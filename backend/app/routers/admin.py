import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_superadmin
from app.models.restaurant import Restaurant
from app.models.user import User
from app.schemas.admin import (
    AdminRestaurantRead,
    AdminRestaurantUpdate,
    AdminUserRead,
    AdminUserUpdate,
)
from app.services import admin as admin_service

router = APIRouter()


def _restaurant_to_read(
    restaurant: Restaurant, owner_email: str | None
) -> AdminRestaurantRead:
    """Build the response shape, injecting owner_email (not a DB column)."""
    return AdminRestaurantRead(
        id=restaurant.id,
        name=restaurant.name,
        slug=restaurant.slug,
        qr_token=restaurant.qr_token,
        is_active=restaurant.is_active,
        orders_enabled=restaurant.orders_enabled,
        owner_email=owner_email,
    )


@router.get("/users", response_model=list[AdminUserRead], status_code=200)
async def list_users(
    _: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db),
) -> list[AdminUserRead]:
    users = await admin_service.list_users(session)
    return [AdminUserRead.model_validate(u) for u in users]


@router.patch("/users/{user_id}", response_model=AdminUserRead, status_code=200)
async def patch_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    _: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db),
) -> AdminUserRead:
    fields = data.model_dump(exclude_unset=True)
    user = await admin_service.update_user(user_id, fields, session)
    return AdminUserRead.model_validate(user)


@router.get("/restaurants", response_model=list[AdminRestaurantRead], status_code=200)
async def list_restaurants(
    _: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db),
) -> list[AdminRestaurantRead]:
    pairs = await admin_service.list_restaurants_with_owner(session)
    return [_restaurant_to_read(restaurant, owner_email) for restaurant, owner_email in pairs]


@router.patch(
    "/restaurants/{restaurant_id}",
    response_model=AdminRestaurantRead,
    status_code=200,
)
async def patch_restaurant(
    restaurant_id: uuid.UUID,
    data: AdminRestaurantUpdate,
    _: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db),
) -> AdminRestaurantRead:
    restaurant = await admin_service.update_restaurant_active(
        restaurant_id, data.is_active, session
    )
    owner_email = await admin_service.get_owner_email(restaurant_id, session)
    return _restaurant_to_read(restaurant, owner_email)
