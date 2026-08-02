"""
Item image business logic (M4) — thin wrapper over `services.image_upload`.

Fase 0b: the R2 plumbing (signing, HEAD verification, best-effort delete,
content-type/size caps) lives in `services.image_upload` now so promo banners
(P4) and restaurant logos (P6) reuse it. This file keeps the item-specific
bits: loading the `Item` via `services.item._get_item`, the
`"items/{rid}/{iid}/"` object key prefix, and the `Item.image_url`
persistence on confirm/delete — none of which the generic service can know
about.
"""
import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.schemas.item import (
    ItemImageConfirmRequest,
    ItemImageUploadRequest,
    ItemImageUploadResponse,
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
    data: ItemImageUploadRequest,
    session: AsyncSession,
) -> ItemImageUploadResponse:
    """Validate the request and sign a presigned PUT URL for the item's image."""
    # Loads the item (404 item_not_found) — the only item-specific bit here.
    await _get_item(restaurant_id, subcategory_id, item_id, session)

    prefix = _item_image_prefix(restaurant_id, item_id)
    upload_url, object_key, expires_in = await image_upload.sign_upload(
        data.content_type, data.file_size, prefix
    )
    return ItemImageUploadResponse(
        upload_url=upload_url,
        object_key=object_key,
        expires_in=expires_in,
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

    expected_prefix = _item_image_prefix(restaurant_id, item_id)
    public_url = await image_upload.verify_upload(data.object_key, expected_prefix)

    # Best-effort cleanup of any previous image so we don't orphan objects in R2.
    if item.image_url:
        await image_upload.delete_object_best_effort(
            image_upload.object_key_from_url(item.image_url)
        )

    item.image_url = public_url
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

    await image_upload.delete_object_best_effort(
        image_upload.object_key_from_url(item.image_url)
    )
    item.image_url = None
    await session.commit()