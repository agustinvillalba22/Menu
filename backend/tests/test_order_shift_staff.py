"""
Tests for M28 (backend) — orders linked to cash shifts and attributed to staff.

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.
"""
import uuid
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderStatus, OrderType


async def as_user(client: AsyncClient, email: str = "owner@example.com") -> dict:
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "full_name": "Owner"},
    )
    token = res.json()["access_token"]
    client.cookies.clear()
    return {"Authorization": f"Bearer {token}"}


async def make_restaurant(client: AsyncClient, headers: dict, name: str = "My Bar") -> str:
    res = await client.post("/restaurants", json={"name": name}, headers=headers)
    return res.json()["id"]


async def make_staff(
    client: AsyncClient, headers: dict, rid: str, name: str = "Ana", pin: str = "1111"
) -> dict:
    res = await client.post(
        f"/restaurants/{rid}/staff",
        json={"name": name, "position": "mozo", "pin": pin},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


async def open_shift(client: AsyncClient, headers: dict, rid: str, staff_id: str) -> dict:
    res = await client.post(
        f"/restaurants/{rid}/shifts",
        json={"staff_member_id": staff_id, "opening_amount": "100.00"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


async def close_shift(
    client: AsyncClient, headers: dict, rid: str, shift_id: str, staff_id: str, counted: str
) -> dict:
    res = await client.post(
        f"/restaurants/{rid}/shifts/{shift_id}/close",
        json={"staff_member_id": staff_id, "counted_amount": counted},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    return res.json()


async def add_order(
    db: AsyncSession, rid: str, total: str = "50.00", status: OrderStatus = OrderStatus.ready
) -> str:
    order = Order(
        restaurant_id=uuid.UUID(rid),
        status=status,
        customer_name="Cliente",
        order_type=OrderType.llevar,
        total=Decimal(total),
    )
    db.add(order)
    await db.commit()
    return str(order.id)


async def patch(client, headers, rid, oid, **body):
    return await client.patch(f"/restaurants/{rid}/orders/{oid}", json=body, headers=headers)


async def setup(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    staff = await make_staff(client, headers, rid)
    return headers, rid, staff


# CA-01
async def test_complete_with_open_shift_links_order_to_shift(client, db_session):
    headers, rid, staff = await setup(client)
    shift = await open_shift(client, headers, rid, staff["id"])
    oid = await add_order(db_session, rid)
    res = await patch(client, headers, rid, oid, status="completed")
    assert res.status_code == 200, res.text
    assert res.json()["cash_shift_id"] == shift["id"]


async def test_complete_without_open_shift_leaves_shift_null(client, db_session):
    headers, rid, _ = await setup(client)
    oid = await add_order(db_session, rid)
    res = await patch(client, headers, rid, oid, status="completed")
    assert res.status_code == 200
    assert res.json()["cash_shift_id"] is None


async def test_cancel_with_open_shift_does_not_link(client, db_session):
    headers, rid, staff = await setup(client)
    await open_shift(client, headers, rid, staff["id"])
    oid = await add_order(db_session, rid, status=OrderStatus.pending)
    res = await patch(client, headers, rid, oid, status="cancelled")
    assert res.status_code == 200
    assert res.json()["cash_shift_id"] is None


async def test_non_completing_transition_does_not_link(client, db_session):
    headers, rid, staff = await setup(client)
    await open_shift(client, headers, rid, staff["id"])
    oid = await add_order(db_session, rid, status=OrderStatus.pending)
    res = await patch(client, headers, rid, oid, status="accepted")
    assert res.json()["cash_shift_id"] is None


# CA-02
async def test_close_sums_only_orders_linked_to_the_shift(client, db_session):
    headers, rid, staff = await setup(client)
    # completed outside any shift
    out = await add_order(db_session, rid, "7.00")
    await patch(client, headers, rid, out, status="completed")

    first = await open_shift(client, headers, rid, staff["id"])
    o1 = await add_order(db_session, rid, "50.00")
    await patch(client, headers, rid, o1, status="completed")
    closed1 = await close_shift(client, headers, rid, first["id"], staff["id"], "150.00")
    assert Decimal(closed1["expected_amount"]) == Decimal("150.00")

    second = await open_shift(client, headers, rid, staff["id"])
    o2 = await add_order(db_session, rid, "30.00")
    await patch(client, headers, rid, o2, status="completed")
    closed2 = await close_shift(client, headers, rid, second["id"], staff["id"], "130.00")
    assert Decimal(closed2["expected_amount"]) == Decimal("130.00")
    # first shift keeps its snapshot
    hist = await client.get(f"/restaurants/{rid}/shifts", headers=headers)
    by_id = {s["id"]: s for s in hist.json()}
    assert Decimal(by_id[first["id"]]["expected_amount"]) == Decimal("150.00")


async def test_order_completed_in_range_but_unlinked_is_not_counted(client, db_session):
    """Range-by-updated_at is gone: only cash_shift_id matters."""
    headers, rid, staff = await setup(client)
    shift = await open_shift(client, headers, rid, staff["id"])
    await add_order(db_session, rid, "40.00", status=OrderStatus.completed)  # no shift id
    closed = await close_shift(client, headers, rid, shift["id"], staff["id"], "100.00")
    assert Decimal(closed["expected_amount"]) == Decimal("100.00")


# CA-03
async def test_staff_attribution_sets_id_and_name(client, db_session):
    headers, rid, staff = await setup(client)
    oid = await add_order(db_session, rid, status=OrderStatus.pending)
    res = await patch(client, headers, rid, oid, status="accepted", staff_member_id=staff["id"])
    assert res.status_code == 200, res.text
    assert res.json()["handled_by_id"] == staff["id"]
    assert res.json()["handled_by_name"] == "Ana"


async def test_last_staff_overrides_and_omitted_keeps_previous(client, db_session):
    headers, rid, ana = await setup(client)
    bea = await make_staff(client, headers, rid, name="Bea", pin="2222")
    oid = await add_order(db_session, rid, status=OrderStatus.pending)
    await patch(client, headers, rid, oid, status="accepted", staff_member_id=ana["id"])
    res = await patch(client, headers, rid, oid, status="ready")
    assert res.json()["handled_by_name"] == "Ana"
    res = await patch(client, headers, rid, oid, status="completed", staff_member_id=bea["id"])
    assert res.json()["handled_by_name"] == "Bea"
    assert res.json()["handled_by_id"] == bea["id"]


async def test_staff_name_snapshot_survives_staff_deletion(client, db_session):
    headers, rid, staff = await setup(client)
    oid = await add_order(db_session, rid, status=OrderStatus.pending)
    await patch(client, headers, rid, oid, status="accepted", staff_member_id=staff["id"])
    d = await client.delete(f"/restaurants/{rid}/staff/{staff['id']}", headers=headers)
    assert d.status_code == 204
    listed = await client.get(f"/restaurants/{rid}/orders", headers=headers)
    assert listed.json()[0]["handled_by_name"] == "Ana"


async def test_inactive_staff_422_and_order_untouched(client, db_session):
    headers, rid, staff = await setup(client)
    await client.patch(
        f"/restaurants/{rid}/staff/{staff['id']}", json={"active": False}, headers=headers
    )
    oid = await add_order(db_session, rid, status=OrderStatus.pending)
    res = await patch(client, headers, rid, oid, status="accepted", staff_member_id=staff["id"])
    assert res.status_code == 422
    assert res.json()["detail"] == "staff_member_inactive"
    row = (await db_session.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
    await db_session.refresh(row)
    assert row.status == OrderStatus.pending


async def test_staff_of_other_restaurant_or_unknown_404(client, db_session):
    headers, rid, _ = await setup(client)
    other = await make_restaurant(client, headers, name="Other")
    foreign = await make_staff(client, headers, other, name="Zed", pin="3333")
    oid = await add_order(db_session, rid, status=OrderStatus.pending)
    for sid in (foreign["id"], str(uuid.uuid4())):
        res = await patch(client, headers, rid, oid, status="accepted", staff_member_id=sid)
        assert res.status_code == 404
        assert res.json()["detail"] == "staff_member_not_found"


# CA-04
async def test_invalid_transition_with_staff_409_and_order_intact(client, db_session):
    headers, rid, staff = await setup(client)
    oid = await add_order(db_session, rid, status=OrderStatus.pending)
    res = await patch(client, headers, rid, oid, status="completed", staff_member_id=staff["id"])
    assert res.status_code == 409
    row = (await db_session.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
    await db_session.refresh(row)
    assert row.status == OrderStatus.pending
    assert row.handled_by_id is None
    assert row.handled_by_name is None
    assert row.cash_shift_id is None


# RF-07
async def test_body_without_staff_still_valid_and_fields_null(client, db_session):
    headers, rid, _ = await setup(client)
    oid = await add_order(db_session, rid, status=OrderStatus.pending)
    res = await patch(client, headers, rid, oid, status="accepted")
    assert res.status_code == 200
    body = res.json()
    assert body["handled_by_id"] is None
    assert body["handled_by_name"] is None
    assert body["cash_shift_id"] is None


# CA-05
async def test_orders_count_open_and_closed_shift(client, db_session):
    headers, rid, staff = await setup(client)
    shift = await open_shift(client, headers, rid, staff["id"])
    cur = await client.get(f"/restaurants/{rid}/shifts/current", headers=headers)
    assert cur.json()["orders_count"] == 0
    for total in ("10.00", "20.00"):
        oid = await add_order(db_session, rid, total)
        await patch(client, headers, rid, oid, status="completed")
    cancelled = await add_order(db_session, rid, "99.00", status=OrderStatus.pending)
    await patch(client, headers, rid, cancelled, status="cancelled")

    cur = await client.get(f"/restaurants/{rid}/shifts/current", headers=headers)
    assert cur.json()["orders_count"] == 2
    closed = await close_shift(client, headers, rid, shift["id"], staff["id"], "130.00")
    assert closed["orders_count"] == 2
    hist = await client.get(f"/restaurants/{rid}/shifts", headers=headers)
    assert hist.json()[0]["orders_count"] == 2


async def test_orders_count_in_history_is_per_shift(client, db_session):
    headers, rid, staff = await setup(client)
    s1 = await open_shift(client, headers, rid, staff["id"])
    oid = await add_order(db_session, rid)
    await patch(client, headers, rid, oid, status="completed")
    await close_shift(client, headers, rid, s1["id"], staff["id"], "150.00")
    s2 = await open_shift(client, headers, rid, staff["id"])
    hist = await client.get(f"/restaurants/{rid}/shifts", headers=headers)
    counts = {s["id"]: s["orders_count"] for s in hist.json()}
    assert counts == {s1["id"]: 1, s2["id"]: 0}


async def test_open_shift_response_has_orders_count_zero(client):
    headers, rid, staff = await setup(client)
    shift = await open_shift(client, headers, rid, staff["id"])
    assert shift["orders_count"] == 0
