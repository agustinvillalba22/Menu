import enum
import uuid
from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.item_modifier import ModifierType


class OrderStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    ready = "ready"
    completed = "completed"
    cancelled = "cancelled"


class OrderType(str, enum.Enum):
    mesa = "mesa"
    llevar = "llevar"
    envio = "envio"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    mercadopago = "mercadopago"


class PaymentStatus(str, enum.Enum):
    # `none` = cash orders (nothing to track online).
    none = "none"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, native_enum=False),
        nullable=False,
        default=OrderStatus.pending,
    )
    customer_name: Mapped[str] = mapped_column(String, nullable=False)
    order_type: Mapped[OrderType] = mapped_column(
        Enum(OrderType, native_enum=False),
        nullable=False,
    )
    table_or_address: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # Fase 0009 (P2): which menu the guest was browsing when ordering. SET NULL
    # (not CASCADE): deleting a menu must not destroy order history; null means
    # "ordered under the pre-P2 single-menu model" or the menu was removed.
    menu_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("menus.id", ondelete="SET NULL"),
        nullable=True,
    )
    # M17 — set only when order_type == 'mesa' and the guest picked a real
    # Table (vs. the free-text table_or_address fallback). SET NULL (not
    # CASCADE): deleting a table must not destroy order history.
    table_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tables.id", ondelete="SET NULL"),
        nullable=True,
    )
    # M28 — set when the order is completed while a cash shift is open. SET
    # NULL (not CASCADE): shifts are never deleted in practice, but order
    # history must survive if one is.
    cash_shift_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cash_shifts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # M28 — who handled the order (attribution only, no auth). The name is a
    # snapshot so history survives deleting the StaffMember (FK is SET NULL).
    handled_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("staff_members.id", ondelete="SET NULL"),
        nullable=True,
    )
    handled_by_name: Mapped[str | None] = mapped_column(String, nullable=True)
    # M36 — online payment tracking. Cash orders keep none/cash forever.
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, native_enum=False),
        nullable=False,
        default=PaymentMethod.cash,
        server_default=PaymentMethod.cash.value,
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, native_enum=False),
        nullable=False,
        default=PaymentStatus.none,
        server_default=PaymentStatus.none.value,
    )
    mp_preference_id: Mapped[str | None] = mapped_column(String, nullable=True)
    mp_payment_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    # relationships
    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
    )
    # One-directional: Menu keeps no `orders` backref — orders are read via
    # their own restaurant-scoped queries, never "through" a menu.
    menu: Mapped["app.models.menu.Menu | None"] = relationship(  # type: ignore[name-defined]
        "Menu",
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    # SET NULL (not CASCADE): deleting the live Item must not destroy order
    # history — the snapshots below keep the line legible with item_id=NULL.
    item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="SET NULL"),
        nullable=True,
    )
    name_snapshot: Mapped[str] = mapped_column(String, nullable=False)
    unit_price_snapshot: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    # Fase 0010: snapshot of the promo discount actually applied to this
    # line (NULL = none). unit_price_snapshot keeps the LIST price, subtotal
    # the actually-paid amount — discount_pct explains the difference so
    # history stays auditable after the promo is edited/deleted.
    discount_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    special_instructions: Mapped[str | None] = mapped_column(String, nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # relationships
    order: Mapped["Order"] = relationship("Order", back_populates="items")
    modifiers: Mapped[list["OrderItemModifier"]] = relationship(
        "OrderItemModifier",
        back_populates="order_item",
        cascade="all, delete-orphan",
    )


class OrderItemModifier(Base):
    __tablename__ = "order_item_modifiers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("order_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Pure snapshot — no FK to item_modifiers.id on purpose (M11 spec): the
    # historical order line must survive the live modifier being edited/deleted.
    name_snapshot: Mapped[str] = mapped_column(String, nullable=False)
    price_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    type: Mapped[ModifierType] = mapped_column(
        Enum(ModifierType, native_enum=False),
        nullable=False,
    )

    # relationships
    order_item: Mapped["OrderItem"] = relationship(
        "OrderItem",
        back_populates="modifiers",
    )
