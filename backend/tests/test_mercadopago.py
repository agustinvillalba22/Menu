"""
Tests for M36 (backend) — cobro con Mercado Pago, Checkout Pro, modelo
marketplace. Cero red: el cliente HTTP a MP se reemplaza con
``httpx.MockTransport`` vía ``app.dependency_overrides`` (RNF-04).

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.
"""
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
import pytest_asyncio
from cryptography.fernet import Fernet
from jose import jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.mercadopago import get_mp_client
from app.models.order import (
    Order,
    OrderStatus,
    OrderType,
    PaymentMethod,
    PaymentStatus,
)
from app.models.payment_account import PaymentAccount, PaymentAccountStatus
from app.services import crypto
from app.services.mercadopago import (
    PaymentAccountDisconnected,
    get_seller_token,
)
from main import app

from tests.test_orders import (
    enable_orders,
    grant_editor_role,
    make_item,
    make_modifier,
    make_restaurant,
    make_subcategory,
    as_user,
)

WEBHOOK_SECRET = "whsec-test"
API_URL = "https://api.example.com"
FRONT_URL = "https://app.example.com"
ACCESS = "APP_USR-access-token-1"
REFRESH = "TG-refresh-token-1"
SELLER_MP_ID = "555"
INIT_POINT = "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1"

TOKEN_OK = {
    "access_token": "APP_USR-new-access",
    "refresh_token": "TG-new-refresh",
    "expires_in": 15552000,
    "user_id": 555,
    "token_type": "Bearer",
}


# ---------------------------------------------------------------------------
# Fake Mercado Pago (httpx.MockTransport)
# ---------------------------------------------------------------------------


class FakeMP:
    def __init__(self) -> None:
        self.calls: list[httpx.Request] = []
        self.payments: dict[str, dict] = {}
        self.token_response = lambda req: httpx.Response(200, json=TOKEN_OK)
        self.preference_response = lambda req: httpx.Response(
            201, json={"id": "pref-1", "init_point": INIT_POINT}
        )
        self.payment_error: httpx.Response | Exception | None = None

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        path = request.url.path
        if request.method == "POST" and path == "/oauth/token":
            return self.token_response(request)
        if request.method == "POST" and path == "/checkout/preferences":
            return self.preference_response(request)
        if request.method == "GET" and path.startswith("/v1/payments/"):
            if isinstance(self.payment_error, Exception):
                raise self.payment_error
            if self.payment_error is not None:
                return self.payment_error
            payment = self.payments.get(path.rsplit("/", 1)[1])
            if payment is None:
                return httpx.Response(404, json={"message": "not found"})
            return httpx.Response(200, json=payment)
        return httpx.Response(404)

    def calls_to(self, path: str) -> list[httpx.Request]:
        return [c for c in self.calls if c.url.path.startswith(path)]

    def body(self, request: httpx.Request) -> dict:
        return json.loads(request.content)


def _configure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "MP_CLIENT_ID", "client-id-1")
    monkeypatch.setattr(settings, "MP_CLIENT_SECRET", "client-secret-1")
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", WEBHOOK_SECRET)
    monkeypatch.setattr(
        settings, "MP_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode()
    )
    monkeypatch.setattr(settings, "PUBLIC_API_URL", API_URL)
    monkeypatch.setattr(settings, "FRONTEND_URL", FRONT_URL)


@pytest_asyncio.fixture
async def mp(client, monkeypatch) -> FakeMP:
    """MP configurado en Settings + cliente HTTP falso inyectado."""
    _configure(monkeypatch)
    fake = FakeMP()

    async def override():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(fake.handle), timeout=10.0
        ) as c:
            yield c

    app.dependency_overrides[get_mp_client] = override
    return fake


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def add_account(
    db: AsyncSession,
    rid: str,
    *,
    expires_in: timedelta = timedelta(days=100),
    status: PaymentAccountStatus = PaymentAccountStatus.connected,
    mp_user_id: str = SELLER_MP_ID,
) -> PaymentAccount:
    account = PaymentAccount(
        restaurant_id=uuid.UUID(rid),
        provider="mercadopago",
        mp_user_id=mp_user_id,
        access_token_enc=crypto.encrypt(ACCESS),
        refresh_token_enc=crypto.encrypt(REFRESH),
        expires_at=datetime.now(timezone.utc) + expires_in,
        status=status,
    )
    db.add(account)
    await db.commit()
    return account


async def seed(client, db, *, connect: bool = True, email="owner@example.com", **acc):
    headers = await as_user(client, email=email)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await enable_orders(client, headers, rid)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid, price="10.00")
    if connect:
        await add_account(db, rid, **acc)
    return SimpleNamespace(headers=headers, rid=rid, qr=qr, sid=sid, iid=iid)


def order_payload(iid: str, method: str | None = "mercadopago", qty: int = 2) -> dict:
    body: dict = {
        "customer_name": "Ana",
        "order_type": "llevar",
        "items": [{"item_id": iid, "quantity": qty}],
    }
    if method is not None:
        body["payment_method"] = method
    return body


async def place(client, s, method: str | None = "mercadopago", **kw):
    return await client.post(f"/menu/{s.qr}/orders", json=order_payload(s.iid, method, **kw))


async def count_orders(db: AsyncSession) -> int:
    return (await db.execute(select(func.count(Order.id)))).scalar_one()


async def get_order(db: AsyncSession, oid: str) -> Order:
    db.expire_all()
    return (
        await db.execute(select(Order).where(Order.id == uuid.UUID(oid)))
    ).scalar_one()


def sign(data_id, request_id="req-1", ts="1700000000", secret=WEBHOOK_SECRET) -> dict:
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    v1 = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return {"x-signature": f"ts={ts},v1={v1}", "x-request-id": request_id}


async def notify(
    client, data_id, *, user_id=int(SELLER_MP_ID), type_="payment", headers=None
):
    return await client.post(
        f"/webhooks/mercadopago?data.id={data_id}&type={type_}",
        json={
            "action": "payment.updated",
            "type": type_,
            "user_id": user_id,
            "data": {"id": str(data_id)},
        },
        headers=sign(data_id) if headers is None else headers,
    )


def payment_json(order_id: str, *, status="approved", amount=20.0, currency="ARS"):
    return {
        "id": 111,
        "status": status,
        "transaction_amount": amount,
        "currency_id": currency,
        "external_reference": order_id,
    }


async def mp_order(client, db, mp, s) -> str:
    res = await place(client, s)
    assert res.status_code == 201, res.text
    return res.json()["id"]


# ---------------------------------------------------------------------------
# RF-01 / RF-02 — config y cifrado
# ---------------------------------------------------------------------------


def test_mercadopago_configured_requires_every_variable(monkeypatch):
    _configure(monkeypatch)
    assert settings.mercadopago_configured is True
    for name in (
        "MP_CLIENT_ID",
        "MP_CLIENT_SECRET",
        "MP_WEBHOOK_SECRET",
        "MP_TOKEN_ENCRYPTION_KEY",
        "PUBLIC_API_URL",
        "FRONTEND_URL",
    ):
        with monkeypatch.context() as m:
            m.setattr(settings, name, "")
            assert settings.mercadopago_configured is False, name


def test_mp_settings_default_to_empty_string():
    fields = type(settings).model_fields
    for name in (
        "MP_CLIENT_ID",
        "MP_CLIENT_SECRET",
        "MP_WEBHOOK_SECRET",
        "MP_TOKEN_ENCRYPTION_KEY",
        "PUBLIC_API_URL",
        "FRONTEND_URL",
    ):
        assert fields[name].default == "", name


def test_crypto_roundtrip_and_ciphertext_differs(monkeypatch):
    _configure(monkeypatch)
    enc = crypto.encrypt("APP_USR-secret")
    assert enc != "APP_USR-secret"
    assert "APP_USR-secret" not in enc
    assert crypto.decrypt(enc) == "APP_USR-secret"


# ---------------------------------------------------------------------------
# CA-01 — connect
# ---------------------------------------------------------------------------


async def test_connect_as_owner_returns_authorization_url(client, mp):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    res = await client.post(
        f"/restaurants/{rid}/payments/mercadopago/connect", headers=headers
    )
    assert res.status_code == 200, res.text
    url = urlparse(res.json()["authorization_url"])
    assert f"{url.scheme}://{url.netloc}{url.path}" == (
        "https://auth.mercadopago.com/authorization"
    )
    q = parse_qs(url.query)
    assert q["client_id"] == ["client-id-1"]
    assert q["response_type"] == ["code"]
    assert q["platform_id"] == ["mp"]
    assert q["redirect_uri"] == [f"{API_URL}/payments/mercadopago/callback"]
    claims = jwt.decode(
        q["state"][0], settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )
    assert claims["restaurant_id"] == rid
    assert claims["purpose"] == "mp_oauth"
    ttl = claims["exp"] - datetime.now(timezone.utc).timestamp()
    assert 0 < ttl <= 600


async def test_connect_as_editor_is_403(client, db_session, mp):
    owner = await as_user(client)
    rid = (await make_restaurant(client, owner))["id"]
    editor = await as_user(client, email="ed@example.com")
    await grant_editor_role(db_session, "ed@example.com", rid)
    res = await client.post(
        f"/restaurants/{rid}/payments/mercadopago/connect", headers=editor
    )
    assert res.status_code == 403


async def test_connect_without_server_config_is_503(client, mp, monkeypatch):
    monkeypatch.setattr(settings, "MP_CLIENT_ID", "")
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    res = await client.post(
        f"/restaurants/{rid}/payments/mercadopago/connect", headers=headers
    )
    assert res.status_code == 503
    assert res.json()["detail"] == "payments_not_configured"


async def test_connect_unauthenticated_is_401(client, mp):
    res = await client.post(f"/restaurants/{uuid.uuid4()}/payments/mercadopago/connect")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# CA-02 — callback
# ---------------------------------------------------------------------------


def make_state(rid: str, *, purpose="mp_oauth", exp_delta=timedelta(minutes=10), key=None):
    return jwt.encode(
        {
            "restaurant_id": rid,
            "purpose": purpose,
            "exp": datetime.now(timezone.utc) + exp_delta,
        },
        key or settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


async def callback(client, state: str | None, code: str | None = "code-1"):
    params = {}
    if state is not None:
        params["state"] = state
    if code is not None:
        params["code"] = code
    return await client.get(
        "/payments/mercadopago/callback", params=params, follow_redirects=False
    )


async def accounts_count(db: AsyncSession) -> int:
    db.expire_all()
    return (await db.execute(select(func.count(PaymentAccount.id)))).scalar_one()


async def test_callback_creates_account_with_encrypted_tokens(client, db_session, mp):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    res = await callback(client, make_state(rid))
    assert res.status_code == 302
    assert res.headers["location"] == f"{FRONT_URL}/dashboard/payments?mp=connected"

    db_session.expire_all()
    acc = (await db_session.execute(select(PaymentAccount))).scalar_one()
    assert str(acc.restaurant_id) == rid
    assert acc.provider == "mercadopago"
    assert acc.mp_user_id == "555"
    assert acc.status == PaymentAccountStatus.connected
    assert acc.access_token_enc != TOKEN_OK["access_token"]
    assert acc.refresh_token_enc != TOKEN_OK["refresh_token"]
    assert crypto.decrypt(acc.access_token_enc) == TOKEN_OK["access_token"]
    assert crypto.decrypt(acc.refresh_token_enc) == TOKEN_OK["refresh_token"]
    expires = acc.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    delta = expires - datetime.now(timezone.utc)
    assert timedelta(days=179) < delta < timedelta(days=181)


async def test_callback_exchanges_code_with_expected_body(client, mp):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    await callback(client, make_state(rid), code="the-code")
    (req,) = mp.calls_to("/oauth/token")
    assert mp.body(req) == {
        "grant_type": "authorization_code",
        "client_id": "client-id-1",
        "client_secret": "client-secret-1",
        "code": "the-code",
        "redirect_uri": f"{API_URL}/payments/mercadopago/callback",
    }


async def test_callback_never_leaks_tokens_in_redirect(client, mp):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    res = await callback(client, make_state(rid))
    assert TOKEN_OK["access_token"] not in res.headers["location"]
    assert TOKEN_OK["access_token"] not in res.text


async def test_callback_reconnect_upserts_single_account(client, db_session, mp):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    await add_account(db_session, rid, status=PaymentAccountStatus.disconnected)
    res = await callback(client, make_state(rid))
    assert res.headers["location"].endswith("?mp=connected")
    assert await accounts_count(db_session) == 1
    db_session.expire_all()
    acc = (await db_session.execute(select(PaymentAccount))).scalar_one()
    assert acc.status == PaymentAccountStatus.connected
    assert crypto.decrypt(acc.access_token_enc) == TOKEN_OK["access_token"]


async def test_callback_race_on_unique_account_updates_existing_row(
    client, db_session, mp, monkeypatch
):
    """Two callbacks racing: the loser must update the winner's row, not 500."""
    from app.services import mercadopago as svc

    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    await add_account(db_session, rid, status=PaymentAccountStatus.disconnected)

    real_get_account = svc.get_account
    calls = {"n": 0}

    async def stale_first(restaurant_id, session):
        calls["n"] += 1
        return None if calls["n"] == 1 else await real_get_account(restaurant_id, session)

    monkeypatch.setattr(svc, "get_account", stale_first)
    res = await callback(client, make_state(rid))
    assert res.headers["location"].endswith("?mp=connected")
    assert await accounts_count(db_session) == 1
    db_session.expire_all()
    acc = (await db_session.execute(select(PaymentAccount))).scalar_one()
    assert acc.status == PaymentAccountStatus.connected


@pytest.mark.parametrize(
    "case", ["tampered", "expired", "wrong_purpose", "wrong_key", "garbage", "no_state", "no_code"]
)
async def test_callback_invalid_input_redirects_to_error(client, db_session, mp, case):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    state: str | None = make_state(rid)
    code: str | None = "code-1"
    if case == "tampered":
        state = state[:-3] + ("AAA" if not state.endswith("AAA") else "BBB")
    elif case == "expired":
        state = make_state(rid, exp_delta=timedelta(minutes=-1))
    elif case == "wrong_purpose":
        state = make_state(rid, purpose="other")
    elif case == "wrong_key":
        state = make_state(rid, key="another-secret-key")
    elif case == "garbage":
        state = "not-a-jwt"
    elif case == "no_state":
        state = None
    elif case == "no_code":
        code = None
    res = await callback(client, state, code)
    assert res.status_code == 302
    assert res.headers["location"] == f"{FRONT_URL}/dashboard/payments?mp=error"
    assert await accounts_count(db_session) == 0


async def test_callback_with_normal_auth_token_as_state_is_error(client, db_session, mp):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    auth_token = headers["Authorization"].split()[1]
    res = await callback(client, auth_token)
    assert res.headers["location"].endswith("?mp=error")
    assert await accounts_count(db_session) == 0


async def test_callback_when_mp_rejects_code_redirects_to_error(client, db_session, mp):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    mp.token_response = lambda req: httpx.Response(400, json={"message": "invalid_grant"})
    res = await callback(client, make_state(rid))
    assert res.headers["location"] == f"{FRONT_URL}/dashboard/payments?mp=error"
    assert "invalid_grant" not in res.headers["location"]
    assert await accounts_count(db_session) == 0


async def test_callback_when_mp_unreachable_redirects_to_error(client, db_session, mp):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]

    def boom(req):
        raise httpx.ConnectError("down")

    mp.token_response = boom
    res = await callback(client, make_state(rid))
    assert res.headers["location"].endswith("?mp=error")
    assert await accounts_count(db_session) == 0


async def test_callback_with_malformed_mp_response_redirects_to_error(client, db_session, mp):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    mp.token_response = lambda req: httpx.Response(200, json={"access_token": "x"})
    res = await callback(client, make_state(rid))
    assert res.headers["location"].endswith("?mp=error")
    assert await accounts_count(db_session) == 0


async def test_callback_for_unknown_restaurant_redirects_to_error(client, db_session, mp):
    res = await callback(client, make_state(str(uuid.uuid4())))
    assert res.headers["location"].endswith("?mp=error")
    assert await accounts_count(db_session) == 0


# ---------------------------------------------------------------------------
# CA-03 — status / disconnect
# ---------------------------------------------------------------------------


async def test_status_not_connected(client, mp):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    res = await client.get(f"/restaurants/{rid}/payments/mercadopago", headers=headers)
    assert res.status_code == 200
    assert res.json() == {
        "configured": True,
        "connected": False,
        "status": None,
        "mp_user_id": None,
    }


async def test_status_connected_never_exposes_tokens(client, db_session, mp):
    s = await seed(client, db_session)
    res = await client.get(f"/restaurants/{s.rid}/payments/mercadopago", headers=s.headers)
    assert res.json() == {
        "configured": True,
        "connected": True,
        "status": "connected",
        "mp_user_id": SELLER_MP_ID,
    }
    assert ACCESS not in res.text and REFRESH not in res.text
    assert "token" not in res.text.lower()


async def test_status_disconnected_account(client, db_session, mp):
    s = await seed(client, db_session, status=PaymentAccountStatus.disconnected)
    res = await client.get(f"/restaurants/{s.rid}/payments/mercadopago", headers=s.headers)
    body = res.json()
    assert body["connected"] is False
    assert body["status"] == "disconnected"


async def test_status_reports_unconfigured_server(client, mp, monkeypatch):
    monkeypatch.setattr(settings, "MP_CLIENT_SECRET", "")
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    res = await client.get(f"/restaurants/{rid}/payments/mercadopago", headers=headers)
    assert res.status_code == 200
    assert res.json()["configured"] is False


async def test_status_readable_by_editor(client, db_session, mp):
    s = await seed(client, db_session)
    editor = await as_user(client, email="ed@example.com")
    await grant_editor_role(db_session, "ed@example.com", s.rid)
    got = await client.get(f"/restaurants/{s.rid}/payments/mercadopago", headers=editor)
    assert got.status_code == 200
    assert got.json()["connected"] is True


async def test_disconnect_as_owner_then_404(client, db_session, mp):
    s = await seed(client, db_session)
    first = await client.delete(f"/restaurants/{s.rid}/payments/mercadopago", headers=s.headers)
    assert first.status_code == 204
    assert await accounts_count(db_session) == 0
    second = await client.delete(f"/restaurants/{s.rid}/payments/mercadopago", headers=s.headers)
    assert second.status_code == 404
    assert second.json()["detail"] == "payment_account_not_found"


async def test_disconnect_as_editor_is_403_and_keeps_account(client, db_session, mp):
    s = await seed(client, db_session)
    editor = await as_user(client, email="ed@example.com")
    await grant_editor_role(db_session, "ed@example.com", s.rid)
    res = await client.delete(f"/restaurants/{s.rid}/payments/mercadopago", headers=editor)
    assert res.status_code == 403
    assert await accounts_count(db_session) == 1


async def test_disconnect_keeps_existing_orders(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    await client.delete(f"/restaurants/{s.rid}/payments/mercadopago", headers=s.headers)
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.pending


# ---------------------------------------------------------------------------
# CA-04 — get_seller_token (renovación lazy)
# ---------------------------------------------------------------------------


def http_client(fake: FakeMP) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(fake.handle), timeout=10.0)


async def test_seller_token_not_refreshed_when_valid_for_long(client, db_session, mp):
    s = await seed(client, db_session, expires_in=timedelta(days=30))
    acc = (await db_session.execute(select(PaymentAccount))).scalar_one()
    async with http_client(mp) as c:
        token = await get_seller_token(acc, db_session, c)
    assert token == ACCESS
    assert mp.calls == []


async def test_seller_token_refreshed_when_expiring_in_less_than_7_days(client, db_session, mp):
    await seed(client, db_session, expires_in=timedelta(days=3))
    acc = (await db_session.execute(select(PaymentAccount))).scalar_one()
    async with http_client(mp) as c:
        token = await get_seller_token(acc, db_session, c)
    assert token == TOKEN_OK["access_token"]
    (req,) = mp.calls_to("/oauth/token")
    body = mp.body(req)
    assert body["grant_type"] == "refresh_token"
    assert body["refresh_token"] == REFRESH
    assert body["client_id"] == "client-id-1"
    assert body["client_secret"] == "client-secret-1"
    db_session.expire_all()
    saved = (await db_session.execute(select(PaymentAccount))).scalar_one()
    assert crypto.decrypt(saved.access_token_enc) == TOKEN_OK["access_token"]
    assert crypto.decrypt(saved.refresh_token_enc) == TOKEN_OK["refresh_token"]
    expires = saved.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    assert expires - datetime.now(timezone.utc) > timedelta(days=170)
    assert saved.status == PaymentAccountStatus.connected


async def test_seller_token_refreshed_when_already_expired(client, db_session, mp):
    await seed(client, db_session, expires_in=timedelta(days=-1))
    acc = (await db_session.execute(select(PaymentAccount))).scalar_one()
    async with http_client(mp) as c:
        token = await get_seller_token(acc, db_session, c)
    assert token == TOKEN_OK["access_token"]


@pytest.mark.parametrize("failure", ["http_400", "http_500", "network"])
async def test_seller_token_refresh_failure_disconnects(client, db_session, mp, failure):
    await seed(client, db_session, expires_in=timedelta(days=1))
    acc = (await db_session.execute(select(PaymentAccount))).scalar_one()
    if failure == "network":
        def boom(req):
            raise httpx.ConnectError("down")
        mp.token_response = boom
    else:
        code = int(failure.split("_")[1])
        mp.token_response = lambda req: httpx.Response(code, json={})
    async with http_client(mp) as c:
        with pytest.raises(PaymentAccountDisconnected):
            await get_seller_token(acc, db_session, c)
    db_session.expire_all()
    saved = (await db_session.execute(select(PaymentAccount))).scalar_one()
    assert saved.status == PaymentAccountStatus.disconnected


async def test_seller_token_disconnected_account_is_not_usable(client, db_session, mp):
    await seed(client, db_session, status=PaymentAccountStatus.disconnected)
    acc = (await db_session.execute(select(PaymentAccount))).scalar_one()
    async with http_client(mp) as c:
        with pytest.raises(PaymentAccountDisconnected):
            await get_seller_token(acc, db_session, c)
    assert mp.calls == []


# ---------------------------------------------------------------------------
# CA-05 / CA-06 / CA-07 — creación de orden
# ---------------------------------------------------------------------------


async def test_cash_order_without_payment_method_is_unchanged(client, db_session, mp):
    s = await seed(client, db_session, connect=False)
    res = await place(client, s, method=None)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["payment_method"] == "cash"
    assert body["payment_status"] == "none"
    assert body["payment_url"] is None
    assert mp.calls == []


async def test_explicit_cash_order_is_unchanged_even_with_account(client, db_session, mp):
    s = await seed(client, db_session)
    res = await place(client, s, method="cash")
    assert res.status_code == 201
    assert res.json()["payment_status"] == "none"
    assert res.json()["payment_url"] is None
    assert mp.calls == []


async def test_invalid_payment_method_is_422(client, db_session, mp):
    s = await seed(client, db_session)
    res = await place(client, s, method="bitcoin")
    assert res.status_code == 422


async def test_mercadopago_order_creates_pending_order_and_preference(client, db_session, mp):
    s = await seed(client, db_session)
    res = await place(client, s)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["payment_method"] == "mercadopago"
    assert body["payment_status"] == "pending"
    assert body["status"] == "pending"
    assert body["payment_url"] == INIT_POINT
    assert body["total"] == "20.00"

    (req,) = mp.calls_to("/checkout/preferences")
    assert req.headers["authorization"] == f"Bearer {ACCESS}"
    pref = mp.body(req)
    assert pref["items"] == [
        {
            "title": "Pedido en My Bar",
            "quantity": 1,
            "unit_price": 20.0,
            "currency_id": "ARS",
        }
    ]
    assert pref["external_reference"] == body["id"]
    assert pref["notification_url"] == f"{API_URL}/webhooks/mercadopago"
    assert pref["back_urls"] == {
        "success": f"{FRONT_URL}/menu/{s.qr}?pago=ok&order={body['id']}",
        "failure": f"{FRONT_URL}/menu/{s.qr}?pago=error&order={body['id']}",
        "pending": f"{FRONT_URL}/menu/{s.qr}?pago=pendiente&order={body['id']}",
    }
    assert pref["auto_return"] == "approved"

    order = await get_order(db_session, body["id"])
    assert order.mp_preference_id == "pref-1"
    assert order.payment_method == PaymentMethod.mercadopago


async def test_preference_never_sends_marketplace_fee(client, db_session, mp):
    s = await seed(client, db_session)
    await place(client, s)
    for req in mp.calls:
        assert "marketplace_fee" not in req.content.decode()


async def test_preference_total_is_recomputed_server_side_with_modifiers(client, db_session, mp):
    s = await seed(client, db_session)
    mid = await make_modifier(client, s.headers, s.rid, s.sid, s.iid, price_delta="1.50")
    payload = order_payload(s.iid, qty=2)
    payload["items"][0]["modifier_ids"] = [mid]
    payload["total"] = "0.01"
    res = await client.post(f"/menu/{s.qr}/orders", json=payload)
    assert res.status_code == 201
    (req,) = mp.calls_to("/checkout/preferences")
    assert mp.body(req)["items"][0]["unit_price"] == 23.0


async def test_mercadopago_without_account_is_409_and_creates_nothing(client, db_session, mp):
    s = await seed(client, db_session, connect=False)
    res = await place(client, s)
    assert res.status_code == 409
    assert res.json()["detail"] == "mercadopago_unavailable"
    assert await count_orders(db_session) == 0
    assert mp.calls == []


async def test_mercadopago_with_disconnected_account_is_409(client, db_session, mp):
    s = await seed(client, db_session, status=PaymentAccountStatus.disconnected)
    res = await place(client, s)
    assert res.status_code == 409
    assert res.json()["detail"] == "mercadopago_unavailable"
    assert await count_orders(db_session) == 0


async def test_mercadopago_with_unconfigured_server_is_409(client, db_session, mp, monkeypatch):
    s = await seed(client, db_session)
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", "")
    res = await place(client, s)
    assert res.status_code == 409
    assert res.json()["detail"] == "mercadopago_unavailable"
    assert await count_orders(db_session) == 0


async def test_mercadopago_when_token_refresh_fails_is_409_and_disconnects(client, db_session, mp):
    s = await seed(client, db_session, expires_in=timedelta(days=1))
    mp.token_response = lambda req: httpx.Response(401, json={})
    res = await place(client, s)
    assert res.status_code == 409
    assert res.json()["detail"] == "mercadopago_unavailable"
    assert await count_orders(db_session) == 0
    db_session.expire_all()
    acc = (await db_session.execute(select(PaymentAccount))).scalar_one()
    assert acc.status == PaymentAccountStatus.disconnected


async def test_mercadopago_refreshes_expiring_token_before_charging(client, db_session, mp):
    s = await seed(client, db_session, expires_in=timedelta(days=2))
    res = await place(client, s)
    assert res.status_code == 201
    (req,) = mp.calls_to("/checkout/preferences")
    assert req.headers["authorization"] == f"Bearer {TOKEN_OK['access_token']}"


async def test_mercadopago_orders_disabled_still_404(client, db_session, mp):
    s = await seed(client, db_session, connect=False)
    await client.patch(
        f"/restaurants/{s.rid}",
        json={"name": "My Bar", "orders_enabled": False},
        headers=s.headers,
    )
    res = await place(client, s)
    assert res.status_code == 404
    assert res.json()["detail"] == "orders_disabled"


async def test_mercadopago_invalid_item_is_404_and_does_not_call_mp(client, db_session, mp):
    s = await seed(client, db_session)
    payload = order_payload(str(uuid.uuid4()))
    res = await client.post(f"/menu/{s.qr}/orders", json=payload)
    assert res.status_code == 404
    assert res.json()["detail"] == "item_not_found"
    assert await count_orders(db_session) == 0
    assert mp.calls == []


@pytest.mark.parametrize("failure", ["http_500", "http_400", "network"])
async def test_preference_failure_is_502_and_cancels_order(client, db_session, mp, failure):
    s = await seed(client, db_session)
    if failure == "network":
        def boom(req):
            raise httpx.ReadTimeout("slow")
        mp.preference_response = boom
    else:
        code = int(failure.split("_")[1])
        mp.preference_response = lambda req: httpx.Response(code, json={"message": "x"})
    res = await place(client, s)
    assert res.status_code == 502
    assert res.json()["detail"] == "payment_provider_error"
    db_session.expire_all()
    order = (await db_session.execute(select(Order))).scalar_one()
    assert order.payment_status == PaymentStatus.cancelled
    assert order.payment_status != PaymentStatus.pending


async def test_preference_response_without_init_point_is_502_and_cancels(client, db_session, mp):
    s = await seed(client, db_session)
    mp.preference_response = lambda req: httpx.Response(201, json={"id": "pref-1"})
    res = await place(client, s)
    assert res.status_code == 502
    db_session.expire_all()
    order = (await db_session.execute(select(Order))).scalar_one()
    assert order.payment_status == PaymentStatus.cancelled


# ---------------------------------------------------------------------------
# CA-08 — webhook
# ---------------------------------------------------------------------------


async def test_webhook_without_signature_is_401_and_has_no_effect(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid)
    res = await notify(client, 111, headers={})
    assert res.status_code == 401
    assert res.json()["detail"] == "invalid_signature"
    assert mp.calls_to("/v1/payments") == []
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.pending


async def test_webhook_with_wrong_signature_is_401(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid)
    res = await notify(client, 111, headers=sign(111, secret="other-secret"))
    assert res.status_code == 401
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.pending


async def test_webhook_signature_for_a_different_id_is_401(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid)
    res = await notify(client, 111, headers=sign(999))
    assert res.status_code == 401


async def test_webhook_malformed_signature_header_is_401(client, db_session, mp):
    res = await notify(
        client, 111, headers={"x-signature": "garbage", "x-request-id": "r"}
    )
    assert res.status_code == 401


async def test_webhook_without_server_config_is_503(client, mp, monkeypatch):
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", "")
    res = await notify(client, 111, headers=sign(111, secret=""))
    assert res.status_code == 503


async def test_webhook_approved_marks_order_approved(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid)
    res = await notify(client, 111)
    assert res.status_code == 200
    order = await get_order(db_session, oid)
    assert order.payment_status == PaymentStatus.approved
    assert order.mp_payment_id == "111"
    (req,) = mp.calls_to("/v1/payments/")
    assert req.headers["authorization"] == f"Bearer {ACCESS}"


async def test_webhook_amount_mismatch_does_not_approve(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid, amount=1.0)
    res = await notify(client, 111)
    assert res.status_code == 200
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.pending


async def test_webhook_currency_mismatch_does_not_approve(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid, currency="USD")
    res = await notify(client, 111)
    assert res.status_code == 200
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.pending


@pytest.mark.parametrize(
    "mp_status,expected",
    [
        ("rejected", PaymentStatus.rejected),
        ("cancelled", PaymentStatus.cancelled),
        ("refunded", PaymentStatus.cancelled),
        ("charged_back", PaymentStatus.cancelled),
        ("pending", PaymentStatus.pending),
        ("in_process", PaymentStatus.pending),
        ("authorized", PaymentStatus.pending),
    ],
)
async def test_webhook_status_mapping(client, db_session, mp, mp_status, expected):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid, status=mp_status)
    res = await notify(client, 111)
    assert res.status_code == 200
    assert (await get_order(db_session, oid)).payment_status == expected


async def test_webhook_decimal_amount_matches_without_float_noise(client, db_session, mp):
    s = await seed(client, db_session)
    mid = await make_modifier(client, s.headers, s.rid, s.sid, s.iid, price_delta="0.10")
    payload = order_payload(s.iid, qty=3)
    payload["items"][0]["modifier_ids"] = [mid]
    res = await client.post(f"/menu/{s.qr}/orders", json=payload)
    oid = res.json()["id"]
    assert res.json()["total"] == "30.30"
    mp.payments["111"] = payment_json(oid, amount=30.3)
    await notify(client, 111)
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.approved


async def test_webhook_order_of_another_restaurant_has_no_effect(client, db_session, mp):
    a = await seed(client, db_session)
    b = await seed(client, db_session, email="b@example.com", mp_user_id="777")
    oid_b = await mp_order(client, db_session, mp, b)
    # El pago llega por la cuenta de A (user_id 555) pero referencia una orden de B.
    mp.payments["111"] = payment_json(oid_b)
    res = await notify(client, 111, user_id=int(SELLER_MP_ID))
    assert res.status_code == 200
    assert (await get_order(db_session, oid_b)).payment_status == PaymentStatus.pending


async def test_webhook_unknown_external_reference_is_200(client, db_session, mp):
    await seed(client, db_session)
    mp.payments["111"] = payment_json(str(uuid.uuid4()))
    res = await notify(client, 111)
    assert res.status_code == 200


async def test_webhook_non_uuid_external_reference_is_200(client, db_session, mp):
    await seed(client, db_session)
    mp.payments["111"] = payment_json("not-a-uuid")
    res = await notify(client, 111)
    assert res.status_code == 200


async def test_webhook_cash_order_reference_has_no_effect(client, db_session, mp):
    s = await seed(client, db_session)
    res = await place(client, s, method="cash")
    oid = res.json()["id"]
    mp.payments["111"] = payment_json(oid)
    out = await notify(client, 111)
    assert out.status_code == 200
    order = await get_order(db_session, oid)
    assert order.payment_status == PaymentStatus.none
    assert order.payment_method == PaymentMethod.cash


async def test_webhook_unknown_seller_user_id_is_200_without_mp_calls(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid)
    res = await notify(client, 111, user_id=424242)
    assert res.status_code == 200
    assert mp.calls_to("/v1/payments") == []
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.pending


async def test_webhook_other_notification_types_are_ignored(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid)
    res = await notify(client, 111, type_="merchant_order")
    assert res.status_code == 200
    assert mp.calls_to("/v1/payments") == []
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.pending


async def test_webhook_non_numeric_data_id_never_reaches_mp(client, db_session, mp):
    await seed(client, db_session)
    res = await notify(client, "abc", headers=sign("abc"))
    assert res.status_code == 200
    assert mp.calls_to("/v1/payments") == []


async def test_webhook_is_idempotent(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid)
    first = await notify(client, 111)
    second = await notify(client, 111)
    assert first.status_code == second.status_code == 200
    order = await get_order(db_session, oid)
    assert order.payment_status == PaymentStatus.approved
    assert order.mp_payment_id == "111"


async def test_webhook_approved_does_not_regress_on_late_pending(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid)
    await notify(client, 111)
    mp.payments["111"] = payment_json(oid, status="pending")
    res = await notify(client, 111)
    assert res.status_code == 200
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.approved


async def test_webhook_approved_does_not_regress_on_other_payment_rejected(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid)
    await notify(client, 111)
    mp.payments["222"] = payment_json(oid, status="rejected")
    await notify(client, 222)
    order = await get_order(db_session, oid)
    assert order.payment_status == PaymentStatus.approved
    assert order.mp_payment_id == "111"


async def test_webhook_mp_server_error_is_502(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payment_error = httpx.Response(500, json={})
    res = await notify(client, 111)
    assert res.status_code == 502
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.pending


async def test_webhook_mp_network_error_is_502(client, db_session, mp):
    s = await seed(client, db_session)
    await mp_order(client, db_session, mp, s)
    mp.payment_error = httpx.ConnectError("down")
    res = await notify(client, 111)
    assert res.status_code == 502


async def test_webhook_mp_payment_not_found_is_200_without_effect(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    res = await notify(client, 111)
    assert res.status_code == 200
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.pending


async def test_webhook_with_disconnected_account_is_502_so_mp_retries(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    acc = (await db_session.execute(select(PaymentAccount))).scalar_one()
    acc.status = PaymentAccountStatus.disconnected
    await db_session.commit()
    mp.payments["111"] = payment_json(oid)
    res = await notify(client, 111)
    assert res.status_code == 502
    assert mp.calls_to("/v1/payments") == []
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.pending

    # Reconnected before MP's retry: the same notification now reconciles.
    db_session.expire_all()
    acc = (await db_session.execute(select(PaymentAccount))).scalar_one()
    acc.status = PaymentAccountStatus.connected
    await db_session.commit()
    res = await notify(client, 111)
    assert res.status_code == 200
    assert (await get_order(db_session, oid)).payment_status == PaymentStatus.approved


async def test_webhook_works_when_two_restaurants_share_the_mp_user(client, db_session, mp):
    a = await seed(client, db_session)
    b = await seed(client, db_session, email="b@example.com")
    oid_b = await mp_order(client, db_session, mp, b)
    mp.payments["111"] = payment_json(oid_b)
    res = await notify(client, 111)
    assert res.status_code == 200
    assert (await get_order(db_session, oid_b)).payment_status == PaymentStatus.approved


# ---------------------------------------------------------------------------
# CA-09 — comandas
# ---------------------------------------------------------------------------


async def test_list_orders_hides_unpaid_mercadopago_orders(client, db_session, mp):
    s = await seed(client, db_session)
    cash = (await place(client, s, method="cash")).json()["id"]
    pending = await mp_order(client, db_session, mp, s)
    approved = await mp_order(client, db_session, mp, s)
    rejected = await mp_order(client, db_session, mp, s)
    for oid, st in ((approved, PaymentStatus.approved), (rejected, PaymentStatus.rejected)):
        order = await get_order(db_session, oid)
        order.payment_status = st
        await db_session.commit()

    res = await client.get(f"/restaurants/{s.rid}/orders", headers=s.headers)
    ids = {o["id"] for o in res.json()}
    assert ids == {cash, approved}
    assert pending not in ids and rejected not in ids

    filtered = await client.get(
        f"/restaurants/{s.rid}/orders?status=pending", headers=s.headers
    )
    assert {o["id"] for o in filtered.json()} == {cash, approved}


async def test_list_orders_exposes_payment_fields(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    order = await get_order(db_session, oid)
    order.payment_status = PaymentStatus.approved
    await db_session.commit()
    res = await client.get(f"/restaurants/{s.rid}/orders", headers=s.headers)
    (row,) = res.json()
    assert row["payment_method"] == "mercadopago"
    assert row["payment_status"] == "approved"
    assert "mp_preference_id" not in row


# ---------------------------------------------------------------------------
# CA-10 — turnos de caja
# ---------------------------------------------------------------------------


async def test_shift_expected_ignores_mercadopago_orders(client, db_session, mp):
    s = await seed(client, db_session)
    staff = (
        await client.post(
            f"/restaurants/{s.rid}/staff",
            json={"name": "Ana", "position": "mozo", "pin": "1111"},
            headers=s.headers,
        )
    ).json()
    shift = (
        await client.post(
            f"/restaurants/{s.rid}/shifts",
            json={"staff_member_id": staff["id"], "opening_amount": "100.00"},
            headers=s.headers,
        )
    ).json()
    for method, total in ((PaymentMethod.cash, "50.00"), (PaymentMethod.mercadopago, "30.00")):
        order = Order(
            restaurant_id=uuid.UUID(s.rid),
            status=OrderStatus.ready,
            customer_name="C",
            order_type=OrderType.llevar,
            total=Decimal(total),
            payment_method=method,
            payment_status=(
                PaymentStatus.approved
                if method == PaymentMethod.mercadopago
                else PaymentStatus.none
            ),
        )
        db_session.add(order)
        await db_session.commit()
        patched = await client.patch(
            f"/restaurants/{s.rid}/orders/{order.id}",
            json={"status": "completed"},
            headers=s.headers,
        )
        assert patched.status_code == 200
    closed = await client.post(
        f"/restaurants/{s.rid}/shifts/{shift['id']}/close",
        json={"staff_member_id": staff["id"], "counted_amount": "150.00"},
        headers=s.headers,
    )
    body = closed.json()
    assert Decimal(body["expected_amount"]) == Decimal("150.00")
    assert body["orders_count"] == 2


# ---------------------------------------------------------------------------
# CA-11 — consulta pública del estado de pago
# ---------------------------------------------------------------------------


async def test_public_payment_status_for_mercadopago_order(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    res = await client.get(f"/menu/{s.qr}/orders/{oid}/payment")
    assert res.status_code == 200
    assert res.json() == {"payment_status": "pending", "status": "pending"}


async def test_public_payment_status_reflects_approval(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    mp.payments["111"] = payment_json(oid)
    await notify(client, 111)
    res = await client.get(f"/menu/{s.qr}/orders/{oid}/payment")
    assert res.json()["payment_status"] == "approved"


async def test_public_payment_status_cash_order_is_404(client, db_session, mp):
    s = await seed(client, db_session)
    oid = (await place(client, s, method="cash")).json()["id"]
    res = await client.get(f"/menu/{s.qr}/orders/{oid}/payment")
    assert res.status_code == 404
    assert res.json()["detail"] == "order_not_found"


async def test_public_payment_status_other_restaurant_token_is_404(client, db_session, mp):
    a = await seed(client, db_session)
    b = await seed(client, db_session, email="b@example.com")
    oid = await mp_order(client, db_session, mp, a)
    res = await client.get(f"/menu/{b.qr}/orders/{oid}/payment")
    assert res.status_code == 404
    assert res.json()["detail"] == "order_not_found"


async def test_public_payment_status_unknown_order_or_token_is_404(client, db_session, mp):
    s = await seed(client, db_session)
    unknown_order = await client.get(f"/menu/{s.qr}/orders/{uuid.uuid4()}/payment")
    unknown_token = await client.get(f"/menu/nope/orders/{uuid.uuid4()}/payment")
    assert unknown_order.status_code == 404
    assert unknown_token.status_code == 404
    assert unknown_token.json()["detail"] == "order_not_found"


async def test_public_payment_status_response_has_only_two_fields(client, db_session, mp):
    s = await seed(client, db_session)
    oid = await mp_order(client, db_session, mp, s)
    res = await client.get(f"/menu/{s.qr}/orders/{oid}/payment")
    assert set(res.json()) == {"payment_status", "status"}


# ---------------------------------------------------------------------------
# CA-12 — accepts_mercadopago en el menú público
# ---------------------------------------------------------------------------


async def test_public_menu_accepts_mercadopago_false_without_account(client, db_session, mp):
    s = await seed(client, db_session, connect=False)
    res = await client.get(f"/menu/{s.qr}")
    assert res.json()["restaurant"]["accepts_mercadopago"] is False


async def test_public_menu_accepts_mercadopago_false_when_disconnected(client, db_session, mp):
    s = await seed(client, db_session, status=PaymentAccountStatus.disconnected)
    res = await client.get(f"/menu/{s.qr}")
    assert res.json()["restaurant"]["accepts_mercadopago"] is False


async def test_public_menu_accepts_mercadopago_true_when_connected(client, db_session, mp):
    s = await seed(client, db_session)
    res = await client.get(f"/menu/{s.qr}")
    assert res.json()["restaurant"]["accepts_mercadopago"] is True


async def test_public_menu_accepts_mercadopago_false_when_server_unconfigured(
    client, db_session, mp, monkeypatch
):
    s = await seed(client, db_session)
    monkeypatch.setattr(settings, "MP_CLIENT_SECRET", "")
    res = await client.get(f"/menu/{s.qr}")
    assert res.json()["restaurant"]["accepts_mercadopago"] is False
    assert ACCESS not in res.text


# ---------------------------------------------------------------------------
# Modelo — defaults
# ---------------------------------------------------------------------------


async def test_order_defaults_are_cash_and_none(db_session):
    restaurant_id = uuid.uuid4()
    from app.models.restaurant import Restaurant

    db_session.add(Restaurant(id=restaurant_id, name="R", slug="r-x", qr_token="tok-x"))
    await db_session.commit()
    order = Order(
        restaurant_id=restaurant_id,
        customer_name="C",
        order_type=OrderType.llevar,
        total=Decimal("1.00"),
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)
    assert order.payment_method == PaymentMethod.cash
    assert order.payment_status == PaymentStatus.none
    assert order.mp_preference_id is None
    assert order.mp_payment_id is None


async def test_payment_account_restaurant_id_is_unique(db_session):
    from sqlalchemy.exc import IntegrityError
    from app.models.restaurant import Restaurant

    rid = uuid.uuid4()
    db_session.add(Restaurant(id=rid, name="R", slug="r-y", qr_token="tok-y"))
    await db_session.commit()
    for _ in range(2):
        db_session.add(
            PaymentAccount(
                restaurant_id=rid,
                provider="mercadopago",
                mp_user_id="1",
                access_token_enc="a",
                refresh_token_enc="b",
                expires_at=datetime.now(timezone.utc),
                status=PaymentAccountStatus.connected,
            )
        )
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()
