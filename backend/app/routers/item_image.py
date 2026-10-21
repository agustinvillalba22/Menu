"""Item image endpoints (R2-backed): sub-resource of an item.
"""
import uuid

from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.image_upload import (
    ImageConfirmRequest,
    ImageUploadRequest,
    ImageUploadResponse,
)
from app.schemas.item import (
    ItemRead,
)
from app.services.item_image import (
    confirm_upload,
    create_upload_url,
    delete_image,
)
from app.routers.item import ITEMS_PREFIX

router = APIRouter()

_IMAGE_PREFIX = ITEMS_PREFIX + "/{item_id}/image"


@router.post(
    _IMAGE_PREFIX + "/upload-url",
    response_model=ImageUploadResponse,
    status_code=200,
)
async def create_image_upload_url(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ImageUploadRequest,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ImageUploadResponse:
    return await create_upload_url(
        restaurant_id, subcategory_id, item_id, data, session
    )


@router.post(_IMAGE_PREFIX + "/confirm", response_model=ItemRead, status_code=200)
async def confirm_image_upload(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ImageConfirmRequest,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ItemRead:
    item = await confirm_upload(
        restaurant_id, subcategory_id, item_id, data, session
    )
    return ItemRead.model_validate(item)


@router.delete(_IMAGE_PREFIX, status_code=204)
async def delete_image_endpoint(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_image(restaurant_id, subcategory_id, item_id, session)
