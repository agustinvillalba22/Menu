"""Restaurant logo upload (P6) — Fase 1d.

Thin wrapper over ``services.image_upload`` (Fase 0b) that owns the
item-specific bits the generic service can't know about: the
``"logos/{restaurant_id}/"`` object key prefix and the
``Restaurant.logo_url`` persistence on confirm/delete.

Same PUT-url + HEAD-confirm + DELETE flow as item images (M4): the binary
never passes through the API, the client PUTs straight to R2 with a
presigned URL, then confirms against the backend so we can record the public
URL and verify content type/size server-side.
"""
import uuid

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import Restaurant
from app.services import image_upload
from app.services.restaurant import get_restaurant


class LogoUploadRequest(BaseModel):
    content_type: str
    file_size: int = Field(gt=0)


class LogoUploadResponse(BaseModel):
    upload_url: str
    object_key: str
    expires_in: int


class LogoConfirmRequest(BaseModel):
    object_key: str = Field(min_length=1)


def _logo_prefix(restaurant_id: uuid.UUID) -> str:
    return f"logos/{restaurant_id}/"


async def create_logo_upload_url(
    restaurant_id: uuid.UUID,
    data: LogoUploadRequest,
    session: AsyncSession,
) -> LogoUploadResponse:
    """Validate content type/size and sign a presigned PUT URL for the logo."""
    # Loads the restaurant (404 via require_role upstream already enforces
    # ownership, but we double-check the row exists so a stale role record
    # doesn't let us sign a URL for a ghost restaurant).
    await get_restaurant(restaurant_id, session)

    prefix = _logo_prefix(restaurant_id)
    upload_url, object_key, expires_in = await image_upload.sign_upload(
        data.content_type, data.file_size, prefix
    )
    return LogoUploadResponse(
        upload_url=upload_url,
        object_key=object_key,
        expires_in=expires_in,
    )


async def confirm_logo_upload(
    restaurant_id: uuid.UUID,
    data: LogoConfirmRequest,
    session: AsyncSession,
) -> Restaurant:
    """Verify the uploaded object in R2 and persist its public URL on the row."""
    restaurant = await get_restaurant(restaurant_id, session)
    expected_prefix = _logo_prefix(restaurant_id)
    public_url = await image_upload.verify_upload(data.object_key, expected_prefix)

    # Best-effort cleanup of any previous logo so we don't orphan R2 objects.
    if restaurant.logo_url:
        await image_upload.delete_object_best_effort(
            image_upload.object_key_from_url(restaurant.logo_url)
        )

    restaurant.logo_url = public_url
    await session.commit()
    await session.refresh(restaurant)
    return restaurant


async def delete_logo(
    restaurant_id: uuid.UUID, session: AsyncSession
) -> None:
    """Remove the logo from R2 (best-effort) and clear logo_url."""
    restaurant = await get_restaurant(restaurant_id, session)
    if not restaurant.logo_url:
        raise HTTPException(status_code=404, detail="logo_not_found")

    await image_upload.delete_object_best_effort(
        image_upload.object_key_from_url(restaurant.logo_url)
    )
    restaurant.logo_url = None
    await session.commit()