"""
Tests for Fase 2c/2d (P4/P5) — promo CRUD, public active-promo resolution,
days_remaining, and the R2 image upload flow.

Storage is mocked at the boto3 boundary (`app.services.storage`), exactly
like test_item_image.py / the logo tests.

Window strategy: restaurants created via the API have no explicit timezone,
so the settings.DEFAULT_TIMEZONE fallback applies — every validity window
below spans *whole UTC days* so the assertion is tz-fallback-insensitive.
2026-09-14 (Monday) is the frozen anchor, same as test_menu_scheduling.py.
"""
import uuid
from unittest.mock import AsyncMock, patch

from freezegun import freeze_time
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

STORAGE = "app.services.storage"
VALID_CONTENT_TYPE = "image/jpeg"
VALID_SIZE = 1000

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


async def make_restaurant(
    client: AsyncClient, headers: dict, name: str = "My Bar"
) -> dict:
    res = await client.post("/restaurants", json={"name": name}, headers=headers)
    return res.json()


async def make_item(client: AsyncClient, headers: dict, rid: str) -> str:
    res = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": "Platos", "type": "food"},
        headers=headers,
    )
    cid = res.json()["id"]
    res = await client.post(
        f"/restaurants/{rid}/categories/{cid}/subcategories",
        json={"name": "Pastas"},
        headers=headers,
    )
    sid = res.json()["id"]
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items",
        json={"name": "Ravioles", "description": "", "price": "10.00"},
        headers=headers,
    )
    return res.json()["id"]


async def make_promo(
    client: AsyncClient,
    headers: dict,
    rid: str,
    **overrides,
) -> dict:
    payload = {
        "title": "2x1 Pizzas",
        "subtitle": "Solo hoy",
        "discount_pct": 50,
        "is_active": True,
        **overrides,
    }
    res = await client.post(
        f"/restaurants/{rid}/promos", json=payload, headers=headers
    )
    assert res.status_code == 201, res.text
    return res.json()


def mock_generate_upload_url(return_value: str = "https://fake/signed?sig=abc"):
    return patch(
        f"{STORAGE}.generate_upload_url",
        new=AsyncMock(return_value=return_value),
    )


def mock_head_image_object(meta: dict | None):
    return patch(
        f"{STORAGE}.head_image_object",
        new=AsyncMock(return_value=meta),
    )


def mock_delete_image_object():
    return patch(
        f"{STORAGE}.delete_image_object",
        new=AsyncMock(return_value=None),
    )


async def public_promo(client: AsyncClient, qr: str) -> dict | None:
    res = await client.get(f"/menu/{qr}")
    assert res.status_code == 200, res.text
    return res.json()["promo"]


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


async def test_create_and_list_promos(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    promo = await make_promo(client, headers, rid, is_active=False)
    assert promo["title"] == "2x1 Pizzas"
    assert promo["discount_pct"] == 50
    assert promo["is_active"] is False
    assert promo["days_remaining"] is None  # no ends_at

    res = await client.get(f"/restaurants/{rid}/promos", headers=headers)
    assert res.status_code == 200
    assert [p["id"] for p in res.json()] == [promo["id"]]


async def test_patch_promo_partial(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    promo = await make_promo(client, headers, rid)

    res = await client.patch(
        f"/restaurants/{rid}/promos/{promo['id']}",
        json={"title": "3x1 Pizzas", "discount_pct": 30},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["title"] == "3x1 Pizzas"
    assert body["discount_pct"] == 30
    assert body["subtitle"] == "Solo hoy"  # untouched


async def test_delete_promo(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    promo = await make_promo(client, headers, rid)

    res = await client.delete(
        f"/restaurants/{rid}/promos/{promo['id']}", headers=headers
    )
    assert res.status_code == 204
    res = await client.get(f"/restaurants/{rid}/promos", headers=headers)
    assert res.json() == []


async def test_promo_not_found_404(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    res = await client.get(
        f"/restaurants/{rid}/promos/{uuid.uuid4()}", headers=headers
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "promo_not_found"


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


async def test_discount_pct_out_of_range_422(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    res = await client.post(
        f"/restaurants/{rid}/promos",
        json={"title": "X", "discount_pct": 101},
        headers=headers,
    )
    assert res.status_code == 422


async def test_inverted_window_422(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    res = await client.post(
        f"/restaurants/{rid}/promos",
        json={
            "title": "X",
            "starts_at": "2026-09-16T00:00:00Z",
            "ends_at": "2026-09-13T00:00:00Z",
        },
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "invalid_promo_window"


async def test_naive_datetime_422(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    res = await client.post(
        f"/restaurants/{rid}/promos",
        json={"title": "X", "ends_at": "2026-09-16T00:00:00"},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "naive_datetime"


async def test_patch_window_checked_against_stored_start(client: AsyncClient):
    """PATCHing only ends_at must be validated against the stored starts_at."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    promo = await make_promo(
        client,
        headers,
        rid,
        starts_at="2026-09-15T00:00:00Z",
        ends_at="2026-09-20T00:00:00Z",
    )

    res = await client.patch(
        f"/restaurants/{rid}/promos/{promo['id']}",
        json={"ends_at": "2026-09-14T00:00:00Z"},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "invalid_promo_window"


async def test_item_from_other_restaurant_404(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    # Second owner+restaurant for the cross-restaurant item.
    other_headers = await as_user(client, email="other@example.com")
    other_restaurant = await make_restaurant(client, other_headers, name="Other")
    foreign_item = await make_item(client, other_headers, other_restaurant["id"])

    res = await client.post(
        f"/restaurants/{restaurant['id']}/promos",
        json={
            "title": "X",
            "scope": "item",
            "discount_pct": 20,
            "item_id": foreign_item,
        },
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "item_not_found"


async def test_own_item_accepted(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    item_id = await make_item(client, headers, rid)

    promo = await make_promo(
        client, headers, rid, scope="item", item_id=item_id
    )
    assert promo["item_id"] == item_id
    assert promo["scope"] == "item"


# ---------------------------------------------------------------------------
# P5 — days_remaining
# ---------------------------------------------------------------------------


async def test_days_remaining_computed_server_side(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    promo = await make_promo(
        client,
        headers,
        rid,
        ends_at="2026-09-17T12:00:00Z",
    )
    with freeze_time(f"{_MON}T12:00:00Z"):
        res = await client.get(
            f"/restaurants/{rid}/promos/{promo['id']}", headers=headers
        )
    # Whole-day window: 14 -> 17 is 3 calendar days in any sane tz fallback.
    assert res.json()["days_remaining"] == 3


# ---------------------------------------------------------------------------
# Public — active promo resolution
# ---------------------------------------------------------------------------


async def test_public_promo_active_in_window(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    item_id = await make_item(client, headers, rid)
    await make_promo(
        client,
        headers,
        rid,
        scope="item",
        item_id=item_id,
        starts_at="2026-09-13T00:00:00Z",
        ends_at="2026-09-16T00:00:00Z",
    )

    with freeze_time(f"{_MON}T12:00:00Z"):
        promo = await public_promo(client, qr)
    assert promo is not None
    assert promo["title"] == "2x1 Pizzas"
    assert promo["discount_pct"] == 50
    assert promo["item_id"] == item_id
    # Scheduling internals never leak to the public payload.
    assert "is_active" not in promo
    assert "starts_at" not in promo
    assert "ends_at" not in promo
    assert "days_remaining" not in promo


async def test_public_promo_null_when_inactive_flag(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await make_promo(
        client, headers, rid, is_active=False  # window matches, flag off
    )

    with freeze_time(f"{_MON}T12:00:00Z"):
        assert await public_promo(client, qr) is None


async def test_public_promo_null_when_out_of_window(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await make_promo(
        client,
        headers,
        rid,
        starts_at="2026-09-10T00:00:00Z",
        ends_at="2026-09-11T00:00:00Z",
    )

    with freeze_time(f"{_MON}T12:00:00Z"):
        assert await public_promo(client, qr) is None


async def test_public_promo_null_when_none_exists(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    qr = restaurant["qr_token"]

    with freeze_time(f"{_MON}T12:00:00Z"):
        assert await public_promo(client, qr) is None


async def test_public_promo_open_ended_window(client: AsyncClient):
    """starts_at in the past + ends_at null = active indefinitely."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await make_promo(
        client, headers, rid, starts_at="2026-09-13T00:00:00Z", ends_at=None
    )

    with freeze_time(f"{_MON}T12:00:00Z"):
        assert public_promo(client, qr) is not None


# ---------------------------------------------------------------------------
# R2 image upload — upload-url / confirm / delete
# ---------------------------------------------------------------------------


async def test_promo_image_upload_and_confirm(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    promo = await make_promo(client, headers, rid)

    with mock_generate_upload_url():
        res = await client.post(
            f"/restaurants/{rid}/promos/{promo['id']}/image/upload-url",
            json={"content_type": VALID_CONTENT_TYPE, "file_size": VALID_SIZE},
            headers=headers,
        )
    assert res.status_code == 200, res.text
    object_key = res.json()["object_key"]
    assert object_key.startswith(f"promos/{rid}/{promo['id']}/")
    assert object_key.endswith(".jpg")

    with (
        mock_head_image_object(
            {"content_type": VALID_CONTENT_TYPE, "content_length": VALID_SIZE}
        ),
        mock_delete_image_object(),
    ):
        res = await client.post(
            f"/restaurants/{rid}/promos/{promo['id']}/image/confirm",
            json={"object_key": object_key},
            headers=headers,
        )
    assert res.status_code == 200, res.text
    assert res.json()["image_url"].endswith(object_key)


async def test_promo_image_confirm_rejects_cross_prefix_key(client: AsyncClient):
    """Confirming an object_key from another owner/promo -> 422."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    promo = await make_promo(client, headers, rid)

    res = await client.post(
        f"/restaurants/{rid}/promos/{promo['id']}/image/confirm",
        json={"object_key": f"items/{rid}/{uuid.uuid4()}/evil.jpg"},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "object_key_mismatch"


async def test_promo_image_upload_url_content_type_422(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    promo = await make_promo(client, headers, rid)

    res = await client.post(
        f"/restaurants/{rid}/promos/{promo['id']}/image/upload-url",
        json={"content_type": "image/gif", "file_size": VALID_SIZE},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "unsupported_content_type"


async def test_promo_image_delete(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    promo = await make_promo(client, headers, rid)

    # Deleting without an image -> 404.
    res = await client.delete(
        f"/restaurants/{rid}/promos/{promo['id']}/image", headers=headers
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "promo_image_not_found"

    with (
        mock_generate_upload_url(),
        mock_head_image_object(
            {"content_type": VALID_CONTENT_TYPE, "content_length": VALID_SIZE}
        ),
        mock_delete_image_object(),
    ):
        res = await client.post(
            f"/restaurants/{rid}/promos/{promo['id']}/image/upload-url",
            json={"content_type": VALID_CONTENT_TYPE, "file_size": VALID_SIZE},
            headers=headers,
        )
        object_key = res.json()["object_key"]

        res = await client.post(
            f"/restaurants/{rid}/promos/{promo['id']}/image/confirm",
            json={"object_key": object_key},
            headers=headers,
        )
        assert res.status_code == 200

        res = await client.delete(
            f"/restaurants/{rid}/promos/{promo['id']}/image", headers=headers
        )
        assert res.status_code == 204


# ---------------------------------------------------------------------------
# Fase 0010 — scope validation + discount application on orders
# ---------------------------------------------------------------------------


async def make_item_in_category(
    client: AsyncClient, headers: dict, rid: str, cat_name: str
) -> tuple[str, str]:
    """(item_id, category_id) for one item inside its own category."""
    res = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": cat_name, "type": "food"},
        headers=headers,
    )
    cid = res.json()["id"]
    res = await client.post(
        f"/restaurants/{rid}/categories/{cid}/subcategories",
        json={"name": f"{cat_name} Sub"},
        headers=headers,
    )
    sid = res.json()["id"]
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items",
        json={"name": f"{cat_name} Item", "description": "", "price": "10.00"},
        headers=headers,
    )
    return res.json()["id"], cid


async def place_order(client: AsyncClient, qr: str, item_id: str, qty: int = 2) -> dict:
    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [{"item_id": item_id, "quantity": qty}],
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


async def enable_orders(client: AsyncClient, headers: dict, rid: str) -> None:
    await client.patch(
        f"/restaurants/{rid}",
        json={"name": "My Bar", "orders_enabled": True},
        headers=headers,
    )


async def test_scope_item_requires_item_422(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    res = await client.post(
        f"/restaurants/{rid}/promos",
        json={"title": "X", "scope": "item", "discount_pct": 20},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "promo_requires_item"


async def test_scope_mismatch_422(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    item_id = await make_item(client, headers, rid)

    res = await client.post(
        f"/restaurants/{rid}/promos",
        json={
            "title": "X",
            "scope": "catalog",
            "discount_pct": 20,
            "item_id": item_id,
        },
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "scope_mismatch"


async def test_scope_discount_requires_pct_422(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    res = await client.post(
        f"/restaurants/{rid}/promos",
        json={"title": "X", "scope": "catalog"},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "discount_requires_pct"


async def test_scope_category_from_other_restaurant_404(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    other_headers = await as_user(client, email="other@example.com")
    other_restaurant = await make_restaurant(client, other_headers, name="Other")
    _, foreign_cat = await make_item_in_category(
        client, other_headers, other_restaurant["id"], "Foreign"
    )

    res = await client.post(
        f"/restaurants/{restaurant['id']}/promos",
        json={
            "title": "X",
            "scope": "category",
            "discount_pct": 20,
            "category_id": foreign_cat,
        },
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "category_not_found"


async def test_scope_none_does_not_discount(client: AsyncClient):
    """scope='none' (default): banner advertises 50% OFF but the order pays
    list price — the discount is pure copy."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    item_id = await make_item(client, headers, rid)
    await make_promo(client, headers, rid, scope="none", discount_pct=50)
    await enable_orders(client, headers, rid)

    body = await place_order(client, qr, item_id)
    assert body["items"][0]["discount_pct"] is None
    assert body["items"][0]["subtotal"] == "20.00"  # 10.00 * 2, list price
    assert body["total"] == "20.00"


async def test_discount_applied_scope_item(client: AsyncClient):
    """scope='item': the linked item's lines get the % — list price kept in
    unit_price_snapshot, discount snapshotted, subtotal discounted."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    item_id = await make_item(client, headers, rid)
    await make_promo(
        client, headers, rid, scope="item", discount_pct=20, item_id=item_id
    )
    await enable_orders(client, headers, rid)

    body = await place_order(client, qr, item_id)
    line = body["items"][0]
    assert line["unit_price_snapshot"] == "10.00"  # list price, untouched
    assert line["discount_pct"] == 20
    assert line["subtotal"] == "16.00"  # (10.00 * 0.8) * 2
    assert body["total"] == "16.00"


async def test_discount_scope_item_spares_other_items(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    promo_item, _ = await make_item_in_category(client, headers, rid, "Pizzas")
    other_item, _ = await make_item_in_category(client, headers, rid, "Bebidas")
    await make_promo(
        client, headers, rid, scope="item", discount_pct=20, item_id=promo_item
    )
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [
                {"item_id": promo_item, "quantity": 1},
                {"item_id": other_item, "quantity": 1},
            ],
        },
    )
    assert res.status_code == 201, res.text
    lines = res.json()["items"]
    discounted = next(l for l in lines if l["item_id"] == promo_item)
    full = next(l for l in lines if l["item_id"] == other_item)
    assert discounted["subtotal"] == "8.00"
    assert discounted["discount_pct"] == 20
    assert full["subtotal"] == "10.00"
    assert full["discount_pct"] is None
    assert res.json()["total"] == "18.00"


async def test_discount_applied_scope_category(client: AsyncClient):
    """scope='category': every item of the linked category gets the %,
    items of other categories don't."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    pizza_item, pizza_cat = await make_item_in_category(client, headers, rid, "Pizzas")
    drink_item, _ = await make_item_in_category(client, headers, rid, "Bebidas")
    await make_promo(
        client,
        headers,
        rid,
        scope="category",
        discount_pct=25,
        category_id=pizza_cat,
    )
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [
                {"item_id": pizza_item, "quantity": 2},
                {"item_id": drink_item, "quantity": 1},
            ],
        },
    )
    assert res.status_code == 201, res.text
    lines = res.json()["items"]
    pizza = next(l for l in lines if l["item_id"] == pizza_item)
    drink = next(l for l in lines if l["item_id"] == drink_item)
    assert pizza["discount_pct"] == 25
    assert pizza["subtotal"] == "15.00"  # (10.00 * 0.75) * 2
    assert drink["discount_pct"] is None
    assert drink["subtotal"] == "10.00"
    assert res.json()["total"] == "25.00"


async def test_discount_applied_scope_catalog(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    item_id = await make_item(client, headers, rid)
    await make_promo(client, headers, rid, scope="catalog", discount_pct=10)
    await enable_orders(client, headers, rid)

    body = await place_order(client, qr, item_id)
    assert body["items"][0]["discount_pct"] == 10
    assert body["items"][0]["subtotal"] == "18.00"  # (10.00 * 0.9) * 2
    assert body["total"] == "18.00"


async def test_discount_includes_modifiers_then_discounts(client: AsyncClient):
    """The % applies to the effective unit price (base + modifiers), the
    same definition the public cart shows the guest."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    # Build cat -> sub -> item -> modifier through the real API chain.
    res = await client.post(
        f"/restaurants/{rid}/categories",
        json={"name": "Platos", "type": "food"},
        headers=headers,
    )
    cid = res.json()["id"]
    res = await client.post(
        f"/restaurants/{rid}/categories/{cid}/subcategories",
        json={"name": "Pastas"},
        headers=headers,
    )
    sid = res.json()["id"]
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items",
        json={"name": "Ravioles", "description": "", "price": "10.00"},
        headers=headers,
    )
    item_id = res.json()["id"]
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{item_id}/modifiers",
        json={"name": "Extra queso", "price_delta": "1.50", "type": "extra"},
        headers=headers,
    )
    modifier_id = res.json()["id"]
    await make_promo(
        client, headers, rid, scope="item", discount_pct=20, item_id=item_id
    )
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [
                {
                    "item_id": item_id,
                    "quantity": 1,
                    "modifier_ids": [modifier_id],
                }
            ],
        },
    )
    assert res.status_code == 201, res.text
    line = res.json()["items"][0]
    # (10.00 + 1.50) * 0.8 = 9.20
    assert line["subtotal"] == "9.20"
    assert line["discount_pct"] == 20
    assert res.json()["total"] == "9.20"


async def test_public_payload_carries_scope_and_category_id(client: AsyncClient):
    """The public cart needs (scope, item_id, category_id, discount_pct) on
    the promo and category_id on every item — the mirror of the server rule."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    item_id, cat_id = await make_item_in_category(client, headers, rid, "Pizzas")
    await make_promo(
        client,
        headers,
        rid,
        scope="category",
        discount_pct=20,
        category_id=cat_id,
        starts_at="2026-09-13T00:00:00Z",
        ends_at="2026-09-16T00:00:00Z",
    )

    with freeze_time(f"{_MON}T12:00:00Z"):
        res = await client.get(f"/menu/{qr}")
    assert res.status_code == 200, res.text
    body = res.json()
    promo = body["promo"]
    assert promo["scope"] == "category"
    assert promo["category_id"] == cat_id
    assert promo["discount_pct"] == 20
    item = body["categories"][0]["subcategories"][0]["items"][0]
    assert item["category_id"] == cat_id
