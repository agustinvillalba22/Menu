import uuid

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.dependencies.mercadopago import get_mp_client
from app.models.order import OrderStatus
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.order import (
    OrderCreate,
    OrderRead,
    OrderStatusUpdate,
    PublicBillRequest,
    PublicBillRequestRead,
    PublicOrderStatusRead,
    PublicOrderStatusRequest,
)
from app.services.order import (
    create_order,
    list_orders,
    update_order_status,
)
from app.services.public_order import get_public_orders_status, request_bill_by_token
from app.services.whatsapp import build_whatsapp_url

router = APIRouter()


@router.post("/menu/{qr_token}/orders", response_model=OrderRead, status_code=201)
async def create_public_order(
    qr_token: str,
    data: OrderCreate,
    session: AsyncSession = Depends(get_db),
    mp_client: httpx.AsyncClient = Depends(get_mp_client),
) -> OrderRead:
    """Public (no-auth) order creation. Total is recomputed server-side.

    The response carries ``whatsapp_url`` built from the freshly-resolved
    restaurant (P7): the customer's checkout can open a "Confirmar por
    WhatsApp" deep link without re-fetching anything. Null when the
    restaurant hasn't set a WhatsApp number.
    """
    order, restaurant = await create_order(qr_token, data, session, mp_client)
    read = OrderRead.model_validate(order)
    read.whatsapp_url = build_whatsapp_url(order, restaurant)
    read.public_token = order.public_token
    return read


@router.post("/menu/{qr_token}/orders/status", response_model=list[PublicOrderStatusRead])
async def public_orders_status(
    qr_token: str,
    data: PublicOrderStatusRequest,
    session: AsyncSession = Depends(get_db),
) -> list[PublicOrderStatusRead]:
    """Public: status of the caller's own orders, looked up by their tokens."""
    return await get_public_orders_status(qr_token, data.tokens, session)


@router.post("/menu/{qr_token}/orders/bill-request", response_model=PublicBillRequestRead)
async def public_bill_request(
    qr_token: str,
    data: PublicBillRequest,
    session: AsyncSession = Depends(get_db),
) -> PublicBillRequestRead:
    """Public: ask for the bill of the table the caller's order belongs to."""
    return await request_bill_by_token(qr_token, data.token, session)


@router.get(
    "/restaurants/{restaurant_id}/orders",
    response_model=list[OrderRead],
    status_code=200,
)
async def list_restaurant_orders(
    restaurant_id: uuid.UUID,
    status: OrderStatus | None = None,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[OrderRead]:
    orders = await list_orders(restaurant_id, status, session)
    return [OrderRead.model_validate(o) for o in orders]


@router.patch(
    "/restaurants/{restaurant_id}/orders/{order_id}",
    response_model=OrderRead,
    status_code=200,
)
async def patch_order_status(
    restaurant_id: uuid.UUID,
    order_id: uuid.UUID,
    data: OrderStatusUpdate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> OrderRead:
    order = await update_order_status(
        restaurant_id, order_id, data.status, session, data.staff_member_id
    )
    return OrderRead.model_validate(order)
