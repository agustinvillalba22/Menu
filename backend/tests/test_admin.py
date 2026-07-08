"""
Tests for M13.1 — superadmin infrastructure: /admin/* endpoints, the
`require_superadmin` dependency, and the `promote_superadmin.py` bootstrap
script.

Covers CA-01, CA-06, CA-07, CA-08, CA-09 from
``.agents/specs/M13.1_admin_backend.md`` (CA-02..CA-05 live in
test_import_csv.py / test_restaurant.py / test_public_menu.py, closer to the
endpoints they extend).

asyncio_mode=auto via pytest.ini — no @pytest.mark.asyncio needed.
"""
import subprocess
import sys
import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.models.restaurant import Restaurant, UserRestaurantRole
from app.models.user import User
from scripts import promote_superadmin


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def as_user(
    client: AsyncClient,
    email: str = "user@example.com",
    password: str = "password123",
    full_name: str = "Test User",
) -> dict:
    """Registra un usuario normal (sin superadmin) y devuelve el header Bearer.

    Limpia las cookies para que el header (no la cookie de /register) sea la
    identidad usada — mismo patrón que el resto de la suite.
    """
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
    )
    token = res.json()["access_token"]
    client.cookies.clear()
    return {"Authorization": f"Bearer {token}"}


async def as_superadmin(
    client: AsyncClient,
    db_session: AsyncSession,
    email: str = "super@example.com",
    password: str = "password123",
    full_name: str = "Super Admin",
) -> dict:
    """Registra un usuario y lo promueve a is_superadmin=True directo en DB."""
    headers = await as_user(client, email=email, password=password, full_name=full_name)
    user = (
        await db_session.execute(select(User).where(User.email == email))
    ).scalar_one()
    user.is_superadmin = True
    await db_session.commit()
    return headers


async def make_restaurant(client: AsyncClient, headers: dict, name: str = "My Bar") -> dict:
    res = await client.post("/restaurants", json={"name": name}, headers=headers)
    return res.json()


# ---------------------------------------------------------------------------
# CA-01: usuario sin is_superadmin → 403 not_superadmin en cualquier /admin/*
# ---------------------------------------------------------------------------


async def test_non_superadmin_gets_403_on_list_users(client: AsyncClient):
    headers = await as_user(client)
    res = await client.get("/admin/users", headers=headers)
    assert res.status_code == 403
    assert res.json()["detail"] == "not_superadmin"


async def test_non_superadmin_gets_403_on_patch_user(client: AsyncClient):
    headers = await as_user(client)
    res = await client.patch(
        f"/admin/users/{uuid.uuid4()}",
        json={"is_active": False},
        headers=headers,
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "not_superadmin"


async def test_non_superadmin_gets_403_on_list_restaurants(client: AsyncClient):
    headers = await as_user(client)
    res = await client.get("/admin/restaurants", headers=headers)
    assert res.status_code == 403
    assert res.json()["detail"] == "not_superadmin"


async def test_non_superadmin_gets_403_on_patch_restaurant(client: AsyncClient):
    headers = await as_user(client)
    res = await client.patch(
        f"/admin/restaurants/{uuid.uuid4()}",
        json={"is_active": False},
        headers=headers,
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "not_superadmin"


async def test_unauthenticated_gets_401_not_403(client: AsyncClient):
    """Sin token en absoluto, get_current_user corta antes con 401."""
    res = await client.get("/admin/users")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# RF-09/RF-10: GET/PATCH /admin/users
# ---------------------------------------------------------------------------


async def test_list_users_returns_expected_shape_ordered_desc(
    client: AsyncClient, db_session: AsyncSession
):
    await as_user(client, email="first@example.com")
    await as_user(client, email="second@example.com")
    admin_headers = await as_superadmin(client, db_session, email="admin@example.com")

    res = await client.get("/admin/users", headers=admin_headers)
    assert res.status_code == 200
    body = res.json()

    emails_in_order = [u["email"] for u in body]
    assert set(emails_in_order) == {
        "first@example.com",
        "second@example.com",
        "admin@example.com",
    }
    # created_at descending: timestamps may collide at second-precision in
    # SQLite for requests issued back-to-back, so assert non-increasing order
    # rather than a strict "admin must be exactly first" — the DB-level
    # ORDER BY created_at DESC is what RF-09 actually specifies.
    created_ats = [u["created_at"] for u in body]
    assert created_ats == sorted(created_ats, reverse=True)
    for user in body:
        assert set(user.keys()) == {
            "id",
            "email",
            "full_name",
            "is_active",
            "is_superadmin",
            "created_at",
        }


async def test_patch_user_unknown_id_404(client: AsyncClient, db_session: AsyncSession):
    admin_headers = await as_superadmin(client, db_session)
    res = await client.patch(
        f"/admin/users/{uuid.uuid4()}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "user_not_found"


async def test_patch_user_partial_update_only_touches_present_fields(
    client: AsyncClient, db_session: AsyncSession
):
    await as_user(client, email="target@example.com")
    admin_headers = await as_superadmin(client, db_session)

    target = (
        await db_session.execute(select(User).where(User.email == "target@example.com"))
    ).scalar_one()

    res = await client.patch(
        f"/admin/users/{target.id}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["is_active"] is False
    assert body["is_superadmin"] is False  # untouched — field wasn't in the body


# ---------------------------------------------------------------------------
# CA-07: PATCH is_superadmin=true habilita al usuario para llamadas siguientes
# ---------------------------------------------------------------------------


async def test_patch_user_grant_superadmin_enables_subsequent_admin_calls(
    client: AsyncClient, db_session: AsyncSession
):
    promoted_headers = await as_user(client, email="promoted@example.com")
    admin_headers = await as_superadmin(client, db_session, email="admin@example.com")

    target = (
        await db_session.execute(
            select(User).where(User.email == "promoted@example.com")
        )
    ).scalar_one()

    # Before promotion: the target cannot call /admin/*.
    before = await client.get("/admin/users", headers=promoted_headers)
    assert before.status_code == 403

    patch_res = await client.patch(
        f"/admin/users/{target.id}",
        json={"is_superadmin": True},
        headers=admin_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_superadmin"] is True

    # After promotion: the SAME bearer token now passes require_superadmin
    # (is_superadmin is read fresh from DB per-request, not cached in the JWT).
    after = await client.get("/admin/users", headers=promoted_headers)
    assert after.status_code == 200


# ---------------------------------------------------------------------------
# RF-11/RF-12: GET/PATCH /admin/restaurants
# ---------------------------------------------------------------------------


async def test_list_restaurants_shape_and_owner_email(
    client: AsyncClient, db_session: AsyncSession
):
    owner_headers = await as_user(client, email="owner@example.com")
    restaurant = await make_restaurant(client, owner_headers, name="Zorro Bar")
    admin_headers = await as_superadmin(client, db_session, email="admin@example.com")

    res = await client.get("/admin/restaurants", headers=admin_headers)
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    entry = body[0]
    assert set(entry.keys()) == {
        "id",
        "name",
        "slug",
        "qr_token",
        "is_active",
        "orders_enabled",
        "owner_email",
    }
    assert entry["id"] == restaurant["id"]
    assert entry["owner_email"] == "owner@example.com"
    assert entry["is_active"] is True


async def test_list_restaurants_ordered_by_name_asc(
    client: AsyncClient, db_session: AsyncSession
):
    owner_headers = await as_user(client, email="owner@example.com")
    await make_restaurant(client, owner_headers, name="Zebra")
    await make_restaurant(client, owner_headers, name="Alpha")
    admin_headers = await as_superadmin(client, db_session, email="admin@example.com")

    res = await client.get("/admin/restaurants", headers=admin_headers)
    names = [r["name"] for r in res.json()]
    assert names == ["Alpha", "Zebra"]


async def test_list_restaurants_no_owner_gives_null_owner_email(
    client: AsyncClient, db_session: AsyncSession
):
    owner_headers = await as_user(client, email="owner@example.com")
    restaurant = await make_restaurant(client, owner_headers, name="Orphan Bar")
    rid = uuid.UUID(restaurant["id"])

    # Delete the owner role assignment directly, simulating a restaurant with
    # no owner (edge case explicitly called out in RF-11).
    assignment = (
        await db_session.execute(
            select(UserRestaurantRole).where(UserRestaurantRole.restaurant_id == rid)
        )
    ).scalar_one()
    await db_session.delete(assignment)
    await db_session.commit()

    admin_headers = await as_superadmin(client, db_session, email="admin@example.com")
    res = await client.get("/admin/restaurants", headers=admin_headers)
    entry = next(r for r in res.json() if r["id"] == str(rid))
    assert entry["owner_email"] is None


async def test_patch_restaurant_unknown_id_404(
    client: AsyncClient, db_session: AsyncSession
):
    admin_headers = await as_superadmin(client, db_session)
    res = await client.patch(
        f"/admin/restaurants/{uuid.uuid4()}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "restaurant_not_found"


# ---------------------------------------------------------------------------
# CA-06: superadmin puede reactivar un restaurant inactivo vía /admin/*
# (RNF-01 — require_superadmin nunca pasa por require_role / is_active).
# ---------------------------------------------------------------------------


async def test_superadmin_can_deactivate_and_reactivate_restaurant(
    client: AsyncClient, db_session: AsyncSession
):
    owner_headers = await as_user(client, email="owner@example.com")
    restaurant = await make_restaurant(client, owner_headers)
    rid = restaurant["id"]
    admin_headers = await as_superadmin(client, db_session, email="admin@example.com")

    deactivate = await client.patch(
        f"/admin/restaurants/{rid}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert deactivate.status_code == 200
    assert deactivate.json()["is_active"] is False

    db_restaurant = (
        await db_session.execute(
            select(Restaurant).where(Restaurant.id == uuid.UUID(rid))
        )
    ).scalar_one()
    assert db_restaurant.is_active is False

    # RNF-01: even while inactive, the superadmin can act on it again via /admin/*.
    reactivate = await client.patch(
        f"/admin/restaurants/{rid}",
        json={"is_active": True},
        headers=admin_headers,
    )
    assert reactivate.status_code == 200
    assert reactivate.json()["is_active"] is True


# ---------------------------------------------------------------------------
# CA-08/CA-09: scripts/promote_superadmin.py
# ---------------------------------------------------------------------------
#
# The script's business logic (`promote_superadmin.promote`) is exercised
# in-process against the SAME SQLite in-memory engine the rest of the suite
# uses, by monkeypatching its module-level `AsyncSessionLocal` — this proves
# CA-08/CA-09 deterministically without needing a reachable real DATABASE_URL.
# Argparse-level behavior (missing required `email` arg) is checked separately
# via a real subprocess, since that doesn't touch the DB at all.


async def test_promote_superadmin_existing_user_sets_flag_true(
    client: AsyncClient,
    db_session: AsyncSession,
    test_engine: AsyncEngine,
    monkeypatch,
):
    """CA-08: corrido con el email de un usuario existente, is_superadmin
    queda en True en DB, verificable con una query directa."""
    await client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "password": "password123",
            "full_name": "Owner",
        },
    )

    session_maker = async_sessionmaker(test_engine, expire_on_commit=False)
    monkeypatch.setattr(promote_superadmin, "AsyncSessionLocal", session_maker)

    exit_code = await promote_superadmin.promote("owner@example.com")
    assert exit_code == 0

    user = (
        await db_session.execute(
            select(User).where(User.email == "owner@example.com")
        )
    ).scalar_one()
    assert user.is_superadmin is True


async def test_promote_superadmin_unknown_email_creates_nothing_and_fails(
    client: AsyncClient,
    db_session: AsyncSession,
    test_engine: AsyncEngine,
    monkeypatch,
):
    """CA-09: email inexistente → no crea ningún usuario, exit code != 0."""
    session_maker = async_sessionmaker(test_engine, expire_on_commit=False)
    monkeypatch.setattr(promote_superadmin, "AsyncSessionLocal", session_maker)

    exit_code = await promote_superadmin.promote("nobody@example.com")
    assert exit_code != 0

    result = await db_session.execute(
        select(User).where(User.email == "nobody@example.com")
    )
    assert result.scalar_one_or_none() is None


def _run_script(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "scripts/promote_superadmin.py", *args],
        capture_output=True,
        text=True,
        cwd="/home/pablo/projects/Menu/backend",
    )


def test_promote_superadmin_script_no_args_exits_nonzero():
    """Sin el argumento posicional `email`, argparse debe salir con error."""
    result = _run_script()
    assert result.returncode != 0
