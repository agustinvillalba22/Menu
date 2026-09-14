"""Business hours CRUD + ``is_open_now`` (P6) — Fase 1d.

The schedule lives on its own table (one row per weekday) so the dashboard
form can edit each day independently. ``is_open_now`` centralizes the open/
closed computation: the public menu and the dashboard "Información del
local" page both ask the same question and get the same answer, computed
against the restaurant's tz via the shared ``now_in`` helper (Fase 0a).
"""
import uuid
from datetime import datetime, time

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import BusinessHours, Restaurant
from app.schemas.business_hours import (
    BusinessHoursRead,
    BusinessHoursUpsert,
)
from app.services.datetime import now_in


async def list_business_hours(
    restaurant_id: uuid.UUID, session: AsyncSession
) -> list[BusinessHours]:
    """Return all of a restaurant's hours rows ordered by weekday then open."""
    result = await session.execute(
        select(BusinessHours)
        .where(BusinessHours.restaurant_id == restaurant_id)
        .order_by(BusinessHours.weekday.asc(), BusinessHours.open_time.asc())
    )
    return list(result.scalars().all())


async def replace_business_hours(
    restaurant_id: uuid.UUID,
    upserts: list[BusinessHoursUpsert],
    session: AsyncSession,
) -> list[BusinessHours]:
    """Atomically replace the whole week's schedule.

    Delete-then-insert keeps the contract simple: the dashboard sends the
    full set every save, so stale rows (a weekday the owner unchecked) can't
    linger. The unique ``(restaurant_id, weekday)`` constraint would otherwise
    reject two rows for the same day mid-transaction; dedup here returns a
    clear 409 instead of leaking a 500 IntegrityError up.
    """
    seen_weekdays: set[int] = set()
    for upsert in upserts:
        if upsert.weekday in seen_weekdays:
            raise HTTPException(
                status_code=409, detail="duplicate_weekday"
            )
        seen_weekdays.add(upsert.weekday)

    await session.execute(
        delete(BusinessHours).where(
            BusinessHours.restaurant_id == restaurant_id
        )
    )
    rows = [
        BusinessHours(
            restaurant_id=restaurant_id,
            weekday=u.weekday,
            open_time=u.open_time,
            close_time=u.close_time,
        )
        for u in upserts
    ]
    session.add_all(rows)
    await session.commit()
    return await list_business_hours(restaurant_id, session)


def _current_time_in_tz(restaurant: Restaurant, now: datetime | None) -> time:
    """Return the current time-of-day in the restaurant's tz.

    Falls back to ``settings.DEFAULT_TIMEZONE`` (via ``now_in``) when the
    restaurant has no explicit tz — keeps the column NOT NULL with ``''``
    without forcing every owner to pick one.
    """
    current = now if now is not None else now_in(restaurant.timezone or None)
    return current.time()


def compute_is_open_now(
    restaurant: Restaurant,
    now: datetime | None = None,
) -> bool:
    """Return True if any of the restaurant's hours rows covers ``now``.

    ``now`` is injected (not read inside) so tests can freeze it with
    ``freezegun.freeze_time`` and assert edge cases (split shifts, day
    rollover, DST) deterministically. The weekday is taken from the same
    tz-aware ``now`` so a 23:59 order near a closing-time rollover is judged
    in the same tz the owner set the schedule in.
    """
    current = now if now is not None else now_in(restaurant.timezone or None)
    weekday = current.weekday()
    current_time = current.time()
    for bh in restaurant.business_hours:
        if (
            bh.weekday == weekday
            and bh.open_time <= current_time < bh.close_time
        ):
            return True
    return False


def to_read(bh: BusinessHours) -> BusinessHoursRead:
    return BusinessHoursRead.model_validate(bh)