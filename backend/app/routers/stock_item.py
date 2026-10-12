import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.stock_item import StockItemCreate, StockItemRead, StockItemUpdate
from app.services.stock_item import (
    create_stock_item,
    delete_stock_item,
    list_stock_items,
    update_stock_item,
)

router = APIRouter()


@router.post("/{restaurant_id}/stock-items", response_model=StockItemRead, status_code=201)
async def create(
    restaurant_id: uuid.UUID,
    data: StockItemCreate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> StockItemRead:
    item = await create_stock_item(restaurant_id, data, session)
    return StockItemRead.model_validate(item)


@router.get("/{restaurant_id}/stock-items", response_model=list[StockItemRead], status_code=200)
async def list_all(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[StockItemRead]:
    items = await list_stock_items(restaurant_id, session)
    return [StockItemRead.model_validate(i) for i in items]


@router.patch(
    "/{restaurant_id}/stock-items/{stock_item_id}", response_model=StockItemRead, status_code=200
)
async def patch(
    restaurant_id: uuid.UUID,
    stock_item_id: uuid.UUID,
    data: StockItemUpdate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> StockItemRead:
    item = await update_stock_item(restaurant_id, stock_item_id, data, session)
    return StockItemRead.model_validate(item)


@router.delete("/{restaurant_id}/stock-items/{stock_item_id}", status_code=204)
async def delete(
    restaurant_id: uuid.UUID,
    stock_item_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_stock_item(restaurant_id, stock_item_id, session)
