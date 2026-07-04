"""
Tests for M3.2 — Categories & Subcategories.

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.

Identidad en los tests: igual que test_restaurant.py — ``as_user`` registra un
usuario, limpia cookies y devuelve el header Bearer para controlar la identidad.
"""
import uuid
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.models.menu import Category, Subcategory
from app.models.user import User


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


async def get_user_by_email(email: str, session: AsyncSession) -> User:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one()


async def make_restaurant(client: AsyncClient, headers: dict, name: str = "My Bar") -> str:
    res = await client.post("/restaurants", json={"name": name}, headers=headers)
    return res.json()["id"]


# ---------------------------------------------------------------------------
# CA-01: crear categoría → 201, asociada al menú default
# ---------------------------------------------------------------------------


async def test_create_category_associated_to_default_menu(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)

    res = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": "Entradas", "type": "food"},
        headers=headers,
    )

    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Entradas"
    assert body["type"] == "food"
    uuid.UUID(body["id"])
    assert "menu_id" not in body  # el contrato no expone menu_id

    # asociada al único Menu del restaurant
    from app.models.menu import Menu

    menu_id = (
        await db_session.execute(
            select(Menu.id).where(Menu.restaurant_id == uuid.UUID(rid))
        )
    ).scalar_one()
    category = (
        await db_session.execute(
            select(Category).where(Category.id == uuid.UUID(body["id"]))
        )
    ).scalar_one()
    assert category.menu_id == menu_id


# ---------------------------------------------------------------------------
# CA-02: type inválido → 422
# ---------------------------------------------------------------------------


async def test_invalid_type_returns_422(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)

    res = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": "Entradas", "type": "dessert"},
        headers=headers,
    )
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# CA-03: categoría de otro restaurant → 404 category_not_found
# ---------------------------------------------------------------------------


async def test_category_of_other_restaurant_not_found(
    client: AsyncClient, db_session: AsyncSession
):
    owner_headers = await as_user(client, email="owner@example.com")
    rid_a = await make_restaurant(client, owner_headers, name="Bar A")
    rid_b = await make_restaurant(client, owner_headers, name="Bar B")

    created = await client.post(
        f"/restaurants/{rid_a}/categories",
        json={"name": "Entradas", "type": "food"},
        headers=owner_headers,
    )
    category_id = created.json()["id"]

    # la categoría pertenece a A pero se pide bajo B → 404
    res = await client.get(
        f"/restaurants/{rid_b}/categories/{category_id}", headers=owner_headers
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "category_not_found"


# ---------------------------------------------------------------------------
# CA-04: borrar categoría con subcategoría + ítem → cascade borra todo
# ---------------------------------------------------------------------------


async def test_delete_category_cascades_subcategories_and_items(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)

    created = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": "Platos", "type": "food"},
        headers=headers,
    )
    category_id = uuid.UUID(created.json()["id"])

    sub_res = await client.post(
        f"/restaurants/{rid}/categories/{category_id}/subcategories",
        json={"name": "Pastas"},
        headers=headers,
    )
    subcategory_id = uuid.UUID(sub_res.json()["id"])

    # ítem directo en DB (el router de items aún no existe)
    item = Item(
        name="Ravioles",
        description="Con salsa",
        price=Decimal("1200.00"),
        subcategory_id=subcategory_id,
    )
    db_session.add(item)
    await db_session.commit()
    item_id = item.id

    res = await client.delete(
        f"/restaurants/{rid}/categories/{category_id}", headers=headers
    )
    assert res.status_code == 204
    assert res.content == b""

    # cascade: category, subcategory e item borrados
    assert (
        await db_session.execute(
            select(func.count()).select_from(Category).where(Category.id == category_id)
        )
    ).scalar_one() == 0
    assert (
        await db_session.execute(
            select(func.count())
            .select_from(Subcategory)
            .where(Subcategory.id == subcategory_id)
        )
    ).scalar_one() == 0
    assert (
        await db_session.execute(
            select(func.count()).select_from(Item).where(Item.id == item_id)
        )
    ).scalar_one() == 0


# ---------------------------------------------------------------------------
# CA-05: sin rol → 403 no_role
# ---------------------------------------------------------------------------


async def test_without_role_forbidden(client: AsyncClient):
    owner_headers = await as_user(client, email="owner@example.com")
    rid = await make_restaurant(client, owner_headers)

    stranger_headers = await as_user(client, email="stranger@example.com")
    res = await client.get(
        f"/restaurants/{rid}/categories", headers=stranger_headers
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "no_role"


# ---------------------------------------------------------------------------
# CA-06: PATCH subcategoría → 200, persiste
# ---------------------------------------------------------------------------


async def test_patch_subcategory_persists(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)

    created = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": "Platos", "type": "food"},
        headers=headers,
    )
    category_id = created.json()["id"]

    sub = await client.post(
        f"/restaurants/{rid}/categories/{category_id}/subcategories",
        json={"name": "Pastas"},
        headers=headers,
    )
    subcategory_id = sub.json()["id"]

    res = await client.patch(
        f"/restaurants/{rid}/categories/{category_id}/subcategories/{subcategory_id}",
        json={"name": "Pastas Frescas"},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Pastas Frescas"
    assert body["category_id"] == category_id

    persisted = (
        await db_session.execute(
            select(Subcategory).where(Subcategory.id == uuid.UUID(subcategory_id))
        )
    ).scalar_one()
    assert persisted.name == "Pastas Frescas"


# ---------------------------------------------------------------------------
# CA-07: listas ordenadas alfabéticamente
# ---------------------------------------------------------------------------


async def test_categories_listed_alphabetically(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)

    for name in ["Zanahorias", "Aperitivos", "Milanesas"]:
        await client.post(
            f"/restaurants/{rid}/categories",
            json={"name": name, "type": "food"},
            headers=headers,
        )

    res = await client.get(f"/restaurants/{rid}/categories", headers=headers)
    assert res.status_code == 200
    names = [c["name"] for c in res.json()]
    assert names == ["Aperitivos", "Milanesas", "Zanahorias"]


async def test_subcategories_listed_alphabetically(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)

    created = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": "Platos", "type": "food"},
        headers=headers,
    )
    category_id = created.json()["id"]

    for name in ["Ñoquis", "Canelones", "Ravioles"]:
        await client.post(
            f"/restaurants/{rid}/categories/{category_id}/subcategories",
            json={"name": name},
            headers=headers,
        )

    res = await client.get(
        f"/restaurants/{rid}/categories/{category_id}/subcategories",
        headers=headers,
    )
    assert res.status_code == 200
    names = [s["name"] for s in res.json()]
    assert names == sorted(names)
    assert names == ["Canelones", "Ravioles", "Ñoquis"]


# ---------------------------------------------------------------------------
# Extra: subcategoría inexistente bajo una categoría válida → 404
# ---------------------------------------------------------------------------


async def test_subcategory_not_found(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)

    created = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": "Platos", "type": "food"},
        headers=headers,
    )
    category_id = created.json()["id"]
    ghost = str(uuid.uuid4())

    res = await client.get(
        f"/restaurants/{rid}/categories/{category_id}/subcategories/{ghost}",
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "subcategory_not_found"
