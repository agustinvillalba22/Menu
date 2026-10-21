"""
Tests for M37 (backend) — public "Tu consumo": order public_token, status and
bill-request by token.

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.
"""
import secrets
import uuid
from dataclasses import dataclass
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
from tests.test_orders import (
    as_user,
    enable_orders,
    make_item,
    make_modifier,
    make_restaurant,
    make_subcategory,
)
from tests.test_table_occupancy import (
    checkout_url,
    make_table,
    make_staff,
    occupancy_of,
)

FORBIDDEN_KEYS = {
    "id",
    "restaurant_id",
    "table_id",
    "customer_name",
    "notes",
    "special_instructions",
    "handled_by_id",
    "handled_by_name",
    "cash_shift_id",
    "mp_preference_id",
    "mp_payment_id",
    "payment_url",
    "whatsapp_url",
}


@dataclass
class Setup:
    headers: dict
    rid: str
    qr: str
    iid: str
    mid: str
    table_id: str


async def seed(client: AsyncClient, email: str = "owner@example.com", name: str = "My Bar") -> Setup:
    headers = await as_user(client, email)
    restaurant = await make_restaurant(client, headers, name)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid, price="10.00")
    mid = await make_modifier(client, headers, rid, sid, iid, price_delta="1.50")
    await enable_orders(client, headers, rid, name)
    table_id = await make_table(client, headers, rid, number=7)
    client.cookies.clear()
    return Setup(headers, rid, qr, iid, mid, table_id)


async def place(client: AsyncClient, s: Setup, *, table: bool = True, order_type: str = "mesa") -> dict:
    body = {
        "customer_name": "Ana",
        "order_type": order_type,
        "notes": "sin sal",
        "items": [
            {"item_id": s.iid, "quantity": 2, "modifier_ids": [s.mid], "special_instructions": "x"}
        ],
    }
    if table:
        body["table_id"] = s.table_id
    res = await client.post(f"/menu/{s.qr}/orders", json=body)
    assert res.status_code == 201, res.text
    return res.json()


async def set_status(db: AsyncSession, token: str, status: OrderStatus) -> None:
    db.expire_all()
    order = (await db.execute(select(Order).where(Order.public_token == token))).scalar_one()
    order.status = status
    await db.commit()


async def add_mp_order(db: AsyncSession, s: Setup, pay: PaymentStatus) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        Order(
            restaurant_id=uuid.UUID(s.rid),
            table_id=uuid.UUID(s.table_id),
            status=OrderStatus.pending,
            customer_name="MP",
            order_type=OrderType.mesa,
            total=Decimal("5.00"),
            payment_method=PaymentMethod.mercadopago,
            payment_status=pay,
            public_token=token,
        )
    )
    await db.commit()
    return token


def status_url(qr: str) -> str:
    return f"/menu/{qr}/orders/status"


def bill_url(qr: str) -> str:
    return f"/menu/{qr}/orders/bill-request"


async def get_status(client: AsyncClient, qr: str, tokens: list[str]) -> list[dict]:
    res = await client.post(status_url(qr), json={"tokens": tokens})
    assert res.status_code == 200, res.text
    return res.json()


# --------------------------------------------------------------------------
# creation
# --------------------------------------------------------------------------


async def test_create_order_returns_unique_urlsafe_public_token(client, db_session):
    s = await seed(client)
    a = await place(client, s)
    b = await place(client, s)
    assert len(a["public_token"]) >= 43
    assert a["public_token"] != b["public_token"]
    stored = (await db_session.execute(select(Order.public_token))).scalars().all()
    assert sorted(stored) == sorted([a["public_token"], b["public_token"]])


async def test_create_takeaway_order_also_gets_public_token(client):
    s = await seed(client)
    body = await place(client, s, table=False, order_type="llevar")
    assert len(body["public_token"]) >= 43


async def test_dashboard_list_and_patch_return_null_public_token(client):
    s = await seed(client)
    created = await place(client, s)
    listed = await client.get(f"/restaurants/{s.rid}/orders", headers=s.headers)
    assert listed.json()[0]["public_token"] is None
    patched = await client.patch(
        f"/restaurants/{s.rid}/orders/{created['id']}",
        json={"status": "accepted"},
        headers=s.headers,
    )
    assert patched.json()["public_token"] is None


async def test_occupancy_orders_do_not_leak_public_token(client):
    s = await seed(client)
    await place(client, s)
    occ = await occupancy_of(client, s.headers, s.rid, s.table_id)
    assert [o["public_token"] for o in occ["orders"]] == [None]


# --------------------------------------------------------------------------
# status
# --------------------------------------------------------------------------


async def test_status_returns_only_requested_orders_with_lines_and_total(client):
    s = await seed(client)
    mine = await place(client, s)
    await place(client, s)  # another guest, same table
    rows = await get_status(client, s.qr, [mine["public_token"]])
    assert len(rows) == 1
    row = rows[0]
    assert row["token"] == mine["public_token"]
    assert row["status"] == "pending"
    assert row["total"] == "23.00"
    assert row["table_number"] == 7
    assert row["bill_requested"] is False
    assert row["items"] == [
        {"name": "Ravioles", "quantity": 2, "subtotal": "23.00", "modifiers": ["Extra queso"]}
    ]


async def test_status_response_exposes_no_internal_or_pii_keys(client):
    s = await seed(client)
    mine = await place(client, s)
    row = (await get_status(client, s.qr, [mine["public_token"]]))[0]
    assert not (set(row) & FORBIDDEN_KEYS)
    assert not (set(row["items"][0]) & FORBIDDEN_KEYS)
    assert set(row) == {
        "token", "status", "created_at", "payment_method", "payment_status",
        "total", "table_number", "bill_requested", "items",
    }


async def test_status_omits_unknown_and_foreign_tokens_identically(client):
    a = await seed(client, "a@example.com", "Bar A")
    b = await seed(client, "b@example.com", "Bar B")
    foreign = await place(client, b)
    mine = await place(client, a)
    unknown = secrets.token_urlsafe(32)
    rows = await get_status(client, a.qr, [unknown, foreign["public_token"], mine["public_token"]])
    assert [r["token"] for r in rows] == [mine["public_token"]]
    only_foreign = await get_status(client, a.qr, [foreign["public_token"]])
    only_unknown = await get_status(client, a.qr, [unknown])
    assert only_foreign == only_unknown == []


async def test_status_ordered_by_created_at_asc(client, db_session):
    s = await seed(client)
    first = await place(client, s)
    second = await place(client, s)
    # SQLite timestamps have 1s resolution: pin distinct values explicitly.
    db_session.expire_all()
    for token, delta in ((first["public_token"], 0), (second["public_token"], 60)):
        order = (await db_session.execute(select(Order).where(Order.public_token == token))).scalar_one()
        order.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=delta)
    await db_session.commit()
    rows = await get_status(client, s.qr, [second["public_token"], first["public_token"]])
    assert [r["token"] for r in rows] == [first["public_token"], second["public_token"]]


async def test_status_reports_cancelled_and_completed_states(client, db_session):
    s = await seed(client)
    a = await place(client, s)
    b = await place(client, s)
    await set_status(db_session, a["public_token"], OrderStatus.cancelled)
    await set_status(db_session, b["public_token"], OrderStatus.completed)
    rows = await get_status(client, s.qr, [a["public_token"], b["public_token"]])
    by_token = {r["token"]: r["status"] for r in rows}
    assert by_token == {a["public_token"]: "cancelled", b["public_token"]: "completed"}


async def test_status_reports_mp_payment_status(client, db_session):
    s = await seed(client)
    token = await add_mp_order(db_session, s, PaymentStatus.pending)
    row = (await get_status(client, s.qr, [token]))[0]
    assert (row["payment_method"], row["payment_status"]) == ("mercadopago", "pending")


async def test_status_unknown_qr_token_404(client):
    res = await client.post(status_url(str(uuid.uuid4())), json={"tokens": [secrets.token_urlsafe(32)]})
    assert res.status_code == 404


async def test_status_invalid_bodies_422(client):
    s = await seed(client)
    good = secrets.token_urlsafe(32)
    for tokens in ([], [good] * 21, ["short"], ["x" * 65]):
        res = await client.post(status_url(s.qr), json={"tokens": tokens})
        assert res.status_code == 422, tokens


# --------------------------------------------------------------------------
# bill-request
# --------------------------------------------------------------------------


async def test_bill_request_sets_table_to_bill(client):
    s = await seed(client)
    mine = await place(client, s)
    res = await client.post(bill_url(s.qr), json={"token": mine["public_token"]})
    assert res.status_code == 200, res.text
    assert res.json()["bill_requested"] is True
    occ = await occupancy_of(client, s.headers, s.rid, s.table_id)
    assert occ["status"] == "bill"
    assert occ["bill_requested_at"] is not None


async def test_bill_request_is_idempotent_and_keeps_timestamp(client):
    s = await seed(client)
    mine = await place(client, s)
    first = await client.post(bill_url(s.qr), json={"token": mine["public_token"]})
    second = await client.post(bill_url(s.qr), json={"token": mine["public_token"]})
    assert second.status_code == 200
    assert second.json()["bill_requested_at"] == first.json()["bill_requested_at"]


async def test_bill_request_response_has_only_flag_and_timestamp(client):
    s = await seed(client)
    mine = await place(client, s)
    res = await client.post(bill_url(s.qr), json={"token": mine["public_token"]})
    assert set(res.json()) == {"bill_requested", "bill_requested_at"}


async def test_bill_request_unknown_token_404_without_effect(client):
    s = await seed(client)
    await place(client, s)
    res = await client.post(bill_url(s.qr), json={"token": secrets.token_urlsafe(32)})
    assert res.status_code == 404
    assert res.json()["detail"] == "order_not_found"
    occ = await occupancy_of(client, s.headers, s.rid, s.table_id)
    assert occ["status"] == "occupied"


async def test_bill_request_token_of_other_restaurant_404_without_effect(client):
    a = await seed(client, "a@example.com", "Bar A")
    b = await seed(client, "b@example.com", "Bar B")
    foreign = await place(client, b)
    await place(client, a)
    res = await client.post(bill_url(a.qr), json={"token": foreign["public_token"]})
    assert res.status_code == 404
    assert res.json()["detail"] == "order_not_found"
    assert (await occupancy_of(client, b.headers, b.rid, b.table_id))["status"] == "occupied"
    assert (await occupancy_of(client, a.headers, a.rid, a.table_id))["status"] == "occupied"


async def test_bill_request_order_without_table_409(client):
    s = await seed(client)
    takeaway = await place(client, s, table=False, order_type="llevar")
    res = await client.post(bill_url(s.qr), json={"token": takeaway["public_token"]})
    assert res.status_code == 409
    assert res.json()["detail"] == "order_without_table"


async def test_bill_request_cancelled_or_completed_order_409(client, db_session):
    s = await seed(client)
    await place(client, s)  # keeps the table occupied
    for status in (OrderStatus.cancelled, OrderStatus.completed):
        order = await place(client, s)
        await set_status(db_session, order["public_token"], status)
        res = await client.post(bill_url(s.qr), json={"token": order["public_token"]})
        assert res.status_code == 409, status
        assert res.json()["detail"] == "order_not_active"


async def test_bill_request_mp_without_approved_payment_409(client, db_session):
    s = await seed(client)
    token = await add_mp_order(db_session, s, PaymentStatus.pending)
    res = await client.post(bill_url(s.qr), json={"token": token})
    assert res.status_code == 409
    assert res.json()["detail"] == "order_not_active"


async def test_bill_request_after_table_checkout_race_409(client, db_session):
    s = await seed(client)
    mine = await place(client, s)
    await set_status(db_session, mine["public_token"], OrderStatus.completed)
    res = await client.post(bill_url(s.qr), json={"token": mine["public_token"]})
    assert res.status_code == 409
    assert res.json()["detail"] in {"order_not_active", "table_not_occupied"}


async def test_bill_request_with_other_guests_order_active_but_own_inactive_409(client, db_session):
    s = await seed(client)
    mine = await place(client, s)
    await place(client, s)  # other guest still active on the same table
    await set_status(db_session, mine["public_token"], OrderStatus.cancelled)
    res = await client.post(bill_url(s.qr), json={"token": mine["public_token"]})
    assert res.status_code == 409
    assert (await occupancy_of(client, s.headers, s.rid, s.table_id))["status"] == "occupied"


async def test_bill_request_unknown_qr_404_and_short_token_422(client):
    s = await seed(client)
    assert (
        await client.post(bill_url(str(uuid.uuid4())), json={"token": secrets.token_urlsafe(32)})
    ).status_code == 404
    assert (await client.post(bill_url(s.qr), json={"token": "short"})).status_code == 422


# --------------------------------------------------------------------------
# bill_requested flag in status
# --------------------------------------------------------------------------


async def test_status_bill_requested_false_before_true_after_request(client):
    s = await seed(client)
    mine = await place(client, s)
    other = await place(client, s)
    before = await get_status(client, s.qr, [mine["public_token"]])
    assert before[0]["bill_requested"] is False
    await client.post(bill_url(s.qr), json={"token": mine["public_token"]})
    after = await get_status(client, s.qr, [mine["public_token"], other["public_token"]])
    assert [r["bill_requested"] for r in after] == [True, True]


async def test_status_bill_requested_false_after_checkout(client):
    s = await seed(client)
    mine = await place(client, s)
    await client.post(bill_url(s.qr), json={"token": mine["public_token"]})
    staff = await make_staff(client, s.headers, s.rid)
    res = await client.post(
        checkout_url(s.rid, s.table_id), json={"staff_member_id": staff}, headers=s.headers
    )
    assert res.status_code == 200, res.text
    row = (await get_status(client, s.qr, [mine["public_token"]]))[0]
    assert row["status"] == "completed"
    assert row["bill_requested"] is False
