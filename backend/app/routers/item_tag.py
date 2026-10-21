"""Item tag endpoints: sub-resource of an item.
"""
import uuid

from fastapi import (
    APIRouter,
    Depends,
    Response,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.item import (
    TagCreate,
    TagRead,
)
from app.services.item import (
    add_tag,
    remove_tag,
)
from app.routers.item import ITEMS_PREFIX

router = APIRouter()

_TAGS_PREFIX = ITEMS_PREFIX + "/{item_id}/tags"


@router.post(_TAGS_PREFIX, response_model=TagRead, status_code=201)
async def add_item_tag(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: TagCreate,
    response: Response,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> TagRead:
    tag, created = await add_tag(
        restaurant_id, subcategory_id, item_id, data.name, session
    )
    # PA-01: idempotent — existing tag returns 200, not 201.
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return TagRead.model_validate(tag)


@router.delete(_TAGS_PREFIX + "/{tag_id}", status_code=204)
async def delete_item_tag(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    tag_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await remove_tag(restaurant_id, subcategory_id, item_id, tag_id, session)
