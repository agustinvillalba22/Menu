import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class RestaurantRole(str, enum.Enum):
    owner = "owner"
    editor = "editor"


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(
        String,
        unique=True,
        index=True,
        nullable=False,
    )
    qr_token: Mapped[str] = mapped_column(
        String,
        unique=True,
        index=True,
        default=lambda: str(uuid.uuid4()),
        nullable=False,
    )
    orders_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    # relationships
    menus: Mapped[list["app.models.menu.Menu"]] = relationship(  # type: ignore[name-defined]
        "Menu",
        back_populates="restaurant",
        cascade="all, delete-orphan",
    )
    user_roles: Mapped[list["UserRestaurantRole"]] = relationship(
        "UserRestaurantRole",
        back_populates="restaurant",
        cascade="all, delete-orphan",
    )
    style: Mapped["app.models.style.MenuStyle | None"] = relationship(  # type: ignore[name-defined]
        "MenuStyle",
        back_populates="restaurant",
        cascade="all, delete-orphan",
        uselist=False,
    )


class UserRestaurantRole(Base):
    __tablename__ = "user_restaurant_roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[RestaurantRole] = mapped_column(
        Enum(RestaurantRole, native_enum=False),
        nullable=False,
    )

    # relationships
    restaurant: Mapped["Restaurant"] = relationship(
        "Restaurant",
        back_populates="user_roles",
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="restaurant_roles",
    )
