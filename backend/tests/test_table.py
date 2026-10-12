"""
Tests for M17 — Tables (CRUD) and their link to public order creation.

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.
"""
import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

# ---------------------------------------------------------------------------
# Helpers (mirrors test_orders.py)
# ---------------------------------------------------------------------------


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


async def enable_orders(client: AsyncClient, headers: dict, rid: str, name: str = "My Bar") -> dict:
    res = await client.patch(
        f"/restaurants/{rid}",
        json={"name": name, "orders_enabled": True},
        headers=headers,
    )
    return res.json()


async def make_subcategory(client: AsyncClient, headers: dict, rid: str, cat: str = "Platos") -> str:
    created = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": cat, "type": "food"},
        headers=headers,
    )
    category_id = created.json()["id"]
    sub = await client.post(
        f"/restaurants/{rid}/categories/{category_id}/subcategories",
        json={"name": "Pastas"},
        headers=headers,
    )
    return sub.json()["id"]


async def make_item(
    client: AsyncClient, headers: dict, rid: str, sid: str, name: str = "Ravioles", price: str = "10.00"
) -> str:
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items",
        json={"name": name, "description": "", "price": price},
        headers=headers,
    )
    return res.json()["id"]


# ---------------------------------------------------------------------------
# CA-01 — crear mesa, duplicado de número en el mismo restaurant → 409
# ---------------------------------------------------------------------------


async def test_create_table_then_duplicate_number_409(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    res = await client.post(
        f"/restaurants/{rid}/tables", json={"number": 5, "capacity": 4}, headers=headers
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["number"] == 5
    assert body["capacity"] == 4
    uuid.UUID(body["id"])

    dup = await client.post(
        f"/restaurants/{rid}/tables", json={"number": 5}, headers=headers
    )
    assert dup.status_code == 409
    assert dup.json()["detail"] == "table_number_taken"


async def test_same_number_allowed_across_restaurants(client: AsyncClient):
    headers = await as_user(client)
    r1 = await make_restaurant(client, headers, name="Bar 1")
    r2 = await make_restaurant(client, headers, name="Bar 2")

    res1 = await client.post(
        f"/restaurants/{r1['id']}/tables", json={"number": 1}, headers=headers
    )
    res2 = await client.post(
        f"/restaurants/{r2['id']}/tables", json={"number": 1}, headers=headers
    )
    assert res1.status_code == 201
    assert res2.status_code == 201


async def test_list_tables_ordered_by_number(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    for n in (3, 1, 2):
        await client.post(f"/restaurants/{rid}/tables", json={"number": n}, headers=headers)

    res = await client.get(f"/restaurants/{rid}/tables", headers=headers)
    assert res.status_code == 200
    assert [t["number"] for t in res.json()] == [1, 2, 3]


async def test_update_table_number_conflict_409(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    t1 = (
        await client.post(f"/restaurants/{rid}/tables", json={"number": 1}, headers=headers)
    ).json()
    await client.post(f"/restaurants/{rid}/tables", json={"number": 2}, headers=headers)

    res = await client.patch(
        f"/restaurants/{rid}/tables/{t1['id']}", json={"number": 2}, headers=headers
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "table_number_taken"


# ---------------------------------------------------------------------------
# CA-02 — borrar una mesa con pedido histórico no borra el pedido (SET NULL)
# ---------------------------------------------------------------------------


async def test_delete_table_with_order_history_keeps_order(
    client: AsyncClient, db_session: AsyncSession
):
    from sqlalchemy import text

    # SQLite skips ON DELETE SET NULL unless FK enforcement is enabled on the
    # connection (off by default) — same pattern as test_orders.py's
    # test_deleted_item_leaves_order_history_intact.
    await db_session.execute(text("PRAGMA foreign_keys=ON"))

    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    await enable_orders(client, headers, rid)
    table = (
        await client.post(f"/restaurants/{rid}/tables", json={"number": 7}, headers=headers)
    ).json()

    client.cookies.clear()
    order_res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "table_id": table["id"],
            "items": [{"item_id": iid, "quantity": 1, "modifier_ids": []}],
        },
    )
    assert order_res.status_code == 201, order_res.text
    order_id = order_res.json()["id"]
    assert order_res.json()["table_or_address"] == "Mesa 7"
    assert order_res.json()["table_id"] == table["id"]

    del_res = await client.delete(f"/restaurants/{rid}/tables/{table['id']}", headers=headers)
    assert del_res.status_code == 204

    listed = await client.get(f"/restaurants/{rid}/orders", headers=headers)
    orders = listed.json()
    assert len(orders) == 1
    assert orders[0]["id"] == order_id
    assert orders[0]["table_id"] is None
    assert orders[0]["table_or_address"] == "Mesa 7"  # text snapshot survives


# ---------------------------------------------------------------------------
# CA-03/04 — order creation validates table_id against the restaurant
# ---------------------------------------------------------------------------


async def test_create_order_with_table_id_stamps_text_server_side(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    await enable_orders(client, headers, rid)
    table = (
        await client.post(f"/restaurants/{rid}/tables", json={"number": 3}, headers=headers)
    ).json()

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "table_id": table["id"],
            # Client-sent text must be ignored in favor of the server-built one.
            "table_or_address": "spoofed text",
            "items": [{"item_id": iid, "quantity": 1, "modifier_ids": []}],
        },
    )
    assert res.status_code == 201, res.text
    assert res.json()["table_or_address"] == "Mesa 3"


async def test_create_order_with_table_id_from_other_restaurant_404(client: AsyncClient):
    headers = await as_user(client)
    r1 = await make_restaurant(client, headers, name="Bar 1")
    r2 = await make_restaurant(client, headers, name="Bar 2")
    sid = await make_subcategory(client, headers, r1["id"])
    iid = await make_item(client, headers, r1["id"], sid)
    await enable_orders(client, headers, r1["id"], name="Bar 1")
    other_table = (
        await client.post(f"/restaurants/{r2['id']}/tables", json={"number": 1}, headers=headers)
    ).json()

    client.cookies.clear()
    res = await client.post(
        f"/menu/{r1['qr_token']}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "table_id": other_table["id"],
            "items": [{"item_id": iid, "quantity": 1, "modifier_ids": []}],
        },
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "table_not_found"


async def test_create_order_mesa_without_table_id_keeps_free_text(client: AsyncClient):
    """Backward compat — a restaurant with no tables configured yet still works."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "table_or_address": "Mesa 9 (anotada a mano)",
            "items": [{"item_id": iid, "quantity": 1, "modifier_ids": []}],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["table_or_address"] == "Mesa 9 (anotada a mano)"
    assert body["table_id"] is None


# ---------------------------------------------------------------------------
# CA-05 — public menu exposes `tables`
# ---------------------------------------------------------------------------


async def test_public_menu_exposes_tables(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await client.post(f"/restaurants/{rid}/tables", json={"number": 1, "capacity": 2}, headers=headers)
    await client.post(f"/restaurants/{rid}/tables", json={"number": 2}, headers=headers)

    client.cookies.clear()
    res = await client.get(f"/menu/{qr}")
    assert res.status_code == 200
    tables = res.json()["tables"]
    assert [t["number"] for t in tables] == [1, 2]
    assert tables[0]["capacity"] == 2
    assert tables[1]["capacity"] is None


async def test_public_menu_no_tables_configured_is_empty_list(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    qr = restaurant["qr_token"]

    client.cookies.clear()
    res = await client.get(f"/menu/{qr}")
    assert res.status_code == 200
    assert res.json()["tables"] == []
