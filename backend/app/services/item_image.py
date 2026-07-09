"""
Item image business logic (M4).

Coordinates R2 storage (via `app.services.storage`) with `Item.image_url`
persistence: signing upload URLs, confirming uploads server-side via HEAD,
and deleting images. Storage failures on any delete path are best-effort —
logged and swallowed so they never block a DB operation (RNF-04).
"""
import logging
import uuid

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.item import Item
from app.schemas.item import (
    ItemImageConfirmRequest,
    ItemImageUploadRequest,
    ItemImageUploadResponse,
)
from app.services import storage
from app.services.item import _get_item

logger = logging.getLogger(__name__)

# Allowed content types mapped to the file extension used in the object key.
ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MiB
UPLOAD_URL_EXPIRES_IN = storage.UPLOAD_URL_EXPIRES_IN


def _object_key_from_url(image_url: str) -> str:
    """Recover the R2 object key from a stored public image URL."""
    prefix = f"{settings.R2_PUBLIC_URL}/"
    if image_url.startswith(prefix):
        return image_url[len(prefix):]
    return image_url


async def _delete_object_best_effort(object_key: str) -> None:
    """Delete an object from R2, swallowing (and logging) storage failures so
    the caller's DB operation is never blocked by a transient R2 error."""
    try:
        await storage.delete_image_object(object_key)
    except (BotoCoreError, ClientError):
        logger.warning(
            "R2 delete failed for object_key=%s; continuing (best-effort)",
            object_key,
            exc_info=True,
        )


async def create_upload_url(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ItemImageUploadRequest,
    session: AsyncSession,
) -> ItemImageUploadResponse:
    """Validate the request and sign a presigned PUT URL for the item's image."""
    ext = ALLOWED_CONTENT_TYPES.get(data.content_type)
    if ext is None:
        raise HTTPException(status_code=422, detail="unsupported_content_type")
    if data.file_size > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=422, detail="file_too_large")

    await _get_item(restaurant_id, subcategory_id, item_id, session)

    object_key = f"items/{restaurant_id}/{item_id}/{uuid.uuid4()}.{ext}"
    upload_url = await storage.generate_upload_url(object_key, data.content_type)
    return ItemImageUploadResponse(
        upload_url=upload_url,
        object_key=object_key,
        expires_in=UPLOAD_URL_EXPIRES_IN,
    )


async def confirm_upload(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ItemImageConfirmRequest,
    session: AsyncSession,
) -> Item:
    """Verify the uploaded object in R2 and persist its public URL on the item."""
    item = await _get_item(restaurant_id, subcategory_id, item_id, session)

    expected_prefix = f"items/{restaurant_id}/{item_id}/"
    if not data.object_key.startswith(expected_prefix):
        raise HTTPException(status_code=422, detail="object_key_mismatch")

    meta = await storage.head_image_object(data.object_key)
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

    if item.image_url:
        await _delete_object_best_effort(_object_key_from_url(item.image_url))

    item.image_url = f"{settings.R2_PUBLIC_URL}/{data.object_key}"
    await session.commit()
    await session.refresh(item)
    return item


async def delete_image(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    """Remove the item's image from R2 (best-effort) and clear image_url."""
    item = await _get_item(restaurant_id, subcategory_id, item_id, session)
    if not item.image_url:
        raise HTTPException(status_code=404, detail="image_not_found")

    await _delete_object_best_effort(_object_key_from_url(item.image_url))
    item.image_url = None
    await session.commit()
