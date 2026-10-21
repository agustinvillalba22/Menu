import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock_item import StockItem
from app.models.supplier import Supplier
from app.schemas.stock_item import StockItemCreate, StockItemUpdate
from app.services.crud import apply_patch, get_owned


async def _check_supplier(
    restaurant_id: uuid.UUID, supplier_id: uuid.UUID | None, session: AsyncSession
) -> None:
    if supplier_id is None:
        return
    result = await session.execute(
        select(Supplier.id).where(
            Supplier.id == supplier_id, Supplier.restaurant_id == restaurant_id
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="supplier_not_found")


async def create_stock_item(
    restaurant_id: uuid.UUID, data: StockItemCreate, session: AsyncSession
) -> StockItem:
    await _check_supplier(restaurant_id, data.supplier_id, session)
    item = StockItem(restaurant_id=restaurant_id, **data.model_dump())
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def list_stock_items(restaurant_id: uuid.UUID, session: AsyncSession) -> list[StockItem]:
    result = await session.execute(
        select(StockItem)
        .where(StockItem.restaurant_id == restaurant_id)
        .order_by(StockItem.name.asc())
    )
    return list(result.scalars().all())


async def get_stock_item(
    restaurant_id: uuid.UUID, stock_item_id: uuid.UUID, session: AsyncSession
) -> StockItem:
    return await get_owned(session, StockItem, restaurant_id, stock_item_id, "stock_item_not_found")


async def update_stock_item(
    restaurant_id: uuid.UUID,
    stock_item_id: uuid.UUID,
    data: StockItemUpdate,
    session: AsyncSession,
) -> StockItem:
    item = await get_stock_item(restaurant_id, stock_item_id, session)
    patch = data.model_dump(exclude_unset=True)
    if "supplier_id" in patch:
        await _check_supplier(restaurant_id, patch["supplier_id"], session)
    apply_patch(item, patch)
    await session.commit()
    await session.refresh(item)
    return item


async def delete_stock_item(
    restaurant_id: uuid.UUID, stock_item_id: uuid.UUID, session: AsyncSession
) -> None:
    item = await get_stock_item(restaurant_id, stock_item_id, session)
    await session.delete(item)
    await session.commit()
