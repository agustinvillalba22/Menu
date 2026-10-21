import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.menu import (
    CategoryCreate,
    CategoryRead,
    CategoryTreeRead,
    CategoryUpdate,
    MenuCreate,
    MenuRead,
    MenuUpdate,
)
from app.services.menu import (
    create_category,
    create_menu,
    delete_category,
    delete_menu,
    get_category,
    get_menu,
    list_categories,
    list_categories_with_subcategories,
    list_menus,
    update_category,
    update_menu,
)

router = APIRouter()

_MENUS = "/{restaurant_id}/menus"
_MENU = _MENUS + "/{menu_id}"
_CATEGORIES = _MENU + "/categories"

EditorUser = Depends(require_role(RestaurantRole.editor))


@router.post(_MENUS, response_model=MenuRead, status_code=201)
async def create(
    restaurant_id: uuid.UUID,
    data: MenuCreate,
    _: User = EditorUser,
    session: AsyncSession = Depends(get_db),
) -> MenuRead:
    return await create_menu(restaurant_id, data, session)


@router.get(_MENUS, response_model=list[MenuRead], status_code=200)
async def list_all(
    restaurant_id: uuid.UUID,
    _: User = EditorUser,
    session: AsyncSession = Depends(get_db),
) -> list[MenuRead]:
    return await list_menus(restaurant_id, session)


@router.get(_MENU, response_model=MenuRead, status_code=200)
async def get_one(
    restaurant_id: uuid.UUID,
    menu_id: uuid.UUID,
    _: User = EditorUser,
    session: AsyncSession = Depends(get_db),
) -> MenuRead:
    return await get_menu(restaurant_id, menu_id, session)


@router.patch(_MENU, response_model=MenuRead, status_code=200)
async def patch(
    restaurant_id: uuid.UUID,
    menu_id: uuid.UUID,
    data: MenuUpdate,
    _: User = EditorUser,
    session: AsyncSession = Depends(get_db),
) -> MenuRead:
    return await update_menu(restaurant_id, menu_id, data, session)


@router.delete(_MENU, status_code=204)
async def delete(
    restaurant_id: uuid.UUID,
    menu_id: uuid.UUID,
    _: User = EditorUser,
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_menu(restaurant_id, menu_id, session)


@router.get(_MENU + "/tree", response_model=list[CategoryTreeRead], status_code=200)
async def tree(
    restaurant_id: uuid.UUID,
    menu_id: uuid.UUID,
    _: User = EditorUser,
    session: AsyncSession = Depends(get_db),
) -> list[CategoryTreeRead]:
    categories = await list_categories_with_subcategories(
        restaurant_id, session, menu_id
    )
    return [CategoryTreeRead.model_validate(c) for c in categories]


# ---------------------------------------------------------------------------
# Categories v2 — explicit menu_id (same service as the legacy routes)
# ---------------------------------------------------------------------------


@router.post(_CATEGORIES, response_model=CategoryRead, status_code=201)
async def create_cat(
    restaurant_id: uuid.UUID,
    menu_id: uuid.UUID,
    data: CategoryCreate,
    _: User = EditorUser,
    session: AsyncSession = Depends(get_db),
) -> CategoryRead:
    category = await create_category(restaurant_id, data, session, menu_id)
    return CategoryRead.model_validate(category)


@router.get(_CATEGORIES, response_model=list[CategoryRead], status_code=200)
async def list_cats(
    restaurant_id: uuid.UUID,
    menu_id: uuid.UUID,
    _: User = EditorUser,
    session: AsyncSession = Depends(get_db),
) -> list[CategoryRead]:
    categories = await list_categories(restaurant_id, session, menu_id)
    return [CategoryRead.model_validate(c) for c in categories]


@router.get(
    _CATEGORIES + "/{category_id}", response_model=CategoryRead, status_code=200
)
async def get_cat(
    restaurant_id: uuid.UUID,
    menu_id: uuid.UUID,
    category_id: uuid.UUID,
    _: User = EditorUser,
    session: AsyncSession = Depends(get_db),
) -> CategoryRead:
    category = await get_category(restaurant_id, category_id, session, menu_id)
    return CategoryRead.model_validate(category)


@router.patch(
    _CATEGORIES + "/{category_id}", response_model=CategoryRead, status_code=200
)
async def patch_cat(
    restaurant_id: uuid.UUID,
    menu_id: uuid.UUID,
    category_id: uuid.UUID,
    data: CategoryUpdate,
    _: User = EditorUser,
    session: AsyncSession = Depends(get_db),
) -> CategoryRead:
    category = await update_category(restaurant_id, category_id, data, session, menu_id)
    return CategoryRead.model_validate(category)


@router.delete(_CATEGORIES + "/{category_id}", status_code=204)
async def delete_cat(
    restaurant_id: uuid.UUID,
    menu_id: uuid.UUID,
    category_id: uuid.UUID,
    _: User = EditorUser,
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_category(restaurant_id, category_id, session, menu_id)
