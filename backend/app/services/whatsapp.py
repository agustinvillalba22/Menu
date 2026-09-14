"""WhatsApp confirmation URL builder (P7) — Fase 1d.

Owns the only place that knows how to format an order into a `wa.me` deep
link. Reads exclusively from the order's *snapshot* columns (``name_snapshot``,
``unit_price_snapshot``, ``subtotal``) — never from the live menu — so the
message the customer sees on WhatsApp matches exactly what was persisted at
checkout time, even if the owner edits a price minutes later (M11 RF-05
parity: the same invariant the order rows already enforce).

Returns ``None`` when the restaurant has no ``whatsapp_phone`` set; the
checkout UI hides the button in that case (P7 spec — the button is optional,
not a hard requirement).
"""
from decimal import Decimal
from urllib.parse import quote

from app.models.order import Order
from app.models.restaurant import Restaurant


def _format_amount(v: Decimal) -> str:
    """Render with two decimals — matches the rest of the order API."""
    return f"{v:.2f}"


def _format_message(order: Order, restaurant: Restaurant) -> str:
    """Compose a short, plain-text order summary for WhatsApp.

    Plain ASCII + newlines (no markdown — WhatsApp renders the sender's
    text as-is). Line breaks are real `\n` so `wa.me` URL-encodes them into
    `%0A` via ``quote``, which WhatsApp then decodes back to line breaks
    in the composer. Keeping the builder testable means composing the
    string here and letting the caller URL-encode it.
    """
    lines: list[str] = []
    lines.append(f"Nuevo pedido — {restaurant.name}")
    lines.append(f"Cliente: {order.customer_name}")
    if order.table_or_address:
        label = {
            "mesa": "Mesa",
            "llevar": "Para llevar",
            "envio": "Envío",
        }.get(order.order_type, "Entrega")
        lines.append(f"{label}: {order.table_or_address}")
    lines.append("")
    for item in order.items:
        # The snapshot name is what the customer picked, even if the item was
        # since renamed — matches what they'd see in their own order row.
        line = f"• {item.quantity}× {item.name_snapshot}"
        mods = ", ".join(m.name_snapshot for m in item.modifiers)
        if mods:
            line += f" ({mods})"
        line += f" — ${_format_amount(item.subtotal)}"
        if item.special_instructions:
            line += f" | {item.special_instructions}"
        lines.append(line)
    lines.append("")
    lines.append(f"Total: ${_format_amount(order.total)}")
    if order.notes:
        lines.append(f"Notas: {order.notes}")
    return "\n".join(lines)


def build_whatsapp_url(order: Order, restaurant: Restaurant) -> str | None:
    """Build a ``https://wa.me/{phone}?text={msg}`` deep link, or None.

    ``None`` is the explicit "no WhatsApp number configured" signal: the
    checkout UI hides the button (P7). The phone is stored without the
    leading ``+`` (see ``RestaurantInfoUpdate`` validation), which is what
    ``wa.me`` expects — no extra normalization here.
    """
    phone = restaurant.whatsapp_phone
    if not phone:
        return None
    message = _format_message(order, restaurant)
    return f"https://wa.me/{phone}?text={quote(message)}"