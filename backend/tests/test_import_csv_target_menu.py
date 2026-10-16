"""
Tests for M26 (backend) — CSV import with an optional target menu, plus
GET /admin/restaurants/{id}/menus. Covers CA-01..CA-05 of
``.agents/specs/M26_csv_import_target_menu.md``.
"""
import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.menu import Category, Menu
from tests.test_admin import as_superadmin as admin_as_superadmin
from tests.test_admin import as_user as admin_as_user
from tests.test_import_csv import (
    HEADER,
    as_superadmin,
    count_items,
    make_restaurant,
    seed_menu,
)


def post_csv(client, rid, headers, csv_text, create_missing=None, menu_id=None):
    data = {}
    if create_missing is not None:
        data["create_missing"] = "true" if create_missing else "false"
    if menu_id is not None:
        data["menu_id"] = str(menu_id)
    return client.post(
        f"/restaurants/{rid}/items/import",
        files={"file": ("data.csv", csv_text.encode("utf-8"), "text/csv")},
        data=data,
        headers=headers,
    )


async def create_menu(client, headers, rid, name="Almuerzo") -> str:
    res = await client.post(
        f"/restaurants/{rid}/menus", json={"name": name}, headers=headers
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def cat_names(session: AsyncSession, menu_id) -> set[str]:
    rows = await session.execute(
        select(Category.name).where(Category.menu_id == uuid.UUID(str(menu_id)))
    )
    return {r[0] for r in rows.all()}


async def default_menu_id(session: AsyncSession, rid) -> uuid.UUID:
    return (
        await session.execute(
            select(Menu.id).where(
                Menu.restaurant_id == uuid.UUID(rid), Menu.is_default.is_(True)
            )
        )
    ).scalar_one()


async def test_create_missing_true_with_menu_id_creates_in_target_only(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)
    mid = await create_menu(client, headers, rid)

    res = await post_csv(
        client, rid, headers, HEADER + "Bebidas,Calientes,Cafe,,1200,\n",
        create_missing=True, menu_id=mid,
    )
    assert res.status_code == 200, res.text
    assert res.json() == {"imported": 1, "errors": []}
    assert await cat_names(db_session, mid) == {"Bebidas"}
    assert await cat_names(db_session, await default_menu_id(db_session, rid)) == {
        "Platos"
    }


async def test_menu_id_false_resolves_only_against_target(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)  # Platos > Pastas in default
    mid = await create_menu(client, headers, rid)

    res = await post_csv(
        client, rid, headers, HEADER + "Platos,Pastas,Ravioles,,2000,\n",
        create_missing=False, menu_id=mid,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["imported"] == 0
    assert body["errors"] == [
        {"row": 1, "reason": "category_not_found", "detail": None}
    ]
    assert await count_items(db_session) == 0


async def test_menu_id_unknown_404_even_without_create_missing(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    await seed_menu(client, headers, rid)
    for cm in (False, True):
        res = await post_csv(
            client, rid, headers, HEADER + "Platos,Pastas,Ravioles,,2000,\n",
            create_missing=cm, menu_id=uuid.uuid4(),
        )
        assert res.status_code == 404
        assert res.json()["detail"] == "menu_not_found"
    assert await count_items(db_session) == 0


async def test_menu_id_of_other_restaurant_404(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers, "A")
    other = await make_restaurant(client, headers, "B")
    other_mid = await create_menu(client, headers, other)
    await seed_menu(client, headers, rid)

    res = await post_csv(
        client, rid, headers, HEADER + "Platos,Pastas,Ravioles,,2000,\n",
        create_missing=True, menu_id=other_mid,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "menu_not_found"
    assert await count_items(db_session) == 0


async def test_menu_id_invalid_format_422(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    res = await client.post(
        f"/restaurants/{rid}/items/import",
        files={"file": ("d.csv", (HEADER).encode(), "text/csv")},
        data={"menu_id": "not-a-uuid"},
        headers=headers,
    )
    assert res.status_code == 422


async def test_menu_id_omitted_still_uses_default(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_superadmin(client, db_session)
    rid = await make_restaurant(client, headers)
    res = await post_csv(
        client, rid, headers, HEADER + "Bebidas,Calientes,Cafe,,1200,\n",
        create_missing=True,
    )
    assert res.status_code == 200
    assert await cat_names(db_session, await default_menu_id(db_session, rid)) == {
        "Bebidas"
    }


# --- GET /admin/restaurants/{id}/menus (CA-05) ---


async def test_admin_list_menus_superadmin_not_member(
    client: AsyncClient, db_session: AsyncSession
):
    owner = await admin_as_user(client, email="owner2@example.com")
    rid = await make_restaurant(client, owner)
    mid = await create_menu(client, owner, rid)
    admin = await admin_as_superadmin(client, db_session, email="root@example.com")

    res = await client.get(f"/admin/restaurants/{rid}/menus", headers=admin)
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body) == 2
    assert mid in {m["id"] for m in body}
    assert sum(1 for m in body if m["is_default"]) == 1
    assert {"id", "name", "is_default", "categories_count"} <= set(body[0])


async def test_admin_list_menus_non_superadmin_403(
    client: AsyncClient, db_session: AsyncSession
):
    owner = await admin_as_user(client, email="owner3@example.com")
    rid = await make_restaurant(client, owner)
    res = await client.get(f"/admin/restaurants/{rid}/menus", headers=owner)
    assert res.status_code == 403


async def test_admin_list_menus_unauthenticated_401(client: AsyncClient):
    res = await client.get(f"/admin/restaurants/{uuid.uuid4()}/menus")
    assert res.status_code == 401


async def test_admin_list_menus_unknown_restaurant_404(
    client: AsyncClient, db_session: AsyncSession
):
    admin = await admin_as_superadmin(client, db_session)
    res = await client.get(f"/admin/restaurants/{uuid.uuid4()}/menus", headers=admin)
    assert res.status_code == 404
    assert res.json()["detail"] == "restaurant_not_found"
