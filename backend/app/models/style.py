import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class FontFamily(str, enum.Enum):
    inter = "Inter"
    playfair_display = "Playfair Display"
    poppins = "Poppins"
    dm_sans = "DM Sans"


class MenuStyle(Base):
    __tablename__ = "menu_styles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    font_family: Mapped[FontFamily] = mapped_column(
        Enum(FontFamily, native_enum=False),
        nullable=False,
        default=FontFamily.inter,
    )
    primary_color: Mapped[str | None] = mapped_column(String, nullable=True)
    secondary_color: Mapped[str | None] = mapped_column(String, nullable=True)

    # relationships
    restaurant: Mapped["app.models.restaurant.Restaurant"] = relationship(  # type: ignore[name-defined]
        "Restaurant",
        back_populates="style",
    )
