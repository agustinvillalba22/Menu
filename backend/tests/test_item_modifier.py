"""
Tests for M11 — Item modifiers CRUD (nested under an item).

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.

Identidad: ``as_user`` registra un usuario, limpia cookies y devuelve el header
Bearer, mismo patrón que test_item.py.

Cubre CA-01 (crear → 201, item_id del path), CA-02 (aislamiento
cross-restaurant en PATCH/DELETE → 404), y RF-01 (CRUD completo vía
require_role(editor)).
"""
import uuid

from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
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


async def make_restaurant(
    client: AsyncClient, headers: dict, name: str = "My Bar"
) -> str:
    res = await client.post("/restaurants", json={"name": name}, headers=headers)
    return res.json()["id"]


async def make_subcategory(
    client: AsyncClient, headers: dict, rid: str, cat: str = "Platos"
) -> str:
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
    client: AsyncClient,
    headers: dict,
    rid: str,
    sid: str,
    name: str = "Ravioles",
    price: str = "10.00",
) -> str:
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items",
        json={"name": name, "description": "", "price": price},
        headers=headers,
    )
    return res.json()["id"]


async def make_modifier(
    client: AsyncClient,
    headers: dict,
    rid: str,
    sid: str,
    iid: str,
    name: str = "Extra queso",
    price_delta: str = "1.50",
    type_: str = "extra",
):
    return await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/modifiers",
        json={"name": name, "price_delta": price_delta, "type": type_},
        headers=headers,
    )


# ---------------------------------------------------------------------------
# CA-01 — crear modificador → 201, item_id igual al del path
# ---------------------------------------------------------------------------


async def test_create_modifier_returns_201_with_path_item_id(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    res = await make_modifier(client, headers, rid, sid, iid)
    assert res.status_code == 201
    body = res.json()
    assert body["item_id"] == iid
    assert body["name"] == "Extra queso"
    assert body["price_delta"] == "1.50"
    assert body["type"] == "extra"
    uuid.UUID(body["id"])


async def test_create_modifier_price_delta_negative_allowed(client: AsyncClient):
    """price_delta puede ser negativo (removal) — condecimal sin ge=0."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    res = await make_modifier(
        client, headers, rid, sid, iid,
        name="Sin cebolla", price_delta="-2.00", type_="removal",
    )
    assert res.status_code == 201
    assert res.json()["price_delta"] == "-2.00"
    assert res.json()["type"] == "removal"


async def test_create_modifier_empty_name_422(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    res = await make_modifier(client, headers, rid, sid, iid, name="")
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# RF-01 — listar (orden alfabético por name)
# ---------------------------------------------------------------------------


async def test_list_modifiers_alphabetical(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    await make_modifier(client, headers, rid, sid, iid, name="Zanahoria")
    await make_modifier(client, headers, rid, sid, iid, name="Aceituna")
    await make_modifier(client, headers, rid, sid, iid, name="Morron")

    res = await client.get(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/modifiers",
        headers=headers,
    )
    assert res.status_code == 200
    assert [m["name"] for m in res.json()] == ["Aceituna", "Morron", "Zanahoria"]


# ---------------------------------------------------------------------------
# RF-01 — editar (PATCH parcial)
# ---------------------------------------------------------------------------


async def test_update_modifier_partial(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    mid = (await make_modifier(client, headers, rid, sid, iid)).json()["id"]

    res = await client.patch(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/modifiers/{mid}",
        json={"price_delta": "3.25"},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["price_delta"] == "3.25"
    assert body["name"] == "Extra queso"  # sin cambios


# ---------------------------------------------------------------------------
# RF-01 — borrar → 204, ya no aparece
# ---------------------------------------------------------------------------


async def test_delete_modifier(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    mid = (await make_modifier(client, headers, rid, sid, iid)).json()["id"]

    res = await client.delete(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/modifiers/{mid}",
        headers=headers,
    )
    assert res.status_code == 204
    assert res.content == b""

    listed = await client.get(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/modifiers",
        headers=headers,
    )
    assert listed.json() == []


async def test_delete_modifier_not_belonging_404(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    ghost = str(uuid.uuid4())

    res = await client.delete(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/modifiers/{ghost}",
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "modifier_not_found"


# ---------------------------------------------------------------------------
# CA-02 — aislamiento cross-restaurant: PATCH/DELETE con ids de otro restaurant
# ---------------------------------------------------------------------------


async def test_patch_modifier_cross_restaurant_404(client: AsyncClient):
    headers = await as_user(client)
    rid_a = await make_restaurant(client, headers, name="Bar A")
    sid_a = await make_subcategory(client, headers, rid_a)
    iid_a = await make_item(client, headers, rid_a, sid_a)
    mid = (await make_modifier(client, headers, rid_a, sid_a, iid_a)).json()["id"]

    rid_b = await make_restaurant(client, headers, name="Bar B")
    sid_b = await make_subcategory(client, headers, rid_b)
    iid_b = await make_item(client, headers, rid_b, sid_b)

    # Same modifier_id, but the restaurant/subcategory/item chain in the URL is B's.
    res = await client.patch(
        f"/restaurants/{rid_b}/subcategories/{sid_b}/items/{iid_b}/modifiers/{mid}",
        json={"name": "Hackeado"},
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "modifier_not_found"


async def test_delete_modifier_cross_restaurant_404(client: AsyncClient):
    headers = await as_user(client)
    rid_a = await make_restaurant(client, headers, name="Bar A")
    sid_a = await make_subcategory(client, headers, rid_a)
    iid_a = await make_item(client, headers, rid_a, sid_a)
    mid = (await make_modifier(client, headers, rid_a, sid_a, iid_a)).json()["id"]

    rid_b = await make_restaurant(client, headers, name="Bar B")
    sid_b = await make_subcategory(client, headers, rid_b)
    iid_b = await make_item(client, headers, rid_b, sid_b)

    res = await client.delete(
        f"/restaurants/{rid_b}/subcategories/{sid_b}/items/{iid_b}/modifiers/{mid}",
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "modifier_not_found"


async def test_create_modifier_on_item_of_other_subcategory_404(client: AsyncClient):
    """El item existe pero no pertenece a la subcategoría del path → item_not_found."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid_a = await make_subcategory(client, headers, rid, cat="Comidas")
    sid_b = await make_subcategory(client, headers, rid, cat="Bebidas")
    iid = await make_item(client, headers, rid, sid_a)

    res = await make_modifier(client, headers, rid, sid_b, iid)
    assert res.status_code == 404
    assert res.json()["detail"] == "item_not_found"


# ---------------------------------------------------------------------------
# RF-01 — require_role(editor): sin auth y sin rol son rechazados
# ---------------------------------------------------------------------------


async def test_create_modifier_without_auth_401(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    client.cookies.clear()
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/modifiers",
        json={"name": "Extra queso", "price_delta": "1.50", "type": "extra"},
    )
    assert res.status_code == 401


async def test_create_modifier_without_role_403(client: AsyncClient):
    owner = await as_user(client, email="owner@example.com")
    rid = await make_restaurant(client, owner)
    sid = await make_subcategory(client, owner, rid)
    iid = await make_item(client, owner, rid, sid)

    stranger = await as_user(client, email="stranger@example.com")
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/modifiers",
        json={"name": "Extra queso", "price_delta": "1.50", "type": "extra"},
        headers=stranger,
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "no_role"
