import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item_modifier import ItemModifier
from app.schemas.item_modifier import ItemModifierCreate, ItemModifierUpdate
from app.services.item import _get_item


async def _get_modifier(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    modifier_id: uuid.UUID,
    session: AsyncSession,
) -> ItemModifier:
    """Fetch a modifier, validating the full restaurant->item->modifier chain."""
    await _get_item(restaurant_id, subcategory_id, item_id, session)
    result = await session.execute(
        select(ItemModifier).where(
            ItemModifier.id == modifier_id,
            ItemModifier.item_id == item_id,
        )
    )
    modifier = result.scalar_one_or_none()
    if modifier is None:
        raise HTTPException(status_code=404, detail="modifier_not_found")
    return modifier


async def create_modifier(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ItemModifierCreate,
    session: AsyncSession,
) -> ItemModifier:
    """Create a modifier under an Item owned by the restaurant."""
    await _get_item(restaurant_id, subcategory_id, item_id, session)
    modifier = ItemModifier(
        item_id=item_id,
        name=data.name,
        price_delta=data.price_delta,
        type=data.type,
    )
    session.add(modifier)
    await session.commit()
    await session.refresh(modifier)
    return modifier


async def list_modifiers(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    session: AsyncSession,
) -> list[ItemModifier]:
    """Return an Item's modifiers ordered alphabetically by name."""
    await _get_item(restaurant_id, subcategory_id, item_id, session)
    result = await session.execute(
        select(ItemModifier)
        .where(ItemModifier.item_id == item_id)
        .order_by(ItemModifier.name.asc())
    )
    return list(result.scalars().all())


async def update_modifier(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    modifier_id: uuid.UUID,
    data: ItemModifierUpdate,
    session: AsyncSession,
) -> ItemModifier:
    """Apply a partial update to a modifier owned by the restaurant's item."""
    modifier = await _get_modifier(
        restaurant_id, subcategory_id, item_id, modifier_id, session
    )
    for field, value in data.model_dump(exclude_unset=True).items():
        # name/price_delta/type are NOT NULL columns; an explicit null in the
        # PATCH body is ignored (no-op) rather than triggering an error.
        if value is None:
            continue
        setattr(modifier, field, value)
    await session.commit()
    await session.refresh(modifier)
    return modifier


async def delete_modifier(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    modifier_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    """Delete a modifier owned by the restaurant's item."""
    modifier = await _get_modifier(
        restaurant_id, subcategory_id, item_id, modifier_id, session
    )
    await session.delete(modifier)
    await session.commit()
