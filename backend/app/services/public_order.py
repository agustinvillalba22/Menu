"""Anonymous "Tu consumo": order status and bill request by order token.

Reuses the table rules (``is_active_order`` / ``is_bill_requested`` and
``request_bill``) so the guest-facing flow can never diverge from the
dashboard's notion of an occupied / "bill" table.
"""
import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderItem
from app.models.table import Table
from app.schemas.order import (
    PublicBillRequestRead,
    PublicOrderLineRead,
    PublicOrderStatusRead,
)
from app.services.public_menu import get_public_menu
from app.services.table import (
    _active_orders_query,
    is_active_order,
    is_bill_requested,
    request_bill,
)


async def _orders_by_tokens(
    restaurant_id: uuid.UUID, tokens: list[str], session: AsyncSession
) -> list[Order]:
    """Single indexed ``IN`` lookup; always scoped to the restaurant (tenancy)."""
    result = await session.execute(
        select(Order)
        .where(Order.restaurant_id == restaurant_id, Order.public_token.in_(tokens))
        .options(selectinload(Order.items).selectinload(OrderItem.modifiers))
        .order_by(Order.created_at.asc())
    )
    return list(result.scalars().all())


async def _tables_and_first_active(
    restaurant_id: uuid.UUID, table_ids: set[uuid.UUID], session: AsyncSession
) -> tuple[dict[uuid.UUID, Table], dict[uuid.UUID, datetime]]:
    if not table_ids:
        return {}, {}
    tables = await session.execute(
        select(Table).where(Table.restaurant_id == restaurant_id, Table.id.in_(table_ids))
    )
    active = await session.execute(
        _active_orders_query(restaurant_id).where(Order.table_id.in_(table_ids))
    )
    first: dict[uuid.UUID, datetime] = {}
    for order in active.scalars().all():
        first.setdefault(order.table_id, order.created_at)  # ordered asc
    return {t.id: t for t in tables.scalars().all()}, first


def _to_status(
    order: Order, table: Table | None, first_active: datetime | None
) -> PublicOrderStatusRead:
    bill = (
        table is not None
        and is_active_order(order)
        and is_bill_requested(table, first_active)
    )
    return PublicOrderStatusRead(
        token=order.public_token or "",
        status=order.status,
        created_at=order.created_at,
        payment_method=order.payment_method,
        payment_status=order.payment_status,
        total=order.total,
        table_number=table.number if table is not None else None,
        bill_requested=bill,
        items=[
            PublicOrderLineRead(
                name=i.name_snapshot,
                quantity=i.quantity,
                subtotal=i.subtotal,
                modifiers=[m.name_snapshot for m in i.modifiers],
            )
            for i in order.items
        ],
    )


async def get_public_orders_status(
    qr_token: str, tokens: list[str], session: AsyncSession
) -> list[PublicOrderStatusRead]:
    """Status of the orders owned by ``tokens``; unknown/foreign tokens are omitted."""
    restaurant = await get_public_menu(qr_token, session)
    orders = await _orders_by_tokens(restaurant.id, tokens, session)
    table_ids = {o.table_id for o in orders if o.table_id is not None}
    tables, first = await _tables_and_first_active(restaurant.id, table_ids, session)
    return [
        _to_status(o, tables.get(o.table_id), first.get(o.table_id)) for o in orders
    ]


async def request_bill_by_token(
    qr_token: str, token: str, session: AsyncSession
) -> PublicBillRequestRead:
    """Ask for the bill of the table of the order owned by ``token`` (idempotent)."""
    restaurant = await get_public_menu(qr_token, session)
    orders = await _orders_by_tokens(restaurant.id, [token], session)
    if not orders:
        raise HTTPException(status_code=404, detail="order_not_found")
    order = orders[0]
    if order.table_id is None:
        raise HTTPException(status_code=409, detail="order_without_table")
    if not is_active_order(order):
        raise HTTPException(status_code=409, detail="order_not_active")
    occupancy = await request_bill(restaurant.id, order.table_id, session)
    if occupancy.bill_requested_at is None:  # request_bill leaves it in ``bill``
        raise HTTPException(status_code=409, detail="table_not_occupied")
    return PublicBillRequestRead(
        bill_requested=True, bill_requested_at=occupancy.bill_requested_at
    )
