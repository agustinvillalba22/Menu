import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.style import MenuStyle
from app.schemas.style import StyleUpdate


async def get_style(restaurant_id: uuid.UUID, session: AsyncSession) -> MenuStyle:
    """Fetch the restaurant's MenuStyle row.

    A MenuStyle is created together with every restaurant (see
    create_restaurant), so this normally exists. Legacy restaurants created
    before that behaviour won't have one; those surface as a controlled 404
    instead of a 500.
    """
    result = await session.execute(
        select(MenuStyle).where(MenuStyle.restaurant_id == restaurant_id)
    )
    style = result.scalar_one_or_none()
    if style is None:
        raise HTTPException(status_code=404, detail="style_not_found")
    return style


async def update_style(
    restaurant_id: uuid.UUID, data: StyleUpdate, session: AsyncSession
) -> MenuStyle:
    """Apply a partial update to the restaurant's MenuStyle.

    Uses ``exclude_unset=True`` so that an explicit ``null`` (clear the custom
    color) is distinguished from an omitted field (leave the value untouched).
    """
    style = await get_style(restaurant_id, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(style, field, value)
    await session.commit()
    await session.refresh(style)
    return style
