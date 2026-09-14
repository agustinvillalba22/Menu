import uuid

from fastapi import HTTPException, status
from slugify import slugify
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
    """Update a restaurant's name and/or orders_enabled flag.

    The slug is intentionally left unchanged. Only fields explicitly present in
    the request body are applied (exclude_unset), so a PATCH omitting
    orders_enabled leaves it untouched.
    """
    restaurant = await get_restaurant(restaurant_id, session)
    fields = data.model_dump(exclude_unset=True)
    if "name" in fields:
        restaurant.name = fields["name"]
    # orders_enabled is optional; an explicit null is treated as "no change".
    if fields.get("orders_enabled") is not None:
        restaurant.orders_enabled = fields["orders_enabled"]
    await session.commit()
    await session.refresh(restaurant)
    return restaurant


# ---------------------------------------------------------------------------
# P6 / P7 — Restaurant info (address/phone/tz/logo/whatsapp_phone) ----------
# ---------------------------------------------------------------------------
#
# Eager-load business_hours on every read that will be turned into a
# ``RestaurantInfoRead``: the public menu and the dashboard info page both
# need them (the latter to render the editor, the former to compute
# ``is_open_now``). One selectinload keeps the read tree bounded; the
# alternative (separate queries) would re-introduce the N+1 the rest of the
# codebase already avoids via selectinload on Menu.categories.


async def get_restaurant_with_hours(
    restaurant_id: uuid.UUID, session: AsyncSession
) -> Restaurant:
    """Fetch a restaurant with its business_hours eagerly loaded.

    Distinct from ``get_restaurant`` because callers that need the schedule
    (info read, public menu's ``is_open_now``) want the rows in one shot;
    callers that just want the row (PATCH name) keep using the cheaper
    single-table fetch.
    """
    result = await session.execute(
        select(Restaurant)
        .where(Restaurant.id == restaurant_id)
        .options(selectinload(Restaurant.business_hours))
    )
    return result.scalar_one()


async def update_restaurant_info(
    restaurant_id: uuid.UUID,
    data,
    session: AsyncSession,
) -> Restaurant:
    """Apply a partial PATCH to the restaurant contact info columns.

    Mirrors the existing ``update_restaurant`` for name/orders_enabled:
    ``exclude_unset=True`` so an omitted field is untouched, an explicit null
    clears the nullable columns (whatsapp_phone, logo_url) and an explicit
    value sets them. Validation of ``whatsapp_phone`` lives on the schema
    (regex), not here — the service only persists.
    """
    restaurant = await get_restaurant(restaurant_id, session)
    fields = data.model_dump(exclude_unset=True)
    for column in ("address", "phone", "whatsapp_phone", "timezone", "logo_url"):
        if column in fields:
            setattr(restaurant, column, fields[column])
    await session.commit()
    await session.refresh(restaurant)
    return restaurant
