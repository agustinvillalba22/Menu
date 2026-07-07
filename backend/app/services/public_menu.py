from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.item import Item
from app.models.menu import Category, Menu, Subcategory
from app.models.restaurant import Restaurant


async def get_public_menu(qr_token: str, session: AsyncSession) -> Restaurant:
    """Resolve a Restaurant by its ``qr_token`` for the anonymous public menu.

    Eager-loads the full read tree in a bounded number of queries (one per
    relationship level via ``selectinload``) to avoid N+1:
    restaurant -> style, and restaurant -> menus -> categories ->
    subcategories -> items -> tags. Alphabetical ordering is applied by the
    caller when building the response.

    Raises 404 ``menu_not_found`` if no restaurant owns the token.
    """
    result = await session.execute(
        select(Restaurant)
        .where(Restaurant.qr_token == qr_token)
        .options(
            selectinload(Restaurant.style),
            selectinload(Restaurant.menus)
            .selectinload(Menu.categories)
            .selectinload(Category.subcategories)
            .selectinload(Subcategory.items)
            .options(
                selectinload(Item.tags),
                selectinload(Item.modifiers),
            ),
        )
    )
    restaurant = result.scalar_one_or_none()
    if restaurant is None:
        raise HTTPException(status_code=404, detail="menu_not_found")
    return restaurant
