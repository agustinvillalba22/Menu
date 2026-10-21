import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Supplier(Base):
    __tablename__ = "suppliers"

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
    # Free text, not an enum — a supplier's trade category doesn't have to be
    # one of the 5 StockCategory values (e.g. "Insumos de limpieza").
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    delivery_days: Mapped[str | None] = mapped_column(String, nullable=True)
    payment_terms: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    restaurant: Mapped["app.models.restaurant.Restaurant"] = relationship(  # type: ignore[name-defined]
        "Restaurant",
        back_populates="suppliers",
    )
    stock_items: Mapped[list["app.models.stock_item.StockItem"]] = relationship(  # type: ignore[name-defined]
        "StockItem",
        back_populates="supplier",
    )
