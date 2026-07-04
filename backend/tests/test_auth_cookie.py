"""
Tests for httpOnly cookie auth: login/register set a Set-Cookie "access_token"
and get_current_user reads the token from the cookie (precedence) or the
Authorization header (fallback).

SPEC: "Auth vía cookie httpOnly en login/register + lectura dual
(cookie/header) en get_current_user".

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.
"""
import uuid
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User

COOKIE_NAME = settings.AUTH_COOKIE_NAME  # "access_token"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def register(
    client: AsyncClient,
    email: str = "cookie@example.com",
    password: str = "password123",
    full_name: str = "Cookie User",
):
    """POST /auth/register. Returns the full Response (body + Set-Cookie)."""
    return await client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
    )


async def login(
    client: AsyncClient,
    email: str = "cookie@example.com",
    password: str = "password123",
):
    """POST /auth/login. Returns the full Response (body + Set-Cookie)."""
    return await client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )


async def get_me(client: AsyncClient, cookie_token: str | None = None, bearer: str | None = None):
    """
    GET /auth/me with a controlled auth state.

    Resets the client cookie jar first, then optionally sets the auth cookie
    and/or the Authorization header. Setting the cookie on the client instance
    (instead of per-request cookies=) avoids httpx's per-request-cookie
    deprecation and is unambiguous about persistence.
    """
    client.cookies.clear()
    if cookie_token is not None:
        client.cookies.set(COOKIE_NAME, cookie_token)
    headers = {"Authorization": f"Bearer {bearer}"} if bearer is not None else None
    return await client.get("/auth/me", headers=headers)


def parse_set_cookie(res) -> tuple[str, dict[str, str]]:
    """
    Parse the raw Set-Cookie header for COOKIE_NAME.

    Returns (cookie_value, attributes) where attributes keys are lowercased.
    Flag attributes (e.g. HttpOnly, Secure) map to "".
    Raises AssertionError if the cookie is not present.
    """
    raw_cookies = res.headers.get_list("set-cookie")
    target = next(
        (c for c in raw_cookies if c.startswith(f"{COOKIE_NAME}=")), None
    )
    assert target is not None, (
        f"Set-Cookie '{COOKIE_NAME}' not found. Got: {raw_cookies}"
    )

    parts = [p.strip() for p in target.split(";")]
    name_value = parts[0]
    _, _, value = name_value.partition("=")

    attrs: dict[str, str] = {}
    for part in parts[1:]:
        key, sep, val = part.partition("=")
        attrs[key.strip().lower()] = val.strip() if sep else ""
    return value, attrs


# ---------------------------------------------------------------------------
# CA-01 — POST /auth/login sets the httpOnly cookie; body unchanged
# ---------------------------------------------------------------------------


async def test_login_sets_httponly_cookie(client: AsyncClient):
    """CA-01: login 200 → Set-Cookie access_token HttpOnly/SameSite=Lax/Path=//Max-Age=3600."""
    await register(client)
    client.cookies.clear()

    res = await login(client)
    assert res.status_code == 200

    value, attrs = parse_set_cookie(res)

    assert len(value) > 0, "cookie value (JWT) must not be empty"
    assert "httponly" in attrs, f"HttpOnly flag missing: {attrs}"
    assert attrs.get("samesite", "").lower() == "lax", f"SameSite must be Lax: {attrs}"
    assert attrs.get("path") == "/", f"Path must be /: {attrs}"
    assert attrs.get("max-age") == str(
        settings.JWT_EXPIRE_MINUTES * 60
    ), f"Max-Age must be {settings.JWT_EXPIRE_MINUTES * 60}: {attrs}"


async def test_login_body_still_token_response(client: AsyncClient):
    """CA-01: el body sigue siendo TokenResponse (access_token + token_type), sin cambios."""
    await register(client)
    client.cookies.clear()

    res = await login(client)
    assert res.status_code == 200

    body = res.json()
    assert set(body.keys()) == {"access_token", "token_type"}, (
        f"body must be TokenResponse only: {body}"
    )
    assert isinstance(body["access_token"], str) and len(body["access_token"]) > 0
    assert body["token_type"] == "bearer"


async def test_login_cookie_value_matches_body_token(client: AsyncClient):
    """CA-01: el JWT del Set-Cookie coincide con el access_token del body."""
    await register(client)
    client.cookies.clear()

    res = await login(client)
    value, _ = parse_set_cookie(res)

    assert value == res.json()["access_token"], (
        "cookie JWT must equal the body access_token"
    )


# ---------------------------------------------------------------------------
# CA-02 — POST /auth/register sets the same cookie
# ---------------------------------------------------------------------------


async def test_register_sets_httponly_cookie(client: AsyncClient):
    """CA-02: register 201 → mismo Set-Cookie access_token con los mismos atributos."""
    res = await register(client)
    assert res.status_code == 201

    value, attrs = parse_set_cookie(res)

    assert value == res.json()["access_token"]
    assert "httponly" in attrs, f"HttpOnly flag missing: {attrs}"
    assert attrs.get("samesite", "").lower() == "lax", f"SameSite must be Lax: {attrs}"
    assert attrs.get("path") == "/", f"Path must be /: {attrs}"
    assert attrs.get("max-age") == str(settings.JWT_EXPIRE_MINUTES * 60)


# ---------------------------------------------------------------------------
# CA-03 — cookie-only request to GET /auth/me → 200
# ---------------------------------------------------------------------------


async def test_me_with_cookie_only(client: AsyncClient):
    """CA-03: con la cookie de login (sin header Authorization) → 200 UserRead correcto."""
    await register(client, email="only-cookie@example.com")
    client.cookies.clear()
    token = (await login(client, email="only-cookie@example.com")).json()["access_token"]

    res = await get_me(client, cookie_token=token)

    assert res.status_code == 200
    assert res.json()["email"] == "only-cookie@example.com"


# ---------------------------------------------------------------------------
# CA-04 — header-only request still works (fallback / backward compat)
# ---------------------------------------------------------------------------


async def test_me_with_header_only(client: AsyncClient):
    """CA-04: con header Authorization Bearer (sin cookie) → 200 (fallback intacto)."""
    await register(client, email="only-header@example.com")
    client.cookies.clear()
    token = (await login(client, email="only-header@example.com")).json()["access_token"]

    res = await get_me(client, bearer=token)

    assert res.status_code == 200
    assert res.json()["email"] == "only-header@example.com"


# ---------------------------------------------------------------------------
# CA-05 — cookie beats header when both present (different users)
# ---------------------------------------------------------------------------


async def test_me_cookie_takes_precedence_over_header(client: AsyncClient):
    """CA-05: cookie(userA) + header(userB) → gana la cookie (se resuelve userA)."""
    await register(client, email="user-a@example.com", full_name="User A")
    client.cookies.clear()
    token_a = (await login(client, email="user-a@example.com")).json()["access_token"]

    await register(client, email="user-b@example.com", full_name="User B")
    client.cookies.clear()
    token_b = (await login(client, email="user-b@example.com")).json()["access_token"]

    res = await get_me(client, cookie_token=token_a, bearer=token_b)

    assert res.status_code == 200
    assert res.json()["email"] == "user-a@example.com", (
        "cookie must win over Authorization header"
    )


# ---------------------------------------------------------------------------
# CA-06 — no cookie and no header → 401
# ---------------------------------------------------------------------------


async def test_me_without_cookie_or_header(client: AsyncClient):
    """CA-06: sin cookie y sin header → 401 not_authenticated."""
    res = await get_me(client)

    assert res.status_code == 401
    assert res.json()["detail"] == "not_authenticated"


# ---------------------------------------------------------------------------
# CA-07 — expired / invalid token via cookie → 401 invalid_token
# ---------------------------------------------------------------------------


async def test_me_with_malformed_cookie_token(client: AsyncClient):
    """CA-07: token inválido (mal formado) por cookie → 401 invalid_token."""
    res = await get_me(client, cookie_token="not.a.valid.jwt")

    assert res.status_code == 401
    assert res.json()["detail"] == "invalid_token"


async def test_me_with_expired_cookie_token(client: AsyncClient):
    """CA-07: token expirado (firma válida, exp en el pasado) por cookie → 401 invalid_token."""
    expired = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "exp": datetime.now(timezone.utc) - timedelta(seconds=10),
        },
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    res = await get_me(client, cookie_token=expired)

    assert res.status_code == 401
    assert res.json()["detail"] == "invalid_token"


# ---------------------------------------------------------------------------
# CA-08 — inactive user with a valid cookie token → 403 inactive_user
# ---------------------------------------------------------------------------


async def test_me_inactive_user_via_cookie(
    client: AsyncClient, db_session: AsyncSession
):
    """CA-08: usuario is_active=False con token válido por cookie → 403 inactive_user."""
    await register(client, email="willbe-inactive@example.com")
    client.cookies.clear()
    token = (
        await login(client, email="willbe-inactive@example.com")
    ).json()["access_token"]

    # Deactivate the user directly in the shared in-memory DB.
    result = await db_session.execute(
        select(User).where(User.email == "willbe-inactive@example.com")
    )
    user = result.scalar_one()
    user.is_active = False
    await db_session.commit()

    res = await get_me(client, cookie_token=token)

    assert res.status_code == 403
    assert res.json()["detail"] == "inactive_user"


# ---------------------------------------------------------------------------
# CA-09 — no Secure attribute when COOKIE_SECURE is False (test default)
# ---------------------------------------------------------------------------


async def test_cookie_has_no_secure_flag_when_cookie_secure_false(
    client: AsyncClient,
):
    """CA-09: con settings.COOKIE_SECURE=False (default en tests) la cookie NO lleva Secure."""
    assert settings.COOKIE_SECURE is False, (
        "precondition: COOKIE_SECURE must default to False in tests"
    )

    res = await register(client, email="no-secure@example.com")
    _, attrs = parse_set_cookie(res)

    assert "secure" not in attrs, f"Secure flag must be absent: {attrs}"
