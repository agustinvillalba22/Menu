"""Router for the restaurant's contact info.

Mounted under ``/restaurants``:

  GET    /restaurants/{id}/info   — info + schedule + is_open_now
  PATCH  /restaurants/{id}/info   — partial contact-info update (exclude_unset)

Owner-only for the mutation, editor for the read. The weekly schedule has its
own endpoints in ``routers/business_hours.py``.
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import Restaurant, RestaurantRole
from app.models.user import User
from app.schemas.restaurant_info import RestaurantInfoRead, RestaurantInfoUpdate
from app.services.business_hours import compute_is_open_now, to_read as hours_to_read
from app.services.restaurant import get_restaurant_with_hours, update_restaurant_info

router = APIRouter()


def _build_info_read(restaurant: Restaurant) -> RestaurantInfoRead:
    """Compose the read shape combining the contact fields, the eager-loaded
    hours rows, and the server-side ``is_open_now`` computation."""
    return RestaurantInfoRead(
        address=restaurant.address,
        phone=restaurant.phone,
        whatsapp_phone=restaurant.whatsapp_phone,
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
