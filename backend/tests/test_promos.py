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
        json={"title": "X", "item_id": foreign_item},
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "item_not_found"


async def test_own_item_accepted(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    item_id = await make_item(client, headers, rid)

    promo = await make_promo(client, headers, rid, item_id=item_id)
    assert promo["item_id"] == item_id


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
