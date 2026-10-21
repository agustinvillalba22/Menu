import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cash_shift import CashShift
from app.models.order import Order, OrderStatus, PaymentMethod
from app.schemas.cash_shift import CashShiftClose, CashShiftOpen
from app.services.staff_member import get_active_staff_member

CENTS = Decimal("0.01")


def _q(amount: Decimal) -> Decimal:
    return amount.quantize(CENTS)


async def get_open_shift(restaurant_id: uuid.UUID, session: AsyncSession) -> CashShift | None:
    result = await session.execute(
        select(CashShift).where(
            CashShift.restaurant_id == restaurant_id, CashShift.closed_at.is_(None)
        )
    )
    shift = result.scalar_one_or_none()
    if shift is not None:
        await attach_orders_count([shift], session)
    return shift


async def attach_orders_count(shifts: list[CashShift], session: AsyncSession) -> None:
    """Set `orders_count` on each shift with ONE grouped query (no N+1).

    Counts completed orders linked to the shift (M28 RF-06).
    """
    if not shifts:
        return
    result = await session.execute(
        select(Order.cash_shift_id, func.count(Order.id))
        .where(
            Order.cash_shift_id.in_([s.id for s in shifts]),
            Order.status == OrderStatus.completed,
        )
        .group_by(Order.cash_shift_id)
    )
    counts = dict(result.all())
    for shift in shifts:
        shift.orders_count = counts.get(shift.id, 0)  # type: ignore[attr-defined]


async def open_shift(
    restaurant_id: uuid.UUID, data: CashShiftOpen, session: AsyncSession
) -> CashShift:
    member = await get_active_staff_member(restaurant_id, data.staff_member_id, session)
    if await get_open_shift(restaurant_id, session) is not None:
        raise HTTPException(status_code=409, detail="shift_already_open")
    shift = CashShift(
        restaurant_id=restaurant_id,
        opened_by_id=member.id,
        opened_by_name=member.name,
        opening_amount=_q(data.opening_amount),
        notes=data.notes,
    )
    session.add(shift)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="shift_already_open")
    await session.refresh(shift)
    return shift


async def _completed_total(shift_id: uuid.UUID, session: AsyncSession) -> Decimal:
    result = await session.execute(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.cash_shift_id == shift_id,
            Order.status == OrderStatus.completed,
            # M36: money collected through Mercado Pago never enters the till.
            Order.payment_method == PaymentMethod.cash,
        )
    )
    return Decimal(str(result.scalar_one()))


async def close_shift(
    restaurant_id: uuid.UUID,
    shift_id: uuid.UUID,
    data: CashShiftClose,
    session: AsyncSession,
) -> CashShift:
    result = await session.execute(
        select(CashShift)
        .where(CashShift.id == shift_id, CashShift.restaurant_id == restaurant_id)
        .with_for_update()
    )
    shift = result.scalar_one_or_none()
    if shift is None:
        raise HTTPException(status_code=404, detail="shift_not_found")
    member = await get_active_staff_member(restaurant_id, data.staff_member_id, session)
    if shift.closed_at is not None:
        raise HTTPException(status_code=409, detail="shift_already_closed")

    now = datetime.now(timezone.utc)
    total = await _completed_total(shift.id, session)
    shift.expected_amount = _q(shift.opening_amount + total)
    shift.counted_amount = _q(data.counted_amount)
    shift.closed_by_id = member.id
    shift.closed_by_name = member.name
    shift.closed_at = now
    if data.notes is not None:
        shift.notes = data.notes
    await session.commit()
    await session.refresh(shift)
    await attach_orders_count([shift], session)
    return shift


async def list_shifts(
    restaurant_id: uuid.UUID, limit: int, offset: int, session: AsyncSession
) -> list[CashShift]:
    result = await session.execute(
        select(CashShift)
        .where(CashShift.restaurant_id == restaurant_id)
        .order_by(CashShift.opened_at.desc(), CashShift.id.desc())
        .limit(limit)
        .offset(offset)
    )
    shifts = list(result.scalars().all())
    await attach_orders_count(shifts, session)
    return shifts
