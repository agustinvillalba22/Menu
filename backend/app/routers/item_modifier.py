"""Item modifier endpoints: sub-resource of an item.
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
from app.schemas.item_modifier import (
    ItemModifierCreate,
    ItemModifierRead,
    ItemModifierUpdate,
)
from app.services.item_modifier import (
    create_modifier,
    delete_modifier,
    list_modifiers,
    update_modifier,
)
from app.routers.item import ITEMS_PREFIX

router = APIRouter()

_MODIFIERS_PREFIX = ITEMS_PREFIX + "/{item_id}/modifiers"


@router.post(_MODIFIERS_PREFIX, response_model=ItemModifierRead, status_code=201)
async def add_item_modifier(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ItemModifierCreate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ItemModifierRead:
    modifier = await create_modifier(
        restaurant_id, subcategory_id, item_id, data, session
    )
    return ItemModifierRead.model_validate(modifier)


@router.get(
    _MODIFIERS_PREFIX, response_model=list[ItemModifierRead], status_code=200
)
async def list_item_modifiers(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[ItemModifierRead]:
    modifiers = await list_modifiers(restaurant_id, subcategory_id, item_id, session)
    return [ItemModifierRead.model_validate(m) for m in modifiers]


@router.patch(
    _MODIFIERS_PREFIX + "/{modifier_id}",
    response_model=ItemModifierRead,
    status_code=200,
)
async def patch_item_modifier(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    modifier_id: uuid.UUID,
    data: ItemModifierUpdate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ItemModifierRead:
    modifier = await update_modifier(
        restaurant_id, subcategory_id, item_id, modifier_id, data, session
    )
    return ItemModifierRead.model_validate(modifier)


@router.delete(_MODIFIERS_PREFIX + "/{modifier_id}", status_code=204)
async def delete_item_modifier(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    modifier_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_modifier(
        restaurant_id, subcategory_id, item_id, modifier_id, session
    )
