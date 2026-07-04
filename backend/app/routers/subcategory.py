import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.menu import (
    SubcategoryCreate,
    SubcategoryRead,
    SubcategoryUpdate,
)
from app.services.menu import (
    create_subcategory,
    delete_subcategory,
    get_subcategory,
    list_subcategories,
    update_subcategory,
)

router = APIRouter()

_PREFIX = "/{restaurant_id}/categories/{category_id}/subcategories"


@router.post(_PREFIX, response_model=SubcategoryRead, status_code=201)
async def create(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    data: SubcategoryCreate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> SubcategoryRead:
    subcategory = await create_subcategory(
        restaurant_id, category_id, data, session
    )
    return SubcategoryRead.model_validate(subcategory)


@router.get(_PREFIX, response_model=list[SubcategoryRead], status_code=200)
async def list_all(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[SubcategoryRead]:
    subcategories = await list_subcategories(restaurant_id, category_id, session)
    return [SubcategoryRead.model_validate(s) for s in subcategories]


@router.get(
    _PREFIX + "/{subcategory_id}",
    response_model=SubcategoryRead,
    status_code=200,
)
async def get_one(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> SubcategoryRead:
    subcategory = await get_subcategory(
        restaurant_id, category_id, subcategory_id, session
    )
    return SubcategoryRead.model_validate(subcategory)


@router.patch(
    _PREFIX + "/{subcategory_id}",
    response_model=SubcategoryRead,
    status_code=200,
)
async def patch(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    data: SubcategoryUpdate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> SubcategoryRead:
    subcategory = await update_subcategory(
        restaurant_id, category_id, subcategory_id, data, session
    )
    return SubcategoryRead.model_validate(subcategory)


@router.delete(_PREFIX + "/{subcategory_id}", status_code=204)
async def delete(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_subcategory(restaurant_id, category_id, subcategory_id, session)
