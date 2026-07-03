"""
Tests for M3.1 — Restaurants: POST/GET/GET{id}/PATCH /restaurants.

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.

Nota sobre identidad en los tests:
El cliente httpx persiste la cookie httpOnly que setea /auth/register, y
get_current_user da precedencia a la cookie sobre el header Authorization.
Para actuar como un usuario concreto usamos ``as_user``: limpia las cookies del
cliente y devuelve el header Bearer, de modo que el header controla la identidad.
"""
import uuid

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.menu import Menu
from app.models.restaurant import Restaurant, RestaurantRole, UserRestaurantRole
from app.models.user import User
from app.services import restaurant as restaurant_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def as_user(
    client: AsyncClient,
    email: str = "owner@example.com",
    password: str = "password123",
    full_name: str = "Owner User",
) -> dict:
    """Registra un usuario y devuelve el header Authorization para actuar como él.

    Limpia las cookies del cliente para que el header —y no la cookie de la
    última registración— determine el usuario autenticado.
    """
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


# ---------------------------------------------------------------------------
# CA-01: crear restaurant
# ---------------------------------------------------------------------------


async def test_create_restaurant_returns_owner(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    res = await client.post("/restaurants", json={"name": "My Bar"}, headers=headers)

    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "My Bar"
    assert body["slug"] == "my-bar"
    assert body["role"] == "owner"
    assert body["qr_token"]  # no vacío
    uuid.UUID(body["id"])  # id válido

    # role owner persistido en DB
    result = await db_session.execute(
        select(UserRestaurantRole).where(
            UserRestaurantRole.restaurant_id == uuid.UUID(body["id"])
        )
    )
    assignment = result.scalar_one()
    assert assignment.role == RestaurantRole.owner


# ---------------------------------------------------------------------------
# CA-02: slug duplicado → sufijo -2
# ---------------------------------------------------------------------------


async def test_duplicate_name_gets_suffixed_slug(client: AsyncClient):
    headers = await as_user(client)

    first = await client.post("/restaurants", json={"name": "My Bar"}, headers=headers)
    second = await client.post("/restaurants", json={"name": "My Bar"}, headers=headers)

    assert first.json()["slug"] == "my-bar"
    assert second.json()["slug"] == "my-bar-2"


# ---------------------------------------------------------------------------
# CA-03: exactamente 1 Menu asociado
# ---------------------------------------------------------------------------


async def test_create_makes_exactly_one_default_menu(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    res = await client.post("/restaurants", json={"name": "My Bar"}, headers=headers)
    restaurant_id = uuid.UUID(res.json()["id"])

    result = await db_session.execute(
        select(func.count()).select_from(Menu).where(Menu.restaurant_id == restaurant_id)
    )
    assert result.scalar_one() == 1


# ---------------------------------------------------------------------------
# CA-04: sin auth → 401 en cualquier endpoint
# ---------------------------------------------------------------------------


async def test_endpoints_require_auth(client: AsyncClient):
    rid = str(uuid.uuid4())

    assert (await client.post("/restaurants", json={"name": "X"})).status_code == 401
    assert (await client.get("/restaurants")).status_code == 401
    assert (await client.get(f"/restaurants/{rid}")).status_code == 401
    assert (
        await client.patch(f"/restaurants/{rid}", json={"name": "X"})
    ).status_code == 401


# ---------------------------------------------------------------------------
# CA-05: usuario sin rol → GET por id da 403 no_role
# ---------------------------------------------------------------------------


async def test_get_by_id_without_role_forbidden(client: AsyncClient):
    owner_headers = await as_user(client, email="owner@example.com")
    created = await client.post(
        "/restaurants", json={"name": "My Bar"}, headers=owner_headers
    )
    restaurant_id = created.json()["id"]

    stranger_headers = await as_user(client, email="stranger@example.com")
    res = await client.get(
        f"/restaurants/{restaurant_id}", headers=stranger_headers
    )

    assert res.status_code == 403
    assert res.json()["detail"] == "no_role"


# ---------------------------------------------------------------------------
# CA-06: editor intenta PATCH → 403 insufficient_role, name no cambia
# ---------------------------------------------------------------------------


async def test_editor_cannot_patch(client: AsyncClient, db_session: AsyncSession):
    owner_headers = await as_user(client, email="owner@example.com")
    created = await client.post(
        "/restaurants", json={"name": "My Bar"}, headers=owner_headers
    )
    restaurant_id = uuid.UUID(created.json()["id"])

    editor_headers = await as_user(client, email="editor@example.com")
    editor = await get_user_by_email("editor@example.com", db_session)
    db_session.add(
        UserRestaurantRole(
            user_id=editor.id,
            restaurant_id=restaurant_id,
            role=RestaurantRole.editor,
        )
    )
    await db_session.commit()

    res = await client.patch(
        f"/restaurants/{restaurant_id}",
        json={"name": "Renamed"},
        headers=editor_headers,
    )

    assert res.status_code == 403
    assert res.json()["detail"] == "insufficient_role"

    # name no cambió en DB
    result = await db_session.execute(
        select(Restaurant).where(Restaurant.id == restaurant_id)
    )
    assert result.scalar_one().name == "My Bar"


# ---------------------------------------------------------------------------
# CA-07: GET /restaurants lista con role correcto
# ---------------------------------------------------------------------------


async def test_list_restaurants_with_roles(
    client: AsyncClient, db_session: AsyncSession
):
    owner_headers = await as_user(client, email="owner@example.com")
    owned = await client.post(
        "/restaurants", json={"name": "Owned Bar"}, headers=owner_headers
    )
    owned_id = uuid.UUID(owned.json()["id"])

    # segundo restaurant creado por otro dueño, donde nuestro usuario es editor
    other_headers = await as_user(client, email="other@example.com")
    other = await client.post(
        "/restaurants", json={"name": "Other Bar"}, headers=other_headers
    )
    other_id = uuid.UUID(other.json()["id"])

    owner_user = await get_user_by_email("owner@example.com", db_session)
    db_session.add(
        UserRestaurantRole(
            user_id=owner_user.id,
            restaurant_id=other_id,
            role=RestaurantRole.editor,
        )
    )
    await db_session.commit()

    res = await client.get("/restaurants", headers=owner_headers)
    assert res.status_code == 200
    roles = {item["id"]: item["role"] for item in res.json()}
    assert roles[str(owned_id)] == "owner"
    assert roles[str(other_id)] == "editor"


# ---------------------------------------------------------------------------
# CA-08: PATCH válido por owner → 200, slug no cambia
# ---------------------------------------------------------------------------


async def test_owner_patch_updates_name_keeps_slug(client: AsyncClient):
    owner_headers = await as_user(client, email="owner@example.com")
    created = await client.post(
        "/restaurants", json={"name": "My Bar"}, headers=owner_headers
    )
    restaurant_id = created.json()["id"]
    original_slug = created.json()["slug"]

    res = await client.patch(
        f"/restaurants/{restaurant_id}",
        json={"name": "Completely New Name"},
        headers=owner_headers,
    )

    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Completely New Name"
    assert body["slug"] == original_slug  # slug NO se regenera
    assert body["role"] == "owner"


# ---------------------------------------------------------------------------
# Fix 1: nombre solo con emojis/símbolos → slug no vacío (fallback)
# ---------------------------------------------------------------------------


async def test_symbols_only_name_gets_non_empty_slug(client: AsyncClient):
    headers = await as_user(client)
    res = await client.post("/restaurants", json={"name": "🍕🍕🍕"}, headers=headers)

    assert res.status_code == 201
    body = res.json()
    assert body["slug"]  # no vacío
    assert body["slug"] != ""


async def test_two_symbols_only_names_get_distinct_slugs(client: AsyncClient):
    """El fallback es determinístico por-request pero único (uuid), sin colisión."""
    headers = await as_user(client)
    first = await client.post("/restaurants", json={"name": "!!!"}, headers=headers)
    second = await client.post("/restaurants", json={"name": "###"}, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["slug"]
    assert second.json()["slug"]
    assert first.json()["slug"] != second.json()["slug"]


# ---------------------------------------------------------------------------
# Fix 2: race condition — el path de retry ante IntegrityError termina en 409
#        controlado cuando el slug generado siempre colisiona.
# ---------------------------------------------------------------------------


async def test_slug_conflict_retries_then_409(client: AsyncClient, monkeypatch):
    """Fuerza IntegrityError en cada intento anulando el chequeo previo en Python.

    Con ``_slug_exists`` siempre False, el generador devuelve el mismo slug ya
    existente en cada intento; los 3 commits fallan con IntegrityError y el
    servicio responde con un 409 controlado en vez de un 500 crudo.
    """
    headers = await as_user(client)
    first = await client.post("/restaurants", json={"name": "My Bar"}, headers=headers)
    assert first.status_code == 201

    async def _never_exists(slug, session):
        return False

    monkeypatch.setattr(restaurant_service, "_slug_exists", _never_exists)

    res = await client.post("/restaurants", json={"name": "My Bar"}, headers=headers)
    assert res.status_code == 409
    assert res.json()["detail"] == "slug_conflict"
