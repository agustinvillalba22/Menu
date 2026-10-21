import uuid

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.menu import Category, Menu
from app.schemas.menu import (
    MenuCreate,
    MenuRead,
    MenuUpdate,
    validate_schedule,
)
from app.services.menu_scheduling import _get_default_menu


async def _resolve_menu(
    restaurant_id: uuid.UUID, menu_id: uuid.UUID | None, session: AsyncSession
) -> Menu:
    """The explicit menu of the restaurant, or the default one if ``None``.

    An explicit ``menu_id`` that doesn't belong to ``restaurant_id`` is a
    404 ``menu_not_found`` (existence is never leaked across restaurants).
    """
    if menu_id is None:
        return await _get_default_menu(restaurant_id, session)
    return await get_menu_row(restaurant_id, menu_id, session)


def _categories_count_expr():
    """Correlated scalar subquery: categories of the outer ``Menu`` row."""
    return (
        select(func.count(Category.id))
        .where(Category.menu_id == Menu.id)
        .correlate(Menu)
        .scalar_subquery()
    )


def _to_read(menu: Menu, categories_count: int) -> MenuRead:
    return MenuRead(
        id=menu.id,
        name=menu.name,
        is_default=menu.is_default,
        start_time=menu.start_time,
        end_time=menu.end_time,
        weekday_mask=menu.weekday_mask,
        categories_count=categories_count,
    )


async def get_menu_row(
    restaurant_id: uuid.UUID, menu_id: uuid.UUID, session: AsyncSession
) -> Menu:
    """Fetch a Menu scoped to the restaurant or 404 ``menu_not_found``."""
    result = await session.execute(
        select(Menu).where(Menu.id == menu_id, Menu.restaurant_id == restaurant_id)
    )
    menu = result.scalar_one_or_none()
    if menu is None:
        raise HTTPException(status_code=404, detail="menu_not_found")
    return menu


async def _read_one(
    restaurant_id: uuid.UUID, menu_id: uuid.UUID, session: AsyncSession
) -> MenuRead:
    result = await session.execute(
        select(Menu, _categories_count_expr()).where(
            Menu.id == menu_id, Menu.restaurant_id == restaurant_id
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="menu_not_found")
    return _to_read(row[0], row[1])


def _check_schedule(start, end) -> None:
    try:
        validate_schedule(start, end)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


async def _assert_name_free(
    restaurant_id: uuid.UUID,
    name: str,
    session: AsyncSession,
    exclude_id: uuid.UUID | None = None,
) -> None:
    stmt = select(Menu.id).where(
        Menu.restaurant_id == restaurant_id,
        func.lower(Menu.name) == name.lower(),
    )
    if exclude_id is not None:
        stmt = stmt.where(Menu.id != exclude_id)
    if (await session.execute(stmt)).first() is not None:
        raise HTTPException(status_code=409, detail="menu_name_taken")


async def _commit_menu(session: AsyncSession) -> None:
    """Commit; a lost race on the unique name index maps to 409."""
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="menu_name_taken") from exc


async def _unset_other_defaults(
    restaurant_id: uuid.UUID, keep_id: uuid.UUID, session: AsyncSession
) -> None:
    await session.execute(
        update(Menu)
        .where(Menu.restaurant_id == restaurant_id, Menu.id != keep_id)
        .values(is_default=False)
    )


async def list_menus(restaurant_id: uuid.UUID, session: AsyncSession) -> list[MenuRead]:
    """All menus of the restaurant ordered by name, with ``categories_count``
    computed by a single query (correlated subquery, no N+1)."""
    result = await session.execute(
        select(Menu, _categories_count_expr())
        .where(Menu.restaurant_id == restaurant_id)
        .order_by(Menu.name.asc(), Menu.id.asc())
    )
    return [_to_read(menu, count) for menu, count in result.all()]


async def get_menu(
    restaurant_id: uuid.UUID, menu_id: uuid.UUID, session: AsyncSession
) -> MenuRead:
    return await _read_one(restaurant_id, menu_id, session)


async def create_menu(
    restaurant_id: uuid.UUID, data: MenuCreate, session: AsyncSession
) -> MenuRead:
    """Create a Menu; ``is_default=True`` demotes the previous default in the
    same transaction. Without it the existing default is never touched."""
    _check_schedule(data.start_time, data.end_time)
    await _assert_name_free(restaurant_id, data.name, session)
    menu = Menu(
        id=uuid.uuid4(),
        name=data.name,
        restaurant_id=restaurant_id,
        is_default=data.is_default,
        start_time=data.start_time,
        end_time=data.end_time,
        weekday_mask=data.weekday_mask,
    )
    session.add(menu)
    if data.is_default:
        await session.flush()
        await _unset_other_defaults(restaurant_id, menu.id, session)
    await _commit_menu(session)
    return await _read_one(restaurant_id, menu.id, session)


async def update_menu(
    restaurant_id: uuid.UUID,
    menu_id: uuid.UUID,
    data: MenuUpdate,
    session: AsyncSession,
) -> MenuRead:
    """Partial update; ``model_fields_set`` tells "not sent" from explicit null."""
    menu = await get_menu_row(restaurant_id, menu_id, session)
    sent = data.model_fields_set

    if "is_default" in sent and data.is_default is False and menu.is_default:
        raise HTTPException(status_code=409, detail="cannot_unset_default")
    if "name" in sent and data.name is not None:
        await _assert_name_free(restaurant_id, data.name, session, exclude_id=menu.id)
        menu.name = data.name

    start = data.start_time if "start_time" in sent else menu.start_time
    end = data.end_time if "end_time" in sent else menu.end_time
    _check_schedule(start, end)
    menu.start_time, menu.end_time = start, end
    if "weekday_mask" in sent:
        menu.weekday_mask = data.weekday_mask

    if data.is_default is True and not menu.is_default:
        menu.is_default = True
        await _unset_other_defaults(restaurant_id, menu.id, session)
    await _commit_menu(session)
    return await _read_one(restaurant_id, menu.id, session)


async def delete_menu(
    restaurant_id: uuid.UUID, menu_id: uuid.UUID, session: AsyncSession
) -> None:
    """Delete a Menu (cascades categories/subcategories/items).

    The last menu cannot be deleted; deleting the default promotes the first
    remaining menu by name — all in one transaction.
    """
    menu = await get_menu_row(restaurant_id, menu_id, session)
    others = (
        await session.execute(
            select(Menu)
            .where(Menu.restaurant_id == restaurant_id, Menu.id != menu.id)
            .order_by(Menu.name.asc(), Menu.id.asc())
            .with_for_update()
        )
    ).scalars().all()
    if not others:
        raise HTTPException(status_code=409, detail="cannot_delete_last_menu")
    if menu.is_default:
        others[0].is_default = True
    await session.delete(menu)
    await session.commit()
