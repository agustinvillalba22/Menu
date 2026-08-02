import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String
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
    in a single dict.
    """

    utensils = "utensils"
    glass_water = "glass_water"
    pizza = "pizza"
    mug_hot = "mug_hot"
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
