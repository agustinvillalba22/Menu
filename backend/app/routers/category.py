import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.menu import CategoryCreate, CategoryRead, CategoryUpdate
from app.services.menu import (
    create_category,
    delete_category,
    get_category,
    list_categories,
    update_category,
)

router = APIRouter()


@router.post(
    "/{restaurant_id}/categories", response_model=CategoryRead, status_code=201
)
async def create(
    restaurant_id: uuid.UUID,
    data: CategoryCreate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> CategoryRead:
    category = await create_category(restaurant_id, data, session)
    return CategoryRead.model_validate(category)


@router.get(
    "/{restaurant_id}/categories",
    response_model=list[CategoryRead],
    status_code=200,
)
async def list_all(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[CategoryRead]:
    categories = await list_categories(restaurant_id, session)
    return [CategoryRead.model_validate(c) for c in categories]


@router.get(
    "/{restaurant_id}/categories/{category_id}",
    response_model=CategoryRead,
    status_code=200,
)
async def get_one(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> CategoryRead:
    category = await get_category(restaurant_id, category_id, session)
    return CategoryRead.model_validate(category)


@router.patch(
    "/{restaurant_id}/categories/{category_id}",
    response_model=CategoryRead,
    status_code=200,
)
async def patch(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    data: CategoryUpdate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> CategoryRead:
    category = await update_category(restaurant_id, category_id, data, session)
    return CategoryRead.model_validate(category)


@router.delete(
    "/{restaurant_id}/categories/{category_id}", status_code=204
)
async def delete(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_category(restaurant_id, category_id, session)
