"""
Item image business logic — thin wrapper over `services.image_upload`.

The R2 plumbing (signing, HEAD verification, best-effort delete,
content-type/size caps) lives in `services.image_upload` so promo banners
and restaurant logos reuse it. This file keeps the item-specific bits:
loading the `Item` via `services.item._get_item` and the
`"items/{rid}/{iid}/"` object key prefix.
"""
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.schemas.image_upload import (
    ImageConfirmRequest,
    ImageUploadRequest,
    ImageUploadResponse,
)
from app.services import image_upload
from app.services.item import _get_item


def _item_image_prefix(restaurant_id: uuid.UUID, item_id: uuid.UUID) -> str:
    """Object key prefix scoping all images for one item in R2."""
    return f"items/{restaurant_id}/{item_id}/"


async def create_upload_url(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ImageUploadRequest,
    session: AsyncSession,
) -> ImageUploadResponse:
    """Validate the request and sign a presigned PUT URL for the item's image."""
    await _get_item(restaurant_id, subcategory_id, item_id, session)
    return await image_upload.request_upload(data, _item_image_prefix(restaurant_id, item_id))


async def confirm_upload(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ImageConfirmRequest,
    session: AsyncSession,
) -> Item:
    """Verify the uploaded object in R2 and persist its public URL on the item."""
    item = await _get_item(restaurant_id, subcategory_id, item_id, session)
    await image_upload.replace_image(
        session, item, "image_url", data.object_key, _item_image_prefix(restaurant_id, item_id)
    )
    return item


async def delete_image(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    """Remove the item's image from R2 (best-effort) and clear image_url."""
    item = await _get_item(restaurant_id, subcategory_id, item_id, session)
    await image_upload.clear_image(session, item, "image_url", "image_not_found")
