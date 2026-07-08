"""CSV import service — M3.4, extended by M12.5.

Additive bulk import of items from a CSV. Category/subcategory are matched by
name (case-insensitive + trim) against the restaurant's already-existing
menu. By default (``create_missing=False``), a row whose category or
subcategory doesn't exist fails instead of creating anything — this is the
original M3 behavior and stays unchanged (RNF-01).

When ``create_missing=True`` (M12.5, opt-in), a row may create the missing
``Category``/``Subcategory`` instead of failing: the CSV's optional `type`
column (`food`/`drink`, case-insensitive, defaults to `food`) is used only
when a brand-new Category is created; it is ignored when the category
already exists. Categories/subcategories created this way are deduped
in-memory within the same import (RF-06): the same index used to resolve
existing rows is updated as new ones are created during the row loop.

Rows are validated one by one without aborting on error: valid rows are
staged on the session and a SINGLE commit is issued at the end (RF-07),
matching the pattern already used for `Item`. `Category`/`Subcategory` IDs
are generated client-side (`default=uuid.uuid4`), so they're available
in-memory to assign as FKs before that single commit.
"""
import csv
import io
import uuid

from fastapi import HTTPException
from pydantic import TypeAdapter, ValidationError

from app.models.item import Item, ItemTag
from app.models.menu import Category, CategoryType, Subcategory
from app.schemas.item import ImportResult, ImportRowError, Price
from app.services.menu import _get_default_menu, list_categories_with_subcategories

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 2000
_REQUIRED_COLUMNS = {"category", "subcategory", "name", "price"}
_TAG_SEPARATOR = ";"
# Kept in lock-step with app.schemas.item (ItemCreate / TagCreate) so the
# importer rejects the same over-length values the normal CRUD path rejects.
_NAME_MAX_LENGTH = 120
_DESCRIPTION_MAX_LENGTH = 1000
_TAG_MAX_LENGTH = 50
# Kept in lock-step with app.schemas.menu (CategoryCreate / SubcategoryCreate,
# RNF-03) so categories/subcategories auto-created by the importer reject the
# same over-length names the normal CRUD path rejects.
_CATEGORY_NAME_MAX_LENGTH = 120
_SUBCATEGORY_NAME_MAX_LENGTH = 120

_price_adapter: TypeAdapter = TypeAdapter(Price)


def _normalize(value: str | None) -> str:
    """Lower-case + trim for case-insensitive name matching."""
    return (value or "").strip().lower()


def _decode(content: bytes) -> str:
    """Decode CSV bytes as UTF-8 (tolerating a BOM). 422 on failure."""
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="invalid_csv")


def _read_rows(text: str) -> tuple[dict[str, str], list[dict[str, str]]]:
    """Parse CSV into (normalized_header_map, rows). Validates the header.

    Rows are consumed lazily and the read is aborted as soon as the row count
    exceeds ``MAX_ROWS``, so an oversized (but <5MB) file never gets fully
    materialized in memory before being rejected.
    """
    reader = csv.DictReader(io.StringIO(text))
    try:
        fieldnames = reader.fieldnames
    except csv.Error:
        raise HTTPException(status_code=422, detail="invalid_csv")
    if not fieldnames:
        raise HTTPException(status_code=422, detail="invalid_csv_header")
    header_map = {_normalize(f): f for f in fieldnames if f is not None}
    if not _REQUIRED_COLUMNS.issubset(header_map):
        raise HTTPException(status_code=422, detail="invalid_csv_header")
    rows: list[dict[str, str]] = []
    try:
        for row in reader:
            rows.append(row)
            if len(rows) > MAX_ROWS:
                raise HTTPException(status_code=413, detail="file_too_large")
    except csv.Error:
        raise HTTPException(status_code=422, detail="invalid_csv")
    return header_map, rows


def _build_index(
    categories: list,
) -> dict[str, dict[str, list[uuid.UUID]]]:
    """Map normalized category name -> normalized subcategory name -> [ids].

    Mutated in place as new categories/subcategories are created during the
    row loop (RF-06 dedupe), not just built once up front.
    """
    index: dict[str, dict[str, list[uuid.UUID]]] = {}
    for category in categories:
        cat_key = _normalize(category.name)
        subs = index.setdefault(cat_key, {})
        for sub in category.subcategories:
            subs.setdefault(_normalize(sub.name), []).append(sub.id)
    return index


def _build_category_ids(categories: list) -> dict[str, uuid.UUID]:
    """Map normalized category name -> category id, for attaching a new
    Subcategory to an already-existing Category by id."""
    return {_normalize(c.name): c.id for c in categories}


def _category_type_from(raw: str | None) -> CategoryType:
    """RF-05: default 'food' when `type` is missing, empty, or not a
    recognized value (case-insensitive `food`/`drink`)."""
    value = (raw or "").strip().lower()
    if value == CategoryType.drink.value:
        return CategoryType.drink
    return CategoryType.food


def _resolve_subcategory(
    cat_name: str,
    sub_name: str,
    type_raw: str | None,
    index: dict[str, dict[str, list[uuid.UUID]]],
    category_ids: dict[str, uuid.UUID],
    menu_id: uuid.UUID | None,
    session,
    create_missing: bool,
) -> tuple[uuid.UUID | None, str | None]:
    """Return (subcategory_id, None) or (None, error_reason).

    With ``create_missing=False`` this is byte-for-byte the original M3
    behavior. With ``create_missing=True`` (RF-04), a missing category or
    subcategory is created instead of failing the row; RF-02 the `type`
    column is only consulted when a brand-new Category is created.
    """
    cat_key = _normalize(cat_name)
    sub_key = _normalize(sub_name)

    subs = index.get(cat_key)
    if subs is None:
        if not create_missing:
            return None, "category_not_found"
        if not cat_name.strip():
            return None, "category_not_found"
        if len(cat_name) > _CATEGORY_NAME_MAX_LENGTH:
            return None, "category_name_too_long"
        if not sub_name.strip():
            return None, "subcategory_not_found"
        if len(sub_name) > _SUBCATEGORY_NAME_MAX_LENGTH:
            return None, "subcategory_name_too_long"
        if menu_id is None:
            # Guaranteed not to happen: the caller only reaches this branch
            # (a missing category) with create_missing=True, and menu_id is
            # always resolved up front whenever create_missing=True. Guarded
            # explicitly (not via `assert`, which `-O` can strip) so a future
            # refactor fails loudly instead of inserting a Category with a
            # NULL menu_id.
            raise HTTPException(status_code=500, detail="internal_import_error")
        # RF-07: assign the id explicitly rather than relying on the mapped
        # column's `default=uuid.uuid4` — that default is only evaluated at
        # flush time, but we need the FK available in memory right now (no
        # intermediate flush before the single commit at the end).
        category = Category(
            id=uuid.uuid4(),
            name=cat_name,
            type=_category_type_from(type_raw),
            menu_id=menu_id,
        )
        session.add(category)
        category_ids[cat_key] = category.id
        subcategory = Subcategory(
            id=uuid.uuid4(), name=sub_name, category_id=category.id
        )
        session.add(subcategory)
        subs = index.setdefault(cat_key, {})
        subs.setdefault(sub_key, []).append(subcategory.id)
        return subcategory.id, None

    ids = subs.get(sub_key)
    if not ids:
        if not create_missing:
            return None, "subcategory_not_found"
        if not sub_name.strip():
            return None, "subcategory_not_found"
        if len(sub_name) > _SUBCATEGORY_NAME_MAX_LENGTH:
            return None, "subcategory_name_too_long"
        category_id = category_ids[cat_key]
        subcategory = Subcategory(
            id=uuid.uuid4(), name=sub_name, category_id=category_id
        )
        session.add(subcategory)
        subs.setdefault(sub_key, []).append(subcategory.id)
        return subcategory.id, None
    if len(ids) > 1:
        return None, "ambiguous_subcategory"
    return ids[0], None


def _parse_tags(raw: str | None) -> list[str]:
    """Split a ";"-separated tag string, trimming, dropping empties and dupes.

    Deduping here (CRIT-01) prevents a row like ``vegano;vegano`` from building
    two ItemTag rows that would violate ``uq_item_tag`` and abort the whole
    single-commit import.

    Dedup is case-insensitive and trimmed (M12.2, RF-02), matching the same
    "already exists" criterion as ``add_tag``: ``vegano;Vegano`` collapses to
    a single tag, keeping the casing of the first occurrence seen.
    """
    if not raw:
        return []
    seen: dict[str, str] = {}
    for t in raw.split(_TAG_SEPARATOR):
        t = t.strip()
        if t:
            seen.setdefault(_normalize(t), t)
    return list(seen.values())


def _build_tags(raw: str | None) -> tuple[list[ItemTag] | None, str | None]:
    """Build deduped ItemTag rows, rejecting any tag over the length limit."""
    tags = _parse_tags(raw)
    for t in tags:
        if len(t) > _TAG_MAX_LENGTH:
            return None, "tag_too_long"
    return [ItemTag(name=t) for t in tags], None


def _build_item(
    row: dict[str, str],
    header_map: dict[str, str],
    index: dict[str, dict[str, list[uuid.UUID]]],
    category_ids: dict[str, uuid.UUID],
    menu_id: uuid.UUID | None,
    session,
    create_missing: bool,
) -> tuple[Item | None, str | None]:
    """Validate a single data row and build an unsaved Item (or an error)."""

    def field(name: str) -> str | None:
        source = header_map.get(name)
        return row.get(source) if source else None

    name = (field("name") or "").strip()
    if not name:
        return None, "missing_name"
    if len(name) > _NAME_MAX_LENGTH:
        return None, "name_too_long"

    description = (field("description") or "").strip()
    if len(description) > _DESCRIPTION_MAX_LENGTH:
        return None, "description_too_long"

    subcategory_id, error = _resolve_subcategory(
        field("category") or "",
        field("subcategory") or "",
        field("type"),
        index,
        category_ids,
        menu_id,
        session,
        create_missing,
    )
    if error is not None:
        return None, error

    try:
        price = _price_adapter.validate_python((field("price") or "").strip())
    except ValidationError:
        return None, "invalid_price"

    tags, error = _build_tags(field("tags"))
    if error is not None:
        return None, error

    item = Item(
        name=name,
        description=description,
        price=price,
        subcategory_id=subcategory_id,
    )
    item.tags = tags
    return item, None


async def import_items_csv(
    restaurant_id: uuid.UUID,
    content: bytes,
    session,
    create_missing: bool = False,
) -> ImportResult:
    """Import items from CSV bytes. Additive, single commit at the end.

    ``create_missing`` (RF-01, default False) opts into auto-creating
    missing categories/subcategories (RF-04) instead of failing those rows.
    """
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="file_too_large")

    header_map, rows = _read_rows(_decode(content))
    categories = await list_categories_with_subcategories(restaurant_id, session)
    index = _build_index(categories)
    category_ids = _build_category_ids(categories)

    # Only fetch the Menu (needed as the FK for brand-new Categories) when
    # create_missing is actually set, to keep the create_missing=False path
    # byte-for-byte identical to the pre-M12.5 behavior (RNF-01).
    menu_id: uuid.UUID | None = None
    if create_missing:
        menu = await _get_default_menu(restaurant_id, session)
        menu_id = menu.id

    imported = 0
    errors: list[ImportRowError] = []
    for offset, row in enumerate(rows, start=1):
        item, reason = _build_item(
            row, header_map, index, category_ids, menu_id, session, create_missing
        )
        if reason is not None:
            errors.append(ImportRowError(row=offset, reason=reason, detail=None))
            continue
        session.add(item)
        imported += 1

    await session.commit()
    return ImportResult(imported=imported, errors=errors)
