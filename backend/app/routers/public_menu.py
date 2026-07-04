from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.item import Item
from app.models.menu import Category, Subcategory
from app.models.restaurant import Restaurant
from app.schemas.public_menu import (
    PublicCategoryRead,
    PublicItemRead,
    PublicMenuResponse,
    PublicRestaurantRead,
    PublicStyleRead,
    PublicSubcategoryRead,
    PublicTagRead,
)
from app.services.public_menu import get_public_menu

router = APIRouter()


def _build_item(item: Item) -> PublicItemRead:
    return PublicItemRead(
        id=item.id,
        name=item.name,
        description=item.description,
        price=item.price,
        tags=[PublicTagRead(id=t.id, name=t.name) for t in item.tags],
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
        subcategories=[_build_subcategory(s) for s in subs],
    )


def _build_response(restaurant: Restaurant) -> PublicMenuResponse:
    # The restaurant has a single auto-created default menu (see M3.1).
    menu = restaurant.menus[0] if restaurant.menus else None
    categories = sorted(menu.categories, key=lambda c: c.name) if menu else []
    style = (
        PublicStyleRead.model_validate(restaurant.style)
        if restaurant.style is not None
        else None
    )
    return PublicMenuResponse(
        restaurant=PublicRestaurantRead.model_validate(restaurant),
        style=style,
        categories=[_build_category(c) for c in categories],
    )


@router.get("/menu/{qr_token}", response_model=PublicMenuResponse, status_code=200)
async def read_public_menu(
    qr_token: str,
    session: AsyncSession = Depends(get_db),
) -> PublicMenuResponse:
    restaurant = await get_public_menu(qr_token, session)
    return _build_response(restaurant)
