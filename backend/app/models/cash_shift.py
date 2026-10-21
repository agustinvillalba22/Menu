import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CashShift(Base):
    """A cash-register shift: open/close with arqueo.

    `opened_by_id`/`closed_by_id` point to the StaffMember roster as
    attribution only (no auth). The `*_name` columns are snapshots so history
    survives deleting the staff member (FK is SET NULL).
    `expected_amount` is a snapshot computed server-side at close; the
    difference (counted - expected) is derived in the read schema.
    """

    __tablename__ = "cash_shifts"
    __table_args__ = (
        # At most one open shift per restaurant, enforced at DB level.
        Index(
            "ux_cash_shifts_one_open",
            "restaurant_id",
            unique=True,
            postgresql_where=text("closed_at IS NULL"),
            sqlite_where=text("closed_at IS NULL"),
        ),
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
    opened_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("staff_members.id", ondelete="SET NULL"),
        nullable=True,
    )
    opened_by_name: Mapped[str] = mapped_column(String, nullable=False)
    # Python-side default gives microsecond precision (server default alone is
    # second-resolution on SQLite); server_default stays as a DB-level fallback.
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        server_default=func.now(),
        nullable=False,
    )
    opening_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    closed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("staff_members.id", ondelete="SET NULL"),
        nullable=True,
    )
    closed_by_name: Mapped[str | None] = mapped_column(String, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    counted_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    expected_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
