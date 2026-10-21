"""Router for promo CRUD + promo image upload.

Mirrors the category router (editor role — a promo banner is marketing
content, same trust level as editing the menu) and the restaurant_logo
router (R2 upload-url + confirm + DELETE shape, scoped per promo):

  POST   /restaurants/{id}/promos
  GET    /restaurants/{id}/promos
  GET    /restaurants/{id}/promos/{promo_id}
  PATCH  /restaurants/{id}/promos/{promo_id}
  DELETE /restaurants/{id}/promos/{promo_id}
  POST   /restaurants/{id}/promos/{promo_id}/image/upload-url
  POST   /restaurants/{id}/promos/{promo_id}/image/confirm
  DELETE /restaurants/{id}/promos/{promo_id}/image

``days_remaining`` is computed here — the ORM row never
carries it, the response shape is the only place the dashboard sees it.
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.promo import Promo
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.image_upload import (
    ImageConfirmRequest,
    ImageUploadRequest,
    ImageUploadResponse,
)
from app.schemas.promo import PromoCreate, PromoRead, PromoUpdate
from app.services.promo import (
    confirm_promo_image_upload,
    create_promo,
    create_promo_image_upload_url,
    days_remaining,
    delete_promo,
    delete_promo_image,
    get_promo,
    list_promos,
    update_promo,
)

router = APIRouter()


def _to_read(promo: Promo) -> PromoRead:
    return PromoRead.model_validate(
        {
            **{c.name: getattr(promo, c.name) for c in promo.__table__.columns},
            "days_remaining": days_remaining(promo),
        }
    )


@router.post("/{restaurant_id}/promos", response_model=PromoRead, status_code=201)
async def create(
    restaurant_id: uuid.UUID,
    data: PromoCreate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> PromoRead:
    promo = await create_promo(restaurant_id, data, session)
    return _to_read(promo)


@router.get("/{restaurant_id}/promos", response_model=list[PromoRead])
async def list_all(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[PromoRead]:
    promos = await list_promos(restaurant_id, session)
    return [_to_read(p) for p in promos]


@router.get("/{restaurant_id}/promos/{promo_id}", response_model=PromoRead)
async def get_one(
    restaurant_id: uuid.UUID,
    promo_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> PromoRead:
    promo = await get_promo(restaurant_id, promo_id, session)
    return _to_read(promo)


@router.patch("/{restaurant_id}/promos/{promo_id}", response_model=PromoRead)
async def patch(
    restaurant_id: uuid.UUID,
    promo_id: uuid.UUID,
    data: PromoUpdate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> PromoRead:
    promo = await update_promo(restaurant_id, promo_id, data, session)
    return _to_read(promo)


@router.delete("/{restaurant_id}/promos/{promo_id}", status_code=204)
async def delete(
    restaurant_id: uuid.UUID,
    promo_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_promo(restaurant_id, promo_id, session)


@router.post(
    "/{restaurant_id}/promos/{promo_id}/image/upload-url",
    response_model=ImageUploadResponse,
)
async def upload_url(
    restaurant_id: uuid.UUID,
    promo_id: uuid.UUID,
    data: ImageUploadRequest,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ImageUploadResponse:
    return await create_promo_image_upload_url(restaurant_id, promo_id, data, session)


@router.post(
    "/{restaurant_id}/promos/{promo_id}/image/confirm",
    response_model=PromoRead,
)
async def confirm_image(
    restaurant_id: uuid.UUID,
    promo_id: uuid.UUID,
    data: ImageConfirmRequest,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> PromoRead:
    promo = await confirm_promo_image_upload(restaurant_id, promo_id, data, session)
    return _to_read(promo)


@router.delete("/{restaurant_id}/promos/{promo_id}/image", status_code=204)
async def delete_image(
    restaurant_id: uuid.UUID,
    promo_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_promo_image(restaurant_id, promo_id, session)
