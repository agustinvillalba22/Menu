"""
Generic R2 image-upload helper (Fase 0b).

Extracted from `app.services.item_image` so every image-bearing feature
(M4 item images, P6 restaurant logos, P4 promo banners) shares one
validation + signing + verification path instead of duplicating the R2
plumbing per feature.

This module is deliberately *not* aware of the owning entity (Item,
Restaurant, Promo): callers pass an `object_key_prefix` that scopes where
in the bucket the object lands (e.g. ``"items/{rid}/{iid}/"``,
``"logos/{rid}/"``). The generic service validates the request, signs a
presigned PUT URL, verifies the upload via HEAD on confirm, and exposes a
best-effort delete helper. Persistence on the owning row stays in the
caller's service, since only it knows which column to touch.

Tests mock `app.services.storage` (the boto3 boundary) — this module only
adds the orchestration layer on top, so existing image tests keep mocking
storage and stay valid without changes.
"""
import logging
import uuid

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException

from app.core.config import settings
from app.services import storage

logger = logging.getLogger(__name__)

# Allowed content types mapped to the file extension used in the object key.
# Shared across item images, promo banners, and restaurant logos — same set,
# same upper bound, so a single test fixture covers them all.
ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MiB
UPLOAD_URL_EXPIRES_IN = storage.UPLOAD_URL_EXPIRES_IN


def object_key_from_url(image_url: str) -> str:
    """Recover the R2 object key from a stored public image URL.

    Public version of the old private `_object_key_from_url` — `item.py`
    needs it on the delete-item path, and other features (P6 logo delete)
    will too. Kept non-async since it's pure string work.
    """
    prefix = f"{settings.R2_PUBLIC_URL}/"
    if image_url.startswith(prefix):
        return image_url[len(prefix):]
    return image_url


async def delete_object_best_effort(object_key: str) -> None:
    """Delete an object from R2, swallowing (and logging) storage failures
    so the caller's DB operation is never blocked by a transient R2 error.

    Public version of the old private `_delete_object_best_effort`. Used by
    `item_image` on replace/delete-image and by `item.delete_item` on the
    delete-item path.
    """
    try:
        await storage.delete_image_object(object_key)
    except (BotoCoreError, ClientError):
        logger.warning(
            "R2 delete failed for object_key=%s; continuing (best-effort)",
            object_key,
            exc_info=True,
        )


async def sign_upload(
    content_type: str,
    file_size: int,
    object_key_prefix: str,
) -> tuple[str, str, int]:
    """Validate the request and sign a presigned PUT URL.

    Returns ``(upload_url, object_key, expires_in)``. ``object_key`` is
    ``{object_key_prefix}{uuid}.{ext}`` — the prefix scopes the object in
    the bucket and is what `verify_upload` later checks against to prevent
    confirming an object that belongs to another owner.
    """
    ext = ALLOWED_CONTENT_TYPES.get(content_type)
    if ext is None:
        raise HTTPException(status_code=422, detail="unsupported_content_type")
    if file_size > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=422, detail="file_too_large")

    object_key = f"{object_key_prefix}{uuid.uuid4()}.{ext}"
    upload_url = await storage.generate_upload_url(object_key, content_type)
    return upload_url, object_key, UPLOAD_URL_EXPIRES_IN


async def verify_upload(object_key: str, expected_prefix: str) -> str:
    """Verify the uploaded object in R2 and return its public URL.

    Raises:
        422 ``object_key_mismatch`` — the object lives outside the caller's
            prefix (cross-owner confirmation attempt).
        422 ``upload_not_found`` — HEAD returned nothing (client never
            actually PUT the object).
        422 ``upload_verification_failed`` — content type/length rejected
            by HEAD.

    The public URL is `{R2_PUBLIC_URL}/{object_key}` — `image_url` on the
    owning row stores this, never the bare object key.
    """
    if not object_key.startswith(expected_prefix):
        raise HTTPException(status_code=422, detail="object_key_mismatch")

    meta = await storage.head_image_object(object_key)
    if meta is None:
        raise HTTPException(status_code=422, detail="upload_not_found")

    content_type = meta.get("content_type")
    content_length = meta.get("content_length")
    if (
        content_type not in ALLOWED_CONTENT_TYPES
        or content_length is None
        or content_length > MAX_IMAGE_BYTES
    ):
        raise HTTPException(status_code=422, detail="upload_verification_failed")

    return f"{settings.R2_PUBLIC_URL}/{object_key}"