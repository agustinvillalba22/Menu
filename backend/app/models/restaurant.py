import enum
import uuid
from datetime import time

from sqlalchemy import Boolean, Enum, ForeignKey, String, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class RestaurantRole(str, enum.Enum):
    owner = "owner"
    editor = "editor"


class RestaurantPlan(str, enum.Enum):
    # Gating for the dominio-propio feature (P3). Default `free` so existing
    # rows backfill to the lowest tier without loosing the NOT NULL constraint.
    free = "free"
    pro = "pro"
    premium = "premium"


class Weekday(enum.IntEnum):
    # 0=Mon .. 6=Sun — matches Python's `datetime.weekday()`, so `is_open_now`
    # (P6) can compare server-side without remapping.
    monday = 0
    tuesday = 1
    wednesday = 2
    thursday = 3
    friday = 4
    saturday = 5
    sunday = 6


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

    # --- Fase 0008 extensions (P3 / P6 / P7) — all nullable + backfilled ---
    # Strings default to "" (not NULL) so partial UPDATEs and existing rows keep
    # a deterministic empty-state instead of NULL-handling surprises.
    address: Mapped[str] = mapped_column(
        String, nullable=False, server_default="", default=""
    )
    phone: Mapped[str] = mapped_column(
        String, nullable=False, server_default="", default=""
    )
    whatsapp_phone: Mapped[str | None] = mapped_column(String, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    # IANA tz name. Empty string falls back to settings.DEFAULT_TIMEZONE in
    # `services.datetime.now_in` — keeps the column NOT NULL without forcing
    # every restaurant to pick one at signup.
    timezone: Mapped[str] = mapped_column(
        String, nullable=False, server_default="", default=""
    )
    # P3 — only the data model lands here; DNS/TLS infra is out of scope.
    custom_domain: Mapped[str | None] = mapped_column(String, nullable=True)
    plan: Mapped[RestaurantPlan] = mapped_column(
        Enum(RestaurantPlan, native_enum=False),
        nullable=False,
        server_default=RestaurantPlan.free.value,
        default=RestaurantPlan.free,
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
    business_hours: Mapped[list["BusinessHours"]] = relationship(
        "BusinessHours",
        back_populates="restaurant",
        cascade="all, delete-orphan",
        order_by="[BusinessHours.weekday, BusinessHours.open_time]",
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


class BusinessHours(Base):
    """One row per (restaurant, weekday) — P6.

    A restaurant can have at most one open/close window per weekday in this
    version; split shifts (lunch + dinner) are out of scope. A `UNIQUE
    (restaurant_id, weekday)` constraint enforces one-row-per-day at the DB
    level — same pattern as `menu_styles.restaurant_id`.
    """

    __tablename__ = "business_hours"
    # One row per (restaurant, weekday) — enforced at the DB level so the
    # dashboard "save all hours" form can upsert by weekday without races.
    # Mirrors the `UniqueConstraint` in the 0008 migration so SQLite tests
    # (Base.metadata.create_all) and Postgres stay in sync.
    __table_args__ = (
        UniqueConstraint(
            "restaurant_id", "weekday", name="uq_business_hours_restaurant_weekday"
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
    weekday: Mapped[int] = mapped_column(nullable=False)
    # Aware time-of-day (no date) — `is_open_now` (P6) combines it with today's
    # date in the restaurant tz.
    open_time: Mapped[time] = mapped_column(Time, nullable=False)
    close_time: Mapped[time] = mapped_column(Time, nullable=False)

    # relationships
    restaurant: Mapped["Restaurant"] = relationship(
        "Restaurant",
        back_populates="business_hours",
    )