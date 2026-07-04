"""
Tests for M3.4 — CSV import.

Additive bulk import: category/subcategory matched by name (case-insensitive +
trim) against the restaurant's existing menu. Never auto-creates categories or
subcategories. Row-level errors do not abort the import; a single commit is
issued at the end. ``row`` is 1-based over the DATA rows (header excluded).

CSVs are built in-memory as strings — no file on disk is needed.
"""
import uuid

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item, ItemTag


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def as_user(
    client: AsyncClient,
    email: str = "owner@example.com",
    password: str = "password123",
    full_name: str = "Owner User",
) -> dict:
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
    )
    token = res.json()["access_token"]
    client.cookies.clear()
    return {"Authorization": f"Bearer {token}"}


async def make_restaurant(
    client: AsyncClient, headers: dict, name: str = "My Bar"
) -> str:
    res = await client.post("/restaurants", json={"name": name}, headers=headers)
    return res.json()["id"]


async def make_category(
    client: AsyncClient, headers: dict, rid: str, name: str, type_: str = "food"
) -> str:
    res = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": name, "type": type_},
        headers=headers,
    )
    return res.json()["id"]


async def make_subcategory(
    client: AsyncClient, headers: dict, rid: str, category_id: str, name: str
) -> str:
    res = await client.post(
        f"/restaurants/{rid}/categories/{category_id}/subcategories",
        json={"name": name},
        headers=headers,
    )
    return res.json()["id"]


async def seed_menu(client: AsyncClient, headers: dict, rid: str) -> None:
    """Category 'Platos' > Subcategory 'Pastas'."""
    cat = await make_category(client, headers, rid, "Platos")
    await make_subcategory(client, headers, rid, cat, "Pastas")


def post_csv(
    client: AsyncClient, rid: str, headers: dict, csv_text: str
):
    return client.post(
        f"/restaurants/{rid}/items/import",
        files={"file": ("data.csv", csv_text.encode("utf-8"), "text/csv")},
        headers=headers,
    )


async def count_items(session: AsyncSession) -> int:
    return (
        await session.execute(select(func.count()).select_from(Item))
    ).scalar_one()


HEADER = "category,subcategory,name,description,price,tags\n"


# ---------------------------------------------------------------------------
# CA-01: 3 filas válidas → {"imported":3,"errors":[]}, existen 3 ítems
# ---------------------------------------------------------------------------


async def test_import_three_valid_rows(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = HEADER + (
        "Platos,Pastas,Ravioles,Caseros,1200.50,\n"
        "Platos,Pastas,Ñoquis,,900,\n"
        "Platos,Pastas,Lasaña,Boloñesa,1500.00,\n"
    )
    res = await post_csv(client, rid, headers, csv_text)
    assert res.status_code == 200
    assert res.json() == {"imported": 3, "errors": []}
    assert await count_items(db_session) == 3


# ---------------------------------------------------------------------------
# CA-02: fila 2 con price inválido → imported=2, error en row 2, 1 y 3 se crean
# ---------------------------------------------------------------------------


async def test_invalid_price_row_fails_others_created(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = HEADER + (
        "Platos,Pastas,Ravioles,,1200.50,\n"
        "Platos,Pastas,Ñoquis,,10.999,\n"
        "Platos,Pastas,Lasaña,,1500.00,\n"
    )
    res = await post_csv(client, rid, headers, csv_text)
    assert res.status_code == 200
    body = res.json()
    assert body["imported"] == 2
    assert len(body["errors"]) == 1
    assert body["errors"][0]["row"] == 2
    assert body["errors"][0]["reason"] == "invalid_price"

    names = (
        await db_session.execute(select(Item.name).order_by(Item.name))
    ).scalars().all()
    assert set(names) == {"Ravioles", "Lasaña"}


# ---------------------------------------------------------------------------
# CA-03: subcategoría inexistente → subcategory_not_found, no crea ítem
# ---------------------------------------------------------------------------


async def test_missing_subcategory(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = HEADER + "Platos,Milanesas,Napolitana,,1800,\n"
    res = await post_csv(client, rid, headers, csv_text)
    assert res.status_code == 200
    body = res.json()
    assert body["imported"] == 0
    assert body["errors"] == [
        {"row": 1, "reason": "subcategory_not_found", "detail": None}
    ]
    assert await count_items(db_session) == 0


async def test_missing_category(client: AsyncClient, db_session: AsyncSession):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = HEADER + "Bebidas,Pastas,Ravioles,,1800,\n"
    res = await post_csv(client, rid, headers, csv_text)
    assert res.status_code == 200
    assert res.json()["errors"][0]["reason"] == "category_not_found"
    assert await count_items(db_session) == 0


# ---------------------------------------------------------------------------
# CA-04: importar dos veces el mismo name → 2 ítems (aditivo, sin dedupe)
# ---------------------------------------------------------------------------


async def test_import_is_additive_no_dedupe(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = HEADER + "Platos,Pastas,Ravioles,,1200,\n"
    first = await post_csv(client, rid, headers, csv_text)
    second = await post_csv(client, rid, headers, csv_text)
    assert first.json()["imported"] == 1
    assert second.json()["imported"] == 1
    assert await count_items(db_session) == 2


# ---------------------------------------------------------------------------
# CA-05: tags "vegano;sin tacc" → ítem con 2 tags
# ---------------------------------------------------------------------------


async def test_tags_parsed(client: AsyncClient, db_session: AsyncSession):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = HEADER + "Platos,Pastas,Ravioles,,1200,vegano;sin tacc\n"
    res = await post_csv(client, rid, headers, csv_text)
    assert res.json()["imported"] == 1

    tag_names = (
        await db_session.execute(select(ItemTag.name).order_by(ItemTag.name))
    ).scalars().all()
    assert set(tag_names) == {"vegano", "sin tacc"}


async def test_empty_tags_no_tags(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = HEADER + "Platos,Pastas,Ravioles,,1200,\n"
    await post_csv(client, rid, headers, csv_text)
    count = (
        await db_session.execute(select(func.count()).select_from(ItemTag))
    ).scalar_one()
    assert count == 0


# ---------------------------------------------------------------------------
# CA-06: header sin columnas requeridas → 422 invalid_csv_header
# ---------------------------------------------------------------------------


async def test_missing_required_columns_422(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    # falta la columna "price"
    csv_text = "category,subcategory,name\nPlatos,Pastas,Ravioles\n"
    res = await post_csv(client, rid, headers, csv_text)
    assert res.status_code == 422
    assert res.json()["detail"] == "invalid_csv_header"


# ---------------------------------------------------------------------------
# CA-07: editor de otro restaurant → 403
# ---------------------------------------------------------------------------


async def test_other_restaurant_editor_403(client: AsyncClient):
    owner = await as_user(client, email="owner@example.com")
    rid = await make_restaurant(client, owner)
    await seed_menu(client, owner, rid)

    stranger = await as_user(client, email="stranger@example.com")
    csv_text = HEADER + "Platos,Pastas,Ravioles,,1200,\n"
    res = await post_csv(client, rid, stranger, csv_text)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# CA-08: row es 1-based sobre las filas de datos
# ---------------------------------------------------------------------------


async def test_row_is_one_based_over_data_rows(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    # primera fila de datos inválida → row debe ser 1 (no 2 por el header)
    csv_text = HEADER + (
        "Platos,Pastas,SinPrecio,,abc,\n"
        "Platos,Pastas,Ok,,1200,\n"
    )
    res = await post_csv(client, rid, headers, csv_text)
    errors = res.json()["errors"]
    assert errors[0]["row"] == 1
    assert errors[0]["reason"] == "invalid_price"


async def test_missing_name_reason(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = HEADER + "Platos,Pastas,,,1200,\n"
    res = await post_csv(client, rid, headers, csv_text)
    body = res.json()
    assert body["imported"] == 0
    assert body["errors"][0]["reason"] == "missing_name"


# ---------------------------------------------------------------------------
# Extra: casing/espacios distintos igual matchean (case-insensitive + trim)
# ---------------------------------------------------------------------------


async def test_case_insensitive_and_trimmed_matching(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)  # "Platos" / "Pastas"

    csv_text = HEADER + "  PLATOS ,  pAsTaS  ,Ravioles,,1200,\n"
    res = await post_csv(client, rid, headers, csv_text)
    assert res.status_code == 200
    assert res.json() == {"imported": 1, "errors": []}
    assert await count_items(db_session) == 1


# ---------------------------------------------------------------------------
# Extra: falta el campo file → 422
# ---------------------------------------------------------------------------


async def test_missing_file_field_422(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    res = await client.post(
        f"/restaurants/{rid}/items/import", headers=headers
    )
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Extra: header con distinto orden/casing igual es válido
# ---------------------------------------------------------------------------


async def test_header_reordered_case_insensitive(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    csv_text = (
        "Name,PRICE, Category ,Subcategory,Tags,Description\n"
        "Ravioles,1200,Platos,Pastas,vegano,Caseros\n"
    )
    res = await post_csv(client, rid, headers, csv_text)
    assert res.status_code == 200
    assert res.json()["imported"] == 1
    item = (await db_session.execute(select(Item))).scalar_one()
    assert item.description == "Caseros"


# ---------------------------------------------------------------------------
# Extra: bytes no decodificables como UTF-8 → 422 invalid_csv
# ---------------------------------------------------------------------------


async def test_non_utf8_bytes_422(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)

    res = await client.post(
        f"/restaurants/{rid}/items/import",
        files={"file": ("data.csv", b"\xff\xfe\x00bad", "text/csv")},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "invalid_csv"
