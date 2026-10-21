"""Router for the restaurant's weekly business hours.

Mounted under ``/restaurants``:

  GET  /restaurants/{id}/business-hours   — schedule only
  PUT  /restaurants/{id}/business-hours   — replace the whole week atomically

The PUT replaces the full set (the dashboard sends all 7 days on every save),
unlike the partial PATCH of the contact info in ``routers/restaurant_info.py``.
Owner-only for the mutation, editor for the read.
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.business_hours import BusinessHoursBulkUpsert, BusinessHoursRead
from app.services.business_hours import (
    list_business_hours,
    replace_business_hours,
    to_read as hours_to_read,
)

router = APIRouter()


@router.get(
    "/{restaurant_id}/business-hours",
    response_model=list[BusinessHoursRead],
    status_code=200,
)
async def list_hours(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[BusinessHoursRead]:
    rows = await list_business_hours(restaurant_id, session)
    return [hours_to_read(bh) for bh in rows]


@router.put(
    "/{restaurant_id}/business-hours",
    response_model=list[BusinessHoursRead],
    status_code=200,
)
async def replace_hours(
    restaurant_id: uuid.UUID,
    data: BusinessHoursBulkUpsert,
    _: User = Depends(require_role(RestaurantRole.owner)),
    session: AsyncSession = Depends(get_db),
) -> list[BusinessHoursRead]:
    rows = await replace_business_hours(restaurant_id, data.hours, session)
    return [hours_to_read(bh) for bh in rows]