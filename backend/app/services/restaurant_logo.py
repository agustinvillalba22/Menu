"""Restaurant logo upload.

Thin wrapper over ``services.image_upload`` that owns the logo-specific bits:
the ``"logos/{restaurant_id}/"`` object key prefix and the
``Restaurant.logo_url`` column.

Same PUT-url + HEAD-confirm + DELETE flow as item images: the binary never
passes through the API, the client PUTs straight to R2 with a presigned URL,
then confirms against the backend so we can record the public URL and verify
content type/size server-side.
"""
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import Restaurant
from app.schemas.image_upload import (
    ImageConfirmRequest,
    ImageUploadRequest,
    ImageUploadResponse,
)
from app.services import image_upload
from app.services.restaurant import get_restaurant


def _logo_prefix(restaurant_id: uuid.UUID) -> str:
    return f"logos/{restaurant_id}/"


async def create_logo_upload_url(
    restaurant_id: uuid.UUID,
    data: ImageUploadRequest,
    session: AsyncSession,
) -> ImageUploadResponse:
    """Validate content type/size and sign a presigned PUT URL for the logo."""
    # require_role upstream already enforces ownership; this also checks the row
    # exists so a stale role record can't sign a URL for a ghost restaurant.
    await get_restaurant(restaurant_id, session)
    return await image_upload.request_upload(data, _logo_prefix(restaurant_id))


async def confirm_logo_upload(
    restaurant_id: uuid.UUID,
    data: ImageConfirmRequest,
    session: AsyncSession,
) -> Restaurant:
    """Verify the uploaded object in R2 and persist its public URL on the row."""
    restaurant = await get_restaurant(restaurant_id, session)
    await image_upload.replace_image(
        session, restaurant, "logo_url", data.object_key, _logo_prefix(restaurant_id)
    )
    return restaurant


async def delete_logo(restaurant_id: uuid.UUID, session: AsyncSession) -> None:
    """Remove the logo from R2 (best-effort) and clear logo_url."""
    restaurant = await get_restaurant(restaurant_id, session)
    await image_upload.clear_image(session, restaurant, "logo_url", "logo_not_found")
