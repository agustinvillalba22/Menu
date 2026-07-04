import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.restaurant import Restaurant, RestaurantRole
from app.models.user import User
from app.schemas.restaurant import RestaurantCreate, RestaurantRead, RestaurantUpdate
from app.services.restaurant import (
    create_restaurant,
    get_restaurant,
    get_user_role,
    list_restaurants_for_user,
    update_restaurant,
)

router = APIRouter()


def _to_read(restaurant: Restaurant, role: RestaurantRole) -> RestaurantRead:
    """Build the response shape, injecting the caller's role (not a DB column)."""
    return RestaurantRead(
        id=restaurant.id,
        name=restaurant.name,
        slug=restaurant.slug,
        qr_token=restaurant.qr_token,
        role=role,
    )


@router.post("", response_model=RestaurantRead, status_code=201)
async def create(
    data: RestaurantCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> RestaurantRead:
    restaurant = await create_restaurant(data, current_user, session)
    return _to_read(restaurant, RestaurantRole.owner)


@router.get("", response_model=list[RestaurantRead], status_code=200)
async def list_mine(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[RestaurantRead]:
    pairs = await list_restaurants_for_user(current_user, session)
    return [_to_read(restaurant, role) for restaurant, role in pairs]


@router.get(
    "/{restaurant_id}", response_model=RestaurantRead, status_code=200
)
async def get_one(
    restaurant_id: uuid.UUID,
    current_user: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> RestaurantRead:
    restaurant = await get_restaurant(restaurant_id, session)
    role = await get_user_role(restaurant_id, current_user, session)
    return _to_read(restaurant, role)


@router.patch(
    "/{restaurant_id}", response_model=RestaurantRead, status_code=200
)
async def patch(
    restaurant_id: uuid.UUID,
    data: RestaurantUpdate,
    current_user: User = Depends(require_role(RestaurantRole.owner)),
    session: AsyncSession = Depends(get_db),
) -> RestaurantRead:
    restaurant = await update_restaurant(restaurant_id, data, session)
    role = await get_user_role(restaurant_id, current_user, session)
    return _to_read(restaurant, role)
