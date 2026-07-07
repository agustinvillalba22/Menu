import enum
import uuid
from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ModifierType(str, enum.Enum):
    extra = "extra"
    removal = "removal"


class ItemModifier(Base):
    __tablename__ = "item_modifiers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    # price_delta can be negative (removal) or positive (extra); unlike
    # Item.price it is NOT constrained to >= 0. See M11 spec, open question 1.
    price_delta: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    type: Mapped[ModifierType] = mapped_column(
        Enum(ModifierType, native_enum=False),
        nullable=False,
    )

    # relationships
    item: Mapped["app.models.item.Item"] = relationship(  # type: ignore[name-defined]
        "Item",
        back_populates="modifiers",
    )
