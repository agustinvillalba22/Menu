import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class PromoScope(str, enum.Enum):
    """What the promo's discount applies to (Fase 0010).

    ``none``    — banner only: the promo advertises but discounts nothing.
    ``item``    — discount_pct applies to the linked item's order lines.
    ``category``— discount_pct applies to every item of the linked category.
    ``catalog`` — discount_pct applies to every item of the restaurant.
    """

    none = "none"
    item = "item"
    category = "category"
    catalog = "catalog"


class Promo(Base, TimestampMixin):
    """Promotional banner (P4) — one row per promo, per restaurant.

    The public menu renders the *active* promo (see the public service in
    Fase 2c): ``is_active=True`` AND ``now`` within ``[starts_at, ends_at]``
    (both bounds optional) in the restaurant's timezone. No periodic job
    flips ``is_active`` — the window check is implicit at read time.

    ``item_id`` is SET NULL on item delete: a promo about a deleted item
    stays readable (title/subtitle/discount keep meaning), the item link
    just disappears. Same snapshot-philosophy as ``OrderItem.item_id``.
    ``category_id`` follows the same rule for category-scoped promos.

    The discount only applies to what ``scope`` points at (Fase 0010);
    ``scope='none'`` promos are pure advertising.
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
    # Only applies when scope != 'none' (and then it is required).
    discount_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    # Fase 0010 — what the discount applies to.
    scope: Mapped[PromoScope] = mapped_column(
        Enum(PromoScope, native_enum=False),
        nullable=False,
        default=PromoScope.none,
        server_default=PromoScope.none.value,
    )
    item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="SET NULL"),
        nullable=True,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
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
    # One-directional on purpose: Item/Category have no `promos` backref —
    # the promo form only needs to read the linked rows, they never list
    # their promos.
    item: Mapped["app.models.item.Item | None"] = relationship(  # type: ignore[name-defined]
        "Item",
    )
    category: Mapped["app.models.menu.Category | None"] = relationship(  # type: ignore[name-defined]
        "Category",
    )
