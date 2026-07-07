import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Item(Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    subcategory_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subcategories.id", ondelete="CASCADE"),
        nullable=False,
    )

    # relationships
    subcategory: Mapped["app.models.menu.Subcategory"] = relationship(  # type: ignore[name-defined]
        "Subcategory",
        back_populates="items",
    )
    tags: Mapped[list["ItemTag"]] = relationship(
        "ItemTag",
        back_populates="item",
        cascade="all, delete-orphan",
    )
    modifiers: Mapped[list["app.models.item_modifier.ItemModifier"]] = relationship(  # type: ignore[name-defined]
        "ItemModifier",
        back_populates="item",
        cascade="all, delete-orphan",
    )


class ItemTag(Base):
    __tablename__ = "item_tags"
    __table_args__ = (
        UniqueConstraint("item_id", "name", name="uq_item_tag"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
    )

    # relationships
    item: Mapped["Item"] = relationship("Item", back_populates="tags")
