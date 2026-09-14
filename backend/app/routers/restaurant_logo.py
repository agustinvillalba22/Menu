"""Router for restaurant logo upload (P6) — Fase 1d.

Mirrors the M4 item-image router shape (upload-url + confirm + DELETE), since
both wrap the same generic R2 service:

  POST   /restaurants/{id}/logo/upload-url
  POST   /restaurants/{id}/logo/confirm
  DELETE /restaurants/{id}/logo

Owner-only: a logo is a brand asset, same role as editing contact info —
editor can view and read the public menu, but flipping the logo is owner
territory. Keeps parity with the style router's PATCH.
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.restaurant import RestaurantRead
from app.services.restaurant import get_user_role
from app.services.restaurant_logo import (
    LogoConfirmRequest,
    LogoUploadRequest,
    LogoUploadResponse,
    confirm_logo_upload,
    create_logo_upload_url,
    delete_logo,
)

router = APIRouter()


def _to_read(restaurant, role: RestaurantRole) -> RestaurantRead:
    return RestaurantRead.model_validate(
        {**{c.name: getattr(restaurant, c.name) for c in restaurant.__table__.columns}, "role": role}
    )


@router.post(
    "/{restaurant_id}/logo/upload-url",
    response_model=LogoUploadResponse,
    status_code=200,
)
async def create_upload_url(
    restaurant_id: uuid.UUID,
    data: LogoUploadRequest,
    _: User = Depends(require_role(RestaurantRole.owner)),
    session: AsyncSession = Depends(get_db),
) -> LogoUploadResponse:
    return await create_logo_upload_url(restaurant_id, data, session)


@router.post(
    "/{restaurant_id}/logo/confirm",
    response_model=RestaurantRead,
    status_code=200,
)
async def confirm_upload(
    restaurant_id: uuid.UUID,
    data: LogoConfirmRequest,
    current_user: User = Depends(require_role(RestaurantRole.owner)),
    session: AsyncSession = Depends(get_db),
) -> RestaurantRead:
    restaurant = await confirm_logo_upload(restaurant_id, data, session)
    role = await get_user_role(restaurant_id, current_user, session)
    return _to_read(restaurant, role)


@router.delete("/{restaurant_id}/logo", status_code=204)
async def delete_logo_endpoint(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.owner)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_logo(restaurant_id, session)