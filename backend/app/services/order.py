import uuid
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.item import Item
from app.models.item_modifier import ItemModifier
from app.models.order import Order, OrderItem, OrderItemModifier, OrderStatus
from app.models.restaurant import Restaurant
from app.schemas.order import OrderCreate, OrderItemCreate
from app.services.public_menu import get_public_menu

# Numeric(10, 2) columns (subtotal/total) top out at 8 integer digits. The
# per-request bounds on quantity/items/modifier_ids (M11 review CRIT-01) make
# this very hard to hit organically, but a near-max-price item combined with
# the max allowed quantity across many lines can still overflow it. Reject
# that explicitly with a 422 instead of letting Postgres raise an unhandled
# DataError on INSERT (SQLite's lax NUMERIC affinity would silently accept
# it, masking the bug in tests).
_MAX_AMOUNT = Decimal("99999999.99")


def _check_amount(value: Decimal) -> None:
    if value > _MAX_AMOUNT:
        raise HTTPException(status_code=422, detail="amount_too_large")


# Allowed status transitions (M11 RF-07). Terminal states (completed,
# cancelled) map to an empty set — no outgoing transition is permitted.
_VALID_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.pending: {OrderStatus.accepted, OrderStatus.cancelled},
    OrderStatus.accepted: {OrderStatus.ready, OrderStatus.cancelled},
    OrderStatus.ready: {OrderStatus.completed, OrderStatus.cancelled},
    OrderStatus.completed: set(),
    OrderStatus.cancelled: set(),
}


def _collect_items(restaurant: Restaurant) -> dict[uuid.UUID, Item]:
    """Flatten the eager-loaded menu tree into an {item_id: Item} map.

    Only items reachable from this restaurant's menu are included, which is what
    enforces cross-restaurant integrity (RNF-02): an item_id from another
    restaurant simply will not be present in the map.
    """
    items: dict[uuid.UUID, Item] = {}
    for menu in restaurant.menus:
        for category in menu.categories:
            for subcategory in category.subcategories:
                for item in subcategory.items:
                    items[item.id] = item
    return items


async def _load_order(order_id: uuid.UUID, session: AsyncSession) -> Order:
    """Re-fetch an Order with its lines and modifiers eagerly loaded (RNF-03)."""
    result = await session.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items).selectinload(OrderItem.modifiers))
    )
    return result.scalar_one()


def _build_line(item: Item, line: OrderItemCreate) -> OrderItem:
    """Build an OrderItem (with modifier snapshots) for a single payload line.

    The server recomputes every price from live DB values; nothing from the
    client body except item_id/modifier_ids/quantity/special_instructions is
    trusted (M11 RF-05, CA-05).
    """
    modifiers_by_id: dict[uuid.UUID, ItemModifier] = {
        m.id: m for m in item.modifiers
    }
    chosen: list[ItemModifier] = []
    for modifier_id in line.modifier_ids:
        modifier = modifiers_by_id.get(modifier_id)
        if modifier is None:
            raise HTTPException(status_code=404, detail="modifier_not_found")
        chosen.append(modifier)

    unit_price: Decimal = item.price
    modifiers_total: Decimal = sum(
        (m.price_delta for m in chosen), start=Decimal("0")
    )
    # M11.1 RF-01/RF-02: negative modifiers (type=removal) must not push the
    # effective unit price below $0. Clamp before multiplying by quantity so
    # a high quantity cannot hide a would-be-negative unit price.
    effective_unit_price = max(unit_price + modifiers_total, Decimal("0"))
    subtotal: Decimal = effective_unit_price * line.quantity
    _check_amount(subtotal)

    return OrderItem(
        item_id=item.id,
        name_snapshot=item.name,
        unit_price_snapshot=unit_price,
        quantity=line.quantity,
        special_instructions=line.special_instructions,
        subtotal=subtotal,
        modifiers=[
            OrderItemModifier(
                name_snapshot=m.name,
                price_snapshot=m.price_delta,
                type=m.type,
            )
            for m in chosen
        ],
    )


async def create_order(
    qr_token: str, data: OrderCreate, session: AsyncSession
) -> Order:
    """Create a public order for the restaurant resolved by ``qr_token``.

    Resolution/validation order (M11 RF-05):
      1. 404 menu_not_found  — token resolves to no restaurant.
      2. 404 orders_disabled — restaurant.orders_enabled is False.
      3. 404 item_not_found  — an item_id is missing or belongs elsewhere.
      4. 404 modifier_not_found — a modifier_id does not belong to its line item.
    Total is recomputed entirely server-side.
    """
    restaurant = await get_public_menu(qr_token, session)
    if not restaurant.orders_enabled:
        raise HTTPException(status_code=404, detail="orders_disabled")

    items_by_id = _collect_items(restaurant)

    order_items: list[OrderItem] = []
    for line in data.items:
        item = items_by_id.get(line.item_id)
        if item is None:
            raise HTTPException(status_code=404, detail="item_not_found")
        order_items.append(_build_line(item, line))

    total: Decimal = sum(
        (oi.subtotal for oi in order_items), start=Decimal("0")
    )
    _check_amount(total)

    order = Order(
        restaurant_id=restaurant.id,
        status=OrderStatus.pending,
        customer_name=data.customer_name,
        order_type=data.order_type,
        table_or_address=data.table_or_address,
        notes=data.notes,
        total=total,
        items=order_items,
    )
    session.add(order)
    await session.commit()
    return await _load_order(order.id, session)


async def list_orders(
    restaurant_id: uuid.UUID,
    status_filter: OrderStatus | None,
    session: AsyncSession,
) -> list[Order]:
    """List a restaurant's orders (newest first), optionally filtered by status."""
    query = (
        select(Order)
        .where(Order.restaurant_id == restaurant_id)
        .options(selectinload(Order.items).selectinload(OrderItem.modifiers))
        .order_by(Order.created_at.desc())
    )
    if status_filter is not None:
        query = query.where(Order.status == status_filter)
    result = await session.execute(query)
    return list(result.scalars().all())


async def update_order_status(
    restaurant_id: uuid.UUID,
    order_id: uuid.UUID,
    new_status: OrderStatus,
    session: AsyncSession,
) -> Order:
    """Transition an order's status, enforcing the M11 state machine (RF-07)."""
    result = await session.execute(
        select(Order).where(
            Order.id == order_id,
            Order.restaurant_id == restaurant_id,
        )
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="order_not_found")
    if new_status not in _VALID_TRANSITIONS[order.status]:
        raise HTTPException(status_code=409, detail="invalid_transition")
    order.status = new_status
    await session.commit()
    return await _load_order(order.id, session)
