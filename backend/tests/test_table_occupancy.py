"""
Tests for M33 (backend) — table occupancy, bill request and checkout.

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.
"""
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import (
    Order,
    OrderStatus,
    OrderType,
    PaymentMethod,
    PaymentStatus,
)
from app.models.table import Table
from app.services import table as table_service


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


async def make_table(client: AsyncClient, headers: dict, rid: str, number: int = 1) -> str:
    res = await client.post(
        f"/restaurants/{rid}/tables", json={"number": number, "capacity": 4}, headers=headers
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def make_staff(client: AsyncClient, headers: dict, rid: str) -> str:
    res = await client.post(
        f"/restaurants/{rid}/staff",
        json={"name": "Ana", "position": "mozo", "pin": "1111"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def open_shift(client: AsyncClient, headers: dict, rid: str, staff_id: str) -> str:
    res = await client.post(
        f"/restaurants/{rid}/shifts",
        json={"staff_member_id": staff_id, "opening_amount": "100.00"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def add_order(
    db: AsyncSession,
    rid: str,
    table_id: str | None,
    total: str = "10.00",
    status: OrderStatus = OrderStatus.pending,
    method: PaymentMethod = PaymentMethod.cash,
    pay: PaymentStatus = PaymentStatus.none,
    created_at: datetime | None = None,
) -> str:
    order = Order(
        restaurant_id=uuid.UUID(rid),
        table_id=uuid.UUID(table_id) if table_id else None,
        status=status,
        customer_name="Cliente",
        order_type=OrderType.mesa,
        total=Decimal(total),
        payment_method=method,
        payment_status=pay,
    )
    if created_at is not None:
        order.created_at = created_at
    db.add(order)
    await db.commit()
    return str(order.id)


async def get_order(db: AsyncSession, oid: str) -> Order:
    db.expire_all()
    res = await db.execute(select(Order).where(Order.id == uuid.UUID(oid)))
    return res.scalar_one()


async def set_bill_requested(db: AsyncSession, table_id: str, value: datetime | None) -> None:
    db.expire_all()
    res = await db.execute(select(Table).where(Table.id == uuid.UUID(table_id)))
    res.scalar_one().bill_requested_at = value
    await db.commit()


def occ_url(rid: str) -> str:
    return f"/restaurants/{rid}/tables/occupancy"


def bill_url(rid: str, tid: str) -> str:
    return f"/restaurants/{rid}/tables/{tid}/bill-request"


def checkout_url(rid: str, tid: str) -> str:
    return f"/restaurants/{rid}/tables/{tid}/checkout"


async def occupancy_of(client, headers, rid, tid) -> dict:
    res = await client.get(occ_url(rid), headers=headers)
    assert res.status_code == 200, res.text
    return next(t for t in res.json() if t["id"] == tid)


# --------------------------------------------------------------------------
# occupancy
# --------------------------------------------------------------------------


async def test_occupancy_free_table_has_zero_total_and_no_orders(client):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)

    occ = await occupancy_of(client, h, rid, tid)

    assert occ["status"] == "free"
    assert occ["total"] == "0.00"
    assert occ["first_order_at"] is None
    assert occ["bill_requested_at"] is None
    assert occ["orders"] == []


async def test_occupancy_sorted_by_number_and_includes_all_tables(client):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    for n in (3, 1, 2):
        await make_table(client, h, rid, n)

    res = await client.get(occ_url(rid), headers=h)

    assert [t["number"] for t in res.json()] == [1, 2, 3]


async def test_occupancy_active_orders_sum_total_and_first_order_at(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    now = datetime.now(timezone.utc)
    await add_order(db_session, rid, tid, "10.00", OrderStatus.pending, created_at=now - timedelta(minutes=30))
    await add_order(db_session, rid, tid, "5.50", OrderStatus.accepted, created_at=now - timedelta(minutes=20))
    await add_order(db_session, rid, tid, "4.00", OrderStatus.ready, created_at=now - timedelta(minutes=10))

    occ = await occupancy_of(client, h, rid, tid)

    assert occ["status"] == "occupied"
    assert occ["total"] == "19.50"
    assert len(occ["orders"]) == 3
    created = [o["created_at"] for o in occ["orders"]]
    assert created == sorted(created)
    assert occ["first_order_at"] == occ["orders"][0]["created_at"]


async def test_occupancy_ignores_completed_and_cancelled(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    await add_order(db_session, rid, tid, "10.00", OrderStatus.completed)
    await add_order(db_session, rid, tid, "10.00", OrderStatus.cancelled)

    occ = await occupancy_of(client, h, rid, tid)

    assert occ["status"] == "free"
    assert occ["total"] == "0.00"


async def test_occupancy_mp_pending_does_not_count_but_approved_does(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    for pay in (PaymentStatus.pending, PaymentStatus.rejected, PaymentStatus.cancelled):
        await add_order(db_session, rid, tid, "10.00", method=PaymentMethod.mercadopago, pay=pay)
    assert (await occupancy_of(client, h, rid, tid))["status"] == "free"

    await add_order(
        db_session, rid, tid, "7.00", method=PaymentMethod.mercadopago, pay=PaymentStatus.approved
    )

    occ = await occupancy_of(client, h, rid, tid)
    assert occ["status"] == "occupied"
    assert occ["total"] == "7.00"
    assert len(occ["orders"]) == 1


async def test_occupancy_orders_include_items_field(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    await add_order(db_session, rid, tid)

    occ = await occupancy_of(client, h, rid, tid)

    assert occ["orders"][0]["items"] == []
    assert occ["orders"][0]["table_id"] == tid


async def test_occupancy_orders_of_other_tables_and_restaurants_excluded(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h, "A")
    rid2 = await make_restaurant(client, h, "B")
    t1 = await make_table(client, h, rid, 1)
    t2 = await make_table(client, h, rid, 2)
    other = await make_table(client, h, rid2, 1)
    await add_order(db_session, rid, t1, "10.00")
    await add_order(db_session, rid2, other, "99.00")

    assert (await occupancy_of(client, h, rid, t2))["status"] == "free"
    assert (await occupancy_of(client, h, rid, t1))["total"] == "10.00"


async def test_occupancy_status_bill_when_requested_after_first_order(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    await add_order(db_session, rid, tid)
    await set_bill_requested(db_session, tid, datetime.now(timezone.utc) + timedelta(minutes=1))

    occ = await occupancy_of(client, h, rid, tid)

    assert occ["status"] == "bill"
    assert occ["bill_requested_at"] is not None


# --------------------------------------------------------------------------
# bill-request
# --------------------------------------------------------------------------


async def test_bill_request_on_free_table_409(client):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)

    res = await client.post(bill_url(rid, tid), headers=h)

    assert res.status_code == 409
    assert res.json()["detail"] == "table_not_occupied"


async def test_bill_request_on_occupied_table_sets_bill_with_timestamp(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    await add_order(db_session, rid, tid, "12.00")

    res = await client.post(bill_url(rid, tid), headers=h)

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "bill"
    assert body["bill_requested_at"] is not None
    assert body["total"] == "12.00"
    assert len(body["orders"]) == 1


async def test_bill_request_is_idempotent_and_keeps_original_timestamp(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    await add_order(db_session, rid, tid)

    first = (await client.post(bill_url(rid, tid), headers=h)).json()
    second = await client.post(bill_url(rid, tid), headers=h)

    assert second.status_code == 200
    assert second.json()["bill_requested_at"] == first["bill_requested_at"]


async def test_stale_bill_requested_at_before_first_order_is_not_bill(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    await set_bill_requested(db_session, tid, datetime.now(timezone.utc) - timedelta(days=1))
    await add_order(db_session, rid, tid)

    occ = await occupancy_of(client, h, rid, tid)

    assert occ["status"] == "occupied"
    assert occ["bill_requested_at"] is None


async def test_bill_request_after_stale_value_renews_to_bill(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    await set_bill_requested(db_session, tid, datetime.now(timezone.utc) - timedelta(days=1))
    await add_order(db_session, rid, tid)

    res = await client.post(bill_url(rid, tid), headers=h)

    assert res.json()["status"] == "bill"


async def test_bill_request_unknown_table_404(client):
    h = await as_user(client)
    rid = await make_restaurant(client, h)

    res = await client.post(bill_url(rid, str(uuid.uuid4())), headers=h)

    assert res.status_code == 404
    assert res.json()["detail"] == "table_not_found"


# --------------------------------------------------------------------------
# checkout
# --------------------------------------------------------------------------


async def test_checkout_completes_all_active_orders_and_frees_table(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    ids = [
        await add_order(db_session, rid, tid, status=s)
        for s in (OrderStatus.pending, OrderStatus.accepted, OrderStatus.ready)
    ]

    res = await client.post(checkout_url(rid, tid), headers=h)

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "free"
    assert body["orders"] == []
    assert body["total"] == "0.00"
    for oid in ids:
        assert (await get_order(db_session, oid)).status == OrderStatus.completed


async def test_checkout_without_body_is_accepted(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    await add_order(db_session, rid, tid)

    res = await client.post(checkout_url(rid, tid), headers=h)

    assert res.status_code == 200


async def test_checkout_with_open_shift_links_cash_shift(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    staff = await make_staff(client, h, rid)
    shift = await open_shift(client, h, rid, staff)
    oid = await add_order(db_session, rid, tid)

    await client.post(checkout_url(rid, tid), json={}, headers=h)

    assert str((await get_order(db_session, oid)).cash_shift_id) == shift


async def test_checkout_without_open_shift_leaves_cash_shift_null(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    oid = await add_order(db_session, rid, tid)

    res = await client.post(checkout_url(rid, tid), headers=h)

    assert res.status_code == 200
    assert (await get_order(db_session, oid)).cash_shift_id is None


async def test_checkout_stamps_staff_member(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    staff = await make_staff(client, h, rid)
    oid = await add_order(db_session, rid, tid)

    await client.post(checkout_url(rid, tid), json={"staff_member_id": staff}, headers=h)

    order = await get_order(db_session, oid)
    assert str(order.handled_by_id) == staff
    assert order.handled_by_name == "Ana"


async def test_checkout_clears_bill_requested_at(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    await add_order(db_session, rid, tid)
    await client.post(bill_url(rid, tid), headers=h)

    res = await client.post(checkout_url(rid, tid), headers=h)

    assert res.json()["bill_requested_at"] is None
    db_session.expire_all()
    table = (await db_session.execute(select(Table).where(Table.id == uuid.UUID(tid)))).scalar_one()
    assert table.bill_requested_at is None


async def test_checkout_leaves_mp_pending_and_other_tables_untouched(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    t1 = await make_table(client, h, rid, 1)
    t2 = await make_table(client, h, rid, 2)
    mp_pending = await add_order(
        db_session, rid, t1, method=PaymentMethod.mercadopago, pay=PaymentStatus.pending
    )
    other = await add_order(db_session, rid, t2)
    await add_order(db_session, rid, t1)

    await client.post(checkout_url(rid, t1), headers=h)

    assert (await get_order(db_session, mp_pending)).status == OrderStatus.pending
    assert (await get_order(db_session, other)).status == OrderStatus.pending


async def test_checkout_mp_approved_order_is_completed(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    oid = await add_order(
        db_session, rid, tid, method=PaymentMethod.mercadopago, pay=PaymentStatus.approved
    )

    await client.post(checkout_url(rid, tid), headers=h)

    order = await get_order(db_session, oid)
    assert order.status == OrderStatus.completed
    assert order.payment_status == PaymentStatus.approved


async def test_checkout_free_table_409(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)

    res = await client.post(checkout_url(rid, tid), headers=h)

    assert res.status_code == 409
    assert res.json()["detail"] == "table_not_occupied"


async def test_checkout_twice_second_is_409(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    await add_order(db_session, rid, tid)

    first = await client.post(checkout_url(rid, tid), headers=h)
    second = await client.post(checkout_url(rid, tid), headers=h)

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"] == "table_not_occupied"


async def test_checkout_unknown_staff_404_and_nothing_changes(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    oid = await add_order(db_session, rid, tid)

    res = await client.post(
        checkout_url(rid, tid), json={"staff_member_id": str(uuid.uuid4())}, headers=h
    )

    assert res.status_code == 404
    assert res.json()["detail"] == "staff_member_not_found"
    assert (await get_order(db_session, oid)).status == OrderStatus.pending


async def test_checkout_staff_of_other_restaurant_404_and_nothing_changes(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h, "A")
    rid2 = await make_restaurant(client, h, "B")
    tid = await make_table(client, h, rid)
    foreign_staff = await make_staff(client, h, rid2)
    oid = await add_order(db_session, rid, tid)

    res = await client.post(
        checkout_url(rid, tid), json={"staff_member_id": foreign_staff}, headers=h
    )

    assert res.status_code == 404
    assert (await get_order(db_session, oid)).status == OrderStatus.pending


async def test_checkout_inactive_staff_422_and_nothing_changes(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    staff = await make_staff(client, h, rid)
    await client.patch(f"/restaurants/{rid}/staff/{staff}", json={"active": False}, headers=h)
    oid = await add_order(db_session, rid, tid)

    res = await client.post(checkout_url(rid, tid), json={"staff_member_id": staff}, headers=h)

    assert res.status_code == 422
    assert res.json()["detail"] == "staff_member_inactive"
    assert (await get_order(db_session, oid)).status == OrderStatus.pending


async def test_checkout_rolls_back_all_orders_on_mid_failure(client, db_session, monkeypatch):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    tid = await make_table(client, h, rid)
    ids = [await add_order(db_session, rid, tid, status=OrderStatus.ready) for _ in range(2)]
    await client.post(bill_url(rid, tid), headers=h)
    real = table_service.apply_status_change
    calls = {"n": 0}

    def flaky(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("boom")
        return real(*args, **kwargs)

    monkeypatch.setattr(table_service, "apply_status_change", flaky)

    res = await client.post(checkout_url(rid, tid), headers=h)

    assert res.status_code == 500

    for oid in ids:
        assert (await get_order(db_session, oid)).status == OrderStatus.ready
    assert (await occupancy_of(client, h, rid, tid))["status"] == "bill"


# --------------------------------------------------------------------------
# tenancy, auth
# --------------------------------------------------------------------------


async def test_table_of_other_restaurant_is_404_and_untouched(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h, "A")
    rid2 = await make_restaurant(client, h, "B")
    foreign_table = await make_table(client, h, rid2)
    oid = await add_order(db_session, rid2, foreign_table)

    bill = await client.post(bill_url(rid, foreign_table), headers=h)
    checkout = await client.post(checkout_url(rid, foreign_table), headers=h)

    assert bill.status_code == 404
    assert checkout.status_code == 404
    assert (await get_order(db_session, oid)).status == OrderStatus.pending


async def test_user_without_role_in_restaurant_is_403(client, db_session):
    owner = await as_user(client)
    rid = await make_restaurant(client, owner)
    tid = await make_table(client, owner, rid)
    await add_order(db_session, rid, tid)
    stranger = await as_user(client, "stranger@example.com")

    responses = [
        await client.get(occ_url(rid), headers=stranger),
        await client.post(bill_url(rid, tid), headers=stranger),
        await client.post(checkout_url(rid, tid), headers=stranger),
    ]

    assert [r.status_code for r in responses] == [403, 403, 403]


async def test_endpoints_require_authentication_401(client):
    rid = str(uuid.uuid4())
    tid = str(uuid.uuid4())

    responses = [
        await client.get(occ_url(rid)),
        await client.post(bill_url(rid, tid)),
        await client.post(checkout_url(rid, tid)),
    ]

    assert [r.status_code for r in responses] == [401, 401, 401]


# --------------------------------------------------------------------------
# regression
# --------------------------------------------------------------------------


async def test_patch_order_status_still_follows_state_machine_and_stamps(client, db_session):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    staff = await make_staff(client, h, rid)
    shift = await open_shift(client, h, rid, staff)
    oid = await add_order(db_session, rid, None, status=OrderStatus.ready)

    bad = await client.patch(
        f"/restaurants/{rid}/orders/{oid}", json={"status": "pending"}, headers=h
    )
    ok = await client.patch(
        f"/restaurants/{rid}/orders/{oid}",
        json={"status": "completed", "staff_member_id": staff},
        headers=h,
    )

    assert bad.status_code == 409
    assert ok.status_code == 200
    assert ok.json()["cash_shift_id"] == shift
    assert ok.json()["handled_by_name"] == "Ana"


async def test_table_crud_exposes_bill_requested_at_null(client):
    h = await as_user(client)
    rid = await make_restaurant(client, h)
    await make_table(client, h, rid)

    res = await client.get(f"/restaurants/{rid}/tables", headers=h)

    assert res.json()[0]["bill_requested_at"] is None
