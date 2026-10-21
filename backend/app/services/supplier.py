import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierUpdate


async def create_supplier(
    restaurant_id: uuid.UUID, data: SupplierCreate, session: AsyncSession
) -> Supplier:
    supplier = Supplier(restaurant_id=restaurant_id, **data.model_dump())
    session.add(supplier)
    await session.commit()
    await session.refresh(supplier)
    return supplier


async def list_suppliers(restaurant_id: uuid.UUID, session: AsyncSession) -> list[Supplier]:
    result = await session.execute(
        select(Supplier)
        .where(Supplier.restaurant_id == restaurant_id)
        .order_by(Supplier.name.asc())
    )
    return list(result.scalars().all())


async def get_supplier(
    restaurant_id: uuid.UUID, supplier_id: uuid.UUID, session: AsyncSession
) -> Supplier:
    result = await session.execute(
        select(Supplier).where(
            Supplier.id == supplier_id, Supplier.restaurant_id == restaurant_id
        )
    )
    supplier = result.scalar_one_or_none()
    if supplier is None:
        raise HTTPException(status_code=404, detail="supplier_not_found")
    return supplier


async def update_supplier(
    restaurant_id: uuid.UUID,
    supplier_id: uuid.UUID,
    data: SupplierUpdate,
    session: AsyncSession,
) -> Supplier:
    supplier = await get_supplier(restaurant_id, supplier_id, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
    await session.commit()
    await session.refresh(supplier)
    return supplier


async def delete_supplier(
    restaurant_id: uuid.UUID, supplier_id: uuid.UUID, session: AsyncSession
) -> None:
    supplier = await get_supplier(restaurant_id, supplier_id, session)
    await session.delete(supplier)
    await session.commit()
