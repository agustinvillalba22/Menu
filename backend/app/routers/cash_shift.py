import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.cash_shift import CashShiftClose, CashShiftOpen, CashShiftRead
from app.services.cash_shift import close_shift, get_open_shift, list_shifts, open_shift

router = APIRouter()

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 30


@router.post("/{restaurant_id}/shifts", response_model=CashShiftRead, status_code=201)
async def open_(
    restaurant_id: uuid.UUID,
    data: CashShiftOpen,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> CashShiftRead:
    shift = await open_shift(restaurant_id, data, session)
    return CashShiftRead.model_validate(shift)


# Declared before "/{shift_id}/..." routes; "current" is a fixed path segment.
@router.get("/{restaurant_id}/shifts/current", response_model=CashShiftRead | None)
async def current(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> CashShiftRead | None:
    shift = await get_open_shift(restaurant_id, session)
    return None if shift is None else CashShiftRead.model_validate(shift)


@router.get("/{restaurant_id}/shifts", response_model=list[CashShiftRead])
async def history(
    restaurant_id: uuid.UUID,
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[CashShiftRead]:
    shifts = await list_shifts(restaurant_id, limit, offset, session)
    return [CashShiftRead.model_validate(s) for s in shifts]


@router.post("/{restaurant_id}/shifts/{shift_id}/close", response_model=CashShiftRead)
async def close(
    restaurant_id: uuid.UUID,
    shift_id: uuid.UUID,
    data: CashShiftClose,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> CashShiftRead:
    shift = await close_shift(restaurant_id, shift_id, data, session)
    return CashShiftRead.model_validate(shift)
