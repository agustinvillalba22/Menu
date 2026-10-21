"""
Tests for M21 (Fase 3) backend — multi-menu CRUD, v2 categories, tree and
RF-07 (get_category scoped to the restaurant, not the default menu).

asyncio_mode=auto via pytest.ini.
"""
import uuid

import pytest
from freezegun import freeze_time
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.menu import Category, Menu
from app.models.order import Order

_MON = "2026-09-14"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def as_user(client: AsyncClient, email: str = "owner@example.com") -> dict:
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "full_name": "Owner"},
    )
    token = res.json()["access_token"]
    client.cookies.clear()
    return {"Authorization": f"Bearer {token}"}


async def make_restaurant(client: AsyncClient, headers: dict, name: str = "My Bar") -> dict:
    res = await client.post("/restaurants", json={"name": name}, headers=headers)
    return res.json()


async def list_menus(client, headers, rid) -> list[dict]:
    res = await client.get(f"/restaurants/{rid}/menus", headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


async def default_menu(client, headers, rid) -> dict:
    return next(m for m in await list_menus(client, headers, rid) if m["is_default"])


async def create_menu(client, headers, rid, **body) -> dict:
    body.setdefault("name", "Almuerzo")
    res = await client.post(f"/restaurants/{rid}/menus", json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


async def create_v2_category(client, headers, rid, mid, name="Entradas") -> str:
    res = await client.post(
        f"/restaurants/{rid}/menus/{mid}/categories",
        json={"name": name, "type": "food"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


# ---------------------------------------------------------------------------
# CA-01 / RF-01 / RF-05
# ---------------------------------------------------------------------------


async def test_create_menu_with_schedule_keeps_default(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    before = await default_menu(client, headers, rid)

    res = await client.post(
        f"/restaurants/{rid}/menus",
        json={"name": "Almuerzo", "start_time": "12:00", "end_time": "16:00", "weekday_mask": 31},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["is_default"] is False
    assert body["start_time"] == "12:00:00"
    assert body["end_time"] == "16:00:00"
    assert body["weekday_mask"] == 31
    assert body["categories_count"] == 0
    assert (await default_menu(client, headers, rid))["id"] == before["id"]


async def test_list_menus_sorted_by_name_with_categories_count(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    zeta = await create_menu(client, headers, rid, name="Zeta")
    alfa = await create_menu(client, headers, rid, name="Alfa")
    await create_v2_category(client, headers, rid, zeta["id"], "C1")
    await create_v2_category(client, headers, rid, zeta["id"], "C2")

    menus = await list_menus(client, headers, rid)
    names = [m["name"] for m in menus]
    assert names == sorted(names)
    by_id = {m["id"]: m for m in menus}
    assert by_id[zeta["id"]]["categories_count"] == 2
    assert by_id[alfa["id"]]["categories_count"] == 0


async def test_get_one_menu(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid)
    res = await client.get(f"/restaurants/{rid}/menus/{m['id']}", headers=headers)
    assert res.status_code == 200
    assert res.json()["id"] == m["id"]


async def test_menus_require_editor_role(client: AsyncClient):
    owner = await as_user(client)
    rid = (await make_restaurant(client, owner))["id"]
    other = await as_user(client, "other@example.com")
    res = await client.get(f"/restaurants/{rid}/menus", headers=other)
    assert res.status_code == 403
    res = await client.post(f"/restaurants/{rid}/menus", json={"name": "X"}, headers=other)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# CA-02 / RF-02
# ---------------------------------------------------------------------------


async def test_create_start_without_end_is_incomplete_schedule(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    res = await client.post(
        f"/restaurants/{rid}/menus",
        json={"name": "X", "start_time": "12:00"},
        headers=headers,
    )
    assert res.status_code == 422
    assert "incomplete_schedule" in res.text


async def test_create_end_without_start_is_incomplete_schedule(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    res = await client.post(
        f"/restaurants/{rid}/menus",
        json={"name": "X", "end_time": "12:00"},
        headers=headers,
    )
    assert res.status_code == 422
    assert "incomplete_schedule" in res.text


async def test_create_equal_times_is_invalid_schedule(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    res = await client.post(
        f"/restaurants/{rid}/menus",
        json={"name": "X", "start_time": "12:00", "end_time": "12:00"},
        headers=headers,
    )
    assert res.status_code == 422
    assert "invalid_schedule" in res.text


async def test_create_overnight_window_allowed(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid, start_time="21:00", end_time="02:00")
    assert m["end_time"] == "02:00:00"


@pytest.mark.parametrize("mask", [0, 128, -1])
async def test_create_weekday_mask_out_of_range_422(client: AsyncClient, mask: int):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    res = await client.post(
        f"/restaurants/{rid}/menus",
        json={"name": "X", "weekday_mask": mask},
        headers=headers,
    )
    assert res.status_code == 422


@pytest.mark.parametrize("name", ["", "x" * 121])
async def test_create_name_length_422(client: AsyncClient, name: str):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    res = await client.post(f"/restaurants/{rid}/menus", json={"name": name}, headers=headers)
    assert res.status_code == 422


async def test_create_duplicate_name_case_insensitive_409(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    await create_menu(client, headers, rid, name="Almuerzo")
    res = await client.post(
        f"/restaurants/{rid}/menus", json={"name": "ALMUERZO"}, headers=headers
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "menu_name_taken"


async def test_same_name_in_other_restaurant_ok(client: AsyncClient):
    h1 = await as_user(client, "a@example.com")
    r1 = (await make_restaurant(client, h1, "A"))["id"]
    h2 = await as_user(client, "b@example.com")
    r2 = (await make_restaurant(client, h2, "B"))["id"]
    await create_menu(client, h1, r1, name="Almuerzo")
    res = await client.post(f"/restaurants/{r2}/menus", json={"name": "Almuerzo"}, headers=h2)
    assert res.status_code == 201


async def test_patch_rename_to_taken_name_409(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    await create_menu(client, headers, rid, name="Almuerzo")
    cena = await create_menu(client, headers, rid, name="Cena")
    res = await client.patch(
        f"/restaurants/{rid}/menus/{cena['id']}", json={"name": "almuerzo"}, headers=headers
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "menu_name_taken"


async def test_patch_rename_to_own_name_other_case_ok(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid, name="Cena")
    res = await client.patch(
        f"/restaurants/{rid}/menus/{m['id']}", json={"name": "CENA"}, headers=headers
    )
    assert res.status_code == 200
    assert res.json()["name"] == "CENA"


# --- PATCH schedule semantics (model_fields_set) ---


async def test_patch_unsent_fields_untouched(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(
        client, headers, rid, start_time="12:00", end_time="16:00", weekday_mask=31
    )
    res = await client.patch(
        f"/restaurants/{rid}/menus/{m['id']}", json={"name": "Nuevo"}, headers=headers
    )
    assert res.status_code == 200
    body = res.json()
    assert body["start_time"] == "12:00:00"
    assert body["end_time"] == "16:00:00"
    assert body["weekday_mask"] == 31


async def test_patch_explicit_null_clears_schedule(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(
        client, headers, rid, start_time="12:00", end_time="16:00", weekday_mask=31
    )
    res = await client.patch(
        f"/restaurants/{rid}/menus/{m['id']}",
        json={"start_time": None, "end_time": None, "weekday_mask": None},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["start_time"] is None
    assert body["end_time"] is None
    assert body["weekday_mask"] is None


async def test_patch_clearing_only_one_time_is_incomplete(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid, start_time="12:00", end_time="16:00")
    res = await client.patch(
        f"/restaurants/{rid}/menus/{m['id']}", json={"end_time": None}, headers=headers
    )
    assert res.status_code == 422
    assert "incomplete_schedule" in res.text


async def test_patch_only_end_time_rechecked_against_resulting_state(client: AsyncClient):
    """Resulting state start==end -> invalid_schedule (service re-check)."""
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid, start_time="12:00", end_time="16:00")
    res = await client.patch(
        f"/restaurants/{rid}/menus/{m['id']}", json={"end_time": "12:00"}, headers=headers
    )
    assert res.status_code == 422
    assert "invalid_schedule" in res.text


async def test_patch_setting_schedule_on_unscheduled_menu_sets_both(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid)
    res = await client.patch(
        f"/restaurants/{rid}/menus/{m['id']}",
        json={"start_time": "08:00", "end_time": "11:00"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["start_time"] == "08:00:00"


async def test_patch_weekday_mask_zero_422(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid)
    res = await client.patch(
        f"/restaurants/{rid}/menus/{m['id']}", json={"weekday_mask": 0}, headers=headers
    )
    assert res.status_code == 422


async def test_patch_name_null_is_422(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid)
    res = await client.patch(
        f"/restaurants/{rid}/menus/{m['id']}", json={"name": None}, headers=headers
    )
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# CA-03 / CA-04 / RF-03
# ---------------------------------------------------------------------------


async def test_patch_is_default_true_swaps_default(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    old = await default_menu(client, headers, rid)
    new = await create_menu(client, headers, rid)

    res = await client.patch(
        f"/restaurants/{rid}/menus/{new['id']}", json={"is_default": True}, headers=headers
    )
    assert res.status_code == 200
    assert res.json()["is_default"] is True
    menus = await list_menus(client, headers, rid)
    assert [m["id"] for m in menus if m["is_default"]] == [new["id"]]
    assert old["id"] != new["id"]


async def test_create_with_is_default_true_swaps_default(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    new = await create_menu(client, headers, rid, is_default=True)
    assert new["is_default"] is True
    menus = await list_menus(client, headers, rid)
    assert [m["id"] for m in menus if m["is_default"]] == [new["id"]]


async def test_patch_unset_default_409(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    d = await default_menu(client, headers, rid)
    res = await client.patch(
        f"/restaurants/{rid}/menus/{d['id']}", json={"is_default": False}, headers=headers
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "cannot_unset_default"


async def test_patch_is_default_true_on_default_is_noop_ok(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    d = await default_menu(client, headers, rid)
    res = await client.patch(
        f"/restaurants/{rid}/menus/{d['id']}", json={"is_default": True}, headers=headers
    )
    assert res.status_code == 200
    assert len([m for m in await list_menus(client, headers, rid) if m["is_default"]]) == 1


async def test_patch_is_default_false_on_non_default_is_ok(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid)
    res = await client.patch(
        f"/restaurants/{rid}/menus/{m['id']}", json={"is_default": False}, headers=headers
    )
    assert res.status_code == 200
    assert res.json()["is_default"] is False


# ---------------------------------------------------------------------------
# CA-05 / RF-04
# ---------------------------------------------------------------------------


async def test_delete_non_default_removes_categories(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid)
    cid = await create_v2_category(client, headers, rid, m["id"])

    res = await client.delete(f"/restaurants/{rid}/menus/{m['id']}", headers=headers)
    assert res.status_code == 204
    assert (
        await db_session.execute(select(Category).where(Category.id == uuid.UUID(cid)))
    ).scalar_one_or_none() is None
    res = await client.get(f"/restaurants/{rid}/menus/{m['id']}", headers=headers)
    assert res.status_code == 404


async def test_delete_default_promotes_first_by_name(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    await create_menu(client, headers, rid, name="Zzz")
    bee = await create_menu(client, headers, rid, name="aaa-first")
    d = await default_menu(client, headers, rid)

    res = await client.delete(f"/restaurants/{rid}/menus/{d['id']}", headers=headers)
    assert res.status_code == 204
    menus = await list_menus(client, headers, rid)
    assert len(menus) == 2
    defaults = [m for m in menus if m["is_default"]]
    assert len(defaults) == 1
    assert menus[0]["is_default"] is True  # first by name
    assert bee["name"] in {m["name"] for m in menus}


async def test_delete_last_menu_409(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    d = await default_menu(client, headers, rid)
    res = await client.delete(f"/restaurants/{rid}/menus/{d['id']}", headers=headers)
    assert res.status_code == 409
    assert res.json()["detail"] == "cannot_delete_last_menu"
    assert len(await list_menus(client, headers, rid)) == 1


async def test_delete_menu_keeps_order_with_null_menu_id(
    client: AsyncClient, db_session: AsyncSession
):
    await db_session.execute(text("PRAGMA foreign_keys=ON"))
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    m = await create_menu(client, headers, rid)
    d = await default_menu(client, headers, rid)
    cid = (
        await client.post(
            f"/restaurants/{rid}/categories",
            json={"name": "C", "type": "food"},
            headers=headers,
        )
    ).json()["id"]
    sid = (
        await client.post(
            f"/restaurants/{rid}/categories/{cid}/subcategories",
            json={"name": "S"},
            headers=headers,
        )
    ).json()["id"]
    iid = (
        await client.post(
            f"/restaurants/{rid}/subcategories/{sid}/items",
            json={"name": "Item", "price": "5.00"},
            headers=headers,
        )
    ).json()["id"]
    await client.patch(
        f"/restaurants/{rid}", json={"name": "My Bar", "orders_enabled": True}, headers=headers
    )
    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [{"item_id": iid, "quantity": 1}],
        },
    )
    assert res.status_code == 201, res.text
    oid = uuid.UUID(res.json()["id"])
    order = (await db_session.execute(select(Order).where(Order.id == oid))).scalar_one()
    assert order.menu_id == uuid.UUID(d["id"])

    # Make `m` the default so the order's menu can be deleted.
    r = await client.patch(
        f"/restaurants/{rid}/menus/{m['id']}", json={"is_default": True}, headers=headers
    )
    assert r.status_code == 200
    r = await client.delete(f"/restaurants/{rid}/menus/{d['id']}", headers=headers)
    assert r.status_code == 204

    db_session.expire_all()
    order = (await db_session.execute(select(Order).where(Order.id == oid))).scalar_one()
    assert order.menu_id is None


# ---------------------------------------------------------------------------
# CA-06 / RF-06 / RF-08
# ---------------------------------------------------------------------------


async def test_v2_category_in_non_default_menu_isolated_from_legacy(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid)
    cid = await create_v2_category(client, headers, rid, m["id"], "Solo B")

    legacy = await client.get(f"/restaurants/{rid}/categories", headers=headers)
    assert cid not in [c["id"] for c in legacy.json()]
    v2 = await client.get(f"/restaurants/{rid}/menus/{m['id']}/categories", headers=headers)
    assert [c["id"] for c in v2.json()] == [cid]
    tree = await client.get(f"/restaurants/{rid}/menus/{m['id']}/tree", headers=headers)
    assert tree.status_code == 200
    assert [c["id"] for c in tree.json()] == [cid]
    assert tree.json()[0]["subcategories"] == []


async def test_tree_includes_subcategories_and_default_tree_excludes_other_menu(
    client: AsyncClient,
):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid)
    d = await default_menu(client, headers, rid)
    cid = await create_v2_category(client, headers, rid, m["id"])
    sub = await client.post(
        f"/restaurants/{rid}/categories/{cid}/subcategories",
        json={"name": "Sub"},
        headers=headers,
    )
    assert sub.status_code == 201
    tree = (await client.get(f"/restaurants/{rid}/menus/{m['id']}/tree", headers=headers)).json()
    assert [s["name"] for s in tree[0]["subcategories"]] == ["Sub"]
    dtree = (await client.get(f"/restaurants/{rid}/menus/{d['id']}/tree", headers=headers)).json()
    assert dtree == []


async def test_v2_category_get_patch_delete(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid)
    cid = await create_v2_category(client, headers, rid, m["id"])
    base = f"/restaurants/{rid}/menus/{m['id']}/categories/{cid}"

    assert (await client.get(base, headers=headers)).json()["name"] == "Entradas"
    res = await client.patch(base, json={"name": "Postres"}, headers=headers)
    assert res.status_code == 200 and res.json()["name"] == "Postres"
    assert (await client.delete(base, headers=headers)).status_code == 204
    assert (await client.get(base, headers=headers)).status_code == 404


async def test_legacy_category_routes_still_target_default_menu(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    d = await default_menu(client, headers, rid)
    res = await client.post(
        f"/restaurants/{rid}/categories", json={"name": "L", "type": "drink"}, headers=headers
    )
    assert res.status_code == 201
    v2 = await client.get(f"/restaurants/{rid}/menus/{d['id']}/categories", headers=headers)
    assert [c["name"] for c in v2.json()] == ["L"]
    menus = await list_menus(client, headers, rid)
    assert menus[0]["categories_count"] == 1


# ---------------------------------------------------------------------------
# CA-07 / RF-07 — everything hanging off a non-default menu's category
# ---------------------------------------------------------------------------


async def test_subcategory_item_tag_modifier_on_non_default_menu(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    m = await create_menu(client, headers, rid)
    cid = await create_v2_category(client, headers, rid, m["id"])

    # legacy per-category GET works (get_category scoped to restaurant)
    res = await client.get(f"/restaurants/{rid}/categories/{cid}", headers=headers)
    assert res.status_code == 200

    res = await client.post(
        f"/restaurants/{rid}/categories/{cid}/subcategories",
        json={"name": "Sub"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    sid = res.json()["id"]

    res = await client.get(
        f"/restaurants/{rid}/categories/{cid}/subcategories", headers=headers
    )
    assert res.status_code == 200 and len(res.json()) == 1
    res = await client.patch(
        f"/restaurants/{rid}/categories/{cid}/subcategories/{sid}",
        json={"name": "Sub2"},
        headers=headers,
    )
    assert res.status_code == 200

    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items",
        json={"name": "Plato", "price": "9.50"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    iid = res.json()["id"]

    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/tags",
        json={"name": "vegano"},
        headers=headers,
    )
    assert res.status_code in (200, 201), res.text

    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/modifiers",
        json={"name": "Extra queso", "price_delta": "1.00", "type": "extra"},
        headers=headers,
    )
    assert res.status_code == 201, res.text


async def test_legacy_category_routes_reject_other_restaurant_category(client: AsyncClient):
    h1 = await as_user(client, "a@example.com")
    r1 = (await make_restaurant(client, h1, "A"))["id"]
    h2 = await as_user(client, "b@example.com")
    r2 = (await make_restaurant(client, h2, "B"))["id"]
    m1 = await create_menu(client, h1, r1)
    cid = await create_v2_category(client, h1, r1, m1["id"])
    res = await client.get(f"/restaurants/{r2}/categories/{cid}", headers=h2)
    assert res.status_code == 404
    assert res.json()["detail"] == "category_not_found"
    res = await client.post(
        f"/restaurants/{r2}/categories/{cid}/subcategories", json={"name": "x"}, headers=h2
    )
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# CA-08 / RNF-03
# ---------------------------------------------------------------------------


async def test_menu_of_other_restaurant_is_404_menu_not_found(client: AsyncClient):
    h1 = await as_user(client, "a@example.com")
    r1 = (await make_restaurant(client, h1, "A"))["id"]
    h2 = await as_user(client, "b@example.com")
    r2 = (await make_restaurant(client, h2, "B"))["id"]
    m1 = await create_menu(client, h1, r1)
    cid = await create_v2_category(client, h1, r1, m1["id"])
    mid = m1["id"]

    calls = [
        ("get", f"/restaurants/{r2}/menus/{mid}", None),
        ("patch", f"/restaurants/{r2}/menus/{mid}", {"name": "z"}),
        ("delete", f"/restaurants/{r2}/menus/{mid}", None),
        ("get", f"/restaurants/{r2}/menus/{mid}/tree", None),
        ("get", f"/restaurants/{r2}/menus/{mid}/categories", None),
        ("post", f"/restaurants/{r2}/menus/{mid}/categories", {"name": "z", "type": "food"}),
        ("get", f"/restaurants/{r2}/menus/{mid}/categories/{cid}", None),
        ("patch", f"/restaurants/{r2}/menus/{mid}/categories/{cid}", {"name": "z"}),
        ("delete", f"/restaurants/{r2}/menus/{mid}/categories/{cid}", None),
    ]
    for method, url, body in calls:
        kwargs = {"headers": h2}
        if body is not None:
            kwargs["json"] = body
        res = await getattr(client, method)(url, **kwargs)
        assert res.status_code == 404, (method, url, res.text)
        assert res.json()["detail"] == "menu_not_found", (method, url)
    # Untouched
    assert len(await list_menus(client, h1, r1)) == 2


async def test_unknown_menu_uuid_404(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    res = await client.get(f"/restaurants/{rid}/menus/{uuid.uuid4()}", headers=headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "menu_not_found"


async def test_category_of_other_menu_is_404_category_not_found(client: AsyncClient):
    headers = await as_user(client)
    rid = (await make_restaurant(client, headers))["id"]
    a = await create_menu(client, headers, rid, name="A")
    b = await create_menu(client, headers, rid, name="B")
    cid = await create_v2_category(client, headers, rid, a["id"])
    base = f"/restaurants/{rid}/menus/{b['id']}/categories/{cid}"
    for method, body in [("get", None), ("patch", {"name": "z"}), ("delete", None)]:
        kwargs = {"headers": headers}
        if body is not None:
            kwargs["json"] = body
        res = await getattr(client, method)(base, **kwargs)
        assert res.status_code == 404
        assert res.json()["detail"] == "category_not_found"


# ---------------------------------------------------------------------------
# CA-09 — scheduling integration with created menus
# ---------------------------------------------------------------------------


async def test_scheduled_menu_created_via_api_served_and_stamped(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(settings, "MENU_SCHEDULING_ENABLED", True)
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    # pin tz to UTC
    await client.patch(
        f"/restaurants/{rid}",
        json={"name": "My Bar", "orders_enabled": True},
        headers=headers,
    )
    d = await default_menu(client, headers, rid)
    await client.post(
        f"/restaurants/{rid}/categories", json={"name": "DayCat", "type": "food"}, headers=headers
    )
    lunch = await create_menu(client, headers, rid, start_time="12:00", end_time="16:00")
    lcid = await create_v2_category(client, headers, rid, lunch["id"], "LunchCat")
    sid = (
        await client.post(
            f"/restaurants/{rid}/categories/{lcid}/subcategories",
            json={"name": "S"},
            headers=headers,
        )
    ).json()["id"]
    iid = (
        await client.post(
            f"/restaurants/{rid}/subcategories/{sid}/items",
            json={"name": "Milanesa", "price": "7.00"},
            headers=headers,
        )
    ).json()["id"]
    client.cookies.clear()

    with freeze_time(f"{_MON} 13:00:00"):
        res = await client.get(f"/menu/{qr}")
        assert {c["name"] for c in res.json()["categories"]} == {"LunchCat"}
        order = await client.post(
            f"/menu/{qr}/orders",
            json={
                "customer_name": "Ana",
                "order_type": "mesa",
                "items": [{"item_id": iid, "quantity": 1}],
            },
        )
    assert order.status_code == 201, order.text
    row = (
        await db_session.execute(select(Order).where(Order.id == uuid.UUID(order.json()["id"])))
    ).scalar_one()
    assert row.menu_id == uuid.UUID(lunch["id"])

    with freeze_time(f"{_MON} 18:00:00"):
        res = await client.get(f"/menu/{qr}")
        assert {c["name"] for c in res.json()["categories"]} == {"DayCat"}
    assert d["is_default"] is True


# ---------------------------------------------------------------------------
# DB-level guard (model Index mirrors migration 0015)
# ---------------------------------------------------------------------------


async def test_db_unique_index_lower_name_per_restaurant(
    client: AsyncClient, db_session: AsyncSession
):
    from sqlalchemy.exc import IntegrityError

    headers = await as_user(client)
    rid = uuid.UUID((await make_restaurant(client, headers))["id"])
    db_session.add(Menu(name="Dup", restaurant_id=rid))
    await db_session.commit()
    db_session.add(Menu(name="dUP", restaurant_id=rid))
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()
