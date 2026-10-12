import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.table import Table
from app.schemas.table import TableCreate, TableUpdate


async def create_table(
    restaurant_id: uuid.UUID, data: TableCreate, session: AsyncSession
) -> Table:
    table = Table(restaurant_id=restaurant_id, number=data.number, capacity=data.capacity)
    session.add(table)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="table_number_taken")
    await session.refresh(table)
    return table


async def list_tables(restaurant_id: uuid.UUID, session: AsyncSession) -> list[Table]:
    result = await session.execute(
        select(Table)
        .where(Table.restaurant_id == restaurant_id)
        .order_by(Table.number.asc())
    )
    return list(result.scalars().all())


async def get_table(
    restaurant_id: uuid.UUID, table_id: uuid.UUID, session: AsyncSession
) -> Table:
    result = await session.execute(
        select(Table).where(Table.id == table_id, Table.restaurant_id == restaurant_id)
    )
    table = result.scalar_one_or_none()
    if table is None:
        raise HTTPException(status_code=404, detail="table_not_found")
    return table


async def update_table(
    restaurant_id: uuid.UUID,
    table_id: uuid.UUID,
    data: TableUpdate,
    session: AsyncSession,
) -> Table:
    table = await get_table(restaurant_id, table_id, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(table, field, value)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="table_number_taken")
    await session.refresh(table)
    return table


async def delete_table(
    restaurant_id: uuid.UUID, table_id: uuid.UUID, session: AsyncSession
) -> None:
    table = await get_table(restaurant_id, table_id, session)
    await session.delete(table)
    await session.commit()
