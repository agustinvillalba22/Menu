"""CSV import service — M3.4.

Additive bulk import of items from a CSV. Category/subcategory are matched by
name (case-insensitive + trim) against the restaurant's already-existing menu;
missing categories/subcategories are NOT auto-created — the row fails instead.

Rows are validated one by one without aborting on error: valid rows are staged
on the session and a SINGLE commit is issued at the end. Failed rows are
collected into ``errors`` and processing continues.
"""
import csv
import io
import uuid

from fastapi import HTTPException
from pydantic import TypeAdapter, ValidationError

from app.models.item import Item, ItemTag
from app.schemas.item import ImportResult, ImportRowError, Price
from app.services.menu import list_categories_with_subcategories

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 2000
_REQUIRED_COLUMNS = {"category", "subcategory", "name", "price"}
_TAG_SEPARATOR = ";"
# Kept in lock-step with app.schemas.item (ItemCreate / TagCreate) so the
# importer rejects the same over-length values the normal CRUD path rejects.
_NAME_MAX_LENGTH = 120
_DESCRIPTION_MAX_LENGTH = 1000
_TAG_MAX_LENGTH = 50

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
    """Map normalized category name -> normalized subcategory name -> [ids]."""
    index: dict[str, dict[str, list[uuid.UUID]]] = {}
    for category in categories:
        cat_key = _normalize(category.name)
        subs = index.setdefault(cat_key, {})
        for sub in category.subcategories:
            subs.setdefault(_normalize(sub.name), []).append(sub.id)
    return index


def _resolve_subcategory(
    cat_name: str,
    sub_name: str,
    index: dict[str, dict[str, list[uuid.UUID]]],
) -> tuple[uuid.UUID | None, str | None]:
    """Return (subcategory_id, None) or (None, error_reason)."""
    subs = index.get(_normalize(cat_name))
    if subs is None:
        return None, "category_not_found"
    ids = subs.get(_normalize(sub_name))
    if not ids:
        return None, "subcategory_not_found"
    if len(ids) > 1:
        return None, "ambiguous_subcategory"
    return ids[0], None


def _parse_tags(raw: str | None) -> list[str]:
    """Split a ";"-separated tag string, trimming, dropping empties and dupes.

    Deduping here (CRIT-01) prevents a row like ``vegano;vegano`` from building
    two ItemTag rows that would violate ``uq_item_tag`` and abort the whole
    single-commit import.
    """
    if not raw:
        return []
    seen: dict[str, None] = {}
    for t in raw.split(_TAG_SEPARATOR):
        t = t.strip()
        if t:
            seen.setdefault(t, None)
    return list(seen)


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
        field("category") or "", field("subcategory") or "", index
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
    restaurant_id: uuid.UUID, content: bytes, session
) -> ImportResult:
    """Import items from CSV bytes. Additive, single commit at the end."""
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="file_too_large")

    header_map, rows = _read_rows(_decode(content))
    categories = await list_categories_with_subcategories(restaurant_id, session)
    index = _build_index(categories)

    imported = 0
    errors: list[ImportRowError] = []
    for offset, row in enumerate(rows, start=1):
        item, reason = _build_item(row, header_map, index)
        if reason is not None:
            errors.append(ImportRowError(row=offset, reason=reason, detail=None))
            continue
        session.add(item)
        imported += 1

    await session.commit()
    return ImportResult(imported=imported, errors=errors)
