"""
Tests for M11 — Public order creation, order queue (list/patch) and the
public-menu / restaurant fields (image_url, modifiers, orders_enabled).

asyncio_mode=auto via pytest.ini — sin @pytest.mark.asyncio.

Cubre:
- CA-03  image_url + modifiers en el menú público.
- CA-04  orders_disabled → 404, sin crear Order.
- CA-05  recálculo server-side del total (ignora price del cliente).
- CA-06  item_id de otro restaurant → item_not_found.
- CA-07  modifier_id de otro item → modifier_not_found.
- CA-08  transición pending→accepted→ready→completed.
- CA-09  transición desde estado terminal → 409.
- CA-10  pending→cancelled permitido.
- CA-11  salto pending→ready → 409.
- CA-12  filtro ?status.
- CA-13  sin rol → 403 no_role.
- CA-14  (item borrado → OrderItem sobrevive) — cubierto en test_orders_history.
- CA-15  orders_enabled en RestaurantRead + PATCH (owner ok, editor 403).
- menu_not_found, sin auth, aislamiento cross-restaurant en la cola.
"""
import uuid

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.models.order import Order
from app.models.restaurant import RestaurantRole, UserRestaurantRole
from app.models.user import User


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


async def make_restaurant(client: AsyncClient, headers: dict, name: str = "My Bar") -> dict:
    res = await client.post("/restaurants", json={"name": name}, headers=headers)
    return res.json()


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
    price: str = "10.00",
) -> str:
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items",
        json={"name": name, "description": "", "price": price},
        headers=headers,
    )
    return res.json()["id"]


async def make_modifier(
    client: AsyncClient,
    headers: dict,
    rid: str,
    sid: str,
    iid: str,
    name: str = "Extra queso",
    price_delta: str = "1.50",
    type_: str = "extra",
) -> str:
    res = await client.post(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}/modifiers",
        json={"name": name, "price_delta": price_delta, "type": type_},
        headers=headers,
    )
    return res.json()["id"]


async def enable_orders(client: AsyncClient, headers: dict, rid: str, name: str = "My Bar") -> dict:
    """PATCH restaurant como owner para habilitar pedidos."""
    res = await client.patch(
        f"/restaurants/{rid}",
        json={"name": name, "orders_enabled": True},
        headers=headers,
    )
    return res.json()


async def grant_editor_role(
    db_session: AsyncSession, email: str, restaurant_id: str
) -> None:
    """Inserta un rol editor (no owner) directo en DB — no hay endpoint de colaboradores."""
    user = (
        await db_session.execute(select(User).where(User.email == email))
    ).scalar_one()
    db_session.add(
        UserRestaurantRole(
            user_id=user.id,
            restaurant_id=uuid.UUID(restaurant_id),
            role=RestaurantRole.editor,
        )
    )
    await db_session.commit()


# ---------------------------------------------------------------------------
# CA-03 — menú público expone image_url + modifiers (orden alfabético)
# ---------------------------------------------------------------------------


async def test_public_menu_exposes_image_url_and_modifiers(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    await make_modifier(client, headers, rid, sid, iid, name="Zanahoria")
    await make_modifier(client, headers, rid, sid, iid, name="Aceituna")

    # image_url no tiene endpoint de escritura en el schema de item; se setea directo.
    item = (
        await db_session.execute(select(Item).where(Item.id == uuid.UUID(iid)))
    ).scalar_one()
    item.image_url = "https://cdn.example.com/ravioles.jpg"
    await db_session.commit()

    res = await client.get(f"/menu/{qr}")
    assert res.status_code == 200
    public_item = res.json()["categories"][0]["subcategories"][0]["items"][0]
    assert public_item["image_url"] == "https://cdn.example.com/ravioles.jpg"
    assert [m["name"] for m in public_item["modifiers"]] == ["Aceituna", "Zanahoria"]
    assert public_item["modifiers"][0]["price_delta"] == "1.50"
    assert public_item["modifiers"][0]["type"] == "extra"


# ---------------------------------------------------------------------------
# CA-15 — orders_enabled en RestaurantRead + PATCH (owner ok, editor 403)
# ---------------------------------------------------------------------------


async def test_restaurant_read_default_orders_enabled_false(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    assert restaurant["orders_enabled"] is False

    got = await client.get(f"/restaurants/{restaurant['id']}", headers=headers)
    assert got.status_code == 200
    assert got.json()["orders_enabled"] is False


async def test_owner_patch_enables_orders(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid = restaurant["id"]

    res = await client.patch(
        f"/restaurants/{rid}",
        json={"name": "My Bar", "orders_enabled": True},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["orders_enabled"] is True

    # Persistió.
    got = await client.get(f"/restaurants/{rid}", headers=headers)
    assert got.json()["orders_enabled"] is True


async def test_editor_patch_restaurant_forbidden(
    client: AsyncClient, db_session: AsyncSession
):
    owner = await as_user(client, email="owner@example.com")
    restaurant = await make_restaurant(client, owner)
    rid = restaurant["id"]

    editor = await as_user(client, email="editor@example.com")
    await grant_editor_role(db_session, "editor@example.com", rid)

    res = await client.patch(
        f"/restaurants/{rid}",
        json={"name": "Hijacked", "orders_enabled": True},
        headers=editor,
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "insufficient_role"


# ---------------------------------------------------------------------------
# CA-05 — happy path: total recalculado server-side, ignora price del cliente
# ---------------------------------------------------------------------------


async def test_create_order_recomputes_total_server_side(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid, price="10.00")
    mid = await make_modifier(client, headers, rid, sid, iid, price_delta="1.50")
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [
                {
                    "item_id": iid,
                    "quantity": 2,
                    "modifier_ids": [mid],
                    # Intento de inyección de precio: debe ser ignorado.
                    "price": "0.01",
                    "subtotal": "0.01",
                }
            ],
            # Intento de inyección de total: ignorado.
            "total": "0.01",
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "pending"
    # (10.00 + 1.50) * 2 = 23.00
    assert body["items"][0]["subtotal"] == "23.00"
    assert body["items"][0]["unit_price_snapshot"] == "10.00"
    assert body["items"][0]["modifiers"][0]["price_snapshot"] == "1.50"
    assert body["total"] == "23.00"
    assert isinstance(body["total"], str)


async def test_create_order_no_auth_required(client: AsyncClient):
    """El POST público no exige ni manda Authorization/cookie."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "llevar",
            "items": [{"item_id": iid, "quantity": 1, "modifier_ids": []}],
        },
    )
    assert res.status_code == 201
    assert "Authorization" not in res.request.headers


# ---------------------------------------------------------------------------
# CA-04 — orders_disabled → 404, no crea Order
# ---------------------------------------------------------------------------


async def test_create_order_disabled_404(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    # orders_enabled queda en su default False.

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [{"item_id": iid, "quantity": 1, "modifier_ids": []}],
        },
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "orders_disabled"

    count = (
        await db_session.execute(select(func.count()).select_from(Order))
    ).scalar_one()
    assert count == 0


# ---------------------------------------------------------------------------
# menu_not_found — qr_token inexistente
# ---------------------------------------------------------------------------


async def test_create_order_unknown_token_404(client: AsyncClient):
    res = await client.post(
        f"/menu/{uuid.uuid4()}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [{"item_id": str(uuid.uuid4()), "quantity": 1, "modifier_ids": []}],
        },
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "menu_not_found"


# ---------------------------------------------------------------------------
# CA-06 — item_id de otro restaurant → item_not_found, no crea Order
# ---------------------------------------------------------------------------


async def test_create_order_item_of_other_restaurant_404(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rest_a = await make_restaurant(client, headers, name="Bar A")
    rid_a, qr_a = rest_a["id"], rest_a["qr_token"]
    await enable_orders(client, headers, rid_a, name="Bar A")

    rest_b = await make_restaurant(client, headers, name="Bar B")
    rid_b = rest_b["id"]
    sid_b = await make_subcategory(client, headers, rid_b)
    iid_b = await make_item(client, headers, rid_b, sid_b)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr_a}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [{"item_id": iid_b, "quantity": 1, "modifier_ids": []}],
        },
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "item_not_found"

    count = (
        await db_session.execute(select(func.count()).select_from(Order))
    ).scalar_one()
    assert count == 0


# ---------------------------------------------------------------------------
# CA-07 — modifier_id de otro item → modifier_not_found
# ---------------------------------------------------------------------------


async def test_create_order_modifier_of_other_item_404(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid_1 = await make_item(client, headers, rid, sid, name="Pizza")
    iid_2 = await make_item(client, headers, rid, sid, name="Empanada")
    # Modificador que pertenece a iid_2, referenciado bajo la línea de iid_1.
    mid_2 = await make_modifier(client, headers, rid, sid, iid_2, name="Extra")
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [{"item_id": iid_1, "quantity": 1, "modifier_ids": [mid_2]}],
        },
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "modifier_not_found"


# ---------------------------------------------------------------------------
# Validación de payload — items vacío → 422
# ---------------------------------------------------------------------------


async def test_create_order_empty_items_422(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={"customer_name": "Ana", "order_type": "mesa", "items": []},
    )
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Review CRIT-01 — cotas anti-amplificación en el POST público sin auth
# ---------------------------------------------------------------------------


async def test_create_order_quantity_over_limit_422(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [{"item_id": iid, "quantity": 1000, "modifier_ids": []}],
        },
    )
    assert res.status_code == 422


async def test_create_order_too_many_items_422(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [
                {"item_id": iid, "quantity": 1, "modifier_ids": []} for _ in range(101)
            ],
        },
    )
    assert res.status_code == 422


async def test_create_order_too_many_modifier_ids_422(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [
                {
                    "item_id": iid,
                    "quantity": 1,
                    "modifier_ids": [str(uuid.uuid4()) for _ in range(51)],
                }
            ],
        },
    )
    assert res.status_code == 422


async def test_create_order_amount_overflow_422(client: AsyncClient):
    """quantity al tope permitido (999) sobre un item de precio casi máximo
    desborda Numeric(10,2) del subtotal -> 422 amount_too_large, no 500."""
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid, price="99999999.99")
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [{"item_id": iid, "quantity": 999, "modifier_ids": []}],
        },
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "amount_too_large"


# ---------------------------------------------------------------------------
# Helper: crear un pedido pending y devolver (rid, order_id, owner_headers)
# ---------------------------------------------------------------------------


async def _seed_order(client: AsyncClient, headers: dict, email: str = "owner@example.com"):
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    await enable_orders(client, headers, rid)

    client.cookies.clear()
    res = await client.post(
        f"/menu/{qr}/orders",
        json={
            "customer_name": "Ana",
            "order_type": "mesa",
            "items": [{"item_id": iid, "quantity": 1, "modifier_ids": []}],
        },
    )
    return rid, res.json()["id"]


# ---------------------------------------------------------------------------
# CA-08 — transición pending→accepted→ready→completed
# ---------------------------------------------------------------------------


async def test_status_transition_full_chain(client: AsyncClient):
    headers = await as_user(client)
    rid, oid = await _seed_order(client, headers)

    for target in ("accepted", "ready", "completed"):
        res = await client.patch(
            f"/restaurants/{rid}/orders/{oid}",
            json={"status": target},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        assert res.json()["status"] == target


# ---------------------------------------------------------------------------
# CA-10 — pending→cancelled permitido
# ---------------------------------------------------------------------------


async def test_status_transition_pending_to_cancelled(client: AsyncClient):
    headers = await as_user(client)
    rid, oid = await _seed_order(client, headers)

    res = await client.patch(
        f"/restaurants/{rid}/orders/{oid}",
        json={"status": "cancelled"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


# ---------------------------------------------------------------------------
# CA-11 — salto pending→ready → 409
# ---------------------------------------------------------------------------


async def test_status_transition_skip_is_rejected(client: AsyncClient):
    headers = await as_user(client)
    rid, oid = await _seed_order(client, headers)

    res = await client.patch(
        f"/restaurants/{rid}/orders/{oid}",
        json={"status": "ready"},
        headers=headers,
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "invalid_transition"


# ---------------------------------------------------------------------------
# CA-09 — desde estado terminal → 409, status en DB no cambia
# ---------------------------------------------------------------------------


async def test_status_transition_from_terminal_rejected(
    client: AsyncClient, db_session: AsyncSession
):
    headers = await as_user(client)
    rid, oid = await _seed_order(client, headers)

    # Llevar a completed por la cadena válida.
    for target in ("accepted", "ready", "completed"):
        await client.patch(
            f"/restaurants/{rid}/orders/{oid}",
            json={"status": target},
            headers=headers,
        )

    res = await client.patch(
        f"/restaurants/{rid}/orders/{oid}",
        json={"status": "pending"},
        headers=headers,
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "invalid_transition"

    order = (
        await db_session.execute(select(Order).where(Order.id == uuid.UUID(oid)))
    ).scalar_one()
    assert order.status.value == "completed"


async def test_patch_order_unknown_id_404(client: AsyncClient):
    headers = await as_user(client)
    rid, _ = await _seed_order(client, headers)

    res = await client.patch(
        f"/restaurants/{rid}/orders/{uuid.uuid4()}",
        json={"status": "accepted"},
        headers=headers,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "order_not_found"


# ---------------------------------------------------------------------------
# CA-12 — GET .../orders?status filtra
# ---------------------------------------------------------------------------


async def test_list_orders_filter_by_status(client: AsyncClient):
    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    await enable_orders(client, headers, rid)

    async def place_order():
        return (
            await client.post(
                f"/menu/{qr}/orders",
                json={
                    "customer_name": "Ana",
                    "order_type": "mesa",
                    "items": [{"item_id": iid, "quantity": 1, "modifier_ids": []}],
                },
            )
        ).json()["id"]

    o1 = await place_order()
    await place_order()  # queda pending
    o3 = await place_order()

    # Mover o1 y o3 fuera de pending (a completed via cadena).
    for oid in (o1, o3):
        for target in ("accepted", "ready", "completed"):
            await client.patch(
                f"/restaurants/{rid}/orders/{oid}",
                json={"status": target},
                headers=headers,
            )

    res = await client.get(
        f"/restaurants/{rid}/orders", params={"status": "pending"}, headers=headers
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert all(o["status"] == "pending" for o in body)

    completed = await client.get(
        f"/restaurants/{rid}/orders", params={"status": "completed"}, headers=headers
    )
    assert len(completed.json()) == 2


async def test_list_orders_invalid_status_422(client: AsyncClient):
    headers = await as_user(client)
    rid, _ = await _seed_order(client, headers)

    res = await client.get(
        f"/restaurants/{rid}/orders", params={"status": "bogus"}, headers=headers
    )
    assert res.status_code == 422


async def test_list_orders_newest_first(
    client: AsyncClient, db_session: AsyncSession
):
    from datetime import datetime, timedelta, timezone

    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid)
    await enable_orders(client, headers, rid)

    ids = []
    for name in ("Ana", "Beto", "Cami"):
        oid = (
            await client.post(
                f"/menu/{qr}/orders",
                json={
                    "customer_name": name,
                    "order_type": "mesa",
                    "items": [{"item_id": iid, "quantity": 1, "modifier_ids": []}],
                },
            )
        ).json()["id"]
        ids.append(oid)

    # created_at ties within the same second are not deterministic; force
    # distinct, increasing timestamps so the desc ordering can be asserted.
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for offset, oid in enumerate(ids):
        order = (
            await db_session.execute(select(Order).where(Order.id == uuid.UUID(oid)))
        ).scalar_one()
        order.created_at = base + timedelta(minutes=offset)
    await db_session.commit()

    res = await client.get(f"/restaurants/{rid}/orders", headers=headers)
    returned = [o["id"] for o in res.json()]
    assert returned == list(reversed(ids))


# ---------------------------------------------------------------------------
# CA-13 — sin rol → 403 no_role en GET y PATCH
# ---------------------------------------------------------------------------


async def test_list_orders_without_role_403(client: AsyncClient):
    owner = await as_user(client, email="owner@example.com")
    rid, _ = await _seed_order(client, owner)

    stranger = await as_user(client, email="stranger@example.com")
    res = await client.get(f"/restaurants/{rid}/orders", headers=stranger)
    assert res.status_code == 403
    assert res.json()["detail"] == "no_role"


async def test_patch_order_without_role_403(client: AsyncClient):
    owner = await as_user(client, email="owner@example.com")
    rid, oid = await _seed_order(client, owner)

    stranger = await as_user(client, email="stranger@example.com")
    res = await client.patch(
        f"/restaurants/{rid}/orders/{oid}",
        json={"status": "accepted"},
        headers=stranger,
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "no_role"


# ---------------------------------------------------------------------------
# Aislamiento cross-restaurant en la cola: owner de B no ve/toca pedidos de A
# ---------------------------------------------------------------------------


async def test_cross_restaurant_order_access_isolated(client: AsyncClient):
    owner_a = await as_user(client, email="a@example.com")
    rid_a, oid_a = await _seed_order(client, owner_a)

    owner_b = await as_user(client, email="b@example.com")
    rest_b = await make_restaurant(client, owner_b, name="Bar B")
    rid_b = rest_b["id"]

    # B pide la cola de su propio restaurant usando el order_id de A → order_not_found.
    res = await client.patch(
        f"/restaurants/{rid_b}/orders/{oid_a}",
        json={"status": "accepted"},
        headers=owner_b,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "order_not_found"

    # B no tiene rol sobre A → 403.
    res2 = await client.get(f"/restaurants/{rid_a}/orders", headers=owner_b)
    assert res2.status_code == 403


# ---------------------------------------------------------------------------
# CA-14 — borrar Item deja el OrderItem histórico con item_id NULL y snapshots
# ---------------------------------------------------------------------------


async def test_deleted_item_leaves_order_history_intact(
    client: AsyncClient, db_session: AsyncSession
):
    from sqlalchemy import text

    # SQLite skips ON DELETE SET NULL unless FK enforcement is enabled on the
    # connection (off by default). The in-memory engine shares one connection
    # (StaticPool), so this PRAGMA also applies to the request-side session.
    await db_session.execute(text("PRAGMA foreign_keys=ON"))

    headers = await as_user(client)
    restaurant = await make_restaurant(client, headers)
    rid, qr = restaurant["id"], restaurant["qr_token"]
    sid = await make_subcategory(client, headers, rid)
    iid = await make_item(client, headers, rid, sid, name="Ravioles", price="10.00")
    await enable_orders(client, headers, rid)

    order = (
        await client.post(
            f"/menu/{qr}/orders",
            json={
                "customer_name": "Ana",
                "order_type": "mesa",
                "items": [{"item_id": iid, "quantity": 1, "modifier_ids": []}],
            },
        )
    ).json()

    # Borrar el Item vivo.
    del_res = await client.delete(
        f"/restaurants/{rid}/subcategories/{sid}/items/{iid}", headers=headers
    )
    assert del_res.status_code == 204

    from app.models.order import OrderItem

    order_item = (
        await db_session.execute(
            select(OrderItem).where(OrderItem.order_id == uuid.UUID(order["id"]))
        )
    ).scalar_one()
    assert order_item.item_id is None
    assert order_item.name_snapshot == "Ravioles"
    assert str(order_item.unit_price_snapshot) == "10.00"
