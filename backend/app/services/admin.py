import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import Restaurant, RestaurantRole, UserRestaurantRole
from app.models.user import User


async def list_users(session: AsyncSession) -> list[User]:
    """All users, newest first (RF-09)."""
    result = await session.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


async def update_user(
    user_id: uuid.UUID, fields: dict, session: AsyncSession
) -> User:
    """Apply a partial update to a user's ``is_active``/``is_superadmin`` flags.

    ``fields`` is expected to already be the result of ``model_dump(exclude_unset=True)``
    on ``AdminUserUpdate`` — only keys actually present in the request body are
    applied (RF-10).
    """
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user_not_found")

    if "is_active" in fields:
        user.is_active = fields["is_active"]
    if "is_superadmin" in fields:
        user.is_superadmin = fields["is_superadmin"]

    await session.commit()
    await session.refresh(user)
    return user


async def list_restaurants_with_owner(
    session: AsyncSession,
) -> list[tuple[Restaurant, str | None]]:
    """All restaurants with their owner's email, alphabetical by name (RF-11).

    Resolved with a single LEFT JOIN against a per-restaurant owner subquery
    rather than one query per restaurant, to avoid N+1 (RNF-02).
    """
    owner_subq = (
        select(
            UserRestaurantRole.restaurant_id.label("restaurant_id"),
            User.email.label("owner_email"),
        )
        .join(User, User.id == UserRestaurantRole.user_id)
        .where(UserRestaurantRole.role == RestaurantRole.owner)
        .subquery()
    )
    result = await session.execute(
        select(Restaurant, owner_subq.c.owner_email)
        .join(owner_subq, owner_subq.c.restaurant_id == Restaurant.id, isouter=True)
        .order_by(Restaurant.name.asc())
    )
    return [(restaurant, owner_email) for restaurant, owner_email in result.all()]


async def get_owner_email(
    restaurant_id: uuid.UUID, session: AsyncSession
) -> str | None:
    """Email of the user with role `owner` on ``restaurant_id``, or None."""
    result = await session.execute(
        select(User.email)
        .join(UserRestaurantRole, UserRestaurantRole.user_id == User.id)
        .where(
            UserRestaurantRole.restaurant_id == restaurant_id,
            UserRestaurantRole.role == RestaurantRole.owner,
        )
    )
    return result.scalar_one_or_none()


async def update_restaurant_active(
    restaurant_id: uuid.UUID, is_active: bool, session: AsyncSession
) -> Restaurant:
    """Set ``Restaurant.is_active`` (RF-12). 404 if the restaurant doesn't exist."""
    result = await session.execute(
        select(Restaurant).where(Restaurant.id == restaurant_id)
    )
    restaurant = result.scalar_one_or_none()
    if restaurant is None:
        raise HTTPException(status_code=404, detail="restaurant_not_found")

    restaurant.is_active = is_active
    await session.commit()
    await session.refresh(restaurant)
    return restaurant
