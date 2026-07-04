import uuid

from fastapi import HTTPException, status
from slugify import slugify
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.menu import Menu
from app.models.restaurant import Restaurant, RestaurantRole, UserRestaurantRole
from app.models.style import MenuStyle
from app.models.user import User
from app.schemas.restaurant import RestaurantCreate, RestaurantUpdate

_DEFAULT_MENU_NAME = "Menú"
_MAX_SLUG_ATTEMPTS = 3


def _slug_fallback() -> str:
    """Deterministic non-empty slug base for names without alphanumeric chars."""
    return f"restaurant-{uuid.uuid4().hex[:8]}"


async def _generate_unique_slug(name: str, session: AsyncSession) -> str:
    """Derive a URL-safe slug from ``name``, appending -2, -3, ... on collision.

    Names without alphanumeric characters (e.g. "🍕🍕🍕") slugify to "", which
    would break the public URL; in that case a deterministic fallback is used.
    """
    base = slugify(name) or _slug_fallback()
    candidate = base
    suffix = 2
    while await _slug_exists(candidate, session):
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


async def _slug_exists(slug: str, session: AsyncSession) -> bool:
    result = await session.execute(
        select(Restaurant.id).where(Restaurant.slug == slug)
    )
    return result.scalar_one_or_none() is not None


async def create_restaurant(
    data: RestaurantCreate, user: User, session: AsyncSession
) -> Restaurant:
    """Create a Restaurant, its owner role and a default Menu in one transaction.

    The Python-side uniqueness check races with concurrent requests using the
    same name: two requests can both pass the check before either commits. The
    DB unique constraint on ``slug`` is the real safety net, so we catch the
    resulting IntegrityError, roll back, and retry with a freshly generated slug
    a few times before giving up with a controlled 409.
    """
    for _ in range(_MAX_SLUG_ATTEMPTS):
        slug = await _generate_unique_slug(data.name, session)
        try:
            restaurant = Restaurant(name=data.name, slug=slug)
            session.add(restaurant)
            await session.flush()  # assign restaurant.id (may raise on race)

            session.add(
                UserRestaurantRole(
                    user_id=user.id,
                    restaurant_id=restaurant.id,
                    role=RestaurantRole.owner,
                )
            )
            session.add(Menu(name=_DEFAULT_MENU_NAME, restaurant_id=restaurant.id))
            session.add(MenuStyle(restaurant_id=restaurant.id))

            await session.commit()
        except IntegrityError:
            await session.rollback()
            continue

        await session.refresh(restaurant)
        return restaurant

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="slug_conflict",
    )


async def list_restaurants_for_user(
    user: User, session: AsyncSession
) -> list[tuple[Restaurant, RestaurantRole]]:
    """Return every (restaurant, role) pair where ``user`` has an assigned role."""
    result = await session.execute(
        select(Restaurant, UserRestaurantRole.role)
        .join(
            UserRestaurantRole,
            UserRestaurantRole.restaurant_id == Restaurant.id,
        )
        .where(UserRestaurantRole.user_id == user.id)
    )
    return [(restaurant, role) for restaurant, role in result.all()]


async def get_restaurant(
    restaurant_id: uuid.UUID, session: AsyncSession
) -> Restaurant:
    """Fetch a restaurant by id. Access is already enforced by require_role."""
    result = await session.execute(
        select(Restaurant).where(Restaurant.id == restaurant_id)
    )
    return result.scalar_one()


async def get_user_role(
    restaurant_id: uuid.UUID, user: User, session: AsyncSession
) -> RestaurantRole:
    """Return the role ``user`` holds for the given restaurant."""
    result = await session.execute(
        select(UserRestaurantRole.role).where(
            UserRestaurantRole.user_id == user.id,
            UserRestaurantRole.restaurant_id == restaurant_id,
        )
    )
    return result.scalar_one()


async def update_restaurant(
    restaurant_id: uuid.UUID, data: RestaurantUpdate, session: AsyncSession
) -> Restaurant:
    """Update a restaurant's name. The slug is intentionally left unchanged."""
    restaurant = await get_restaurant(restaurant_id, session)
    restaurant.name = data.name
    await session.commit()
    await session.refresh(restaurant)
    return restaurant
