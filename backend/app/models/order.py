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

    # relationships
    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
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
