"""
Tests for M4 — Upload de imagen de producto vía R2.

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.

Fase RED del ciclo TDD: `app/services/storage.py` todavía NO existe (lo crea
el Developer agent), y los endpoints
`.../image/upload-url`, `.../image/confirm`, `.../image` (DELETE) tampoco
están implementados en `app/routers/item.py`. Se espera que estos tests
fallen ahora (404 en el mejor de los casos, o error al resolver el mock de
`app.services.storage.*` porque el módulo no existe todavía) y pasen una vez
que el Developer implemente RF-01 a RF-08.

Se mockean SIEMPRE las llamadas a R2/boto3 en el borde, parcheando las
funciones async que va a exponer `app.services.storage`:
- `generate_upload_url(object_key, content_type) -> str`
- `head_image_object(object_key) -> {"content_type": str, "content_length": int} | None`
- `delete_image_object(object_key) -> None`

CA-04 y CA-07 de la spec hablan de "subir un archivo real" a la URL firmada;
como no hay red real en tests, se simulan mockeando `head_image_object` para
que devuelva un content_type/content_length válidos, y se verifica que
`Item.image_url` queda seteado correctamente en DB.
"""
import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, patch

from app.models.item import Item

STORAGE = "app.services.storage"

VALID_CONTENT_TYPE = "image/jpeg"
VALID_SIZE = 1000
MAX_SIZE = 5 * 1024 * 1024


# ---------------------------------------------------------------------------
# Helpers (copiados del patrón de test_item.py / test_item_modifier.py)
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
) -> str:
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items",
        json={"name": name, "description": "", "price": price},
        headers=headers,
    )
    return res.json()["id"]


def upload_url_path(rid: str, sid: str, iid: str) -> str:
    return f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/image/upload-url"


def confirm_path(rid: str, sid: str, iid: str) -> str:
    return f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/image/confirm"


def delete_image_path(rid: str, sid: str, iid: str) -> str:
    return f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/image"


async def get_item_image_url(db_session: AsyncSession, item_id: str) -> str | None:
    result = await db_session.execute(
        select(Item.image_url).where(Item.id == uuid.UUID(item_id))
    )
    return result.scalar_one()


def mock_generate_upload_url(return_value: str = "https://fake.r2.example.com/signed?sig=abc"):
    return patch(
        f"{STORAGE}.generate_upload_url",
        new=AsyncMock(return_value=return_value),
        create=True,
    )


def mock_head_image_object(return_value):
    return patch(
        f"{STORAGE}.head_image_object",
        new=AsyncMock(return_value=return_value),
        create=True,
    )


def mock_delete_image_object():
    return patch(
        f"{STORAGE}.delete_image_object",
        new=AsyncMock(return_value=None),
        create=True,
    )


# ---------------------------------------------------------------------------
# CA-01: content_type fuera de jpeg/png/webp -> 422 unsupported_content_type
# ---------------------------------------------------------------------------


async def test_upload_url_unsupported_content_type_422(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    res = await client.post(
        upload_url_path(rid, sid, iid),
        json={"content_type": "image/gif", "file_size": VALID_SIZE},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "unsupported_content_type"


# ---------------------------------------------------------------------------
# CA-02: file_size > 5 MiB -> 422 file_too_large
# ---------------------------------------------------------------------------


async def test_upload_url_file_too_large_422(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    res = await client.post(
        upload_url_path(rid, sid, iid),
        json={"content_type": VALID_CONTENT_TYPE, "file_size": 6_000_000},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "file_too_large"


# ---------------------------------------------------------------------------
# CA-03: request válido -> 200, upload_url + object_key con prefijo correcto
# ---------------------------------------------------------------------------


async def test_upload_url_valid_returns_200_with_object_key_prefix(
    client: AsyncClient,
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    with mock_generate_upload_url(
        return_value="https://fake-bucket.r2.cloudflarestorage.com/signed?sig=abc"
    ):
        res = await client.post(
            upload_url_path(rid, sid, iid),
            json={"content_type": VALID_CONTENT_TYPE, "file_size": VALID_SIZE},
            headers=headers,
        )
    assert res.status_code == 200
    body = res.json()
    assert body["upload_url"].startswith("https://")
    assert body["object_key"].startswith(f"items/{rid}/{iid}/")
    assert body["object_key"].endswith(".jpg")
    assert body["expires_in"] == 300


# ---------------------------------------------------------------------------
# upload-url: item que no existe -> 404 item_not_found
# ---------------------------------------------------------------------------


async def test_upload_url_item_not_found_404(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    ghost_item_id = str(uuid.uuid4())

    res = await client.post(
        upload_url_path(rid, sid, ghost_item_id),
        json={"content_type": VALID_CONTENT_TYPE, "file_size": VALID_SIZE},
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "item_not_found"


# ---------------------------------------------------------------------------
# CA-04 (adaptado): upload-url + confirm (con head_image_object mockeado
# simulando un objeto real ya subido) deja Item.image_url seteado en DB.
# ---------------------------------------------------------------------------


async def test_confirm_valid_sets_image_url(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    with mock_generate_upload_url():
        upload_res = await client.post(
            upload_url_path(rid, sid, iid),
            json={"content_type": VALID_CONTENT_TYPE, "file_size": VALID_SIZE},
            headers=headers,
        )
    object_key = upload_res.json()["object_key"]

    with mock_head_image_object(
        {"content_type": VALID_CONTENT_TYPE, "content_length": VALID_SIZE}
    ):
        confirm_res = await client.post(
            confirm_path(rid, sid, iid),
            json={"object_key": object_key},
            headers=headers,
        )
    assert confirm_res.status_code == 200
    body = confirm_res.json()

    from app.core.config import settings

    assert body["image_url"] == f"{settings.R2_PUBLIC_URL}/{object_key}"

    persisted = await get_item_image_url(db_session, iid)
    assert persisted == f"{settings.R2_PUBLIC_URL}/{object_key}"


# ---------------------------------------------------------------------------
# CA-05: confirm con object_key nunca subido -> 422 upload_not_found,
# sin tocar Item.image_url
# ---------------------------------------------------------------------------


async def test_confirm_object_never_uploaded_returns_422(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    fake_object_key = f"items/{rid}/{iid}/{uuid.uuid4()}.jpg"

    with mock_head_image_object(None):
        res = await client.post(
            confirm_path(rid, sid, iid),
            json={"object_key": fake_object_key},
            headers=headers,
        )
    assert res.status_code == 422
    assert res.json()["detail"] == "upload_not_found"

    assert await get_item_image_url(db_session, iid) is None


# ---------------------------------------------------------------------------
# CA-06: confirm con object_key de otro item -> 422 object_key_mismatch
# ---------------------------------------------------------------------------


async def test_confirm_object_key_from_other_item_returns_422(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid_a = await make_item(client, headers, rid, sid, name="Item A")
    iid_b = await make_item(client, headers, rid, sid, name="Item B")

    other_item_object_key = f"items/{rid}/{iid_b}/{uuid.uuid4()}.jpg"

    res = await client.post(
        confirm_path(rid, sid, iid_a),
        json={"object_key": other_item_object_key},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "object_key_mismatch"

    assert await get_item_image_url(db_session, iid_a) is None


# ---------------------------------------------------------------------------
# CA-07 (adaptado): confirmar imagen nueva sobre item que ya tenía image_url
# borra el objeto viejo de R2 (delete_image_object llamado con la key vieja)
# y deja solo la key nueva.
# ---------------------------------------------------------------------------


async def test_confirm_replacing_existing_image_deletes_old_object(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    # Primera imagen ya confirmada.
    with mock_generate_upload_url():
        first_upload = await client.post(
            upload_url_path(rid, sid, iid),
            json={"content_type": VALID_CONTENT_TYPE, "file_size": VALID_SIZE},
            headers=headers,
        )
    old_object_key = first_upload.json()["object_key"]

    with mock_head_image_object(
        {"content_type": VALID_CONTENT_TYPE, "content_length": VALID_SIZE}
    ):
        first_confirm = await client.post(
            confirm_path(rid, sid, iid),
            json={"object_key": old_object_key},
            headers=headers,
        )
    assert first_confirm.status_code == 200

    # Segunda imagen reemplaza a la primera.
    with mock_generate_upload_url():
        second_upload = await client.post(
            upload_url_path(rid, sid, iid),
            json={"content_type": VALID_CONTENT_TYPE, "file_size": VALID_SIZE},
            headers=headers,
        )
    new_object_key = second_upload.json()["object_key"]
    assert new_object_key != old_object_key

    delete_mock = AsyncMock(return_value=None)
    with mock_head_image_object(
        {"content_type": VALID_CONTENT_TYPE, "content_length": VALID_SIZE}
    ), patch(f"{STORAGE}.delete_image_object", new=delete_mock, create=True):
        second_confirm = await client.post(
            confirm_path(rid, sid, iid),
            json={"object_key": new_object_key},
            headers=headers,
        )
    assert second_confirm.status_code == 200

    delete_mock.assert_awaited_once_with(old_object_key)

    from app.core.config import settings

    persisted = await get_item_image_url(db_session, iid)
    assert persisted == f"{settings.R2_PUBLIC_URL}/{new_object_key}"
    assert old_object_key not in persisted


# ---------------------------------------------------------------------------
# CA-08: DELETE .../image sobre item con imagen la borra de R2 y deja
# Item.image_url = None
# ---------------------------------------------------------------------------


async def test_delete_image_removes_from_r2_and_clears_image_url(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    with mock_generate_upload_url():
        upload_res = await client.post(
            upload_url_path(rid, sid, iid),
            json={"content_type": VALID_CONTENT_TYPE, "file_size": VALID_SIZE},
            headers=headers,
        )
    object_key = upload_res.json()["object_key"]

    with mock_head_image_object(
        {"content_type": VALID_CONTENT_TYPE, "content_length": VALID_SIZE}
    ):
        await client.post(
            confirm_path(rid, sid, iid),
            json={"object_key": object_key},
            headers=headers,
        )
    assert await get_item_image_url(db_session, iid) is not None

    delete_mock = AsyncMock(return_value=None)
    with patch(f"{STORAGE}.delete_image_object", new=delete_mock, create=True):
        res = await client.delete(delete_image_path(rid, sid, iid), headers=headers)

    assert res.status_code == 204
    assert res.content == b""
    delete_mock.assert_awaited_once_with(object_key)
    assert await get_item_image_url(db_session, iid) is None


# ---------------------------------------------------------------------------
# CA-09: DELETE .../image sobre item sin imagen -> 404 image_not_found
# ---------------------------------------------------------------------------


async def test_delete_image_without_image_returns_404(client: AsyncClient):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    res = await client.delete(delete_image_path(rid, sid, iid), headers=headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "image_not_found"


# ---------------------------------------------------------------------------
# CA-10: borrar un item que tiene image_url borra también el objeto en R2
# ---------------------------------------------------------------------------


async def test_delete_item_with_image_deletes_r2_object(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid = await make_restaurant(client, headers)
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)

    with mock_generate_upload_url():
        upload_res = await client.post(
            upload_url_path(rid, sid, iid),
            json={"content_type": VALID_CONTENT_TYPE, "file_size": VALID_SIZE},
            headers=headers,
        )
    object_key = upload_res.json()["object_key"]

    with mock_head_image_object(
        {"content_type": VALID_CONTENT_TYPE, "content_length": VALID_SIZE}
    ):
        await client.post(
            confirm_path(rid, sid, iid),
            json={"object_key": object_key},
            headers=headers,
        )

    delete_mock = AsyncMock(return_value=None)
    with patch(f"{STORAGE}.delete_image_object", new=delete_mock, create=True):
        res = await client.delete(
            f"/restaurants/{rid}/subcategories/{sid}/items/{iid}", headers=headers
        )

    assert res.status_code == 204
    delete_mock.assert_awaited_once_with(object_key)

    got = await client.get(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}", headers=headers
    )
    assert got.status_code == 404


# ---------------------------------------------------------------------------
# CA-11: usuario sin rol owner/editor -> 403 en cada uno de los 3 endpoints
# ---------------------------------------------------------------------------


async def test_upload_url_without_role_403(client: AsyncClient):
    owner = await as_user(client, email="owner@example.com")
    rid = await make_restaurant(client, owner)
    sid = await make_subcategory(client, owner, rid)
    iid = await make_item(client, owner, rid, sid)

    stranger = await as_user(client, email="stranger@example.com")
    res = await client.post(
        upload_url_path(rid, sid, iid),
        json={"content_type": VALID_CONTENT_TYPE, "file_size": VALID_SIZE},
        headers=stranger,
    )
    assert res.status_code == 403


async def test_confirm_without_role_403(client: AsyncClient):
    owner = await as_user(client, email="owner@example.com")
    rid = await make_restaurant(client, owner)
    sid = await make_subcategory(client, owner, rid)
    iid = await make_item(client, owner, rid, sid)

    stranger = await as_user(client, email="stranger@example.com")
    fake_object_key = f"items/{rid}/{iid}/{uuid.uuid4()}.jpg"
    res = await client.post(
        confirm_path(rid, sid, iid),
        json={"object_key": fake_object_key},
        headers=stranger,
    )
    assert res.status_code == 403


async def test_delete_image_without_role_403(client: AsyncClient):
    owner = await as_user(client, email="owner@example.com")
    rid = await make_restaurant(client, owner)
    sid = await make_subcategory(client, owner, rid)
    iid = await make_item(client, owner, rid, sid)

    stranger = await as_user(client, email="stranger@example.com")
    res = await client.delete(delete_image_path(rid, sid, iid), headers=stranger)
    assert res.status_code == 403
