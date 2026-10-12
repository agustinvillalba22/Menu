"""
Tests for M19 — Stock items + Suppliers (CRUD, manual inventory only).

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.
"""
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


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


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------


async def test_create_supplier_name_only(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    res = await client.post(
        f"/restaurants/{rid}/suppliers", json={"name": "Distribuidora X"}, headers=headers
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "Distribuidora X"
    assert body["category"] is None
    assert body["active"] is True


async def test_list_suppliers_ordered_by_name(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    for name in ["Zeta", "Alfa", "Beta"]:
        await client.post(f"/restaurants/{rid}/suppliers", json={"name": name}, headers=headers)

    res = await client.get(f"/restaurants/{rid}/suppliers", headers=headers)
    assert [s["name"] for s in res.json()] == ["Alfa", "Beta", "Zeta"]


async def test_delete_supplier(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    supplier = (
        await client.post(f"/restaurants/{rid}/suppliers", json={"name": "X"}, headers=headers)
    ).json()

    del_res = await client.delete(f"/restaurants/{rid}/suppliers/{supplier['id']}", headers=headers)
    assert del_res.status_code == 204
    assert (await client.get(f"/restaurants/{rid}/suppliers", headers=headers)).json() == []


# ---------------------------------------------------------------------------
# Stock items
# ---------------------------------------------------------------------------


async def test_create_stock_item_defaults(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    res = await client.post(
        f"/restaurants/{rid}/stock-items",
        json={"name": "Harina 000", "category": "almacen_secos", "unit": "kg"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["quantity"] == "0.00"
    assert body["min_threshold"] == "0.00"
    assert isinstance(body["quantity"], str)
    assert body["cost_per_unit"] is None
    assert body["supplier_id"] is None


async def test_create_stock_item_with_supplier(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    supplier = (
        await client.post(f"/restaurants/{rid}/suppliers", json={"name": "X"}, headers=headers)
    ).json()

    res = await client.post(
        f"/restaurants/{rid}/stock-items",
        json={
            "name": "Mozzarella",
            "category": "lacteos",
            "unit": "kg",
            "quantity": "5.50",
            "min_threshold": "2.00",
            "cost_per_unit": "3.80",
            "supplier_id": supplier["id"],
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["quantity"] == "5.50"
    assert body["cost_per_unit"] == "3.80"
    assert body["supplier_id"] == supplier["id"]


# ---------------------------------------------------------------------------
# CA-02 — supplier_id de otro restaurant → 404
# ---------------------------------------------------------------------------


async def test_create_stock_item_supplier_from_other_restaurant_404(client: AsyncClient):
    headers = await as_user(client)
    r1 = await make_restaurant(client, headers, name="Bar 1")
    r2 = await make_restaurant(client, headers, name="Bar 2")
    other_supplier = (
        await client.post(f"/restaurants/{r2['id']}/suppliers", json={"name": "X"}, headers=headers)
    ).json()

    res = await client.post(
        f"/restaurants/{r1['id']}/stock-items",
        json={
            "name": "Harina",
            "category": "almacen_secos",
            "unit": "kg",
            "supplier_id": other_supplier["id"],
        },
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "supplier_not_found"


async def test_update_stock_item_supplier_from_other_restaurant_404(client: AsyncClient):
    headers = await as_user(client)
    r1 = await make_restaurant(client, headers, name="Bar 1")
    r2 = await make_restaurant(client, headers, name="Bar 2")
    item = (
        await client.post(
            f"/restaurants/{r1['id']}/stock-items",
            json={"name": "Harina", "category": "almacen_secos", "unit": "kg"},
            headers=headers,
        )
    ).json()
    other_supplier = (
        await client.post(f"/restaurants/{r2['id']}/suppliers", json={"name": "X"}, headers=headers)
    ).json()

    res = await client.patch(
        f"/restaurants/{r1['id']}/stock-items/{item['id']}",
        json={"supplier_id": other_supplier["id"]},
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "supplier_not_found"


# ---------------------------------------------------------------------------
# CA-03 — borrar un supplier con stock_items vinculados no los borra
# ---------------------------------------------------------------------------


async def test_delete_supplier_with_stock_items_keeps_them(
    client: AsyncClient, db_session: AsyncSession
):
    from sqlalchemy import text

    # SQLite skips ON DELETE SET NULL unless FK enforcement is enabled on the
    # connection (off by default) — same pattern as test_orders.py/test_table.py.
    await db_session.execute(text("PRAGMA foreign_keys=ON"))

    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    supplier = (
        await client.post(f"/restaurants/{rid}/suppliers", json={"name": "X"}, headers=headers)
    ).json()
    item = (
        await client.post(
            f"/restaurants/{rid}/stock-items",
            json={
                "name": "Harina",
                "category": "almacen_secos",
                "unit": "kg",
                "supplier_id": supplier["id"],
            },
            headers=headers,
        )
    ).json()

    del_res = await client.delete(f"/restaurants/{rid}/suppliers/{supplier['id']}", headers=headers)
    assert del_res.status_code == 204

    listed = await client.get(f"/restaurants/{rid}/stock-items", headers=headers)
    items = listed.json()
    assert len(items) == 1
    assert items[0]["id"] == item["id"]
    assert items[0]["supplier_id"] is None


async def test_list_stock_items_ordered_by_name(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    for name in ["Zapallo", "Arroz", "Mozzarella"]:
        await client.post(
            f"/restaurants/{rid}/stock-items",
            json={"name": name, "category": "almacen_secos", "unit": "unidades"},
            headers=headers,
        )

    res = await client.get(f"/restaurants/{rid}/stock-items", headers=headers)
    assert [i["name"] for i in res.json()] == ["Arroz", "Mozzarella", "Zapallo"]


async def test_update_stock_item_quantity(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    item = (
        await client.post(
            f"/restaurants/{rid}/stock-items",
            json={"name": "Harina", "category": "almacen_secos", "unit": "kg"},
            headers=headers,
        )
    ).json()

    res = await client.patch(
        f"/restaurants/{rid}/stock-items/{item['id']}", json={"quantity": "12.50"}, headers=headers
    )
    assert res.status_code == 200
    assert res.json()["quantity"] == "12.50"


async def test_delete_stock_item(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    item = (
        await client.post(
            f"/restaurants/{rid}/stock-items",
            json={"name": "Harina", "category": "almacen_secos", "unit": "kg"},
            headers=headers,
        )
    ).json()

    del_res = await client.delete(f"/restaurants/{rid}/stock-items/{item['id']}", headers=headers)
    assert del_res.status_code == 204
    assert (await client.get(f"/restaurants/{rid}/stock-items", headers=headers)).json() == []
