import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Promo(Base, TimestampMixin):
    """Promotional banner (P4) — one row per promo, per restaurant.

    The public menu renders the *active* promo (see the public service in
    Fase 2c): ``is_active=True`` AND ``now`` within ``[starts_at, ends_at]``
    (both bounds optional) in the restaurant's timezone. No periodic job
    flips ``is_active`` — the window check is implicit at read time.

    ``item_id`` is SET NULL on item delete: a promo about a deleted item
    stays readable (title/subtitle/discount keep meaning), the item link
    just disappears. Same snapshot-philosophy as ``OrderItem.item_id``.
    """

    __tablename__ = "promos"

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
    title: Mapped[str] = mapped_column(String, nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    # Optional whole-number discount, 0-100 (validated at the schema layer).
    discount_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    # Optional validity window, aware datetimes in the restaurant's tz.
    # Null starts_at/ends_at means unbounded on that side.
    starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # relationships
    restaurant: Mapped["app.models.restaurant.Restaurant"] = relationship(  # type: ignore[name-defined]
        "Restaurant",
        back_populates="promos",
    )
    # One-directional on purpose: Item has no `promos` backref — the promo
    # form only needs to read the linked item, items never list their promos.
    item: Mapped["app.models.item.Item | None"] = relationship(  # type: ignore[name-defined]
        "Item",
    )
