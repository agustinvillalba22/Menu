"""
Tests for M12.5 — CSV import can auto-create missing categories/subcategories.

Covers the 7 ACs (plus RNF-01/RNF-03) from
``.agents/specs/M12.5_csv_import_autocreate_categories.md``. Reuses helpers
from ``test_import_csv.py`` (auth, restaurant/menu setup, ``HEADER``) so the
auth/upload conventions and the base "Platos > Pastas" seeded menu stay
identical to the pre-existing suite.
"""
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.models.menu import Category, CategoryType, Subcategory
from tests.test_import_csv import (
    HEADER,
    as_superadmin,
    count_items,
    make_restaurant,
    seed_menu,
)


def post_csv(
    client: AsyncClient,
    rid: str,
    headers: dict,
    csv_text: str,
    create_missing: bool | None = None,
):
    """Like ``test_import_csv.post_csv`` but optionally attaches
    ``create_missing`` as a multipart form field. When ``create_missing`` is
    left as ``None``, no such field is sent at all — this exercises the exact
    same request shape the pre-M12.5 suite always sent (RNF-01)."""
    data = {}
    if create_missing is not None:
        data["create_missing"] = "true" if create_missing else "false"
    return client.post(
        f"/restaurants/{rid}/items/import",
        files={"file": ("data.csv", csv_text.encode("utf-8"), "text/csv")},
        data=data,
        headers=headers,
    )


# The `type` column is new (RF-02) and optional; only some tests need it.
TYPE_HEADER = "category,subcategory,name,description,price,tags,type\n"


# ---------------------------------------------------------------------------
# CA-01: create_missing=False (explicit) — behavior identical to today
# ---------------------------------------------------------------------------


async def test_create_missing_false_category_not_found_unchanged(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = HEADER + "Bebidas,Calientes,Cafe,,1200,\n"
    res = await post_csv(client, rid, headers, csv_text, create_missing=False)
    assert res.status_code == 200
    body = res.json()
    assert body["imported"] == 0
    assert body["errors"] == [
        {"row": 1, "reason": "category_not_found", "detail": None}
    ]
    assert await count_items(db_session) == 0
    cat_count = (
        await db_session.execute(select(func.count()).select_from(Category))
    ).scalar_one()
    assert cat_count == 1  # only the seeded "Platos"


# ---------------------------------------------------------------------------
# CA-02: create_missing=True, category+subcategory missing, type=drink
# ---------------------------------------------------------------------------


async def test_create_missing_true_creates_category_and_subcategory_with_type(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = TYPE_HEADER + "Bebidas,Calientes,Cafe,,1200,,drink\n"
    res = await post_csv(client, rid, headers, csv_text, create_missing=True)
    assert res.status_code == 200
    assert res.json() == {"imported": 1, "errors": []}
    assert await count_items(db_session) == 1

    category = (
        await db_session.execute(select(Category).where(Category.name == "Bebidas"))
    ).scalar_one()
    assert category.type == CategoryType.drink

    subcategory = (
        await db_session.execute(
            select(Subcategory).where(Subcategory.name == "Calientes")
        )
    ).scalar_one()
    assert subcategory.category_id == category.id

    item = (await db_session.execute(select(Item))).scalar_one()
    assert item.subcategory_id == subcategory.id


# ---------------------------------------------------------------------------
# CA-03: category exists, subcategory missing — only the subcategory is created
# ---------------------------------------------------------------------------


async def test_create_missing_true_existing_category_new_subcategory(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)  # "Platos" (food) > "Pastas"

    csv_text = HEADER + "Platos,Milanesas,Napolitana,,1800,\n"
    res = await post_csv(client, rid, headers, csv_text, create_missing=True)
    assert res.status_code == 200
    assert res.json() == {"imported": 1, "errors": []}

    categories = (
        (
            await db_session.execute(
                select(Category).where(Category.name == "Platos")
            )
        )
        .scalars()
        .all()
    )
    assert len(categories) == 1
    assert categories[0].type == CategoryType.food  # unchanged, not duplicated

    subcategory = (
        await db_session.execute(
            select(Subcategory).where(Subcategory.name == "Milanesas")
        )
    ).scalar_one()
    assert subcategory.category_id == categories[0].id


# ---------------------------------------------------------------------------
# CA-04: two rows referencing the same new category+subcategory dedupe
# ---------------------------------------------------------------------------


async def test_create_missing_true_dedupes_within_same_file(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = TYPE_HEADER + (
        "Bebidas,Calientes,Cafe,,1200,,drink\n"
        "Bebidas,Calientes,Te,,1000,,drink\n"
    )
    res = await post_csv(client, rid, headers, csv_text, create_missing=True)
    assert res.status_code == 200
    assert res.json() == {"imported": 2, "errors": []}

    cat_count = (
        await db_session.execute(
            select(func.count())
            .select_from(Category)
            .where(Category.name == "Bebidas")
        )
    ).scalar_one()
    sub_count = (
        await db_session.execute(
            select(func.count())
            .select_from(Subcategory)
            .where(Subcategory.name == "Calientes")
        )
    ).scalar_one()
    assert cat_count == 1
    assert sub_count == 1


# ---------------------------------------------------------------------------
# CA-05: type column missing/invalid defaults to "food"
# ---------------------------------------------------------------------------


async def test_create_missing_true_type_missing_or_invalid_defaults_food(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = TYPE_HEADER + (
        "Postres,Frios,Helado,,900,,\n"
        "Snacks,Salados,Papas,,700,,bebidas\n"
    )
    res = await post_csv(client, rid, headers, csv_text, create_missing=True)
    assert res.status_code == 200
    assert res.json() == {"imported": 2, "errors": []}

    postres = (
        await db_session.execute(select(Category).where(Category.name == "Postres"))
    ).scalar_one()
    snacks = (
        await db_session.execute(select(Category).where(Category.name == "Snacks"))
    ).scalar_one()
    assert postres.type == CategoryType.food
    assert snacks.type == CategoryType.food


# ---------------------------------------------------------------------------
# CA-06: create_missing=True but category/subcategory already exist — no-op create
# ---------------------------------------------------------------------------


async def test_create_missing_true_existing_category_and_subcategory_unchanged(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)  # "Platos" > "Pastas"

    csv_text = HEADER + "Platos,Pastas,Ravioles,,1200,\n"
    res = await post_csv(client, rid, headers, csv_text, create_missing=True)
    assert res.status_code == 200
    assert res.json() == {"imported": 1, "errors": []}

    cat_count = (
        await db_session.execute(
            select(func.count())
            .select_from(Category)
            .where(Category.name == "Platos")
        )
    ).scalar_one()
    sub_count = (
        await db_session.execute(
            select(func.count())
            .select_from(Subcategory)
            .where(Subcategory.name == "Pastas")
        )
    ).scalar_one()
    assert cat_count == 1
    assert sub_count == 1


# ---------------------------------------------------------------------------
# RNF-01: field entirely absent from the request behaves like create_missing=False
# ---------------------------------------------------------------------------


async def test_create_missing_field_absent_behaves_like_false(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = HEADER + "Bebidas,Calientes,Cafe,,1200,\n"
    res = await post_csv(client, rid, headers, csv_text)  # no create_missing at all
    assert res.status_code == 200
    body = res.json()
    assert body["imported"] == 0
    assert body["errors"][0]["reason"] == "category_not_found"
    assert await count_items(db_session) == 0


# ---------------------------------------------------------------------------
# RNF-03: new category/subcategory names respect the same length limits as
# CategoryCreate/SubcategoryCreate (max_length=120) — a row fails cleanly
# instead of a 500.
# ---------------------------------------------------------------------------


async def test_create_missing_true_category_name_too_long_fails_row(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    long_name = "A" * 121
    csv_text = HEADER + (
        f"{long_name},Sub,Item1,,1200,\n"
        "Platos,Pastas,Item2,,900,\n"
    )
    res = await post_csv(client, rid, headers, csv_text, create_missing=True)
    assert res.status_code == 200
    body = res.json()
    assert body["imported"] == 1
    assert body["errors"] == [
        {"row": 1, "reason": "category_name_too_long", "detail": None}
    ]
    cat_count = (
        await db_session.execute(select(func.count()).select_from(Category))
    ).scalar_one()
    assert cat_count == 1  # only the seeded "Platos" — the too-long one wasn't created


async def test_create_missing_true_subcategory_name_too_long_fails_row(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)  # "Platos" exists

    long_name = "B" * 121
    csv_text = HEADER + f"Platos,{long_name},Item1,,1200,\n"
    res = await post_csv(client, rid, headers, csv_text, create_missing=True)
    assert res.status_code == 200
    body = res.json()
    assert body["imported"] == 0
    assert body["errors"] == [
        {"row": 1, "reason": "subcategory_name_too_long", "detail": None}
    ]
    sub_count = (
        await db_session.execute(select(func.count()).select_from(Subcategory))
    ).scalar_one()
    assert sub_count == 1  # only the seeded "Pastas"
