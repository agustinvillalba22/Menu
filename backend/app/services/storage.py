"""
R2 (Cloudflare, S3-compatible) object storage client — M4 item images.

boto3 is synchronous, so every network call is dispatched via
`asyncio.to_thread` to avoid blocking the event loop (RNF-02). The binary of
the image never passes through the API: `generate_upload_url` only signs a URL
the client PUTs to directly, and `head_image_object` only reads metadata
(RNF-01).
"""
import asyncio
import logging

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Presigned PUT URL lifetime, in seconds (RF-05).
UPLOAD_URL_EXPIRES_IN = 300

_client = None


def _get_client():
    """Lazily build and cache the S3-compatible client pointed at R2."""
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )
    return _client


def _generate_upload_url(object_key: str, content_type: str) -> str:
    return _get_client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET_NAME,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=UPLOAD_URL_EXPIRES_IN,
    )


async def generate_upload_url(object_key: str, content_type: str) -> str:
    """Sign a presigned PUT URL the client uses to upload the binary to R2."""
    return await asyncio.to_thread(_generate_upload_url, object_key, content_type)


def _head_image_object(object_key: str) -> dict | None:
    try:
        response = _get_client().head_object(
            Bucket=settings.R2_BUCKET_NAME, Key=object_key
        )
    except ClientError as exc:
        # 404 / NoSuchKey means the client never actually uploaded the object.
        error_code = exc.response.get("Error", {}).get("Code")
        if error_code in ("404", "NoSuchKey", "NotFound"):
            return None
        raise
    return {
        "content_type": response.get("ContentType"),
        "content_length": response.get("ContentLength"),
    }


async def head_image_object(object_key: str) -> dict | None:
    """Return the object's real content_type/content_length, or None if absent."""
    return await asyncio.to_thread(_head_image_object, object_key)


def _delete_image_object(object_key: str) -> None:
    _get_client().delete_object(Bucket=settings.R2_BUCKET_NAME, Key=object_key)


async def delete_image_object(object_key: str) -> None:
    """Delete an object from R2. Callers on the delete path treat this as
    best-effort — see `item_image` service (RNF-04)."""
    await asyncio.to_thread(_delete_image_object, object_key)
