import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.menu import Category, Menu, Subcategory
from app.schemas.menu import (
    CategoryCreate,
    CategoryUpdate,
    SubcategoryCreate,
    SubcategoryUpdate,
)


async def _get_default_menu(restaurant_id: uuid.UUID, session: AsyncSession) -> Menu:
    """Return the restaurant's single Menu (auto-created at restaurant creation)."""
    result = await session.execute(
        select(Menu).where(Menu.restaurant_id == restaurant_id)
    )
    return result.scalar_one()


async def list_categories_with_subcategories(
    restaurant_id: uuid.UUID, session: AsyncSession
) -> list[Category]:
    """Return the default Menu's categories with their subcategories eagerly
    loaded. Used by the CSV importer to resolve category/subcategory by name
    in-memory without a query per row."""
    menu = await _get_default_menu(restaurant_id, session)
    result = await session.execute(
        select(Category)
        .options(selectinload(Category.subcategories))
        .where(Category.menu_id == menu.id)
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------


async def create_category(
    restaurant_id: uuid.UUID, data: CategoryCreate, session: AsyncSession
) -> Category:
    """Create a Category on the restaurant's default Menu."""
    menu = await _get_default_menu(restaurant_id, session)
    category = Category(name=data.name, type=data.type, menu_id=menu.id)
    session.add(category)
    await session.commit()
    await session.refresh(category)
    return category


async def list_categories(
    restaurant_id: uuid.UUID, session: AsyncSession
) -> list[Category]:
    """Return the default Menu's categories ordered alphabetically by name."""
    menu = await _get_default_menu(restaurant_id, session)
    result = await session.execute(
        select(Category)
        .where(Category.menu_id == menu.id)
        .order_by(Category.name.asc())
    )
    return list(result.scalars().all())


async def get_category(
    restaurant_id: uuid.UUID, category_id: uuid.UUID, session: AsyncSession
) -> Category:
    """Fetch a Category, ensuring it belongs to the restaurant's default Menu."""
    menu = await _get_default_menu(restaurant_id, session)
    result = await session.execute(
        select(Category).where(
            Category.id == category_id, Category.menu_id == menu.id
        )
    )
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=404, detail="category_not_found")
    return category


async def update_category(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    data: CategoryUpdate,
    session: AsyncSession,
) -> Category:
    """Apply a partial update to a Category owned by the restaurant."""
    category = await get_category(restaurant_id, category_id, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await session.commit()
    await session.refresh(category)
    return category


async def delete_category(
    restaurant_id: uuid.UUID, category_id: uuid.UUID, session: AsyncSession
) -> None:
    """Delete a Category (cascade removes subcategories and items)."""
    category = await get_category(restaurant_id, category_id, session)
    await session.delete(category)
    await session.commit()


# ---------------------------------------------------------------------------
# Subcategories
# ---------------------------------------------------------------------------


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
