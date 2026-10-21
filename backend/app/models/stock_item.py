import enum
import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.restaurant import Restaurant
    from app.models.supplier import Supplier


class StockCategory(str, enum.Enum):
    carnes_pescados = "carnes_pescados"
    verduras_frescos = "verduras_frescos"
    almacen_secos = "almacen_secos"
    lacteos = "lacteos"
    bebidas_licores = "bebidas_licores"


class StockUnit(str, enum.Enum):
    kg = "kg"
    g = "g"
    l = "l"  # noqa: E741 - unit symbol for litres
    unidades = "unidades"
    botellas = "botellas"


class StockItem(Base):
    """Manually-managed inventory row — no link to menu Items/Orders.

    Quantity is never decremented automatically; the owner updates it by
    hand.
    """

    __tablename__ = "stock_items"

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
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[StockCategory] = mapped_column(
        Enum(StockCategory, native_enum=False),
        nullable=False,
    )
    unit: Mapped[StockUnit] = mapped_column(
        Enum(StockUnit, native_enum=False),
        nullable=False,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    min_threshold: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0")
    )
    cost_per_unit: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    # SET NULL (not CASCADE): deleting a supplier must not destroy the stock
    # rows that bought from it — just unlink them (same philosophy as
    # orders.table_id).
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="SET NULL"),
        nullable=True,
    )
    last_restocked: Mapped[date | None] = mapped_column(Date, nullable=True)

    restaurant: Mapped["Restaurant"] = relationship(
        "Restaurant",
        back_populates="stock_items",
    )
    supplier: Mapped["Supplier | None"] = relationship(
        "Supplier",
        back_populates="stock_items",
    )
