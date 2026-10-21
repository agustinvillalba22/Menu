"""Restaurant logo upload: upload-url, confirm and delete (R2 is mocked)."""
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.core.config import settings

STORAGE = "app.services.storage"
JPEG = "image/jpeg"
VALID_HEAD = {"content_type": JPEG, "content_length": 1000}


async def as_user(client: AsyncClient, email: str = "owner@example.com") -> dict:
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "full_name": "Owner"},
    )
    client.cookies.clear()
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


async def make_restaurant(client: AsyncClient, headers: dict) -> str:
    res = await client.post("/restaurants", json={"name": "My Bar"}, headers=headers)
    return res.json()["id"]


async def request_upload(client: AsyncClient, headers: dict, rid: str) -> str:
    with patch(
        f"{STORAGE}.generate_upload_url",
        new=AsyncMock(return_value="https://r2.example.com/signed"),
    ):
        res = await client.post(
            f"/restaurants/{rid}/logo/upload-url",
            json={"content_type": JPEG, "file_size": 1000},
            headers=headers,
        )
    assert res.status_code == 200
    return res.json()["object_key"]


async def confirm(client: AsyncClient, headers: dict, rid: str, object_key: str):
    with patch(f"{STORAGE}.head_image_object", new=AsyncMock(return_value=VALID_HEAD)):
        return await client.post(
            f"/restaurants/{rid}/logo/confirm", json={"object_key": object_key}, headers=headers
        )


async def logo_url(client: AsyncClient, headers: dict, rid: str) -> str | None:
    res = await client.get(f"/restaurants/{rid}/info", headers=headers)
    return res.json()["logo_url"]


async def test_upload_url_is_scoped_to_the_restaurant_prefix(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)

    object_key = await request_upload(client, headers, rid)

    assert object_key.startswith(f"logos/{rid}/")
    assert object_key.endswith(".jpg")


async def test_upload_url_rejects_unsupported_content_type(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)

    res = await client.post(
        f"/restaurants/{rid}/logo/upload-url",
        json={"content_type": "image/gif", "file_size": 1000},
        headers=headers,
    )

    assert res.status_code == 422
    assert res.json()["detail"] == "unsupported_content_type"


async def test_confirm_stores_the_public_url(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    object_key = await request_upload(client, headers, rid)

    res = await confirm(client, headers, rid, object_key)

    assert res.status_code == 200
    expected = f"{settings.R2_PUBLIC_URL}/{object_key}"
    assert await logo_url(client, headers, rid) == expected


async def test_confirm_rejects_an_object_of_another_restaurant(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)

    res = await confirm(client, headers, rid, f"logos/{rid[::-1]}/x.jpg")

    assert res.status_code == 422
    assert res.json()["detail"] == "object_key_mismatch"
    assert await logo_url(client, headers, rid) is None


async def test_confirm_replacing_the_logo_deletes_the_old_object(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    old_key = await request_upload(client, headers, rid)
    await confirm(client, headers, rid, old_key)
    new_key = await request_upload(client, headers, rid)

    delete_mock = AsyncMock(return_value=None)
    with patch(f"{STORAGE}.delete_image_object", new=delete_mock):
        res = await confirm(client, headers, rid, new_key)

    assert res.status_code == 200
    delete_mock.assert_awaited_once_with(old_key)
    assert await logo_url(client, headers, rid) == f"{settings.R2_PUBLIC_URL}/{new_key}"


async def test_delete_removes_the_object_and_clears_the_logo(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    object_key = await request_upload(client, headers, rid)
    await confirm(client, headers, rid, object_key)

    delete_mock = AsyncMock(return_value=None)
    with patch(f"{STORAGE}.delete_image_object", new=delete_mock):
        res = await client.delete(f"/restaurants/{rid}/logo", headers=headers)

    assert res.status_code == 204
    delete_mock.assert_awaited_once_with(object_key)
    assert await logo_url(client, headers, rid) is None


async def test_delete_without_a_logo_returns_404(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)

    res = await client.delete(f"/restaurants/{rid}/logo", headers=headers)

    assert res.status_code == 404
    assert res.json()["detail"] == "logo_not_found"


async def test_a_user_outside_the_restaurant_gets_403(client: AsyncClient):
    owner = await as_user(client)
    rid = await make_restaurant(client, owner)
    stranger = await as_user(client, email="stranger@example.com")

    upload = await client.post(
        f"/restaurants/{rid}/logo/upload-url",
        json={"content_type": JPEG, "file_size": 1000},
        headers=stranger,
    )
    delete = await client.delete(f"/restaurants/{rid}/logo", headers=stranger)

    assert upload.status_code == 403
    assert delete.status_code == 403
