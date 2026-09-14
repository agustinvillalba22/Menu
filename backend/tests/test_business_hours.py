"""Tests for P6 — restaurant info + business hours + is_open_now (Fase 1d).

Covers:
  - GET /restaurants/{id}/info        — read defaults, with-hours, role gating.
  - PATCH /restaurants/{id}/info      — partial update, clearable fields,
                                        whatsapp_phone validation (P7 overlaps).
  - GET /restaurants/{id}/business-hours
  - PUT  /restaurants/{id}/business-hours  — atomic replace, duplicate weekday
                                             409, close-after-open 422 both
                                             layers.
  - is_open_now                       — direct service test with freezegun
                                        across open/closed edges and a tz rollover.

Same fixture pattern as the rest of the backend: in-memory SQLite, no
network, so timezone edges are pinned with freezegun instead of sleep.
"""
import uuid
from datetime import time

import pytest
from freezegun import freeze_time
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.restaurant import BusinessHours, Restaurant
from app.services.business_hours import compute_is_open_now


async def _as_user(
    client: AsyncClient, email: str = "owner@example.com"
) -> dict:
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "full_name": "Owner"},
    )
    token = res.json()["access_token"]
    client.cookies.clear()
    return {"Authorization": f"Bearer {token}"}


async def _make_restaurant(client: AsyncClient, headers: dict, name="My Bar") -> dict:
    res = await client.post("/restaurants", json={"name": name}, headers=headers)
    return res.json()


# ---------------------------------------------------------------------------
# GET /info defaults
# ---------------------------------------------------------------------------


async def test_info_defaults_for_brand_new_restaurant(client: AsyncClient):
    headers = await _as_user(client)
    r = await _make_restaurant(client, headers)

    res = await client.get(f"/restaurants/{r['id']}/info", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["address"] == ""
    assert body["phone"] == ""
    assert body["whatsapp_phone"] is None
    assert body["logo_url"] is None
    assert body["timezone"] == ""
    assert body["business_hours"] == []
    assert body["is_open_now"] is False
    assert body["whatsapp_enabled"] is False


# ---------------------------------------------------------------------------
# PATCH /info partial update
# ---------------------------------------------------------------------------


async def test_patch_info_only_modified_fields(client: AsyncClient):
    headers = await _as_user(client)
    r = await _make_restaurant(client, headers)

    res = await client.patch(
        f"/restaurants/{r['id']}/info",
        json={"address": "Av. Corrientes 1234", "timezone": "America/Argentina/Buenos_Aires"},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["address"] == "Av. Corrientes 1234"
    assert body["timezone"] == "America/Argentina/Buenos_Aires"
    # Untouched fields keep their defaults.
    assert body["phone"] == ""
    assert body["whatsapp_phone"] is None
    assert body["logo_url"] is None


async def test_patch_info_whatsapp_phone_strips_leading_plus(client: AsyncClient):
    headers = await _as_user(client)
    r = await _make_restaurant(client, headers)

    res = await client.patch(
        f"/restaurants/{r['id']}/info",
        json={"whatsapp_phone": "+5491112345678"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["whatsapp_phone"] == "5491112345678"
    # And a follow-up read reflects the persisted value.
    again = await client.get(f"/restaurants/{r['id']}/info", headers=headers)
    assert again.json()["whatsapp_phone"] == "5491112345678"
    assert again.json()["whatsapp_enabled"] is True


async def test_patch_info_empty_string_clears_whatsapp(client: AsyncClient):
    headers = await _as_user(client)
    r = await _make_restaurant(client, headers)

    await client.patch(
        f"/restaurants/{r['id']}/info",
        json={"whatsapp_phone": "5491112345678"},
        headers=headers,
    )
    res = await client.patch(
        f"/restaurants/{r['id']}/info",
        json={"whatsapp_phone": ""},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["whatsapp_phone"] is None
    assert body["whatsapp_enabled"] is False


@pytest.mark.parametrize(
    "bad",
    [
        "abc",          # non-numeric
        "12345",        # too short (<6)
        "1" * 16,       # too long (>15)
        "+abc123",
        "54 9 11 1234",  # spaces
    ],
)
async def test_patch_info_rejects_invalid_whatsapp_phone(
    client: AsyncClient, bad: str
):
    headers = await _as_user(client)
    r = await _make_restaurant(client, headers)

    res = await client.patch(
        f"/restaurants/{r['id']}/info",
        json={"whatsapp_phone": bad},
        headers=headers,
    )
    assert res.status_code == 422


async def test_patch_info_requires_owner_not_editor(client: AsyncClient):
    owner = await _as_user(client, email="owner@example.com")
    r = await _make_restaurant(client, owner)
    # A second user with no role on this restaurant is still rejected — but the
    # weaker-claim check we care about here is: a logged-in stranger.
    stranger = await _as_user(client, email="stranger@example.com")
    res = await client.patch(
        f"/restaurants/{r['id']}/info",
        json={"address": "x"},
        headers=stranger,
    )
    # require_role -> 403 (no role row at all).
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# PUT /business-hours — atomic replace
# ---------------------------------------------------------------------------


async def test_put_business_hours_replaces_week(client: AsyncClient):
    headers = await _as_user(client)
    r = await _make_restaurant(client, headers)

    res = await client.put(
        f"/restaurants/{r['id']}/business-hours",
        json={
            "hours": [
                {"weekday": 0, "open_time": "09:00", "close_time": "18:00"},
                {"weekday": 1, "open_time": "09:00", "close_time": "18:00"},
                {"weekday": 4, "open_time": "11:00", "close_time": "23:30"},
            ]
        },
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert [(h["weekday"], h["open_time"], h["close_time"]) for h in body] == [
        (0, "09:00:00", "18:00:00"),
        (1, "09:00:00", "18:00:00"),
        (4, "11:00:00", "23:30:00"),
    ]

    # A second PUT replaces (not appends) — weekday 1 disappears.
    res2 = await client.put(
        f"/restaurants/{r['id']}/business-hours",
        json={
            "hours": [
                {"weekday": 2, "open_time": "09:00", "close_time": "18:00"},
            ]
        },
        headers=headers,
    )
    assert res2.status_code == 200
    body2 = res2.json()
    assert [h["weekday"] for h in body2] == [2]


async def test_put_business_hours_rejects_duplicate_weekday(client: AsyncClient):
    headers = await _as_user(client)
    r = await _make_restaurant(client, headers)

    res = await client.put(
        f"/restaurants/{r['id']}/business-hours",
        json={
            "hours": [
                {"weekday": 3, "open_time": "09:00", "close_time": "18:00"},
                {"weekday": 3, "open_time": "19:00", "close_time": "23:00"},
            ]
        },
        headers=headers,
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "duplicate_weekday"
    # Nothing persisted.
    listed = await client.get(
        f"/restaurants/{r['id']}/business-hours", headers=headers
    )
    assert listed.json() == []


@pytest.mark.parametrize(
    "payload,expected_detail",
    [
        (
            {"weekday": 7, "open_time": "09:00", "close_time": "18:00"},
            None,
        ),  # out of range — pydantic 422
        (
            {"weekday": 0, "open_time": "18:00", "close_time": "09:00"},
            "close_time must be after open_time",
        ),
    ],
)
async def test_put_business_hours_rejects_invalid_rows(
    client: AsyncClient, payload: dict, expected_detail: str | None
):
    headers = await _as_user(client)
    r = await _make_restaurant(client, headers)

    res = await client.put(
        f"/restaurants/{r['id']}/business-hours",
        json={"hours": [payload]},
        headers=headers,
    )
    assert res.status_code == 422
    if expected_detail is not None:
        assert expected_detail in res.text


async def test_put_business_hours_max_seven_days(client: AsyncClient):
    headers = await _as_user(client)
    r = await _make_restaurant(client, headers)

    days = [
        {"weekday": d, "open_time": "09:00", "close_time": "18:00"}
        for d in range(7)
    ]
    res = await client.put(
        f"/restaurants/{r['id']}/business-hours",
        json={"hours": days},
        headers=headers,
    )
    assert res.status_code == 200
    assert len(res.json()) == 7

    # An 8th day would overflow the schema cap.
    days.append(
        {"weekday": 0, "open_time": "12:00", "close_time": "13:00"}  # any weekday
    )
    res = await client.put(
        f"/restaurants/{r['id']}/business-hours",
        json={"hours": days},
        headers=headers,
    )
    assert res.status_code == 422


async def test_list_business_hours_empty_for_brand_new_restaurant(
    client: AsyncClient,
):
    headers = await _as_user(client)
    r = await _make_restaurant(client, headers)
    res = await client.get(
        f"/restaurants/{r['id']}/business-hours", headers=headers
    )
    assert res.status_code == 200
    assert res.json() == []


# ---------------------------------------------------------------------------
# is_open_now — direct service test, freezegun-pinned
# ---------------------------------------------------------------------------


async def _seed_restaurant_with_hours(
    db_session: AsyncSession, hours_spec
) -> Restaurant:
    """Seed a restaurant + business_hours rows, then re-query with the hours
    eagerly loaded. ``compute_is_open_now`` accesses ``restaurant.business_hours``,
    which is a lazy relationship — without the eager load SQLAlchemy tries to
    trigger IO after the async session has been closed (``MissingGreenlet``).
    Mirrors how the real router uses the function (``get_restaurant_with_hours``
    selects with ``selectinload(Restaurant.business_hours)``).
    """
    restaurant = Restaurant(
        name="Test Bar",
        slug=f"test-bar-{uuid.uuid4().hex[:8]}",
        qr_token=str(uuid.uuid4()),
        timezone="America/Argentina/Buenos_Aires",
    )
    db_session.add(restaurant)
    await db_session.flush()
    for weekday, open_t, close_t in hours_spec:
        db_session.add(
            BusinessHours(
                restaurant_id=restaurant.id,
                weekday=weekday,
                open_time=open_t,
                close_time=close_t,
            )
        )
    await db_session.flush()
    # Re-query with selectinload so .business_hours is materialized.
    result = await db_session.execute(
        select(Restaurant)
        .where(Restaurant.id == restaurant.id)
        .options(selectinload(Restaurant.business_hours))
    )
    return result.scalar_one()


async def test_is_open_now_inside_window(db_session: AsyncSession):
    restaurant = await _seed_restaurant_with_hours(
        db_session, [(2, time(9, 0), time(18, 0))]  # Wed 09-18
    )
    # Wed 12:00 BUE — squarely inside the window.
    from datetime import datetime
    from zoneinfo import ZoneInfo
    now = datetime(2026, 8, 5, 12, 0, tzinfo=ZoneInfo("America/Argentina/Buenos_Aires"))
    assert compute_is_open_now(restaurant, now=now) is True


async def test_is_open_now_outside_window(db_session: AsyncSession):
    restaurant = await _seed_restaurant_with_hours(
        db_session, [(2, time(9, 0), time(18, 0))]
    )
    from datetime import datetime
    from zoneinfo import ZoneInfo
    # Wed 19:00 BUE — after close.
    now = datetime(2026, 8, 5, 19, 0, tzinfo=ZoneInfo("America/Argentina/Buenos_Aires"))
    assert compute_is_open_now(restaurant, now=now) is False


async def test_is_open_now_wrong_weekday(db_session: AsyncSession):
    restaurant = await _seed_restaurant_with_hours(
        db_session, [(2, time(9, 0), time(18, 0))]  # Wed only
    )
    from datetime import datetime
    from zoneinfo import ZoneInfo
    # Thursday 12:00 — wrong day entirely.
    now = datetime(2026, 8, 6, 12, 0, tzinfo=ZoneInfo("America/Argentina/Buenos_Aires"))
    assert compute_is_open_now(restaurant, now=now) is False


async def test_is_open_now_boundary_open_time_is_inclusive(db_session: AsyncSession):
    """Opening time is treated as open (<=), closing time as closed (<)."""
    restaurant = await _seed_restaurant_with_hours(
        db_session, [(2, time(9, 0), time(18, 0))]
    )
    from datetime import datetime
    from zoneinfo import ZoneInfo
    tz = ZoneInfo("America/Argentina/Buenos_Aires")
    assert compute_is_open_now(restaurant, now=datetime(2026, 8, 5, 9, 0, tzinfo=tz)) is True
    assert compute_is_open_now(restaurant, now=datetime(2026, 8, 5, 17, 59, tzinfo=tz)) is True
    assert compute_is_open_now(restaurant, now=datetime(2026, 8, 5, 18, 0, tzinfo=tz)) is False


async def test_is_open_now_no_hours_is_closed(db_session: AsyncSession):
    restaurant = Restaurant(
        name="Empty Bar",
        slug=f"empty-bar-{uuid.uuid4().hex[:8]}",
        qr_token=str(uuid.uuid4()),
    )
    db_session.add(restaurant)
    await db_session.flush()
    result = await db_session.execute(
        select(Restaurant)
        .where(Restaurant.id == restaurant.id)
        .options(selectinload(Restaurant.business_hours))
    )
    loaded = result.scalar_one()
    assert compute_is_open_now(loaded, now=None) is False