"""
Tests for M3.5 — Public menu endpoint (GET /menu/{qr_token}).

Read-only, unauthenticated. asyncio_mode=auto via pytest.ini.

Decisiones cerradas:
- PA-01: la respuesta incluye ``slug`` del restaurant.
- PA-02: sin Cache-Control especial.
- PA-03: resolución solo por qr_token (no por slug).
"""
import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import Restaurant
from app.models.style import FontFamily, MenuStyle

# Keys that must NEVER leak into the public payload at any nesting level.
_FORBIDDEN_KEYS = {"email", "user_id", "hashed_password", "role", "qr_token"}


# ---------------------------------------------------------------------------
# Helpers — build data through the authenticated API, then read it publicly.
# ---------------------------------------------------------------------------


async def as_user(client: AsyncClient, email: str = "owner@example.com") -> dict:
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "full_name": "Owner"},
    )
    token = res.json()["access_token"]
    client.cookies.clear()
    return {"Authorization": f"Bearer {token}"}


async def make_restaurant(client: AsyncClient, headers: dict, name: str = "My Bar") -> dict:
    res = await client.post("/restaurants", json={"name": name}, headers=headers)
    return res.json()


async def make_category(
    client: AsyncClient, headers: dict, rid: str, name: str, type_: str = "food"
) -> str:
    res = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": name, "type": type_},
        headers=headers,
    )
    return res.json()["id"]


async def make_subcategory(
    client: AsyncClient, headers: dict, rid: str, cid: str, name: str
) -> str:
    res = await client.post(
        f"/restaurants/{rid}/categories/{cid}/subcategories",
        json={"name": name},
        headers=headers,
    )
    return res.json()["id"]


async def make_item(
    client: AsyncClient,
    headers: dict,
    rid: str,
    sid: str,
    name: str,
    price: str = "350.00",
    description: str = "Rico",
) -> str:
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items",
        json={"name": name, "description": description, "price": price},
        headers=headers,
    )
    return res.json()["id"]


async def add_tag(
    client: AsyncClient, headers: dict, rid: str, sid: str, iid: str, name: str
) -> None:
    await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/tags",
        json={"name": name},
        headers=headers,
    )


def _collect_keys(node) -> set[str]:
    """Recursively collect every dict key present in a JSON-like structure."""
    keys: set[str] = set()
    if isinstance(node, dict):
        for k, v in node.items():
            keys.add(k)
            keys |= _collect_keys(v)
    elif isinstance(node, list):
        for v in node:
            keys |= _collect_keys(v)
    return keys


# ---------------------------------------------------------------------------
# CA-01 — full tree, price as string
# ---------------------------------------------------------------------------


async def test_ca01_full_menu_tree(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers, name="Bodegón")
    rid, qr = restaurant["id"], restaurant["qr_token"]
    cid = await make_category(client, headers, rid, "Comidas", "food")
    sid = await make_subcategory(client, headers, rid, cid, "Pastas")
    iid = await make_item(client, headers, rid, sid, "Ravioles", price="350.00")
    await add_tag(client, headers, rid, sid, iid, "vegetariano")

    res = await client.get(f"/menu/{qr}")
    assert res.status_code == 200
    body = res.json()

    assert body["restaurant"] == {"name": "Bodegón", "slug": restaurant["slug"]}
    assert len(body["categories"]) == 1
    cat = body["categories"][0]
    assert cat["name"] == "Comidas"
    assert cat["type"] == "food"
    sub = cat["subcategories"][0]
    assert sub["name"] == "Pastas"
    item = sub["items"][0]
    assert item["id"] == iid
    assert item["name"] == "Ravioles"
    assert item["description"] == "Rico"
    assert item["price"] == "350.00"
    assert item["tags"][0]["name"] == "vegetariano"
    assert uuid.UUID(item["tags"][0]["id"])


# ---------------------------------------------------------------------------
# CA-02 — unknown qr_token -> 404
# ---------------------------------------------------------------------------


async def test_ca02_unknown_token_404(client: AsyncClient):
    res = await client.get(f"/menu/{uuid.uuid4()}")
    assert res.status_code == 404
    assert res.json() == {"detail": "menu_not_found"}


# ---------------------------------------------------------------------------
# CA-03 — no MenuStyle -> style is null
# ---------------------------------------------------------------------------


async def test_ca03_no_style_is_null(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    res = await client.get(f"/menu/{restaurant['qr_token']}")
    assert res.status_code == 200
    assert res.json()["style"] is None


# ---------------------------------------------------------------------------
# CA-04 — MenuStyle present -> populated
# ---------------------------------------------------------------------------


async def test_ca04_style_populated(client: AsyncClient, db_session: AsyncSession):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]

    db_session.add(
        MenuStyle(
            restaurant_id=uuid.UUID(rid),
            font_family=FontFamily.playfair_display,
            primary_color="#112233",
            secondary_color="#445566",
        )
    )
    await db_session.commit()

    res = await client.get(f"/menu/{qr}")
    assert res.status_code == 200
    style = res.json()["style"]
    assert style == {
        "font_family": "Playfair Display",
        "primary_color": "#112233",
        "secondary_color": "#445566",
    }


# ---------------------------------------------------------------------------
# CA-05 — no sensitive keys anywhere in the payload
# ---------------------------------------------------------------------------


async def test_ca05_no_sensitive_keys(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    cid = await make_category(client, headers, rid, "Comidas")
    sid = await make_subcategory(client, headers, rid, cid, "Pastas")
    iid = await make_item(client, headers, rid, sid, "Ravioles")
    await add_tag(client, headers, rid, sid, iid, "vegetariano")

    res = await client.get(f"/menu/{qr}")
    assert res.status_code == 200
    present = _collect_keys(res.json())
    assert _FORBIDDEN_KEYS.isdisjoint(present), present & _FORBIDDEN_KEYS


# ---------------------------------------------------------------------------
# CA-06 — alphabetical ordering of categories, subcategories and items
# ---------------------------------------------------------------------------


async def test_ca06_alphabetical_ordering(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]

    cid_b = await make_category(client, headers, rid, "Bebidas", "drink")
    cid_a = await make_category(client, headers, rid, "Aperitivos", "food")
    sid_z = await make_subcategory(client, headers, rid, cid_a, "Zapallo")
    sid_a = await make_subcategory(client, headers, rid, cid_a, "Aceitunas")
    await make_item(client, headers, rid, sid_a, "Verdes")
    await make_item(client, headers, rid, sid_a, "Negras")

    res = await client.get(f"/menu/{qr}")
    body = res.json()

    assert [c["name"] for c in body["categories"]] == ["Aperitivos", "Bebidas"]
    aperitivos = body["categories"][0]
    assert [s["name"] for s in aperitivos["subcategories"]] == ["Aceitunas", "Zapallo"]
    aceitunas = aperitivos["subcategories"][0]
    assert [i["name"] for i in aceitunas["items"]] == ["Negras", "Verdes"]


# ---------------------------------------------------------------------------
# CA-07 — fully anonymous request (no cookie, no Authorization header)
# ---------------------------------------------------------------------------


async def test_ca07_anonymous_request(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)

    # Drop every trace of identity, then hit the endpoint bare.
    client.cookies.clear()
    res = await client.get(f"/menu/{restaurant['qr_token']}")
    assert res.status_code == 200
    assert "Authorization" not in res.request.headers
    assert res.json()["restaurant"]["name"] == "My Bar"


# ---------------------------------------------------------------------------
# Sanity — qr_token really resolves the right restaurant
# ---------------------------------------------------------------------------


async def test_token_resolves_correct_restaurant(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers, name="Unico")
    row = await db_session.execute(
        select(Restaurant).where(Restaurant.name == "Unico")
    )
    assert str(row.scalar_one().qr_token) == restaurant["qr_token"]
