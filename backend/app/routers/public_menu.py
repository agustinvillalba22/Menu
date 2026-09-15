from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.item import Item
from app.models.menu import Category, Subcategory
from app.models.restaurant import Restaurant
from app.schemas.public_menu import (
    PublicBusinessHoursRead,
    PublicCategoryRead,
    PublicItemModifierRead,
    PublicItemRead,
    PublicMenuResponse,
    PublicPromoRead,
    PublicRestaurantRead,
    PublicStyleRead,
    PublicSubcategoryRead,
    PublicTagRead,
)
from app.services.business_hours import compute_is_open_now
from app.services.menu import resolve_active_menu
from app.services.promo import active_promo_for
from app.services.public_menu import get_public_menu

router = APIRouter()


def _build_item(item: Item) -> PublicItemRead:
    modifiers = sorted(item.modifiers, key=lambda m: m.name)
    return PublicItemRead(
        id=item.id,
        name=item.name,
        description=item.description,
        price=item.price,
        image_url=item.image_url,
        # The owning subcategory's category (Fase 0010) — the subcategory is
        # always in memory here via the eager-loaded public tree.
        category_id=item.subcategory.category_id,
        tags=[PublicTagRead(id=t.id, name=t.name) for t in item.tags],
        modifiers=[
            PublicItemModifierRead(
                id=m.id,
                name=m.name,
                price_delta=m.price_delta,
                type=m.type,
            )
            for m in modifiers
        ],
    )


def _build_subcategory(subcategory: Subcategory) -> PublicSubcategoryRead:
    items = sorted(subcategory.items, key=lambda i: i.name)
    return PublicSubcategoryRead(
        id=subcategory.id,
        name=subcategory.name,
        items=[_build_item(i) for i in items],
    )


def _build_category(category: Category) -> PublicCategoryRead:
    subs = sorted(category.subcategories, key=lambda s: s.name)
    return PublicCategoryRead(
        id=category.id,
        name=category.name,
        type=category.type,
        icon=category.icon,
        subcategories=[_build_subcategory(s) for s in subs],
    )


def _build_restaurant(restaurant: Restaurant) -> PublicRestaurantRead:
    """Compose the public restaurant shape with P6 (info + hours + open/closed)
    and P7 (whatsapp_enabled flag) fields.

    ``is_open_now`` is computed here (not in the service layer) so the
    response shape is the only place that decides what the public sees — the
    service returns the ORM row and stays free of response-shaping concerns.
    ``whatsapp_enabled`` is a boolean only: never leak the raw phone number
    to page-source scrapers (P7 deep link is minted server-side in the POST
    /orders response).
    """
    return PublicRestaurantRead(
        name=restaurant.name,
        slug=restaurant.slug,
        orders_enabled=restaurant.orders_enabled,
        address=restaurant.address,
        phone=restaurant.phone,
        logo_url=restaurant.logo_url,
        timezone=restaurant.timezone,
        business_hours=[
            PublicBusinessHoursRead(
                weekday=bh.weekday,
                open_time=bh.open_time,
                close_time=bh.close_time,
            )
            for bh in restaurant.business_hours
        ],
        is_open_now=compute_is_open_now(restaurant),
        whatsapp_enabled=bool(restaurant.whatsapp_phone),
    )


def _build_response(restaurant: Restaurant) -> PublicMenuResponse:
    # P2 (Fase 2b): the auto-switching lives in resolve_active_menu — flag
    # off (default) this is exactly the pre-P2 "the default menu" behavior.
    menu = resolve_active_menu(restaurant)
    categories = sorted(menu.categories, key=lambda c: c.name) if menu else []
    style = (
        PublicStyleRead.model_validate(restaurant.style)
        if restaurant.style is not None
        else None
    )
    # P4 (Fase 2c): the active promo, resolved server-side (is_active +
    # window vs now in the restaurant's tz). Null when there is none.
    promo = active_promo_for(restaurant)
    return PublicMenuResponse(
        restaurant=_build_restaurant(restaurant),
        style=style,
        promo=(
            PublicPromoRead.model_validate(promo) if promo is not None else None
        ),
        categories=[_build_category(c) for c in categories],
    )


@router.get("/menu/{qr_token}", response_model=PublicMenuResponse, status_code=200)
async def read_public_menu(
    qr_token: str,
    session: AsyncSession = Depends(get_db),
) -> PublicMenuResponse:
    restaurant = await get_public_menu(qr_token, session)
    return _build_response(restaurant)
