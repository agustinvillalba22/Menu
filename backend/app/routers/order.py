import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.order import OrderStatus
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.order import OrderCreate, OrderRead, OrderStatusUpdate
from app.services.order import (
    create_order,
    list_orders,
    update_order_status,
)
from app.services.whatsapp import build_whatsapp_url

router = APIRouter()


@router.post("/menu/{qr_token}/orders", response_model=OrderRead, status_code=201)
async def create_public_order(
    qr_token: str,
    data: OrderCreate,
    session: AsyncSession = Depends(get_db),
) -> OrderRead:
    """Public (no-auth) order creation. Total is recomputed server-side.

    The response carries ``whatsapp_url`` built from the freshly-resolved
    restaurant (P7): the customer's checkout can open a "Confirmar por
    WhatsApp" deep link without re-fetching anything. Null when the
    restaurant hasn't set a WhatsApp number.
    """
    order, restaurant = await create_order(qr_token, data, session)
    read = OrderRead.model_validate(order)
    read.whatsapp_url = build_whatsapp_url(order, restaurant)
    return read


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
    order = await update_order_status(restaurant_id, order_id, data.status, session)
    return OrderRead.model_validate(order)
