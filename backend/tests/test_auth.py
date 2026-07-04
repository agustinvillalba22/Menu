"""
Tests for auth endpoints: POST /auth/register, POST /auth/login, GET /auth/me.

MOMENT: BEFORE IMPLEMENTATION — todos estos tests deben fallar.
Los routers, schemas y servicios de auth aún no existen.

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.
"""
import uuid
from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

# Clave secreta que debe coincidir con el valor en .env
TEST_SECRET_KEY = "test-secret-key-for-development"
ALGORITHM = "HS256"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def register_user(
    client: AsyncClient,
    email: str = "test@example.com",
    password: str = "password123",
    full_name: str = "Test User",
):
    """POST /auth/register con los datos dados. Retorna la Response completa."""
    return await client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
    )


async def auth_headers(
    client: AsyncClient,
    email: str = "test@example.com",
    password: str = "password123",
    full_name: str = "Test User",
) -> dict:
    """Registra un usuario y retorna el header Authorization listo para usar."""
    res = await register_user(client, email, password, full_name)
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------


async def test_register_success(client: AsyncClient):
    """Registro válido → 201, body con access_token (no vacío) y token_type 'bearer'."""
    res = await register_user(client)

    assert res.status_code == 201
    body = res.json()
    assert "access_token" in body
    assert isinstance(body["access_token"], str)
    assert len(body["access_token"]) > 0
    assert body["token_type"] == "bearer"


async def test_register_email_normalized(client: AsyncClient):
    """Email en mayúsculas → guardado en lowercase en DB (verificado via GET /auth/me)."""
    res = await register_user(client, email="User@Example.COM")
    assert res.status_code == 201

    token = res.json()["access_token"]
    me_res = await client.get(
        "/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "user@example.com"


async def test_register_duplicate_email(client: AsyncClient):
    """Registrar el mismo email dos veces → segundo intento 400 con detail 'email_taken'."""
    await register_user(client)
    res = await register_user(client)  # mismo email por defecto

    assert res.status_code == 400
    assert res.json()["detail"] == "email_taken"


async def test_register_short_password(client: AsyncClient):
    """Password de 7 caracteres (< 8) → 422 (falla validación Pydantic)."""
    res = await register_user(client, password="short7!")

    assert res.status_code == 422


async def test_register_empty_full_name(client: AsyncClient):
    """full_name vacío (min_length=1) → 422 (falla validación Pydantic)."""
    res = await register_user(client, full_name="")

    assert res.status_code == 422


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------


async def test_login_success(client: AsyncClient):
    """Registro seguido de login con las mismas credenciales → 200 con access_token."""
    await register_user(client)

    res = await client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )

    assert res.status_code == 200
    body = res.json()
    assert "access_token" in body
    assert isinstance(body["access_token"], str)
    assert len(body["access_token"]) > 0
    assert body["token_type"] == "bearer"


async def test_login_email_case_insensitive(client: AsyncClient):
    """Registro con minúsculas, login con MAYÚSCULAS → 200."""
    await register_user(client, email="user@example.com")

    res = await client.post(
        "/auth/login",
        json={"email": "USER@EXAMPLE.COM", "password": "password123"},
    )

    assert res.status_code == 200
    assert "access_token" in res.json()


async def test_login_wrong_password(client: AsyncClient):
    """Password incorrecto → 401 con detail 'invalid_credentials'."""
    await register_user(client)

    res = await client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "wrongpassword"},
    )

    assert res.status_code == 401
    assert res.json()["detail"] == "invalid_credentials"


async def test_login_unknown_email(client: AsyncClient):
    """Email inexistente → 401 con detail 'invalid_credentials'."""
    res = await client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "password123"},
    )

    assert res.status_code == 401
    assert res.json()["detail"] == "invalid_credentials"


async def test_login_inactive_user(client: AsyncClient, db_session: AsyncSession):
    """Usuario inactivo creado directamente en DB → login da 403 con detail 'inactive_user'."""
    from app.services.auth import hash_password  # importado aquí: módulo no existe aún

    inactive_user = User(
        id=uuid.uuid4(),
        email="inactive@example.com",
        hashed_password=hash_password("password123"),
        full_name="Inactive User",
        is_active=False,
    )
    db_session.add(inactive_user)
    await db_session.commit()

    res = await client.post(
        "/auth/login",
        json={"email": "inactive@example.com", "password": "password123"},
    )

    assert res.status_code == 403
    assert res.json()["detail"] == "inactive_user"


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------


async def test_me_success(client: AsyncClient):
    """Token válido de /register → 200, body completo con todos los campos esperados."""
    headers = await auth_headers(client)
    res = await client.get("/auth/me", headers=headers)

    assert res.status_code == 200
    body = res.json()

    # Campos de identidad
    assert "id" in body
    assert body["id"] is not None
    assert body["email"] == "test@example.com"
    assert body["full_name"] == "Test User"

    # Flags por defecto para un usuario recién registrado
    assert body["is_active"] is True
    assert body["is_superadmin"] is False

    # Timestamp de creación presente
    assert "created_at" in body
    assert body["created_at"] is not None


async def test_me_no_token(client: AsyncClient):
    """Sin header Authorization → 401."""
    res = await client.get("/auth/me")

    assert res.status_code == 401


async def test_me_invalid_token(client: AsyncClient):
    """Token mal formado → 401."""
    res = await client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid.token.here"},
    )

    assert res.status_code == 401


async def test_me_expired_token(client: AsyncClient):
    """JWT construido manualmente con exp en el pasado → 401."""
    expired_payload = {
        "sub": str(uuid.uuid4()),
        "exp": datetime.utcnow() - timedelta(seconds=10),
    }
    expired_token = jwt.encode(expired_payload, TEST_SECRET_KEY, algorithm=ALGORITHM)

    res = await client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert res.status_code == 401
