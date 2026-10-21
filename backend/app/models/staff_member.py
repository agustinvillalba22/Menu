import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.restaurant import Restaurant


class StaffPosition(str, enum.Enum):
    mozo = "mozo"
    bartender = "bartender"
    jefe_cocina = "jefe_cocina"
    cajero = "cajero"
    gerente = "gerente"


class StaffMember(Base):
    """A roster entry for operational staff — identification only.

    No relation to `User`/auth: `pin` is a short identifier for future
    attribution UI (e.g. "who marked this order ready"), never a login
    credential. No gating reads `position` today.
    """

    __tablename__ = "staff_members"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "pin", name="uq_staff_members_restaurant_pin"),
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
    name: Mapped[str] = mapped_column(String, nullable=False)
    position: Mapped[StaffPosition] = mapped_column(
        Enum(StaffPosition, native_enum=False),
        nullable=False,
    )
    pin: Mapped[str] = mapped_column(String(4), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    restaurant: Mapped["Restaurant"] = relationship(
        "Restaurant",
        back_populates="staff_members",
    )
