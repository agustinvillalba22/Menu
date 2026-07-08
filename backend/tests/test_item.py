"""
Tests for M3.3 — Items & Tags.

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.

Identidad en los tests: igual que test_category.py — ``as_user`` registra un
usuario, limpia cookies y devuelve el header Bearer para controlar la identidad.

Decisiones cerradas:
- PA-01: tag duplicado (mismo name en el ítem) → idempotente, 200 con el tag
  existente, no crea un segundo.
- PA-02: description vacía permitida (default "").
- price SIEMPRE JSON string, nunca number.
"""
import uuid

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import ItemTag


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


async def make_subcategory(
    client: AsyncClient, headers: dict, rid: str, cat: str = "Platos"
) -> str:
    created = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": cat, "type": "food"},
        headers=headers,
    )
    category_id = created.json()["id"]
    sub = await client.post(
        f"/restaurants/{rid}/categories/{category_id}/subcategories",
        json={"name": "Pastas"},
        headers=headers,
    )
    return sub.json()["id"]


async def make_item(
    client: AsyncClient,
    headers: dict,
    rid: str,
    sid: str,
    name: str = "Ravioles",
    price: str = "1200.50",
) -> dict:
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items",
        json={"name": name, "description": "", "price": price},
        headers=headers,
    )
    return res


# ---------------------------------------------------------------------------
# CA-01: crear ítem, price "1200.50" → sale "1200.50", tags []
# ---------------------------------------------------------------------------


async def test_create_item(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)

    res = await make_item(client, headers, rid, sid, price="1200.50")
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Ravioles"
    assert body["description"] == ""
    assert body["price"] == "1200.50"
    assert body["subcategory_id"] == sid
    assert body["tags"] == []
    uuid.UUID(body["id"])


# ---------------------------------------------------------------------------
# CA-02: price "10.999" → 422
# ---------------------------------------------------------------------------


async def test_price_too_many_decimals_422(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)

    res = await make_item(client, headers, rid, sid, price="10.999")
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# CA-03: price "-1" → 422
# ---------------------------------------------------------------------------


async def test_price_negative_422(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)

    res = await make_item(client, headers, rid, sid, price="-1")
    assert res.status_code == 422


async def test_price_not_numeric_422(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)

    res = await make_item(client, headers, rid, sid, price="abc")
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# CA-04: price "9" → sale "9.00"
# ---------------------------------------------------------------------------


async def test_price_integer_normalized_to_two_decimals(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)

    res = await make_item(client, headers, rid, sid, price="9")
    assert res.status_code == 201
    assert res.json()["price"] == "9.00"


# ---------------------------------------------------------------------------
# CA-05: agregar tag → aparece en GET del ítem
# ---------------------------------------------------------------------------


async def test_add_tag_appears_in_get(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    item_id = (await make_item(client, headers, rid, sid)).json()["id"]

    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}/tags",
        json={"name": "vegano"},
        headers=headers,
    )
    assert res.status_code == 201
    tag = res.json()
    assert tag["name"] == "vegano"
    uuid.UUID(tag["id"])

    got = await client.get(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}",
        headers=headers,
    )
    assert got.status_code == 200
    tags = got.json()["tags"]
    assert [t["name"] for t in tags] == ["vegano"]


# ---------------------------------------------------------------------------
# CA-06: quitar tag → 204, ya no aparece
# ---------------------------------------------------------------------------


async def test_remove_tag(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    item_id = (await make_item(client, headers, rid, sid)).json()["id"]

    tag = (
        await client.post(
            f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}/tags",
            json={"name": "vegano"},
            headers=headers,
        )
    ).json()

    res = await client.delete(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}/tags/{tag['id']}",
        headers=headers,
    )
    assert res.status_code == 204
    assert res.content == b""

    got = await client.get(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}",
        headers=headers,
    )
    assert got.json()["tags"] == []


async def test_remove_tag_not_belonging_404(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    item_id = (await make_item(client, headers, rid, sid)).json()["id"]
    ghost = str(uuid.uuid4())

    res = await client.delete(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}/tags/{ghost}",
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "tag_not_found"


# ---------------------------------------------------------------------------
# CA-07: item de otra subcategory → 404 item_not_found
# ---------------------------------------------------------------------------


async def test_item_of_other_subcategory_not_found(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid_a = await make_subcategory(client, headers, rid, cat="Comidas")
    sid_b = await make_subcategory(client, headers, rid, cat="Bebidas")

    item_id = (await make_item(client, headers, rid, sid_a)).json()["id"]

    res = await client.get(
        f"/restaurants/{rid}/subcategories/{sid_b}/items/{item_id}",
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "item_not_found"


async def test_subcategory_of_other_restaurant_not_found(client: AsyncClient):
    headers = await as_user(client)
    rid_a = await make_restaurant(client, headers, name="Bar A")
    rid_b = await make_restaurant(client, headers, name="Bar B")
    sid_a = await make_subcategory(client, headers, rid_a)

    res = await client.get(
        f"/restaurants/{rid_b}/subcategories/{sid_a}/items",
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "subcategory_not_found"


# ---------------------------------------------------------------------------
# CA-08: price es JSON string siempre (isinstance check)
# ---------------------------------------------------------------------------


async def test_price_is_json_string(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)

    body = (await make_item(client, headers, rid, sid, price="9")).json()
    assert isinstance(body["price"], str)

    # también en la colección
    listed = (
        await client.get(
            f"/restaurants/{rid}/subcategories/{sid}/items", headers=headers
        )
    ).json()
    assert isinstance(listed[0]["price"], str)


# ---------------------------------------------------------------------------
# Extra: tag duplicado (mismo name) → 200 (no 201), no crea un segundo tag
# ---------------------------------------------------------------------------


async def test_duplicate_tag_is_idempotent(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    item_id = (await make_item(client, headers, rid, sid)).json()["id"]

    first = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}/tags",
        json={"name": "vegano"},
        headers=headers,
    )
    assert first.status_code == 201

    second = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}/tags",
        json={"name": "vegano"},
        headers=headers,
    )
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]

    count = (
        await db_session.execute(
            select(func.count())
            .select_from(ItemTag)
            .where(ItemTag.item_id == uuid.UUID(item_id))
        )
    ).scalar_one()
    assert count == 1


# ---------------------------------------------------------------------------
# M12.2 — CA-01: unicidad de tags case-insensitive y trimmed
# ---------------------------------------------------------------------------


async def test_add_tag_case_insensitive_variant_is_idempotent(
    client: AsyncClient, db_session: AsyncSession
):
    """Agregar 'Vegano' cuando ya existe 'vegano' en el mismo ítem devuelve
    200 (no 201) con el tag existente, sin crear un segundo registro."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    item_id = (await make_item(client, headers, rid, sid)).json()["id"]

    first = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}/tags",
        json={"name": "vegano"},
        headers=headers,
    )
    assert first.status_code == 201

    second = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}/tags",
        json={"name": "Vegano"},
        headers=headers,
    )
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]

    count = (
        await db_session.execute(
            select(func.count())
            .select_from(ItemTag)
            .where(ItemTag.item_id == uuid.UUID(item_id))
        )
    ).scalar_one()
    assert count == 1


async def test_add_tag_case_insensitive_trimmed_variant_is_idempotent(
    client: AsyncClient, db_session: AsyncSession
):
    """La comparación también ignora espacios: '  Vegano  ' matchea 'vegano'."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    item_id = (await make_item(client, headers, rid, sid)).json()["id"]

    first = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}/tags",
        json={"name": "vegano"},
        headers=headers,
    )
    assert first.status_code == 201

    second = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}/tags",
        json={"name": "  Vegano  "},
        headers=headers,
    )
    assert second.status_code == 200

    count = (
        await db_session.execute(
            select(func.count())
            .select_from(ItemTag)
            .where(ItemTag.item_id == uuid.UUID(item_id))
        )
    ).scalar_one()
    assert count == 1


# ---------------------------------------------------------------------------
# Extra: PATCH parcial persiste
# ---------------------------------------------------------------------------


async def test_patch_item_partial(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    item_id = (await make_item(client, headers, rid, sid, price="9")).json()["id"]

    res = await client.patch(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}",
        json={"price": "15.50"},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["price"] == "15.50"
    assert body["name"] == "Ravioles"  # sin cambios


# ---------------------------------------------------------------------------
# Fix 1: PATCH con null explícito en campos NOT NULL → no rompe con 500
# ---------------------------------------------------------------------------


async def test_patch_item_explicit_null_price_is_ignored(client: AsyncClient):
    """PATCH {"price": null} sobre una columna NOT NULL: se ignora
    silenciosamente (no-op), el price no cambia y NUNCA devuelve 500."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    item_id = (await make_item(client, headers, rid, sid, price="9")).json()["id"]

    res = await client.patch(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}",
        json={"price": None},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["price"] == "9.00"  # sin cambios
    assert body["name"] == "Ravioles"


async def test_patch_item_explicit_null_name_is_ignored(client: AsyncClient):
    """Idem para name: null explícito no nulea la columna NOT NULL."""
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    item_id = (await make_item(client, headers, rid, sid)).json()["id"]

    res = await client.patch(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}",
        json={"name": None},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Ravioles"


# ---------------------------------------------------------------------------
# Fix 2: unique constraint (item_id, name) a nivel DB como red de seguridad
# ---------------------------------------------------------------------------


async def test_item_tag_unique_constraint_enforced(
    client: AsyncClient, db_session: AsyncSession
):
    """La constraint uq_item_tag rechaza un segundo (item_id, name) idéntico
    insertado por fuera del chequeo SELECT-then-INSERT del servicio. Esto es
    la red de seguridad que respalda el except IntegrityError de add_tag.

    Nota: simular la carrera real concurrente con SQLite in-memory async
    (una sola conexión StaticPool compartida) sería un test frágil; se cubre
    en su lugar la garantía a nivel DB que dispara el branch de rollback.
    """
    from sqlalchemy.exc import IntegrityError

    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    item_id = uuid.UUID((await make_item(client, headers, rid, sid)).json()["id"])

    db_session.add(ItemTag(name="vegano", item_id=item_id))
    await db_session.commit()

    db_session.add(ItemTag(name="vegano", item_id=item_id))
    try:
        await db_session.commit()
        raised = False
    except IntegrityError:
        raised = True
        await db_session.rollback()
    assert raised, "se esperaba IntegrityError por uq_item_tag"


# ---------------------------------------------------------------------------
# M12.3: índice único case-insensitive (item_id, lower(name)) a nivel DB
# ---------------------------------------------------------------------------


async def test_item_tags_table_created_with_ci_index_on_sqlite(
    db_session: AsyncSession,
):
    """CA-01: Base.metadata.create_all (SQLite in-memory, como en conftest)
    crea la tabla item_tags sin error con el nuevo índice de expresión
    uq_item_tag_ci. La creación exitosa de `db_session` (que depende de
    test_engine -> create_all) ya es la prueba: si el índice no fuera válido
    en SQLite, el fixture fallaría antes de llegar a este assert.
    """
    result = await db_session.execute(
        select(func.count()).select_from(ItemTag)
    )
    assert result.scalar_one() == 0


async def test_item_tag_unique_constraint_case_insensitive_enforced(
    client: AsyncClient, db_session: AsyncSession
):
    """CA-02: dos ItemTag del mismo item_id que difieren solo en mayúsculas/
    minúsculas ("vegano" / "Vegano") violan la constraint única a nivel DB.
    Insert directo vía db_session, bypaseando add_tag, para probar la
    constraint de DB en sí (uq_item_tag_ci sobre (item_id, lower(name))),
    no la lógica de servicio (ya cubierta en M12.2).
    """
    from sqlalchemy.exc import IntegrityError

    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    item_id = uuid.UUID((await make_item(client, headers, rid, sid)).json()["id"])

    db_session.add(ItemTag(name="vegano", item_id=item_id))
    await db_session.commit()

    db_session.add(ItemTag(name="Vegano", item_id=item_id))
    try:
        await db_session.commit()
        raised = False
    except IntegrityError:
        raised = True
        await db_session.rollback()
    assert raised, "se esperaba IntegrityError por uq_item_tag_ci (case-insensitive)"


# ---------------------------------------------------------------------------
# Extra: DELETE ítem → 204
# ---------------------------------------------------------------------------


async def test_delete_item(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    item_id = (await make_item(client, headers, rid, sid)).json()["id"]

    res = await client.delete(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}", headers=headers
    )
    assert res.status_code == 204

    got = await client.get(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}", headers=headers
    )
    assert got.status_code == 404
