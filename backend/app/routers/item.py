import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.item import (
    ImportResult,
    ItemCreate,
    ItemRead,
    ItemUpdate,
    TagCreate,
    TagRead,
)
from app.services.import_csv import MAX_FILE_BYTES, import_items_csv
from app.services.item import (
    add_tag,
    create_item,
    delete_item,
    get_item,
    list_items,
    remove_tag,
    update_item,
)

router = APIRouter()

_PREFIX = "/{restaurant_id}/subcategories/{subcategory_id}/items"


@router.post(_PREFIX, response_model=ItemRead, status_code=201)
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
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ImportResult:
    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="file_too_large")
    return await import_items_csv(restaurant_id, content, session)


@router.get(_PREFIX, response_model=list[ItemRead], status_code=200)
async def list_all(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[ItemRead]:
    items = await list_items(restaurant_id, subcategory_id, session)
    return [ItemRead.model_validate(i) for i in items]


@router.get(_PREFIX + "/{item_id}", response_model=ItemRead, status_code=200)
async def get_one(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ItemRead:
    item = await get_item(restaurant_id, subcategory_id, item_id, session)
    return ItemRead.model_validate(item)


@router.patch(_PREFIX + "/{item_id}", response_model=ItemRead, status_code=200)
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


@router.delete(_PREFIX + "/{item_id}", status_code=204)
async def delete(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_item(restaurant_id, subcategory_id, item_id, session)


# ---------------------------------------------------------------------------
# Tags — sub-resource of an item
# ---------------------------------------------------------------------------

_TAGS_PREFIX = _PREFIX + "/{item_id}/tags"


@router.post(_TAGS_PREFIX, response_model=TagRead, status_code=201)
async def add_item_tag(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: TagCreate,
    response: Response,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> TagRead:
    tag, created = await add_tag(
        restaurant_id, subcategory_id, item_id, data.name, session
    )
    # PA-01: idempotent — existing tag returns 200, not 201.
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return TagRead.model_validate(tag)


@router.delete(_TAGS_PREFIX + "/{tag_id}", status_code=204)
async def delete_item_tag(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    tag_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await remove_tag(restaurant_id, subcategory_id, item_id, tag_id, session)
