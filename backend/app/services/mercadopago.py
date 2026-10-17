"""Mercado Pago integration (M36): OAuth connection, seller tokens, Checkout
Pro preferences and webhook processing. Marketplace model — every call that
moves money uses the *restaurant's* token and no fee is ever requested.

Tokens (access/refresh/client secret) must never be logged or returned.
"""
import hashlib
import hmac
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from urllib.parse import urlencode

import httpx
from cryptography.fernet import InvalidToken
from fastapi import HTTPException
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.order import Order, PaymentMethod, PaymentStatus
from app.models.payment_account import PaymentAccount, PaymentAccountStatus
from app.models.restaurant import Restaurant
from app.services import crypto

logger = logging.getLogger(__name__)

MP_API_BASE = "https://api.mercadopago.com"
MP_AUTH_URL = "https://auth.mercadopago.com/authorization"
PROVIDER = "mercadopago"
CURRENCY = "ARS"
REFRESH_THRESHOLD = timedelta(days=7)
STATE_PURPOSE = "mp_oauth"
STATE_TTL = timedelta(minutes=10)
CENTS = Decimal("0.01")

# MP payment.status -> our payment_status (M36 RF-18).
_STATUS_MAP: dict[str, PaymentStatus] = {
    "approved": PaymentStatus.approved,
    "rejected": PaymentStatus.rejected,
    "cancelled": PaymentStatus.cancelled,
    "refunded": PaymentStatus.cancelled,
    "charged_back": PaymentStatus.cancelled,
    "pending": PaymentStatus.pending,
    "in_process": PaymentStatus.pending,
    "authorized": PaymentStatus.pending,
}


class MercadoPagoError(Exception):
    """Mercado Pago failed (HTTP error, timeout, network, unusable response)."""


class PaymentAccountDisconnected(Exception):
    """The seller's account can no longer be used to charge."""


@dataclass(frozen=True)
class TokenSet:
    access_token: str
    refresh_token: str
    expires_at: datetime
    user_id: str


def _aware(value: datetime) -> datetime:
    # SQLite hands timezone-aware columns back naive; the app stores UTC.
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


# --- OAuth state -----------------------------------------------------------


def build_state(restaurant_id: uuid.UUID) -> str:
    claims = {
        "restaurant_id": str(restaurant_id),
        "purpose": STATE_PURPOSE,
        "exp": datetime.now(timezone.utc) + STATE_TTL,
    }
    return jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_state(state: str) -> uuid.UUID:
    """Return the restaurant id carried by ``state`` or raise ``ValueError``."""
    try:
        claims = jwt.decode(
            state, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        if claims.get("purpose") != STATE_PURPOSE:
            raise ValueError("wrong purpose")
        return uuid.UUID(claims["restaurant_id"])
    except (JWTError, KeyError, TypeError) as exc:
        raise ValueError("invalid_state") from exc


def _callback_url() -> str:
    return f"{settings.PUBLIC_API_URL.rstrip('/')}/payments/mercadopago/callback"


def build_authorization_url(restaurant_id: uuid.UUID) -> str:
    query = urlencode(
        {
            "client_id": settings.MP_CLIENT_ID,
            "response_type": "code",
            "platform_id": "mp",
            "state": build_state(restaurant_id),
            "redirect_uri": _callback_url(),
        }
    )
    return f"{MP_AUTH_URL}?{query}"


# --- Token endpoint --------------------------------------------------------


async def _request_tokens(client: httpx.AsyncClient, payload: dict) -> TokenSet:
    try:
        response = await client.post(f"{MP_API_BASE}/oauth/token", json=payload)
    except httpx.HTTPError as exc:
        raise MercadoPagoError("token endpoint unreachable") from exc
    if response.status_code != 200:
        logger.warning("MP token endpoint answered HTTP %s", response.status_code)
        raise MercadoPagoError("token endpoint error")
    try:
        data = response.json()
        return TokenSet(
            access_token=data["access_token"],
            refresh_token=data["refresh_token"],
            expires_at=datetime.now(timezone.utc)
            + timedelta(seconds=int(data["expires_in"])),
            user_id=str(data["user_id"]),
        )
    except (ValueError, KeyError, TypeError) as exc:
        raise MercadoPagoError("malformed token response") from exc


def _oauth_payload(grant_type: str, **extra: str) -> dict:
    return {
        "grant_type": grant_type,
        "client_id": settings.MP_CLIENT_ID,
        "client_secret": settings.MP_CLIENT_SECRET,
        **extra,
    }


async def connect_account(
    restaurant_id: uuid.UUID,
    code: str,
    session: AsyncSession,
    client: httpx.AsyncClient,
) -> PaymentAccount:
    """Exchange the OAuth ``code`` and upsert the restaurant's account (RF-06)."""
    if await session.get(Restaurant, restaurant_id) is None:
        raise MercadoPagoError("unknown restaurant")
    tokens = await _request_tokens(
        client,
        _oauth_payload(
            "authorization_code", code=code, redirect_uri=_callback_url()
        ),
    )
    account = await get_account(restaurant_id, session)
    created = account is None
    if created:
        account = PaymentAccount(restaurant_id=restaurant_id, provider=PROVIDER)
        session.add(account)
    _apply_connection(account, tokens)
    try:
        await session.commit()
    except IntegrityError:
        # Two callbacks raced on the unique restaurant_id: the other one won,
        # so update its row instead of failing.
        await session.rollback()
        account = await get_account(restaurant_id, session)
        if account is None:
            raise MercadoPagoError("account upsert failed") from None
        _apply_connection(account, tokens)
        await session.commit()
    return account


def _apply_connection(account: PaymentAccount, tokens: TokenSet) -> None:
    _store_tokens(account, tokens)
    account.mp_user_id = tokens.user_id
    account.status = PaymentAccountStatus.connected


def _store_tokens(account: PaymentAccount, tokens: TokenSet) -> None:
    account.access_token_enc = crypto.encrypt(tokens.access_token)
    account.refresh_token_enc = crypto.encrypt(tokens.refresh_token)
    account.expires_at = tokens.expires_at


async def get_account(
    restaurant_id: uuid.UUID, session: AsyncSession
) -> PaymentAccount | None:
    result = await session.execute(
        select(PaymentAccount).where(PaymentAccount.restaurant_id == restaurant_id)
    )
    return result.scalar_one_or_none()


async def disconnect_account(restaurant_id: uuid.UUID, session: AsyncSession) -> None:
    account = await get_account(restaurant_id, session)
    if account is None:
        raise HTTPException(status_code=404, detail="payment_account_not_found")
    await session.delete(account)
    await session.commit()


async def get_seller_token(
    account: PaymentAccount, session: AsyncSession, client: httpx.AsyncClient
) -> str:
    """Return a usable access token, refreshing it lazily (RF-09)."""
    if account.status != PaymentAccountStatus.connected:
        raise PaymentAccountDisconnected()
    try:
        access = crypto.decrypt(account.access_token_enc)
        refresh = crypto.decrypt(account.refresh_token_enc)
    except InvalidToken as exc:
        # Wrong/rotated encryption key: a server config problem, not a
        # seller problem, so the account is left untouched.
        logger.error("Cannot decrypt payment account tokens (check encryption key)")
        raise PaymentAccountDisconnected() from exc
    if _aware(account.expires_at) - datetime.now(timezone.utc) >= REFRESH_THRESHOLD:
        return access
    try:
        tokens = await _request_tokens(
            client, _oauth_payload("refresh_token", refresh_token=refresh)
        )
    except MercadoPagoError as exc:
        account.status = PaymentAccountStatus.disconnected
        await session.commit()
        logger.warning("Payment account %s disconnected: refresh failed", account.id)
        raise PaymentAccountDisconnected() from exc
    _store_tokens(account, tokens)
    await session.commit()
    return tokens.access_token


# --- Checkout Pro ----------------------------------------------------------


def _amount(value: Decimal) -> float:
    # The only place money leaves Decimal: the JSON number MP expects.
    return float(value.quantize(CENTS, rounding=ROUND_HALF_UP))


def _preference_body(order: Order, restaurant: Restaurant) -> dict:
    front = settings.FRONTEND_URL.rstrip("/")
    back = f"{front}/menu/{restaurant.qr_token}"
    ref = f"order={order.id}"
    body = {
        "items": [
            {
                "title": f"Pedido en {restaurant.name}",
                "quantity": 1,
                "unit_price": _amount(order.total),
                "currency_id": CURRENCY,
            }
        ],
        "external_reference": str(order.id),
        "notification_url": f"{settings.PUBLIC_API_URL.rstrip('/')}/webhooks/mercadopago",
        "back_urls": {
            "success": f"{back}?pago=ok&{ref}",
            "failure": f"{back}?pago=error&{ref}",
            "pending": f"{back}?pago=pendiente&{ref}",
        },
    }
    # MP rejects auto_return (400 invalid_auto_return) when the back_urls are
    # not public https, e.g. a local http://localhost frontend; the buyer then
    # returns with the "volver al sitio" button instead of automatically.
    if front.startswith("https://"):
        body["auto_return"] = "approved"
    return body


async def create_preference(
    order: Order, restaurant: Restaurant, token: str, client: httpx.AsyncClient
) -> tuple[str, str]:
    """Create the Checkout Pro preference; returns ``(preference_id, init_point)``."""
    try:
        response = await client.post(
            f"{MP_API_BASE}/checkout/preferences",
            json=_preference_body(order, restaurant),
            headers={"Authorization": f"Bearer {token}"},
        )
    except httpx.HTTPError as exc:
        raise MercadoPagoError("preference request failed") from exc
    if not 200 <= response.status_code < 300:
        logger.warning("MP preference creation answered HTTP %s", response.status_code)
        raise MercadoPagoError("preference error")
    try:
        data = response.json()
        return str(data["id"]), str(data["init_point"])
    except (ValueError, KeyError, TypeError) as exc:
        raise MercadoPagoError("malformed preference response") from exc


# --- Webhook ---------------------------------------------------------------


def verify_signature(
    x_signature: str | None, x_request_id: str | None, data_id: str | None
) -> bool:
    """Validate MP's ``x-signature`` (HMAC-SHA256 over the documented manifest)."""
    if not x_signature or not data_id:
        return False
    parts = dict(
        item.split("=", 1) for item in x_signature.split(",") if "=" in item
    )
    ts, received = parts.get("ts"), parts.get("v1")
    if not ts or not received:
        return False
    manifest = f"id:{data_id.lower()};request-id:{x_request_id or ''};ts:{ts};"
    expected = hmac.new(
        settings.MP_WEBHOOK_SECRET.encode(), manifest.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected.encode(), received.strip().encode())


async def _fetch_payment(
    payment_id: str, token: str, client: httpx.AsyncClient
) -> dict | None:
    try:
        response = await client.get(
            f"{MP_API_BASE}/v1/payments/{payment_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    except httpx.HTTPError as exc:
        raise MercadoPagoError("payment lookup failed") from exc
    if response.status_code == 404:
        return None
    if response.status_code != 200:
        raise MercadoPagoError(f"payment lookup HTTP {response.status_code}")
    try:
        data = response.json()
    except ValueError as exc:
        raise MercadoPagoError("malformed payment response") from exc
    return data if isinstance(data, dict) else None


def _amount_matches(payment: dict, order: Order) -> bool:
    try:
        paid = Decimal(str(payment.get("transaction_amount"))).quantize(CENTS)
    except InvalidOperation:
        return False
    return paid == order.total.quantize(CENTS) and payment.get("currency_id") == CURRENCY


async def _usable_token(
    accounts: list[PaymentAccount], session: AsyncSession, client: httpx.AsyncClient
) -> str | None:
    for account in accounts:
        if account.status != PaymentAccountStatus.connected:
            continue
        try:
            return await get_seller_token(account, session, client)
        except PaymentAccountDisconnected:
            continue
    return None


async def process_payment_notification(
    seller_user_id: str,
    payment_id: str,
    session: AsyncSession,
    client: httpx.AsyncClient,
) -> None:
    """Apply a signed ``payment`` notification (RF-17..RF-19).

    Nothing from the notification body is trusted: the payment is re-fetched
    from MP with the seller's token and its amount/ownership are verified.
    Raises ``MercadoPagoError`` if MP cannot be queried or no connected account
    has a usable token (caller answers 502 so MP retries).
    """
    result = await session.execute(
        select(PaymentAccount).where(PaymentAccount.mp_user_id == seller_user_id)
    )
    accounts = list(result.scalars().all())
    if not accounts:
        return
    token = await _usable_token(accounts, session, client)
    if token is None:
        # Answer 5xx so MP retries: if the restaurant reconnects in time the
        # payment is reconciled instead of being silently lost.
        logger.warning("Webhook for MP user without a usable account; MP will retry")
        raise MercadoPagoError("no usable payment account")
    payment = await _fetch_payment(payment_id, token, client)
    if payment is None:
        return
    await _apply_payment(payment, payment_id, {a.restaurant_id for a in accounts}, session)


async def _apply_payment(
    payment: dict, payment_id: str, restaurant_ids: set[uuid.UUID], session: AsyncSession
) -> None:
    try:
        order_id = uuid.UUID(str(payment.get("external_reference")))
    except ValueError:
        return
    result = await session.execute(
        select(Order)
        .where(
            Order.id == order_id,
            Order.restaurant_id.in_(restaurant_ids),
            Order.payment_method == PaymentMethod.mercadopago,
        )
        .with_for_update()
    )
    order = result.scalar_one_or_none()
    if order is None:
        return
    new_status = _STATUS_MAP.get(str(payment.get("status")))
    if new_status is None:
        logger.warning("Unknown MP payment status for order %s", order.id)
        return
    if not _amount_matches(payment, order):
        logger.warning("MP payment amount/currency mismatch for order %s", order.id)
        return
    # An approved order never moves back because of a late/other notification.
    if order.payment_status == PaymentStatus.approved:
        return
    if order.payment_status == new_status and order.mp_payment_id == payment_id:
        return
    order.payment_status = new_status
    order.mp_payment_id = payment_id
    await session.commit()


# --- Public payment status -------------------------------------------------


async def get_public_payment_status(
    qr_token: str, order_id: uuid.UUID, session: AsyncSession
) -> Order:
    result = await session.execute(
        select(Order)
        .join(Restaurant, Restaurant.id == Order.restaurant_id)
        .where(
            Restaurant.qr_token == qr_token,
            Restaurant.is_active.is_(True),
            Order.id == order_id,
            Order.payment_method == PaymentMethod.mercadopago,
        )
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="order_not_found")
    return order
