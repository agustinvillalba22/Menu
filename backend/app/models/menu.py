import enum
import uuid
from datetime import time

from sqlalchemy import Boolean, Enum, ForeignKey, SmallInteger, String, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CategoryType(str, enum.Enum):
    food = "food"
    drink = "drink"


class CategoryIcon(str, enum.Enum):
    """Curated icon keys for P8 (chips de categoría con ícono).

    Stored as ``native_enum=False`` text — same pattern as the other enums —
    so adding new icon keys later is a Python-only change (no migration
    needed), and the frontend (Fase 1c) maps each key to a Lucide component
    in a single dict. Only keys with a concrete Lucide component counterpart
    are listed here — the union is intentional, not aspirational.
    """

    utensils = "utensils"
    glass_water = "glass_water"
    pizza = "pizza"
    beer = "beer"
    wine = "wine"
    cake = "cake"
    coffee = "coffee"
    ice_cream = "ice_cream"
    salad = "salad"
    soup = "soup"
    fish = "fish"
    beef = "beef"
    chicken = "chicken"
    # `bread`/`cookies`/`chicken` don't have a 1:1 Lucide name in this version;
    # the frontend maps them onto `Sandwich`/`Cookie`/`Drumstick` respectively —
    # the key stays human-readable, the visual is just a substitute.
    bread = "bread"
    cookies = "cookies"
    croissant = "croissant"
    flame = "flame"
    sparkles = "sparkles"
    chef_hat = "chef_hat"
    cup_soda = "cup_soda"
    more_horizontal = "more_horizontal"
    clipboard_list = "clipboard_list"


class Menu(Base):
    __tablename__ = "menus"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
    )

    # --- Fase 0009 (P2) — multi-menu scheduling, back-compat mode ---
    # The auto-created menu of every restaurant keeps ``is_default=True`` and
    # null scheduling fields, so it is always active (back-compat). Future
    # menus created via CRUD (Fase 3) default to False — the dashboard then
    # marks exactly one menu per restaurant as default.
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    # Optional daily activation window (restaurant tz). Null start_time means
    # "no schedule" — the menu is only reachable via the is_default fallback.
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    # Bitmask of active weekdays: bit i set = weekday i active (0=Mon..6=Sun,
    # matching ``datetime.weekday()``). Null means "every day"; 0 is rejected
    # at the service layer (a menu active no days is a configuration bug).
    weekday_mask: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )

    # relationships
    restaurant: Mapped["app.models.restaurant.Restaurant"] = relationship(  # type: ignore[name-defined]
        "Restaurant",
        back_populates="menus",
    )
    categories: Mapped[list["Category"]] = relationship(
        "Category",
        back_populates="menu",
        cascade="all, delete-orphan",
    )


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    menu_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("menus.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[CategoryType] = mapped_column(
        Enum(CategoryType, native_enum=False),
        nullable=False,
    )
    # Fase 0008 (P8): nullable curated icon key — null means "no icon", the
    # frontend renders a text-only chip. Stored as text (native_enum=False)
    # so adding new icon keys later is a Python-only change.
    icon: Mapped["CategoryIcon | None"] = mapped_column(
        Enum(CategoryIcon, native_enum=False),
        nullable=True,
        default=None,
    )

    # relationships
    menu: Mapped["Menu"] = relationship("Menu", back_populates="categories")
    subcategories: Mapped[list["Subcategory"]] = relationship(
        "Subcategory",
        back_populates="category",
        cascade="all, delete-orphan",
    )


class Subcategory(Base):
    __tablename__ = "subcategories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
    )

    # relationships
    category: Mapped["Category"] = relationship("Category", back_populates="subcategories")
    items: Mapped[list["app.models.item.Item"]] = relationship(  # type: ignore[name-defined]
        "Item",
        back_populates="subcategory",
        cascade="all, delete-orphan",
    )
