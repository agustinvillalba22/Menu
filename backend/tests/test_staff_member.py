"""
Tests for M18 — Staff roster (CRUD), identification-only (no auth relation).

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.
"""
from httpx import AsyncClient


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


async def make_restaurant(client: AsyncClient, headers: dict, name: str = "My Bar") -> dict:
    res = await client.post("/restaurants", json={"name": name}, headers=headers)
    return res.json()


# ---------------------------------------------------------------------------
# CA-01 — crear, PIN duplicado en el mismo restaurant → 409
# ---------------------------------------------------------------------------


async def test_create_staff_member_then_duplicate_pin_409(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    res = await client.post(
        f"/restaurants/{rid}/staff",
        json={"name": "Juan", "position": "mozo", "pin": "1234"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "Juan"
    assert body["position"] == "mozo"
    assert body["pin"] == "1234"
    assert body["active"] is True

    dup = await client.post(
        f"/restaurants/{rid}/staff",
        json={"name": "Ana", "position": "cajero", "pin": "1234"},
        headers=headers,
    )
    assert dup.status_code == 409
    assert dup.json()["detail"] == "pin_taken"


# ---------------------------------------------------------------------------
# CA-02 — PIN mal formado → 422
# ---------------------------------------------------------------------------


async def test_create_staff_member_invalid_pin_422(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    for bad_pin in ["12a4", "123", "12345"]:
        res = await client.post(
            f"/restaurants/{rid}/staff",
            json={"name": "Juan", "position": "mozo", "pin": bad_pin},
            headers=headers,
        )
        assert res.status_code == 422, bad_pin


# ---------------------------------------------------------------------------
# CA-03 — mismo PIN en restaurants distintos no conflictúa
# ---------------------------------------------------------------------------


async def test_same_pin_allowed_across_restaurants(client: AsyncClient):
    headers = await as_user(client)
    r1 = await make_restaurant(client, headers, name="Bar 1")
    r2 = await make_restaurant(client, headers, name="Bar 2")

    res1 = await client.post(
        f"/restaurants/{r1['id']}/staff",
        json={"name": "Juan", "position": "mozo", "pin": "5555"},
        headers=headers,
    )
    res2 = await client.post(
        f"/restaurants/{r2['id']}/staff",
        json={"name": "Pedro", "position": "cajero", "pin": "5555"},
        headers=headers,
    )
    assert res1.status_code == 201
    assert res2.status_code == 201


async def test_list_staff_members_ordered_by_name(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    for name, pin in [("Carlos", "1111"), ("Ana", "2222"), ("Beto", "3333")]:
        await client.post(
            f"/restaurants/{rid}/staff",
            json={"name": name, "position": "mozo", "pin": pin},
            headers=headers,
        )

    res = await client.get(f"/restaurants/{rid}/staff", headers=headers)
    assert res.status_code == 200
    assert [m["name"] for m in res.json()] == ["Ana", "Beto", "Carlos"]


# ---------------------------------------------------------------------------
# CA-04 — borrar
# ---------------------------------------------------------------------------


async def test_delete_staff_member(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    member = (
        await client.post(
            f"/restaurants/{rid}/staff",
            json={"name": "Juan", "position": "mozo", "pin": "1234"},
            headers=headers,
        )
    ).json()

    del_res = await client.delete(f"/restaurants/{rid}/staff/{member['id']}", headers=headers)
    assert del_res.status_code == 204

    listed = await client.get(f"/restaurants/{rid}/staff", headers=headers)
    assert listed.json() == []


async def test_update_staff_member_pin_conflict_409(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    m1 = (
        await client.post(
            f"/restaurants/{rid}/staff",
            json={"name": "Juan", "position": "mozo", "pin": "1111"},
            headers=headers,
        )
    ).json()
    await client.post(
        f"/restaurants/{rid}/staff",
        json={"name": "Ana", "position": "cajero", "pin": "2222"},
        headers=headers,
    )

    res = await client.patch(
        f"/restaurants/{rid}/staff/{m1['id']}", json={"pin": "2222"}, headers=headers
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "pin_taken"


async def test_update_staff_member_active_flag(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]
    member = (
        await client.post(
            f"/restaurants/{rid}/staff",
            json={"name": "Juan", "position": "mozo", "pin": "1234"},
            headers=headers,
        )
    ).json()

    res = await client.patch(
        f"/restaurants/{rid}/staff/{member['id']}", json={"active": False}, headers=headers
    )
    assert res.status_code == 200
    assert res.json()["active"] is False
