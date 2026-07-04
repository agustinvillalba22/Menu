"""
Regression tests for M3.4 — CSV import review fixes.

These cover the four defects flagged by the reviewer (2 critical + 2 minor)
that had NO coverage in ``test_import_csv.py``:

- CRIT-01: duplicate tags in a single row (``vegano;vegano``) must NOT break
  ``UniqueConstraint(item_id, name)`` — ``_parse_tags`` dedupes (case-sensitive)
  before building ItemTag rows.
- CRIT-02: the router reads with ``file.read(MAX_FILE_BYTES + 1)`` and rejects
  with 413 before buffering the whole file.
- MINOR-1: the importer applies the same length limits as the CRUD layer
  (name > 120 → ``name_too_long``, description > 1000 → ``description_too_long``,
  any tag > 50 → ``tag_too_long``); the offending row fails without creating the
  item and without aborting the rest of the import.
- MINOR-2: ``_read_rows`` reads lazily and raises 413 ``file_too_large`` as soon
  as MAX_ROWS (2000) data rows are exceeded, before resolving categories / DB.

Helpers and the auth/upload pattern are reused from ``test_import_csv`` so the
fixture and multipart-upload conventions stay identical.
"""
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item, ItemTag
from app.services.import_csv import MAX_FILE_BYTES, MAX_ROWS
from tests.test_import_csv import (
    HEADER,
    as_user,
    count_items,
    make_restaurant,
    post_csv,
    seed_menu,
)


# ---------------------------------------------------------------------------
# CRIT-01: duplicate tags in one row do not violate uq_item_tag / 500
# ---------------------------------------------------------------------------


async def test_duplicate_tags_in_row_dedupe_no_500(
    client: AsyncClient, db_session: AsyncSession
):
    """``vegano;vegano;Vegano`` imports fine; exact dupes collapse, but the
    dedupe is case-sensitive so ``Vegano`` stays distinct from ``vegano``."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = HEADER + "Platos,Pastas,Ravioles,,1200,vegano;vegano;Vegano\n"
    res = await post_csv(client, rid, headers, csv_text)

    assert res.status_code == 200
    assert res.json() == {"imported": 1, "errors": []}
    assert await count_items(db_session) == 1

    tag_names = (
        await db_session.execute(select(ItemTag.name))
    ).scalars().all()
    # Exact duplicate "vegano" collapsed to one; "Vegano" kept (case-sensitive).
    assert sorted(tag_names) == ["Vegano", "vegano"]


async def test_duplicate_tags_with_whitespace_dedupe(
    client: AsyncClient, db_session: AsyncSession
):
    """Whitespace-padded dupes (`` vegano ;vegano``) also collapse to one tag."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = HEADER + "Platos,Pastas,Ravioles,,1200, vegano ;vegano;  vegano\n"
    res = await post_csv(client, rid, headers, csv_text)

    assert res.status_code == 200
    assert res.json()["imported"] == 1
    tag_names = (
        await db_session.execute(select(ItemTag.name))
    ).scalars().all()
    assert tag_names == ["vegano"]


# ---------------------------------------------------------------------------
# CRIT-02: file over MAX_FILE_BYTES rejected with 413 at the router boundary
# ---------------------------------------------------------------------------


async def test_file_over_max_bytes_returns_413(
    client: AsyncClient, db_session: AsyncSession
):
    """A payload of MAX_FILE_BYTES + 1 bytes is rejected with 413 end-to-end;
    nothing is imported."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    oversized = b"x" * (MAX_FILE_BYTES + 1)
    res = await client.post(
        f"/restaurants/{rid}/items/import",
        files={"file": ("big.csv", oversized, "text/csv")},
        headers=headers,
    )

    assert res.status_code == 413
    assert res.json()["detail"] == "file_too_large"
    assert await count_items(db_session) == 0


# ---------------------------------------------------------------------------
# MINOR-1: length limits mirror ItemCreate / TagCreate; bad row fails, others OK
# ---------------------------------------------------------------------------


async def test_name_too_long_fails_row_others_imported(
    client: AsyncClient, db_session: AsyncSession
):
    """name > 120 chars → ``name_too_long`` on that row only; valid rows import."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    long_name = "A" * 121
    csv_text = HEADER + (
        f"Platos,Pastas,{long_name},,1200,\n"
        "Platos,Pastas,Ravioles,,900,\n"
    )
    res = await post_csv(client, rid, headers, csv_text)

    assert res.status_code == 200
    body = res.json()
    assert body["imported"] == 1
    assert body["errors"] == [
        {"row": 1, "reason": "name_too_long", "detail": None}
    ]
    names = (await db_session.execute(select(Item.name))).scalars().all()
    assert names == ["Ravioles"]


async def test_name_at_limit_120_imports(
    client: AsyncClient, db_session: AsyncSession
):
    """Boundary: exactly 120 chars is accepted (mirrors ItemCreate max_length)."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    name = "A" * 120
    csv_text = HEADER + f"Platos,Pastas,{name},,1200,\n"
    res = await post_csv(client, rid, headers, csv_text)

    assert res.status_code == 200
    assert res.json() == {"imported": 1, "errors": []}
    assert await count_items(db_session) == 1


async def test_description_too_long_fails_row(
    client: AsyncClient, db_session: AsyncSession
):
    """description > 1000 chars → ``description_too_long``; item not created."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    long_desc = "D" * 1001
    csv_text = HEADER + (
        f"Platos,Pastas,Ravioles,{long_desc},1200,\n"
        "Platos,Pastas,Ñoquis,,900,\n"
    )
    res = await post_csv(client, rid, headers, csv_text)

    assert res.status_code == 200
    body = res.json()
    assert body["imported"] == 1
    assert body["errors"] == [
        {"row": 1, "reason": "description_too_long", "detail": None}
    ]
    names = (await db_session.execute(select(Item.name))).scalars().all()
    assert names == ["Ñoquis"]


async def test_tag_too_long_fails_row(
    client: AsyncClient, db_session: AsyncSession
):
    """Any tag > 50 chars → ``tag_too_long``; the whole row fails, no item/tag."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    long_tag = "t" * 51
    csv_text = HEADER + (
        f"Platos,Pastas,Ravioles,,1200,vegano;{long_tag}\n"
        "Platos,Pastas,Ñoquis,,900,\n"
    )
    res = await post_csv(client, rid, headers, csv_text)

    assert res.status_code == 200
    body = res.json()
    assert body["imported"] == 1
    assert body["errors"] == [
        {"row": 1, "reason": "tag_too_long", "detail": None}
    ]
    # Failed row must not leak its (valid) sibling tag either.
    tag_count = (
        await db_session.execute(select(func.count()).select_from(ItemTag))
    ).scalar_one()
    assert tag_count == 0


async def test_tag_at_limit_50_imports(
    client: AsyncClient, db_session: AsyncSession
):
    """Boundary: a tag of exactly 50 chars is accepted (mirrors TagCreate)."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    tag = "t" * 50
    csv_text = HEADER + f"Platos,Pastas,Ravioles,,1200,{tag}\n"
    res = await post_csv(client, rid, headers, csv_text)

    assert res.status_code == 200
    assert res.json() == {"imported": 1, "errors": []}
    names = (
        await db_session.execute(select(ItemTag.name))
    ).scalars().all()
    assert names == [tag]


# ---------------------------------------------------------------------------
# MINOR-2: more than MAX_ROWS data rows → early 413, before DB/category resolve
# ---------------------------------------------------------------------------


async def test_over_max_rows_returns_413_early(
    client: AsyncClient, db_session: AsyncSession
):
    """A CSV with MAX_ROWS + 1 data rows is rejected with 413 before any insert.

    The content is intentionally trivial (rows point at a non-existent category)
    to prove the row-count guard fires *before* category resolution / DB work.
    """
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    row = "Nope,Nope,x,,1,\n"
    csv_text = HEADER + row * (MAX_ROWS + 1)
    # Stays well under MAX_FILE_BYTES so this exercises the row guard, not size.
    assert len(csv_text.encode("utf-8")) < MAX_FILE_BYTES

    res = await post_csv(client, rid, headers, csv_text)

    assert res.status_code == 413
    assert res.json()["detail"] == "file_too_large"
    assert await count_items(db_session) == 0


async def test_exactly_max_rows_is_accepted(
    client: AsyncClient, db_session: AsyncSession
):
    """Boundary: exactly MAX_ROWS data rows is NOT rejected (guard is strict >)."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    # Rows resolve to a real category so they import; count proves no 413.
    row = "Platos,Pastas,x,,1,\n"
    csv_text = HEADER + row * MAX_ROWS

    res = await post_csv(client, rid, headers, csv_text)

    assert res.status_code == 200
    assert res.json()["imported"] == MAX_ROWS
    assert await count_items(db_session) == MAX_ROWS
