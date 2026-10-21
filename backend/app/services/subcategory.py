import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.menu import Subcategory
from app.schemas.menu import (
    SubcategoryCreate,
    SubcategoryUpdate,
)
from app.services.category import get_category


async def create_subcategory(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    data: SubcategoryCreate,
    session: AsyncSession,
) -> Subcategory:
    """Create a Subcategory under a Category owned by the restaurant."""
    await get_category(restaurant_id, category_id, session)
    subcategory = Subcategory(name=data.name, category_id=category_id)
    session.add(subcategory)
    await session.commit()
    await session.refresh(subcategory)
    return subcategory


async def list_subcategories(
    restaurant_id: uuid.UUID, category_id: uuid.UUID, session: AsyncSession
) -> list[Subcategory]:
    """Return a Category's subcategories ordered alphabetically by name."""
    await get_category(restaurant_id, category_id, session)
    result = await session.execute(
        select(Subcategory)
        .where(Subcategory.category_id == category_id)
        .order_by(Subcategory.name.asc())
    )
    return list(result.scalars().all())


async def get_subcategory(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    session: AsyncSession,
) -> Subcategory:
    """Fetch a Subcategory, ensuring it belongs to the given Category."""
    await get_category(restaurant_id, category_id, session)
    result = await session.execute(
        select(Subcategory).where(
            Subcategory.id == subcategory_id,
            Subcategory.category_id == category_id,
        )
    )
    subcategory = result.scalar_one_or_none()
    if subcategory is None:
        raise HTTPException(status_code=404, detail="subcategory_not_found")
    return subcategory


async def update_subcategory(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    data: SubcategoryUpdate,
    session: AsyncSession,
) -> Subcategory:
    """Rename a Subcategory owned by the restaurant."""
    subcategory = await get_subcategory(
        restaurant_id, category_id, subcategory_id, session
    )
    subcategory.name = data.name
    await session.commit()
    await session.refresh(subcategory)
    return subcategory


async def delete_subcategory(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    """Delete a Subcategory (cascade removes its items)."""
    subcategory = await get_subcategory(
        restaurant_id, category_id, subcategory_id, session
    )
    await session.delete(subcategory)
    await session.commit()
