import secrets
import uuid
from decimal import Decimal, ROUND_HALF_UP

import httpx
from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.item import Item
from app.models.item_modifier import ItemModifier
from app.models.order import (
    Order,
    OrderItem,
    OrderItemModifier,
    OrderStatus,
    OrderType,
    PaymentMethod,
    PaymentStatus,
)
from app.models.payment_account import PaymentAccount, PaymentAccountStatus
from app.models.restaurant import Restaurant
from app.models.cash_shift import CashShift
from app.models.staff_member import StaffMember
from app.models.table import Table
from app.schemas.order import OrderCreate, OrderItemCreate
from app.core.config import settings
from app.services.cash_shift import get_open_shift
from app.services.mercadopago import (
    MercadoPagoError,
    PaymentAccountDisconnected,
    create_preference,
    get_account,
    get_seller_token,
)
from app.services.menu import resolve_active_menu
from app.services.staff_member import get_active_staff_member
from app.services.promo import active_promo_for, promo_discount_pct
from app.services.public_menu import get_public_menu

# Numeric(10, 2) columns (subtotal/total) top out at 8 integer digits. The
# per-request bounds on quantity/items/modifier_ids make
# this very hard to hit organically, but a near-max-price item combined with
# the max allowed quantity across many lines can still overflow it. Reject
# that explicitly with a 422 instead of letting Postgres raise an unhandled
# DataError on INSERT (SQLite's lax NUMERIC affinity would silently accept
# it, masking the bug in tests).
# 32 random bytes -> 43-char urlsafe token (256 bits of entropy).
PUBLIC_TOKEN_BYTES = 32
_MAX_AMOUNT = Decimal("99999999.99")


def _check_amount(value: Decimal) -> None:
    if value > _MAX_AMOUNT:
        raise HTTPException(status_code=422, detail="amount_too_large")


# Allowed status transitions. Terminal states (completed,
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
    enforces cross-restaurant integrity: an item_id from another
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
    """Re-fetch an Order with its lines and modifiers eagerly loaded."""
    result = await session.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items).selectinload(OrderItem.modifiers))
    )
    return result.scalar_one()


def _apply_discount(value: Decimal, pct: int) -> Decimal:
    """Apply a whole-number % discount, quantized to cents."""
    factor = Decimal(100 - pct) / Decimal(100)
    return (value * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _build_line(item: Item, line: OrderItemCreate, promo=None) -> OrderItem:
    """Build an OrderItem (with modifier snapshots) for a single payload line.

    The server recomputes every price from live DB values; nothing from the
    client body except item_id/modifier_ids/quantity/special_instructions is
    trusted.

    The active promo's discount (scope-matched) is applied to the
    effective unit price — base + modifiers, clamped at 0.
    ``unit_price_snapshot`` keeps the LIST price and ``discount_pct``
    snapshots what was applied, so order history explains its own subtotal.
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
    # Negative modifiers (type=removal) must not push the
    # effective unit price below $0. Clamp before multiplying by quantity so
    # a high quantity cannot hide a would-be-negative unit price.
    effective_unit_price = max(unit_price + modifiers_total, Decimal("0"))
    discount_pct = promo_discount_pct(promo, item)
    if discount_pct is not None:
        effective_unit_price = _apply_discount(effective_unit_price, discount_pct)
    subtotal: Decimal = effective_unit_price * line.quantity
    _check_amount(subtotal)

    return OrderItem(
        item_id=item.id,
        name_snapshot=item.name,
        unit_price_snapshot=unit_price,
        discount_pct=discount_pct,
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


async def _require_seller_account(
    restaurant_id: uuid.UUID, session: AsyncSession
) -> PaymentAccount:
    """A connected account on a configured server, else 409."""
    account = await get_account(restaurant_id, session)
    if (
        not settings.mercadopago_configured
        or account is None
        or account.status != PaymentAccountStatus.connected
    ):
        raise HTTPException(status_code=409, detail="mercadopago_unavailable")
    return account


async def _seller_token_or_409(
    account: PaymentAccount, session: AsyncSession, mp_client: httpx.AsyncClient
) -> str:
    try:
        return await get_seller_token(account, session, mp_client)
    except PaymentAccountDisconnected:
        raise HTTPException(status_code=409, detail="mercadopago_unavailable")


async def _start_checkout(
    order: Order,
    restaurant: Restaurant,
    token: str,
    mp_client: httpx.AsyncClient,
    session: AsyncSession,
) -> str:
    """Create the MP preference for a just-persisted order.

    On any provider failure the order is marked ``cancelled`` so it can never
    linger as a ``pending`` payment without a preference, and 502 is raised.
    Returns the preference ``init_point``.
    """
    try:
        preference_id, init_point = await create_preference(
            order, restaurant, token, mp_client
        )
    except MercadoPagoError:
        order.payment_status = PaymentStatus.cancelled
        await session.commit()
        raise HTTPException(status_code=502, detail="payment_provider_error")
    order.mp_preference_id = preference_id
    await session.commit()
    return init_point


async def create_order(
    qr_token: str,
    data: OrderCreate,
    session: AsyncSession,
    mp_client: httpx.AsyncClient | None = None,
) -> tuple[Order, Restaurant]:
    """Create a public order for the restaurant resolved by ``qr_token``.

    Resolution/validation order:
      1. 404 menu_not_found  — token resolves to no restaurant.
      2. 404 orders_disabled — restaurant.orders_enabled is False.
      3. 404 item_not_found  — an item_id is missing or belongs elsewhere.
      4. 404 modifier_not_found — a modifier_id does not belong to its line item.
    With ``payment_method=mercadopago`` a 409 mercadopago_unavailable is
    checked right after (2) and nothing is created if the seller account is
    missing/unusable; after persisting, the Checkout Pro preference is created
    (502 payment_provider_error + order cancelled on failure) and the
    ``init_point`` is exposed on the returned order as ``payment_url``.
    Total is recomputed entirely server-side.

    Returns ``(order, restaurant)`` because the public router needs the
    restaurant's ``whatsapp_phone`` to build the optional WhatsApp confirm
    URL on the just-persisted order. Other callers (list/patch) only
    need the order; they get the restaurant through the URL's id.
    """
    restaurant = await get_public_menu(qr_token, session)
    if not restaurant.orders_enabled:
        raise HTTPException(status_code=404, detail="orders_disabled")
    pay_online = data.payment_method == PaymentMethod.mercadopago
    seller_account = (
        await _require_seller_account(restaurant.id, session) if pay_online else None
    )

    # A real Table takes precedence over free-text table_or_address —
    # server-stamps the display text so a spoofed client value can never show
    # a table number that doesn't exist.
    table_id = data.table_id
    table_or_address = data.table_or_address
    if data.order_type == OrderType.mesa and data.table_id is not None:
        result = await session.execute(
            select(Table).where(
                Table.id == data.table_id, Table.restaurant_id == restaurant.id
            )
        )
        table = result.scalar_one_or_none()
        if table is None:
            raise HTTPException(status_code=404, detail="table_not_found")
        table_or_address = f"Mesa {table.number}"
    else:
        table_id = None

    items_by_id = _collect_items(restaurant)

    # Resolve the active promo once (eager-loaded, no extra
    # query) — the same rule the public cart applied client-side, but
    # recomputed here from live rows. Server is authoritative.
    promo = active_promo_for(restaurant)

    order_items: list[OrderItem] = []
    for line in data.items:
        item = items_by_id.get(line.item_id)
        if item is None:
            raise HTTPException(status_code=404, detail="item_not_found")
        order_items.append(_build_line(item, line, promo))

    total: Decimal = sum(
        (oi.subtotal for oi in order_items), start=Decimal("0")
    )
    _check_amount(total)

    seller_token: str | None = None
    if seller_account is not None:
        if mp_client is None:
            raise RuntimeError("mp_client is required for mercadopago orders")
        seller_token = await _seller_token_or_409(seller_account, session, mp_client)

    # Stamp which menu the guest was browsing. Items are still
    # collected across ALL menus (a cart can outlive a menu switch mid-meal);
    # menu_id is provenance, not an integrity constraint.
    active_menu = resolve_active_menu(restaurant)

    order = Order(
        restaurant_id=restaurant.id,
        status=OrderStatus.pending,
        customer_name=data.customer_name,
        order_type=data.order_type,
        table_or_address=table_or_address,
        table_id=table_id,
        notes=data.notes,
        total=total,
        menu_id=active_menu.id if active_menu is not None else None,
        items=order_items,
        payment_method=data.payment_method,
        payment_status=PaymentStatus.pending if pay_online else PaymentStatus.none,
        public_token=secrets.token_urlsafe(PUBLIC_TOKEN_BYTES),
    )
    session.add(order)
    await session.commit()
    init_point = None
    if seller_token is not None:
        init_point = await _start_checkout(
            order, restaurant, seller_token, mp_client, session
        )
    order = await _load_order(order.id, session)
    order.payment_url = init_point  # type: ignore[attr-defined]  # transient, not a column
    return order, restaurant


async def list_orders(
    restaurant_id: uuid.UUID,
    status_filter: OrderStatus | None,
    session: AsyncSession,
) -> list[Order]:
    """List a restaurant's orders (newest first), optionally filtered by status.

    Mercado Pago orders only appear once their payment is approved
    (the kitchen must not cook unpaid orders); cash orders are unaffected.
    """
    query = (
        select(Order)
        .where(
            Order.restaurant_id == restaurant_id,
            or_(
                Order.payment_method == PaymentMethod.cash,
                Order.payment_status == PaymentStatus.approved,
            ),
        )
        .options(selectinload(Order.items).selectinload(OrderItem.modifiers))
        .order_by(Order.created_at.desc())
    )
    if status_filter is not None:
        query = query.where(Order.status == status_filter)
    result = await session.execute(query)
    return list(result.scalars().all())


def check_transition(order: Order, new_status: OrderStatus) -> None:
    """Raise 409 invalid_transition unless the state machine allows it."""
    if new_status not in _VALID_TRANSITIONS[order.status]:
        raise HTTPException(status_code=409, detail="invalid_transition")


def apply_status_change(
    order: Order,
    new_status: OrderStatus,
    shift: CashShift | None,
    member: StaffMember | None,
) -> None:
    """Mutate ``order`` for an already-validated transition (no commit).

    Completing links the open cash shift (if any); a staff member, if given,
    is stamped as handler. Shared by PATCH /orders and the table checkout.
    """
    if new_status == OrderStatus.completed and shift is not None:
        order.cash_shift_id = shift.id
    if member is not None:
        order.handled_by_id = member.id
        order.handled_by_name = member.name
    order.status = new_status


async def update_order_status(
    restaurant_id: uuid.UUID,
    order_id: uuid.UUID,
    new_status: OrderStatus,
    session: AsyncSession,
    staff_member_id: uuid.UUID | None = None,
) -> Order:
    """Transition an order's status, enforcing the state machine.

    An optional active ``staff_member_id`` is stamped as handler (last
    one wins; omitted leaves the previous value), and completing the order
    links it to the restaurant's open cash shift, if any. All validation
    happens before any mutation.
    """
    result = await session.execute(
        select(Order).where(
            Order.id == order_id,
            Order.restaurant_id == restaurant_id,
        )
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="order_not_found")
    check_transition(order, new_status)
    member = None
    if staff_member_id is not None:
        member = await get_active_staff_member(restaurant_id, staff_member_id, session)
    shift = None
    if new_status == OrderStatus.completed:
        shift = await get_open_shift(restaurant_id, session)
    apply_status_change(order, new_status, shift, member)
    await session.commit()
    return await _load_order(order.id, session)
