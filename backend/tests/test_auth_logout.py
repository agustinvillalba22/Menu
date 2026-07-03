"""
Tests for POST /auth/logout.

The endpoint clears the httpOnly "access_token" cookie and returns 204 No
Content. It is idempotent and requires no authentication or DB access, so it
succeeds whether or not a cookie is present.

SPEC: "POST /auth/logout → 204, borra la cookie access_token con los mismos
atributos que _set_auth_cookie, sin auth ni DB".

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.
"""
from httpx import AsyncClient

from app.core.config import settings

from tests.test_auth_cookie import login, register, parse_set_cookie, get_me

COOKIE_NAME = settings.AUTH_COOKIE_NAME  # "access_token"


# ---------------------------------------------------------------------------
# CA-01 — logout with a valid cookie returns 204 and expires the cookie
# ---------------------------------------------------------------------------


async def test_logout_with_valid_cookie_returns_204_and_expires_cookie(
    client: AsyncClient,
):
    """CA-01: con cookie válida, logout → 204 y Set-Cookie que expira access_token."""
    await register(client, email="logout@example.com")
    # After register the client jar already holds the auth cookie.
    assert client.cookies.get(COOKIE_NAME) is not None

    res = await client.post("/auth/logout")

    assert res.status_code == 204
    assert res.content == b"", "204 response must have no body"

    value, attrs = parse_set_cookie(res)
    # A deletion cookie carries an empty value (Starlette emits `""`) plus a
    # past expiry / Max-Age=0.
    assert value.strip('"') == "", f"deletion cookie value must be empty: {value!r}"
    expired = attrs.get("max-age") == "0" or "expires" in attrs
    assert expired, f"deletion cookie must expire the cookie: {attrs}"


# ---------------------------------------------------------------------------
# CA-02 — deletion cookie keeps Path=/, HttpOnly, SameSite=Lax (+Secure if set)
# ---------------------------------------------------------------------------


async def test_logout_cookie_has_matching_attributes(client: AsyncClient):
    """CA-02: el Set-Cookie de borrado tiene Path=/, HttpOnly, SameSite=Lax."""
    res = await client.post("/auth/logout")

    _, attrs = parse_set_cookie(res)

    assert attrs.get("path") == "/", f"Path must be /: {attrs}"
    assert "httponly" in attrs, f"HttpOnly flag missing: {attrs}"
    assert attrs.get("samesite", "").lower() == "lax", f"SameSite must be Lax: {attrs}"
    # Secure mirrors _set_auth_cookie: present iff COOKIE_SECURE is True.
    if settings.COOKIE_SECURE:
        assert "secure" in attrs, f"Secure flag must be present: {attrs}"
    else:
        assert "secure" not in attrs, f"Secure flag must be absent: {attrs}"


# ---------------------------------------------------------------------------
# CA-03 — logout without any cookie still returns 204 (idempotent)
# ---------------------------------------------------------------------------


async def test_logout_without_cookie_is_idempotent_204(client: AsyncClient):
    """CA-03: sin cookie, logout → 204 igual (idempotente, no requiere auth)."""
    client.cookies.clear()

    res = await client.post("/auth/logout")

    assert res.status_code == 204
    assert res.content == b""


# ---------------------------------------------------------------------------
# CA-04 — after logout, a subsequent GET /auth/me is 401 (cookie jar cleared)
# ---------------------------------------------------------------------------


async def test_me_is_401_after_logout_with_cookie_jar(client: AsyncClient):
    """CA-04: con cookie jar, tras logout un GET /auth/me subsecuente → 401."""
    await register(client, email="jar@example.com")

    # Sanity: the live cookie authenticates /auth/me before logout.
    before = await client.get("/auth/me")
    assert before.status_code == 200
    assert before.json()["email"] == "jar@example.com"

    logout = await client.post("/auth/logout")
    assert logout.status_code == 204
    # httpx honours the deletion Set-Cookie and drops it from the jar.
    assert client.cookies.get(COOKIE_NAME) is None

    after = await client.get("/auth/me")
    assert after.status_code == 401
    assert after.json()["detail"] == "not_authenticated"


# ---------------------------------------------------------------------------
# CA-05 — logout performs no DB access (documented by construction)
# ---------------------------------------------------------------------------


async def test_logout_does_no_db_work_signature():
    """CA-05: logout no toca la DB — verificable por inspección de la firma.

    El handler no declara Depends(get_db) ni Depends(get_current_user): su único
    parámetro es el Response. Si alguien agrega una dependencia de DB o auth, este
    test lo detecta.
    """
    import inspect

    from app.routers.auth import logout

    params = inspect.signature(logout).parameters
    assert set(params) == {"response"}, (
        f"logout must depend only on Response (no DB/auth deps): {list(params)}"
    )
