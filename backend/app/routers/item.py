import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role, require_superadmin
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.item import (
    ImportResult,
    ItemCreate,
    ItemRead,
    ItemUpdate,
)
from app.services.import_csv import MAX_FILE_BYTES, import_items_csv
from app.services.item import (
    create_item,
    delete_item,
    get_item,
    list_items,
    update_item,
)

router = APIRouter()

ITEMS_PREFIX = "/{restaurant_id}/subcategories/{subcategory_id}/items"


@router.post(ITEMS_PREFIX, response_model=ItemRead, status_code=201)
async def create(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    data: ItemCreate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ItemRead:
    item = await create_item(restaurant_id, subcategory_id, data, session)
    return ItemRead.model_validate(item)


@router.post(
    "/{restaurant_id}/items/import",
    response_model=ImportResult,
    status_code=200,
)
async def import_csv(
    restaurant_id: uuid.UUID,
    file: UploadFile = File(...),
    create_missing: bool = Form(False),
    menu_id: uuid.UUID | None = Form(None),
    # CSV import is restricted to superadmins only — the
    # owner/editor role in `restaurant_id` no longer grants access, and a
    # superadmin can import into ANY restaurant regardless of role there.
    _: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db),
) -> ImportResult:
    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="file_too_large")
    return await import_items_csv(
        restaurant_id, content, session, create_missing, menu_id
    )


@router.get(ITEMS_PREFIX, response_model=list[ItemRead], status_code=200)
async def list_all(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[ItemRead]:
    items = await list_items(restaurant_id, subcategory_id, session)
    return [ItemRead.model_validate(i) for i in items]


@router.get(ITEMS_PREFIX + "/{item_id}", response_model=ItemRead, status_code=200)
async def get_one(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ItemRead:
    item = await get_item(restaurant_id, subcategory_id, item_id, session)
    return ItemRead.model_validate(item)


@router.patch(ITEMS_PREFIX + "/{item_id}", response_model=ItemRead, status_code=200)
async def patch(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ItemUpdate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ItemRead:
    item = await update_item(restaurant_id, subcategory_id, item_id, data, session)
    return ItemRead.model_validate(item)


@router.delete(ITEMS_PREFIX + "/{item_id}", status_code=204)
async def delete(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_item(restaurant_id, subcategory_id, item_id, session)
