"""
Tests for Fase 2b (P2) — multi-menu auto-switching.

Covers ``resolve_active_menu`` (the flag-off / in-window / fallback /
weekday-mask / overnight / restaurant-tz matrix) and the two integration
points that consume it: ``GET /menu/{qr_token}`` (which menu is rendered)
and ``POST /menu/{qr_token}/orders`` (which menu_id is stamped on the Order).

Also covers the ``_get_default_menu`` rewrite: is_default preference with a
first-row fallback instead of the pre-P2 ``scalar_one``.

freezegun freezes the wall clock; restaurants pin ``timezone='UTC'`` (except
the tz test) so the settings.DEFAULT_TIMEZONE fallback never leaks in.
2026-09-14 is a Monday (weekday 0) — every freeze in this file is anchored
there so weekday_mask assertions are stable.
"""
import uuid
from datetime import time

import pytest
from freezegun import freeze_time
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.item import Item
from app.models.menu import Category, Menu, Subcategory
from app.models.order import Order
from app.models.restaurant import Restaurant
from app.services.menu import _get_default_menu, resolve_active_menu

# Monday, 2026-09-14 — weekday 0 in every frozen instant below.
_MON = "2026-09-14"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def as_user(client: AsyncClient, email: str = "owner@example.com") -> dict:
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "full_name": "Owner"},
    )
    token = res.json()["access_token"]
    client.cookies.clear()
    return {"Authorization": f"Bearer {token}"}


async def make_restaurant(client: AsyncClient, headers: dict) -> dict:
    res = await client.post("/restaurants", json={"name": "My Bar"}, headers=headers)
    return res.json()


async def make_day_category(client: AsyncClient, headers: dict, rid: str) -> None:
    """One category on the default menu, so the public payload is non-empty."""
    res = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": "Day Cat", "type": "food"},
        headers=headers,
    )
    cid = res.json()["id"]
    await client.post(
        f"/restaurants/{rid}/categories/{cid}/subcategories",
        json={"name": "Day Sub"},
        headers=headers,
    )


async def add_night_menu(
    db_session: AsyncSession,
    rid: str,
    *,
    start: time = time(11, 0),
    end: time | None = time(15, 0),
    weekday_mask: int | None = None,
    tz: str = "UTC",
) -> uuid.UUID:
    """Insert a scheduled 'Menú Nocturno' (with one category) + pin the tz.

    Returns the nocturno menu id. Commits so the API-facing sessions see it.
    """
    result = await db_session.execute(
        select(Restaurant).where(Restaurant.id == uuid.UUID(rid))
    )
    restaurant = result.scalar_one()
    restaurant.timezone = tz

    menu = Menu(
        id=uuid.uuid4(),
        name="Menú Nocturno",
        restaurant_id=restaurant.id,
        is_default=False,
        start_time=start,
        end_time=end,
        weekday_mask=weekday_mask,
    )
    # Explicit ids (same pattern as import_csv.py) so the FKs are available
    # in-memory before any flush.
    category = Category(
        id=uuid.uuid4(), name="Night Cat", menu_id=menu.id, type="food"
    )
    subcategory = Subcategory(
        id=uuid.uuid4(), name="Night Sub", category_id=category.id
    )
    db_session.add_all([menu, category, subcategory])
    db_session.add(
        Item(
            name="Nachos",
            description="",
            price="5.00",
            subcategory_id=subcategory.id,
        )
    )
    await db_session.commit()
    return menu.id


async def public_category_names(client: AsyncClient, qr: str) -> set[str]:
    res = await client.get(f"/menu/{qr}")
    assert res.status_code == 200, res.text
    return {c["name"] for c in res.json()["categories"]}


def _flag_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "MENU_SCHEDULING_ENABLED", True)


# ---------------------------------------------------------------------------
# resolve_active_menu — flag matrix
# ---------------------------------------------------------------------------


async def test_flag_off_ignores_scheduled_menu(
    client: AsyncClient, db_session: AsyncSession
):
    """Flag off (default): a fully-matching scheduled menu is NOT served."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await make_day_category(client, headers, rid)
    await add_night_menu(db_session, rid)

    with freeze_time(f"{_MON} 12:00:00"):
        assert await public_category_names(client, qr) == {"Day Cat"}


async def test_flag_on_serves_scheduled_menu_in_window(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await make_day_category(client, headers, rid)
    await add_night_menu(db_session, rid)
    _flag_on(monkeypatch)

    with freeze_time(f"{_MON} 12:00:00"):
        assert await public_category_names(client, qr) == {"Night Cat"}


async def test_flag_on_falls_back_when_out_of_window(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await make_day_category(client, headers, rid)
    await add_night_menu(db_session, rid)
    _flag_on(monkeypatch)

    with freeze_time(f"{_MON} 16:00:00"):
        assert await public_category_names(client, qr) == {"Day Cat"}


async def test_flag_on_open_ended_window(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """end_time null means active from start_time onwards, no upper bound."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await make_day_category(client, headers, rid)
    await add_night_menu(db_session, rid, start=time(11, 0), end=None)
    _flag_on(monkeypatch)

    with freeze_time(f"{_MON} 23:30:00"):
        assert await public_category_names(client, qr) == {"Night Cat"}


async def test_flag_on_weekday_mask_filters(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """Window matches but today's bit is unset -> default fallback."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await make_day_category(client, headers, rid)
    # bit 5 = Saturday only; every freeze below is Monday.
    await add_night_menu(db_session, rid, weekday_mask=1 << 5)
    _flag_on(monkeypatch)

    with freeze_time(f"{_MON} 12:00:00"):
        assert await public_category_names(client, qr) == {"Day Cat"}


async def test_flag_on_weekday_mask_allows_when_bit_set(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await make_day_category(client, headers, rid)
    await add_night_menu(db_session, rid, weekday_mask=1 << 0)  # Monday
    _flag_on(monkeypatch)

    with freeze_time(f"{_MON} 12:00:00"):
        assert await public_category_names(client, qr) == {"Night Cat"}


async def test_flag_on_overnight_window_wraps_midnight(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """21:00 -> 02:00 wraps: active at 23:30 and at 01:30 (same weekday's
    bit), inactive at 03:00. The post-midnight tail checks the *current*
    weekday's bit — documented behavior, owners set both days' bits."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await make_day_category(client, headers, rid)
    await add_night_menu(
        db_session, rid, start=time(21, 0), end=time(2, 0), weekday_mask=1 << 0
    )
    _flag_on(monkeypatch)

    with freeze_time(f"{_MON} 23:30:00"):
        assert await public_category_names(client, qr) == {"Night Cat"}
    with freeze_time(f"{_MON} 01:30:00"):
        assert await public_category_names(client, qr) == {"Night Cat"}
    with freeze_time(f"{_MON} 03:00:00"):
        assert await public_category_names(client, qr) == {"Day Cat"}


async def test_flag_on_uses_restaurant_timezone(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """The window is evaluated in the restaurant's tz, not the server's.

    Frozen at 02:30 UTC Monday = 23:30 Sunday in Buenos Aires (UTC-3): the
    Sunday-bit nocturne is active even though the server clock says Monday.
    """
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await make_day_category(client, headers, rid)
    await add_night_menu(
        db_session,
        rid,
        start=time(21, 0),
        end=time(23, 45),
        weekday_mask=1 << 6,  # Sunday
        tz="America/Argentina/Buenos_Aires",
    )
    _flag_on(monkeypatch)

    with freeze_time(f"{_MON}T02:30:00Z"):
        assert await public_category_names(client, qr) == {"Night Cat"}


async def test_flag_on_without_scheduled_menus_serves_default(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """Flag on but every menu lacks start_time -> default (back-compat)."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await make_day_category(client, headers, rid)
    _flag_on(monkeypatch)

    with freeze_time(f"{_MON} 12:00:00"):
        assert await public_category_names(client, qr) == {"Day Cat"}


# ---------------------------------------------------------------------------
# Integration: orders stamp the active menu_id
# ---------------------------------------------------------------------------


async def test_order_stamps_active_menu_id(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    night_menu_id = await add_night_menu(db_session, rid)
    _flag_on(monkeypatch)

    # Enable orders (owner PATCH) and fetch the nocturne item id.
    await client.patch(
        f"/restaurants/{rid}",
        json={"name": "My Bar", "orders_enabled": True},
        headers=headers,
    )
    result = await db_session.execute(select(Item).where(Item.name == "Nachos"))
    nachos_id = result.scalar_one().id

    client.cookies.clear()
    with freeze_time(f"{_MON} 12:00:00"):
        res = await client.post(
            f"/menu/{qr}/orders",
            json={
                "customer_name": "Ana",
                "order_type": "mesa",
                "items": [{"item_id": str(nachos_id), "quantity": 1}],
            },
        )
    assert res.status_code == 201, res.text

    result = await db_session.execute(
        select(Order).where(Order.id == uuid.UUID(res.json()["id"]))
    )
    order = result.scalar_one()
    assert order.menu_id == night_menu_id


def test_resolve_active_menu_none_when_no_menus():
    """Pure unit branch: a restaurant with no menus resolves to None (the
    public response renders empty categories, orders stamp menu_id null)."""
    restaurant = Restaurant(name="R", slug="r4", qr_token="t4", timezone="UTC")
    restaurant.menus = []
    assert resolve_active_menu(restaurant) is None


# ---------------------------------------------------------------------------
# _get_default_menu — is_default preference + fallback
# ---------------------------------------------------------------------------


async def test_get_default_menu_prefers_is_default(db_session: AsyncSession):
    restaurant = Restaurant(name="R", slug="r", qr_token="t1", timezone="UTC")
    db_session.add(restaurant)
    await db_session.flush()
    a = Menu(name="A Menu", restaurant_id=restaurant.id, is_default=False)
    b = Menu(name="B Menu", restaurant_id=restaurant.id, is_default=True)
    db_session.add_all([a, b])
    await db_session.commit()

    menu = await _get_default_menu(restaurant.id, db_session)
    assert menu.id == b.id


async def test_get_default_menu_falls_back_to_first_by_name(
    db_session: AsyncSession,
):
    """No is_default menu (pre-0009 rows): any menu keeps working instead of
    the pre-P2 scalar_one crash."""
    restaurant = Restaurant(name="R", slug="r2", qr_token="t2", timezone="UTC")
    db_session.add(restaurant)
    await db_session.flush()
    db_session.add_all(
        [
            Menu(name="Zeta", restaurant_id=restaurant.id, is_default=False),
            Menu(name="Alfa", restaurant_id=restaurant.id, is_default=False),
        ]
    )
    await db_session.commit()

    menu = await _get_default_menu(restaurant.id, db_session)
    assert menu.name == "Alfa"


async def test_get_default_menu_404_when_restaurant_has_no_menus(
    db_session: AsyncSession,
):
    from fastapi import HTTPException

    restaurant = Restaurant(name="R", slug="r3", qr_token="t3", timezone="UTC")
    db_session.add(restaurant)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await _get_default_menu(restaurant.id, db_session)
    assert exc_info.value.status_code == 404
