import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderItem, OrderStatus, PaymentMethod, PaymentStatus
from app.models.table import Table
from app.schemas.order import OrderRead
from app.schemas.table import (
    TableCreate,
    TableOccupancyRead,
    TableStatus,
    TableUpdate,
)
from app.services.cash_shift import get_open_shift
from app.services.order import apply_status_change, check_transition
from app.services.staff_member import get_active_staff_member
from app.services.crud import apply_patch, get_owned


async def create_table(
    restaurant_id: uuid.UUID, data: TableCreate, session: AsyncSession
) -> Table:
    table = Table(restaurant_id=restaurant_id, number=data.number, capacity=data.capacity)
    session.add(table)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="table_number_taken")
    await session.refresh(table)
    return table


async def list_tables(restaurant_id: uuid.UUID, session: AsyncSession) -> list[Table]:
    result = await session.execute(
        select(Table)
        .where(Table.restaurant_id == restaurant_id)
        .order_by(Table.number.asc())
    )
    return list(result.scalars().all())


async def get_table(
    restaurant_id: uuid.UUID,
    table_id: uuid.UUID,
    session: AsyncSession,
    for_update: bool = False,
) -> Table:
    return await get_owned(
        session, Table, restaurant_id, table_id, "table_not_found", for_update=for_update
    )


async def update_table(
    restaurant_id: uuid.UUID,
    table_id: uuid.UUID,
    data: TableUpdate,
    session: AsyncSession,
) -> Table:
    table = await get_table(restaurant_id, table_id, session)
    apply_patch(table, data.model_dump(exclude_unset=True))
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="table_number_taken")
    await session.refresh(table)
    return table


async def delete_table(
    restaurant_id: uuid.UUID, table_id: uuid.UUID, session: AsyncSession
) -> None:
    table = await get_table(restaurant_id, table_id, session)
    await session.delete(table)
    await session.commit()


# ---------------------------------------------------------------------------
# occupancy, bill request and checkout
# ---------------------------------------------------------------------------

# Orders that occupy a table: still in progress, and either cash or already
# paid online (same visibility rule as ``list_orders``).
_ACTIVE_STATUSES = (OrderStatus.pending, OrderStatus.accepted, OrderStatus.ready)
# Walk each active order to ``completed`` through the state machine.
_CHECKOUT_PATH = {
    OrderStatus.pending: (OrderStatus.accepted, OrderStatus.ready, OrderStatus.completed),
    OrderStatus.accepted: (OrderStatus.ready, OrderStatus.completed),
    OrderStatus.ready: (OrderStatus.completed,),
}


def _active_orders_query(restaurant_id: uuid.UUID):
    return (
        select(Order)
        .where(
            Order.restaurant_id == restaurant_id,
            Order.table_id.is_not(None),
            Order.status.in_(_ACTIVE_STATUSES),
            or_(
                Order.payment_method == PaymentMethod.cash,
                Order.payment_status == PaymentStatus.approved,
            ),
        )
        .options(selectinload(Order.items).selectinload(OrderItem.modifiers))
        .order_by(Order.created_at.asc())
    )


def _as_utc(value: datetime) -> datetime:
    """SQLite hands back naive datetimes; Postgres aware ones. Normalize."""
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def is_active_order(order: Order) -> bool:
    """Python mirror of ``_active_orders_query``'s predicate (table not required)."""
    return order.status in _ACTIVE_STATUSES and (
        order.payment_method == PaymentMethod.cash
        or order.payment_status == PaymentStatus.approved
    )


def is_bill_requested(table: Table, first_order_at: datetime | None) -> bool:
    """``bill`` rule: requested at/after the first active order of the table."""
    if table.bill_requested_at is None or first_order_at is None:
        return False
    return _as_utc(table.bill_requested_at) >= _as_utc(first_order_at)


def _build_occupancy(table: Table, orders: list[Order]) -> TableOccupancyRead:
    total = sum((o.total for o in orders), Decimal("0"))
    first = min((o.created_at for o in orders), default=None)
    status = TableStatus.free
    bill_at = None
    if orders:
        status = TableStatus.occupied
        if is_bill_requested(table, first):
            status = TableStatus.bill
            bill_at = table.bill_requested_at
    return TableOccupancyRead(
        id=table.id,
        number=table.number,
        capacity=table.capacity,
        status=status,
        total=total,
        first_order_at=first,
        bill_requested_at=bill_at,
        orders=[OrderRead.model_validate(o) for o in orders],
    )


async def list_occupancy(
    restaurant_id: uuid.UUID, session: AsyncSession
) -> list[TableOccupancyRead]:
    """One entry per table with its active orders (two queries, no N+1)."""
    tables = await list_tables(restaurant_id, session)
    result = await session.execute(_active_orders_query(restaurant_id))
    by_table: dict[uuid.UUID, list[Order]] = {}
    for order in result.scalars().all():
        by_table.setdefault(order.table_id, []).append(order)
    return [_build_occupancy(t, by_table.get(t.id, [])) for t in tables]


async def _table_occupancy(
    restaurant_id: uuid.UUID, table: Table, session: AsyncSession
) -> TableOccupancyRead:
    result = await session.execute(
        _active_orders_query(restaurant_id).where(Order.table_id == table.id)
    )
    return _build_occupancy(table, list(result.scalars().all()))


async def request_bill(
    restaurant_id: uuid.UUID, table_id: uuid.UUID, session: AsyncSession
) -> TableOccupancyRead:
    """Mark the table as "bill requested". Idempotent while already in ``bill``."""
    table = await get_table(restaurant_id, table_id, session, for_update=True)
    occupancy = await _table_occupancy(restaurant_id, table, session)
    if occupancy.status == TableStatus.free:
        raise HTTPException(status_code=409, detail="table_not_occupied")
    if occupancy.status == TableStatus.bill:
        return occupancy
    table.bill_requested_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(table)
    occupancy = await _table_occupancy(restaurant_id, table, session)
    if occupancy.status == TableStatus.free:  # checked out concurrently
        raise HTTPException(status_code=409, detail="table_not_occupied")
    return occupancy


async def checkout_table(
    restaurant_id: uuid.UUID,
    table_id: uuid.UUID,
    staff_member_id: uuid.UUID | None,
    session: AsyncSession,
) -> TableOccupancyRead:
    """Complete every active order of the table in one transaction (all or nothing)."""
    table = await get_table(restaurant_id, table_id, session)
    member = None
    if staff_member_id is not None:
        member = await get_active_staff_member(restaurant_id, staff_member_id, session)
    result = await session.execute(
        _active_orders_query(restaurant_id)
        .where(Order.table_id == table.id)
        .with_for_update(of=Order)
    )
    orders = list(result.scalars().all())
    if not orders:
        raise HTTPException(status_code=409, detail="table_not_occupied")
    shift = await get_open_shift(restaurant_id, session)
    try:
        for order in orders:
            for step in _CHECKOUT_PATH[order.status]:
                check_transition(order, step)
                apply_status_change(order, step, shift, member)
        table.bill_requested_at = None
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    await session.refresh(table)
    return await _table_occupancy(restaurant_id, table, session)
