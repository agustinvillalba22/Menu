import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.menu import Category, Menu
from app.schemas.menu import (
    CategoryCreate,
    CategoryUpdate,
)
from app.services.crud import apply_patch
from app.services.menu import _resolve_menu, get_menu_row


async def list_categories_with_subcategories(
    restaurant_id: uuid.UUID,
    session: AsyncSession,
    menu_id: uuid.UUID | None = None,
) -> list[Category]:
    """Return a Menu's categories with their subcategories eagerly loaded.

    ``menu_id`` defaults to the restaurant's default Menu (used by the CSV
    importer to resolve category/subcategory by name in-memory)."""
    menu = await _resolve_menu(restaurant_id, menu_id, session)
    result = await session.execute(
        select(Category)
        .options(selectinload(Category.subcategories))
        .where(Category.menu_id == menu.id)
        .order_by(Category.name.asc())
    )
    categories = list(result.scalars().all())
    for category in categories:
        category.subcategories.sort(key=lambda s: s.name)
    return categories




async def create_category(
    restaurant_id: uuid.UUID,
    data: CategoryCreate,
    session: AsyncSession,
    menu_id: uuid.UUID | None = None,
) -> Category:
    """Create a Category on ``menu_id`` (default: the restaurant's default Menu)."""
    menu = await _resolve_menu(restaurant_id, menu_id, session)
    category = Category(
        name=data.name,
        type=data.type,
        icon=data.icon,
        menu_id=menu.id,
    )
    session.add(category)
    await session.commit()
    await session.refresh(category)
    return category


async def list_categories(
    restaurant_id: uuid.UUID,
    session: AsyncSession,
    menu_id: uuid.UUID | None = None,
) -> list[Category]:
    """Return a Menu's categories (default Menu if ``menu_id`` is None) by name."""
    menu = await _resolve_menu(restaurant_id, menu_id, session)
    result = await session.execute(
        select(Category)
        .where(Category.menu_id == menu.id)
        .order_by(Category.name.asc())
    )
    return list(result.scalars().all())


async def get_category(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    session: AsyncSession,
    menu_id: uuid.UUID | None = None,
) -> Category:
    """Fetch a Category, ensuring it belongs to the restaurant.

    Membership is checked via ``Category -> Menu.restaurant_id``, so a
    category of ANY of the restaurant's menus is reachable. When ``menu_id``
    is given (v2 routes) the menu must belong to the restaurant
    (``menu_not_found``) and the category to that menu (``category_not_found``).
    """
    if menu_id is not None:
        await get_menu_row(restaurant_id, menu_id, session)
    stmt = (
        select(Category)
        .join(Menu, Category.menu_id == Menu.id)
        .where(Category.id == category_id, Menu.restaurant_id == restaurant_id)
    )
    if menu_id is not None:
        stmt = stmt.where(Category.menu_id == menu_id)
    category = (await session.execute(stmt)).scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=404, detail="category_not_found")
    return category


async def update_category(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    data: CategoryUpdate,
    session: AsyncSession,
    menu_id: uuid.UUID | None = None,
) -> Category:
    """Apply a partial update to a Category owned by the restaurant."""
    category = await get_category(restaurant_id, category_id, session, menu_id)
    apply_patch(category, data.model_dump(exclude_unset=True))
    await session.commit()
    await session.refresh(category)
    return category


async def delete_category(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    session: AsyncSession,
    menu_id: uuid.UUID | None = None,
) -> None:
    """Delete a Category (cascade removes subcategories and items)."""
    category = await get_category(restaurant_id, category_id, session, menu_id)
    await session.delete(category)
    await session.commit()
