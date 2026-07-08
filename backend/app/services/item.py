import uuid

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.item import Item, ItemTag
from app.models.menu import Category, Menu, Subcategory
from app.schemas.item import ItemCreate, ItemUpdate


async def _get_subcategory(
    restaurant_id: uuid.UUID, subcategory_id: uuid.UUID, session: AsyncSession
) -> Subcategory:
    """Fetch a Subcategory, ensuring it belongs to the restaurant's menu."""
    result = await session.execute(
        select(Subcategory)
        .join(Category, Subcategory.category_id == Category.id)
        .join(Menu, Category.menu_id == Menu.id)
        .where(
            Subcategory.id == subcategory_id,
            Menu.restaurant_id == restaurant_id,
        )
    )
    subcategory = result.scalar_one_or_none()
    if subcategory is None:
        raise HTTPException(status_code=404, detail="subcategory_not_found")
    return subcategory


async def _get_item(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    session: AsyncSession,
) -> Item:
    """Fetch an Item (with tags), ensuring it belongs to the given subcategory."""
    await _get_subcategory(restaurant_id, subcategory_id, session)
    result = await session.execute(
        select(Item)
        .options(selectinload(Item.tags))
        .where(Item.id == item_id, Item.subcategory_id == subcategory_id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="item_not_found")
    return item


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------


async def create_item(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    data: ItemCreate,
    session: AsyncSession,
) -> Item:
    """Create an Item under a Subcategory owned by the restaurant."""
    await _get_subcategory(restaurant_id, subcategory_id, session)
    item = Item(
        name=data.name,
        description=data.description,
        price=data.price,
        subcategory_id=subcategory_id,
    )
    session.add(item)
    await session.commit()
    return await _get_item(restaurant_id, subcategory_id, item.id, session)


async def list_items(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    session: AsyncSession,
) -> list[Item]:
    """Return a Subcategory's items ordered alphabetically by name."""
    await _get_subcategory(restaurant_id, subcategory_id, session)
    result = await session.execute(
        select(Item)
        .options(selectinload(Item.tags))
        .where(Item.subcategory_id == subcategory_id)
        .order_by(Item.name.asc())
    )
    return list(result.scalars().all())


async def get_item(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    session: AsyncSession,
) -> Item:
    """Fetch a single Item owned by the restaurant's subcategory."""
    return await _get_item(restaurant_id, subcategory_id, item_id, session)


async def update_item(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ItemUpdate,
    session: AsyncSession,
) -> Item:
    """Apply a partial update to an Item owned by the restaurant."""
    item = await _get_item(restaurant_id, subcategory_id, item_id, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        # name/price/description are NOT NULL columns; an explicit null in the
        # PATCH body is ignored (no-op) rather than triggering a 500 IntegrityError.
        if value is None:
            continue
        setattr(item, field, value)
    await session.commit()
    return await _get_item(restaurant_id, subcategory_id, item_id, session)


async def delete_item(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    """Delete an Item (cascade removes its tags)."""
    item = await _get_item(restaurant_id, subcategory_id, item_id, session)
    await session.delete(item)
    await session.commit()


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------


async def add_tag(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    name: str,
    session: AsyncSession,
) -> tuple[ItemTag, bool]:
    """Add a tag to an Item. Idempotent per (item_id, name) — returns the
    existing tag with created=False if one already exists (PA-01).

    "Already exists" is matched case-insensitively and trimmed (M12.2, RF-01):
    adding "Vegano" when the item already has "vegano" is a no-op that
    returns the existing tag, not a new one.
    """
    await _get_item(restaurant_id, subcategory_id, item_id, session)
    normalized = name.strip().lower()
    existing = await session.execute(
        select(ItemTag).where(
            ItemTag.item_id == item_id,
            func.lower(ItemTag.name) == normalized,
        )
    )
    tag = existing.scalar_one_or_none()
    if tag is not None:
        return tag, False
    tag = ItemTag(name=name, item_id=item_id)
    session.add(tag)
    try:
        await session.commit()
    except IntegrityError:
        # Race safety net: another request inserted a matching (item_id, name)
        # between our SELECT and INSERT and won on the uq_item_tag constraint.
        # Roll back and return the now-existing tag as created=False (PA-01).
        await session.rollback()
        existing = await session.execute(
            select(ItemTag).where(
                ItemTag.item_id == item_id,
                func.lower(ItemTag.name) == normalized,
            )
        )
        return existing.scalar_one(), False
    await session.refresh(tag)
    return tag, True


async def remove_tag(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    tag_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    """Remove a tag from an Item. 404 tag_not_found if it does not belong."""
    await _get_item(restaurant_id, subcategory_id, item_id, session)
    result = await session.execute(
        select(ItemTag).where(
            ItemTag.id == tag_id, ItemTag.item_id == item_id
        )
    )
    tag = result.scalar_one_or_none()
    if tag is None:
        raise HTTPException(status_code=404, detail="tag_not_found")
    await session.delete(tag)
    await session.commit()
