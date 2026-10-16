"""
Tests for M20 — Cash shifts (open/close with arqueo), CA-01..CA-08.

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.
"""
import uuid
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cash_shift import CashShift
from app.models.order import Order, OrderStatus, OrderType
from app.models.restaurant import Restaurant


async def as_user(
    client: AsyncClient,
    email: str = "owner@example.com",
    password: str = "password123",
    full_name: str = "Owner User",
) -> dict:
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
    )
    token = res.json()["access_token"]
    client.cookies.clear()
    return {"Authorization": f"Bearer {token}"}


async def make_restaurant(client: AsyncClient, headers: dict, name: str = "My Bar") -> dict:
    res = await client.post("/restaurants", json={"name": name}, headers=headers)
    return res.json()


async def make_staff(
    client: AsyncClient, headers: dict, rid: str, name: str = "Ana", pin: str = "1111"
) -> dict:
    res = await client.post(
        f"/restaurants/{rid}/staff",
        json={"name": name, "position": "cajero", "pin": pin},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


async def open_shift(
    client: AsyncClient, headers: dict, rid: str, staff_id: str, amount: str = "100.00"
):
    return await client.post(
        f"/restaurants/{rid}/shifts",
        json={"staff_member_id": staff_id, "opening_amount": amount},
        headers=headers,
    )


async def close_shift(
    client: AsyncClient, headers: dict, rid: str, shift_id: str, staff_id: str, counted: str
):
    return await client.post(
        f"/restaurants/{rid}/shifts/{shift_id}/close",
        json={"staff_member_id": staff_id, "counted_amount": counted},
        headers=headers,
    )


async def add_order(
    db: AsyncSession,
    rid: str,
    total: str,
    status: OrderStatus = OrderStatus.completed,
    cash_shift_id: str | None = None,
) -> None:
    order = Order(
        restaurant_id=uuid.UUID(rid),
        status=status,
        customer_name="Cliente",
        order_type=OrderType.llevar,
        total=Decimal(total),
        cash_shift_id=uuid.UUID(cash_shift_id) if cash_shift_id else None,
    )
    db.add(order)
    await db.commit()


async def setup(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    staff = await make_staff(client, headers, rid)
    return headers, rid, staff


# CA-01
async def test_open_shift_then_current(client: AsyncClient):
    headers, rid, staff = await setup(client)
    res = await open_shift(client, headers, rid, staff["id"])
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["opened_by_name"] == "Ana"
    assert Decimal(body["opening_amount"]) == Decimal("100.00")
    assert body["closed_at"] is None
    assert body["difference"] is None
    assert body["expected_amount"] is None

    cur = await client.get(f"/restaurants/{rid}/shifts/current", headers=headers)
    assert cur.status_code == 200
    assert cur.json()["id"] == body["id"]


async def test_current_is_null_without_open_shift(client: AsyncClient):
    headers, rid, _ = await setup(client)
    cur = await client.get(f"/restaurants/{rid}/shifts/current", headers=headers)
    assert cur.status_code == 200
    assert cur.json() is None


# CA-02
async def test_second_open_409(client: AsyncClient):
    headers, rid, staff = await setup(client)
    assert (await open_shift(client, headers, rid, staff["id"])).status_code == 201
    dup = await open_shift(client, headers, rid, staff["id"])
    assert dup.status_code == 409
    assert dup.json()["detail"] == "shift_already_open"


async def test_partial_unique_index_maps_to_409(client: AsyncClient, db_session: AsyncSession):
    """Race: the DB index (not the pre-check) is what raises; must map to 409."""
    from app.schemas.cash_shift import CashShiftOpen
    from app.services import cash_shift as svc
    from fastapi import HTTPException
    import pytest

    headers, rid, staff = await setup(client)
    assert (await open_shift(client, headers, rid, staff["id"])).status_code == 201

    async def no_precheck(*a, **k):
        return None

    orig = svc.get_open_shift
    svc.get_open_shift = no_precheck
    try:
        with pytest.raises(HTTPException) as exc:
            await svc.open_shift(
                uuid.UUID(rid),
                CashShiftOpen(staff_member_id=uuid.UUID(staff["id"]), opening_amount=Decimal("1")),
                db_session,
            )
    finally:
        svc.get_open_shift = orig
    assert exc.value.status_code == 409
    assert exc.value.detail == "shift_already_open"


# CA-03
async def test_close_expected_and_difference(client: AsyncClient, db_session: AsyncSession):
    headers, rid, staff = await setup(client)
    shift = (await open_shift(client, headers, rid, staff["id"])).json()
    await add_order(db_session, rid, "50.00", cash_shift_id=shift["id"])
    await add_order(db_session, rid, "30.00", cash_shift_id=shift["id"])
    await add_order(db_session, rid, "999.00", status=OrderStatus.pending, cash_shift_id=shift["id"])

    res = await close_shift(client, headers, rid, shift["id"], staff["id"], "180.00")
    assert res.status_code == 200, res.text
    body = res.json()
    assert Decimal(body["expected_amount"]) == Decimal("180.00")
    assert Decimal(body["counted_amount"]) == Decimal("180.00")
    assert Decimal(body["difference"]) == Decimal("0.00")
    assert body["closed_at"] is not None
    assert body["closed_by_name"] == "Ana"


async def test_close_negative_difference(client: AsyncClient, db_session: AsyncSession):
    headers, rid, staff = await setup(client)
    shift = (await open_shift(client, headers, rid, staff["id"])).json()
    await add_order(db_session, rid, "50.00", cash_shift_id=shift["id"])
    await add_order(db_session, rid, "30.00", cash_shift_id=shift["id"])
    res = await close_shift(client, headers, rid, shift["id"], staff["id"], "170.00")
    assert Decimal(res.json()["difference"]) == Decimal("-10.00")


async def test_other_restaurant_orders_not_counted(client: AsyncClient, db_session: AsyncSession):
    headers, rid, staff = await setup(client)
    other = await make_restaurant(client, headers, name="Other")
    shift = (await open_shift(client, headers, rid, staff["id"])).json()
    await add_order(db_session, other["id"], "70.00")
    res = await close_shift(client, headers, rid, shift["id"], staff["id"], "100.00")
    assert Decimal(res.json()["expected_amount"]) == Decimal("100.00")


# CA-04
async def test_order_before_open_not_counted(client: AsyncClient, db_session: AsyncSession):
    headers, rid, staff = await setup(client)
    await add_order(db_session, rid, "40.00")  # completed outside any shift
    shift = (await open_shift(client, headers, rid, staff["id"])).json()
    await add_order(db_session, rid, "30.00", cash_shift_id=shift["id"])
    res = await close_shift(client, headers, rid, shift["id"], staff["id"], "130.00")
    assert Decimal(res.json()["expected_amount"]) == Decimal("130.00")


# CA-05
async def test_close_twice_409_then_reopen(client: AsyncClient):
    headers, rid, staff = await setup(client)
    shift = (await open_shift(client, headers, rid, staff["id"])).json()
    assert (
        await close_shift(client, headers, rid, shift["id"], staff["id"], "100.00")
    ).status_code == 200
    again = await close_shift(client, headers, rid, shift["id"], staff["id"], "100.00")
    assert again.status_code == 409
    assert again.json()["detail"] == "shift_already_closed"

    cur = await client.get(f"/restaurants/{rid}/shifts/current", headers=headers)
    assert cur.json() is None
    assert (await open_shift(client, headers, rid, staff["id"])).status_code == 201


async def test_close_unknown_shift_404(client: AsyncClient):
    headers, rid, staff = await setup(client)
    res = await close_shift(client, headers, rid, str(uuid.uuid4()), staff["id"], "1.00")
    assert res.status_code == 404
    assert res.json()["detail"] == "shift_not_found"


async def test_close_shift_of_other_restaurant_404(client: AsyncClient):
    headers, rid, staff = await setup(client)
    other = await make_restaurant(client, headers, name="Other")
    other_staff = await make_staff(client, headers, other["id"], name="Bea", pin="2222")
    shift = (await open_shift(client, headers, rid, staff["id"])).json()
    res = await close_shift(client, headers, other["id"], shift["id"], other_staff["id"], "1.00")
    assert res.status_code == 404
    assert res.json()["detail"] == "shift_not_found"


# CA-06
async def test_inactive_staff_422(client: AsyncClient):
    headers, rid, staff = await setup(client)
    await client.patch(
        f"/restaurants/{rid}/staff/{staff['id']}", json={"active": False}, headers=headers
    )
    res = await open_shift(client, headers, rid, staff["id"])
    assert res.status_code == 422
    assert res.json()["detail"] == "staff_member_inactive"


async def test_staff_of_other_restaurant_404(client: AsyncClient):
    headers, rid, _ = await setup(client)
    other = await make_restaurant(client, headers, name="Other")
    foreign = await make_staff(client, headers, other["id"], name="Bea", pin="2222")
    res = await open_shift(client, headers, rid, foreign["id"])
    assert res.status_code == 404
    assert res.json()["detail"] == "staff_member_not_found"
    res = await open_shift(client, headers, rid, str(uuid.uuid4()))
    assert res.status_code == 404


async def test_close_validates_staff(client: AsyncClient):
    headers, rid, staff = await setup(client)
    other_staff = await make_staff(client, headers, rid, name="Bea", pin="2222")
    shift = (await open_shift(client, headers, rid, staff["id"])).json()
    await client.patch(
        f"/restaurants/{rid}/staff/{other_staff['id']}", json={"active": False}, headers=headers
    )
    res = await close_shift(client, headers, rid, shift["id"], other_staff["id"], "1.00")
    assert res.status_code == 422
    assert res.json()["detail"] == "staff_member_inactive"
    res = await close_shift(client, headers, rid, shift["id"], str(uuid.uuid4()), "1.00")
    assert res.status_code == 404
    assert res.json()["detail"] == "staff_member_not_found"


# CA-07
async def test_delete_staff_keeps_snapshot(client: AsyncClient, db_session: AsyncSession):
    headers, rid, staff = await setup(client)
    shift = (await open_shift(client, headers, rid, staff["id"])).json()
    d = await client.delete(f"/restaurants/{rid}/staff/{staff['id']}", headers=headers)
    assert d.status_code == 204
    hist = await client.get(f"/restaurants/{rid}/shifts", headers=headers)
    assert hist.status_code == 200
    assert hist.json()[0]["id"] == shift["id"]
    assert hist.json()[0]["opened_by_name"] == "Ana"


# CA-08
async def test_no_role_403(client: AsyncClient):
    headers, rid, staff = await setup(client)
    other = await as_user(client, email="x@example.com")
    for res in [
        await open_shift(client, other, rid, staff["id"]),
        await client.get(f"/restaurants/{rid}/shifts", headers=other),
        await client.get(f"/restaurants/{rid}/shifts/current", headers=other),
        await close_shift(client, other, rid, str(uuid.uuid4()), staff["id"], "1.00"),
    ]:
        assert res.status_code == 403
        assert res.json()["detail"] == "no_role"


async def test_inactive_restaurant_403(client: AsyncClient, db_session: AsyncSession):
    headers, rid, staff = await setup(client)
    await db_session.execute(
        update(Restaurant).where(Restaurant.id == uuid.UUID(rid)).values(is_active=False)
    )
    await db_session.commit()
    res = await open_shift(client, headers, rid, staff["id"])
    assert res.status_code == 403
    assert res.json()["detail"] == "restaurant_inactive"
    res = await client.get(f"/restaurants/{rid}/shifts/current", headers=headers)
    assert res.status_code == 403


async def test_unauthenticated_401(client: AsyncClient):
    headers, rid, _ = await setup(client)
    res = await client.get(f"/restaurants/{rid}/shifts")
    assert res.status_code in (401, 403)


# RF-06 / RF-04
async def test_invalid_amounts_422(client: AsyncClient):
    headers, rid, staff = await setup(client)
    for bad in ["-1", "100000000.00", "1.234"]:
        res = await open_shift(client, headers, rid, staff["id"], amount=bad)
        assert res.status_code == 422, bad
    shift = (await open_shift(client, headers, rid, staff["id"])).json()
    for bad in ["-0.01", "100000000.00", "1.234"]:
        res = await close_shift(client, headers, rid, shift["id"], staff["id"], bad)
        assert res.status_code == 422, bad


async def test_amounts_serialized_two_decimals(client: AsyncClient):
    headers, rid, staff = await setup(client)
    res = await open_shift(client, headers, rid, staff["id"], amount="100.5")
    assert res.json()["opening_amount"] == "100.50"


async def test_history_order_and_pagination(client: AsyncClient):
    headers, rid, staff = await setup(client)
    ids = []
    for _ in range(3):
        s = (await open_shift(client, headers, rid, staff["id"])).json()
        ids.append(s["id"])
        await close_shift(client, headers, rid, s["id"], staff["id"], "100.00")
    res = await client.get(f"/restaurants/{rid}/shifts", headers=headers)
    assert [s["id"] for s in res.json()] == ids[::-1]
    res = await client.get(f"/restaurants/{rid}/shifts?limit=1&offset=1", headers=headers)
    assert [s["id"] for s in res.json()] == [ids[1]]
    for bad in ["limit=0", "limit=101", "offset=-1"]:
        assert (await client.get(f"/restaurants/{rid}/shifts?{bad}", headers=headers)).status_code == 422


async def test_expected_amount_persisted_as_snapshot(client: AsyncClient, db_session: AsyncSession):
    headers, rid, staff = await setup(client)
    shift = (await open_shift(client, headers, rid, staff["id"])).json()
    await add_order(db_session, rid, "20.00", cash_shift_id=shift["id"])
    await close_shift(client, headers, rid, shift["id"], staff["id"], "120.00")
    row = (
        await db_session.execute(select(CashShift).where(CashShift.id == uuid.UUID(shift["id"])))
    ).scalar_one()
    assert row.expected_amount == Decimal("120.00")
