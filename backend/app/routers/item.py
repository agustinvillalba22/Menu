import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role, require_superadmin
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.item import (
    ImportResult,
    ItemCreate,
    ItemImageConfirmRequest,
    ItemImageUploadRequest,
    ItemImageUploadResponse,
    ItemRead,
    ItemUpdate,
    TagCreate,
    TagRead,
)
from app.schemas.item_modifier import (
    ItemModifierCreate,
    ItemModifierRead,
    ItemModifierUpdate,
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
from app.services.item_image import (
    confirm_upload,
    create_upload_url,
    delete_image,
)
from app.services.item_modifier import (
    create_modifier,
    delete_modifier,
    list_modifiers,
    update_modifier,
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
    create_missing: bool = Form(False),
    # M13.1 (RF-07): CSV import is restricted to superadmins only — the
    # owner/editor role in `restaurant_id` no longer grants access, and a
    # superadmin can import into ANY restaurant regardless of role there.
    _: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db),
) -> ImportResult:
    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="file_too_large")
    return await import_items_csv(restaurant_id, content, session, create_missing)


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
# Image — sub-resource of an item (M4, R2-backed)
# ---------------------------------------------------------------------------

_IMAGE_PREFIX = _PREFIX + "/{item_id}/image"


@router.post(
    _IMAGE_PREFIX + "/upload-url",
    response_model=ItemImageUploadResponse,
    status_code=200,
)
async def create_image_upload_url(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ItemImageUploadRequest,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ItemImageUploadResponse:
    return await create_upload_url(
        restaurant_id, subcategory_id, item_id, data, session
    )


@router.post(_IMAGE_PREFIX + "/confirm", response_model=ItemRead, status_code=200)
async def confirm_image_upload(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ItemImageConfirmRequest,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ItemRead:
    item = await confirm_upload(
        restaurant_id, subcategory_id, item_id, data, session
    )
    return ItemRead.model_validate(item)


@router.delete(_IMAGE_PREFIX, status_code=204)
async def delete_image_endpoint(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_image(restaurant_id, subcategory_id, item_id, session)


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


# ---------------------------------------------------------------------------
# Modifiers — sub-resource of an item (M11)
# ---------------------------------------------------------------------------

_MODIFIERS_PREFIX = _PREFIX + "/{item_id}/modifiers"


@router.post(_MODIFIERS_PREFIX, response_model=ItemModifierRead, status_code=201)
async def add_item_modifier(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ItemModifierCreate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ItemModifierRead:
    modifier = await create_modifier(
        restaurant_id, subcategory_id, item_id, data, session
    )
    return ItemModifierRead.model_validate(modifier)


@router.get(
    _MODIFIERS_PREFIX, response_model=list[ItemModifierRead], status_code=200
)
async def list_item_modifiers(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> list[ItemModifierRead]:
    modifiers = await list_modifiers(restaurant_id, subcategory_id, item_id, session)
    return [ItemModifierRead.model_validate(m) for m in modifiers]


@router.patch(
    _MODIFIERS_PREFIX + "/{modifier_id}",
    response_model=ItemModifierRead,
    status_code=200,
)
async def patch_item_modifier(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    modifier_id: uuid.UUID,
    data: ItemModifierUpdate,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> ItemModifierRead:
    modifier = await update_modifier(
        restaurant_id, subcategory_id, item_id, modifier_id, data, session
    )
    return ItemModifierRead.model_validate(modifier)


@router.delete(_MODIFIERS_PREFIX + "/{modifier_id}", status_code=204)
async def delete_item_modifier(
    restaurant_id: uuid.UUID,
    subcategory_id: uuid.UUID,
    item_id: uuid.UUID,
    modifier_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> None:
    await delete_modifier(
        restaurant_id, subcategory_id, item_id, modifier_id, session
    )
