"""Router for restaurant info (P6) + business hours (P6) — Fase 1d.

Mounted under ``/restaurants`` (same prefix as the existing category/style
routers) so:

  GET    /restaurants/{id}/info                — info + schedule + is_open_now
  PATCH   /restaurants/{id}/info                — partial contact-info update
  GET    /restaurants/{id}/business-hours       — schedule only
  PUT    /restaurants/{id}/business-hours       — replace whole week atomically

The info PATCH and the hours PUT are intentionally two endpoints: the contact
info is a partial PATCH (exclude_unset), while the hours PUT replaces the
full set atomically (the dashboard sends all 7 days every save). Keeping
them separate avoids a "PATCH the whole object" monster that has to thread
both semantics through one body.

Access: owner-only for the mutations (matches the existing style router),
editor for the reads — same convention as the rest of /restaurants.
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.business_hours import (
    BusinessHoursBulkUpsert,
    BusinessHoursRead,
    RestaurantInfoRead,
    RestaurantInfoUpdate,
)
from app.services.business_hours import (
    compute_is_open_now,
    list_business_hours,
    replace_business_hours,
    to_read as hours_to_read,
)
from app.services.restaurant import (
    get_restaurant_with_hours,
    update_restaurant_info,
)

router = APIRouter()


def _build_info_read(restaurant) -> RestaurantInfoRead:
    """Compose the read shape combining the contact fields, the eager-loaded
    hours rows, and the server-side ``is_open_now`` computation."""
    return RestaurantInfoRead(
        address=restaurant.address,
        phone=restaurant.phone,
        whatsapp_phone=restaurant.whatsapp_phone,
        whatsapp_enabled=bool(restaurant.whatsapp_phone),
        logo_url=restaurant.logo_url,
        timezone=restaurant.timezone,
        business_hours=[hours_to_read(bh) for bh in restaurant.business_hours],
        is_open_now=compute_is_open_now(restaurant),
    )


@router.get(
    "/{restaurant_id}/info",
    response_model=RestaurantInfoRead,
    status_code=200,
)
async def get_info(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> RestaurantInfoRead:
    restaurant = await get_restaurant_with_hours(restaurant_id, session)
    return _build_info_read(restaurant)


@router.patch(
    "/{restaurant_id}/info",
    response_model=RestaurantInfoRead,
    status_code=200,
)
async def patch_info(
    restaurant_id: uuid.UUID,
    data: RestaurantInfoUpdate,
    _: User = Depends(require_role(RestaurantRole.owner)),
    session: AsyncSession = Depends(get_db),
) -> RestaurantInfoRead:
    await update_restaurant_info(restaurant_id, data, session)
    restaurant = await get_restaurant_with_hours(restaurant_id, session)
    return _build_info_read(restaurant)


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