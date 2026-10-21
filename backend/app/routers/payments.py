import logging
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.dependencies.auth import require_role
from app.dependencies.mercadopago import get_mp_client
from app.models.payment_account import PaymentAccountStatus
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.payment import (
    MercadoPagoConnectRead,
    MercadoPagoStatusRead,
    PublicPaymentStatusRead,
)
from app.services.mercadopago import (
    MercadoPagoError,
    build_authorization_url,
    connect_account,
    decode_state,
    disconnect_account,
    get_account,
    get_public_payment_status,
    process_payment_notification,
    verify_signature,
)

logger = logging.getLogger(__name__)

# This router owns full paths: dashboard routes under /restaurants, plus the
# public callback, webhook and payment-status endpoints.
router = APIRouter()


def _result_redirect(outcome: str) -> RedirectResponse:
    base = settings.FRONTEND_URL.rstrip("/")
    return RedirectResponse(f"{base}/dashboard/payments?mp={outcome}", status_code=302)


@router.post(
    "/restaurants/{restaurant_id}/payments/mercadopago/connect",
    response_model=MercadoPagoConnectRead,
)
async def connect_mercadopago(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.owner)),
) -> MercadoPagoConnectRead:
    if not settings.mercadopago_oauth_configured:
        raise HTTPException(status_code=503, detail="payments_not_configured")
    return MercadoPagoConnectRead(
        authorization_url=build_authorization_url(restaurant_id)
    )


@router.get(
    "/restaurants/{restaurant_id}/payments/mercadopago",
    response_model=MercadoPagoStatusRead,
)
async def read_mercadopago_status(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> MercadoPagoStatusRead:
    account = await get_account(restaurant_id, session)
    return MercadoPagoStatusRead(
        configured=settings.mercadopago_configured,
        connected=account is not None
        and account.status == PaymentAccountStatus.connected,
        status=account.status if account is not None else None,
        mp_user_id=account.mp_user_id if account is not None else None,
    )


@router.delete(
    "/restaurants/{restaurant_id}/payments/mercadopago", status_code=204
)
async def disconnect_mercadopago(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.owner)),
    session: AsyncSession = Depends(get_db),
) -> Response:
    await disconnect_account(restaurant_id, session)
    return Response(status_code=204)


@router.get("/payments/mercadopago/callback")
async def mercadopago_callback(
    code: str | None = None,
    state: str | None = None,
    session: AsyncSession = Depends(get_db),
    mp_client: httpx.AsyncClient = Depends(get_mp_client),
) -> RedirectResponse:
    """Public: the browser lands here after authorizing on Mercado Pago.

    Always answers 302 to the dashboard; the outcome is only ``connected`` or
    ``error`` — no token nor provider detail ever reaches the URL.
    """
    if not settings.mercadopago_oauth_configured or not code or not state:
        return _result_redirect("error")
    try:
        restaurant_id = decode_state(state)
        await connect_account(restaurant_id, code, session, mp_client)
    except (ValueError, MercadoPagoError):
        return _result_redirect("error")
    return _result_redirect("connected")


def _notification_fields(request: Request, body: object) -> tuple[str | None, str | None, str | None]:
    """Extract ``(data_id, type, seller_user_id)`` from query/body (RF-16/17)."""
    payload = body if isinstance(body, dict) else {}
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    data_id = request.query_params.get("data.id") or data.get("id")
    kind = payload.get("type") or request.query_params.get("type") or request.query_params.get("topic")
    user_id = payload.get("user_id")
    return (
        str(data_id) if data_id is not None else None,
        str(kind) if kind is not None else None,
        str(user_id) if user_id is not None else None,
    )


@router.post("/webhooks/mercadopago")
async def mercadopago_webhook(
    request: Request,
    session: AsyncSession = Depends(get_db),
    mp_client: httpx.AsyncClient = Depends(get_mp_client),
) -> dict:
    """Public: MP payment notifications. Authenticated by ``x-signature``."""
    if not settings.mercadopago_configured:
        raise HTTPException(status_code=503, detail="payments_not_configured")
    try:
        body = await request.json()
    except ValueError:
        body = {}
    data_id, kind, seller_user_id = _notification_fields(request, body)
    if not verify_signature(
        request.headers.get("x-signature"), request.headers.get("x-request-id"), data_id
    ):
        raise HTTPException(status_code=401, detail="invalid_signature")
    # data_id is part of a URL path towards MP: accept only numeric ids.
    if kind != "payment" or seller_user_id is None or not data_id or not (data_id.isascii() and data_id.isdigit()):
        return {"status": "ignored"}
    try:
        await process_payment_notification(seller_user_id, data_id, session, mp_client)
    except MercadoPagoError:
        raise HTTPException(status_code=502, detail="payment_provider_error")
    return {"status": "ok"}


@router.get(
    "/menu/{qr_token}/orders/{order_id}/payment",
    response_model=PublicPaymentStatusRead,
)
async def read_public_payment_status(
    qr_token: str,
    order_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
) -> PublicPaymentStatusRead:
    order = await get_public_payment_status(qr_token, order_id, session)
    return PublicPaymentStatusRead(
        payment_status=order.payment_status, status=order.status
    )
