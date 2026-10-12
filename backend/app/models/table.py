import uuid

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Table(Base):
    """A physical table at a restaurant (M17) — number + optional capacity.

    No floor-plan positioning (x/y) by deliberate scope decision — this is a
    list-and-occupancy feature, not a visual layout editor.
    """

    __tablename__ = "tables"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "number", name="uq_tables_restaurant_number"),
    )

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
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # relationships
    restaurant: Mapped["app.models.restaurant.Restaurant"] = relationship(  # type: ignore[name-defined]
        "Restaurant",
        back_populates="tables",
    )
