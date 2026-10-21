import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.menu import Menu
from app.models.restaurant import Restaurant
from app.services.datetime import now_in


async def _get_default_menu(restaurant_id: uuid.UUID, session: AsyncSession) -> Menu:
    """Return the restaurant's default Menu, with a first-row fallback.

    Prefers ``is_default=True``. Falls back to any menu of the
    restaurant — pre-0009 rows (or a misconfigured default flag) keep working
    instead of crashing with ``scalar_one``'s MultipleResultsFound, which the
    previous implementation raised as soon as a second menu existed.
    """
    result = await session.execute(
        select(Menu)
        .where(Menu.restaurant_id == restaurant_id, Menu.is_default.is_(True))
    )
    menu = result.scalars().first()
    if menu is not None:
        return menu
    result = await session.execute(
        select(Menu).where(Menu.restaurant_id == restaurant_id).order_by(Menu.name)
    )
    menu = result.scalars().first()
    if menu is None:
        raise HTTPException(status_code=404, detail="menu_not_found")
    return menu


def _default_or_first(menus: list[Menu]) -> Menu | None:
    """Pick the ``is_default`` menu, falling back to the first by name.

    The name sort is a deterministic tie-break when several menus claim
    ``is_default`` (the menu CRUD enforces exactly-one, this is a
    read-side safety net).
    """
    if not menus:
        return None
    ordered = sorted(menus, key=lambda m: (not m.is_default, m.name))
    return ordered[0]


def _in_time_window(menu: Menu, now: datetime) -> bool:
    """True if ``now``'s time-of-day falls in the menu's activation window.

    ``end_time`` null means open-ended (``start_time <= t``). An overnight
    window (``end_time <= start_time``, e.g. 21:00 → 02:00) wraps around
    midnight: active from ``start_time`` onwards OR before ``end_time``.
    The post-midnight tail is checked against the *current* weekday's bit —
    owners of overnight menus should set the following weekday's bit too
    (documented in the dashboard form, validated nowhere server-side).
    """
    t = now.time()
    start = menu.start_time
    end = menu.end_time
    if end is None:
        return t >= start
    if end > start:
        return start <= t < end
    return t >= start or t < end


def _menu_is_active(menu: Menu, now: datetime) -> bool:
    """True if the scheduled menu is active at ``now`` (window + weekday)."""
    if menu.weekday_mask is not None:
        # bit i (0=Mon..6=Sun) matches datetime.weekday() — no remapping.
        if not (menu.weekday_mask >> now.weekday()) & 1:
            return False
    return _in_time_window(menu, now)


def resolve_active_menu(
    restaurant: Restaurant, now: datetime | None = None
) -> Menu | None:
    """Return the menu the public should see right now.

    Pure/in-memory — works off the eager-loaded ``restaurant.menus`` so the
    public flow pays no extra query:

    - flag off  -> the ``is_default`` menu (legacy behavior, back-compat).
    - flag on   -> among menus with ``start_time`` (i.e. "scheduled"), the
                   first active one at ``now`` in the restaurant's tz;
                   if none matches, the ``is_default`` fallback.

    ``now`` defaults to ``now_in(restaurant.timezone)``; pass it explicitly
    in tests (or via freezegun). Deterministic when several menus overlap:
    ``is_default`` wins, then name order.
    """
    menus = list(restaurant.menus)
    if not menus:
        return None
    if not settings.MENU_SCHEDULING_ENABLED:
        return _default_or_first(menus)
    if now is None:
        now = now_in(restaurant.timezone)
    scheduled = [
        m
        for m in menus
        if m.start_time is not None and _menu_is_active(m, now)
    ]
    if scheduled:
        return _default_or_first(scheduled)
    return _default_or_first(menus)
