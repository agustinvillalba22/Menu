"""
Tests for M29 (infra): request logging middleware, global exception handler,
LOG_LEVEL and configurable cookie SameSite.

SPEC: .agents/specs/M29_infra_ci.md (RF-01..RF-04, CA-01).
"""
import logging
import re

import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings
from main import app

_REQUIRED = dict(
    DATABASE_URL="sqlite+aiosqlite:///:memory:",
    SECRET_KEY="x",
    R2_ACCOUNT_ID="a",
    R2_ACCESS_KEY_ID="a",
    R2_SECRET_ACCESS_KEY="a",
    R2_ENDPOINT_URL="http://localhost",
    R2_BUCKET_NAME="b",
    R2_PUBLIC_URL="",
)

_SECRET_MESSAGE = "boom-internal-secret-detail"


def _make_settings(**overrides) -> Settings:
    return Settings(_env_file=None, **{**_REQUIRED, **overrides})


@pytest.fixture
def boom_route():
    async def _boom() -> None:
        raise RuntimeError(_SECRET_MESSAGE)

    app.add_api_route("/__test_boom", _boom, methods=["GET"])
    yield "/__test_boom"
    app.router.routes[:] = [
        r for r in app.router.routes if getattr(r, "path", None) != "/__test_boom"
    ]


# --- RF-02: X-Request-ID ----------------------------------------------------


async def test_response_includes_generated_request_id(client):
    res = await client.get("/health")
    rid = res.headers.get("x-request-id")
    assert rid, "X-Request-ID header must be present"
    assert re.fullmatch(r"[0-9a-f-]{36}", rid), f"expected a UUID, got {rid!r}"


async def test_incoming_request_id_is_respected(client):
    res = await client.get("/health", headers={"X-Request-ID": "abc-123"})
    assert res.headers["x-request-id"] == "abc-123"


async def test_generated_request_ids_are_unique(client):
    a = await client.get("/health")
    b = await client.get("/health")
    assert a.headers["x-request-id"] != b.headers["x-request-id"]


async def test_request_log_has_method_path_status_duration_and_id(client, caplog):
    with caplog.at_level(logging.INFO):
        await client.get("/health", headers={"X-Request-ID": "rid-log-1"})
    lines = [r.getMessage() for r in caplog.records if "rid-log-1" in r.getMessage()]
    assert lines, "a request log line with the request id must exist"
    line = lines[0]
    assert "GET" in line and "/health" in line and "200" in line
    assert re.search(r"\d+(\.\d+)?ms", line), f"duration in ms missing: {line}"


async def test_request_log_omits_query_string_and_credentials(client, caplog):
    with caplog.at_level(logging.DEBUG):
        await client.get(
            "/health?token=sekret-query",
            headers={
                "X-Request-ID": "rid-log-2",
                "Authorization": "Bearer sekret-bearer",
                "Cookie": "access_token=sekret-cookie",
            },
        )
    # Only the app's own loggers: httpx (the test client) logs its own URL.
    text = "\n".join(
        r.getMessage() for r in caplog.records if r.name.startswith("app")
    )
    assert "rid-log-2" in text
    for leaked in ("sekret-query", "sekret-bearer", "sekret-cookie"):
        assert leaked not in text, f"{leaked} leaked into logs"


# --- RF-03: global exception handler ---------------------------------------


async def test_unhandled_exception_returns_500_internal_error(client, boom_route):
    res = await client.get(boom_route)
    assert res.status_code == 500
    assert res.json() == {"detail": "internal_error"}
    assert _SECRET_MESSAGE not in res.text


async def test_unhandled_exception_response_has_request_id(client, boom_route):
    res = await client.get(boom_route, headers={"X-Request-ID": "rid-500"})
    assert res.headers.get("x-request-id") == "rid-500"


async def test_unhandled_exception_is_logged_with_traceback_and_id(
    client, boom_route, caplog
):
    with caplog.at_level(logging.ERROR):
        await client.get(boom_route, headers={"X-Request-ID": "rid-500-log"})
    errors = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert errors, "the exception must be logged at ERROR"
    assert any(r.exc_info and r.exc_info[0] is RuntimeError for r in errors)
    assert any("rid-500-log" in r.getMessage() for r in errors)


async def test_not_found_keeps_shape(client):
    res = await client.get("/__does_not_exist")
    assert res.status_code == 404
    assert res.json() == {"detail": "Not Found"}


async def test_validation_error_keeps_422_shape(client):
    res = await client.post("/auth/login", json={"email": "nope"})
    assert res.status_code == 422
    assert isinstance(res.json()["detail"], list)


async def test_unauthorized_keeps_401(client):
    res = await client.get("/auth/me")
    assert res.status_code == 401
    assert res.json() != {"detail": "internal_error"}


# --- RF-01: LOG_LEVEL -------------------------------------------------------


def test_log_level_defaults_to_info():
    assert _make_settings().LOG_LEVEL == "INFO"


def test_log_level_is_configurable():
    assert _make_settings(LOG_LEVEL="DEBUG").LOG_LEVEL == "DEBUG"


# --- RF-04: COOKIE_SAMESITE -------------------------------------------------


def test_cookie_samesite_defaults_to_lax():
    assert _make_settings().COOKIE_SAMESITE == "lax"


def test_cookie_samesite_rejects_unknown_value():
    with pytest.raises(ValidationError):
        _make_settings(COOKIE_SAMESITE="bogus")


def test_cookie_samesite_none_without_secure_fails_config():
    with pytest.raises(ValidationError, match="COOKIE_SECURE"):
        _make_settings(COOKIE_SAMESITE="none", COOKIE_SECURE=False)


def test_cookie_samesite_none_with_secure_is_valid():
    s = _make_settings(COOKIE_SAMESITE="none", COOKIE_SECURE=True)
    assert s.COOKIE_SAMESITE == "none"


def _samesite(res) -> str:
    header = res.headers.get("set-cookie", "")
    m = re.search(r"samesite=(\w+)", header, re.IGNORECASE)
    return m.group(1).lower() if m else ""


async def test_login_cookie_uses_configured_samesite(client, monkeypatch):
    await client.post(
        "/auth/register",
        json={"email": "ss@example.com", "password": "password123", "full_name": "S"},
    )
    monkeypatch.setattr(settings, "COOKIE_SAMESITE", "strict", raising=False)
    res = await client.post(
        "/auth/login", json={"email": "ss@example.com", "password": "password123"}
    )
    assert _samesite(res) == "strict"


async def test_logout_cookie_uses_configured_samesite(client, monkeypatch):
    monkeypatch.setattr(settings, "COOKIE_SAMESITE", "strict", raising=False)
    res = await client.post("/auth/logout")
    assert _samesite(res) == "strict"


async def test_default_cookie_samesite_is_lax(client):
    res = await client.post("/auth/logout")
    assert _samesite(res) == "lax"
