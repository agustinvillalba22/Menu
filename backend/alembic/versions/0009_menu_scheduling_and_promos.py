"""menu_scheduling_and_promos

Fase 0009 — P2 (multi-menu scheduling) + P4 (promotional banners) data model.

``menus`` gains the scheduling columns:
  - ``is_default`` — NOT NULL, server_default false, then backfilled to true
    for every existing menu: today each restaurant has exactly one menu, so
    all of them keep rendering (back-compat mode — null scheduling fields +
    is_default=true means "always active").
  - ``start_time``/``end_time`` — nullable aware-time-of-day window.
  - ``weekday_mask`` — nullable 7-bit bitmask (0=Mon..6=Sun); CHECKed to
    0-127 when present.

``orders.menu_id`` (P2): nullable FK to ``menus`` with SET NULL — deleting a
menu never destroys order history, mirroring ``order_items.item_id``.

New table ``promos`` (P4): one row per promo per restaurant, optional
``discount_pct`` (CHECK 0-100), optional linked ``item_id`` (SET NULL —
a promo survives its item being deleted), optional validity window
``starts_at``/``ends_at`` (aware datetimes), plus TimestampMixin columns.

Revertible: ``downgrade`` drops the FK, the promos table, and the menus
columns in reverse dependency order, leaving the schema exactly as it was
at 0008.

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, Sequence[str], None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- menus: scheduling columns (P2) ---
    # server_default=false satisfies NOT NULL against existing rows; the
    # UPDATE right after flips every existing menu to default (each
    # restaurant has exactly one menu today, and it must stay always-active).
    op.add_column(
        "menus",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("menus", sa.Column("start_time", sa.Time(), nullable=True))
    op.add_column("menus", sa.Column("end_time", sa.Time(), nullable=True))
    op.add_column(
        "menus", sa.Column("weekday_mask", sa.SmallInteger(), nullable=True)
    )
    op.create_check_constraint(
        "ck_menus_weekday_mask_range",
        "menus",
        "weekday_mask IS NULL OR (weekday_mask BETWEEN 0 AND 127)",
    )
    op.execute("UPDATE menus SET is_default = true")

    # --- orders.menu_id (P2) ---
    op.add_column(
        "orders",
        sa.Column(
            "menu_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True
        ),
    )
    op.create_foreign_key(
        "fk_orders_menu_id",
        "orders",
        "menus",
        ["menu_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- promos (P4) ---
    op.create_table(
        "promos",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "restaurant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("subtitle", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("discount_pct", sa.Integer(), nullable=True),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("item_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "discount_pct IS NULL OR (discount_pct BETWEEN 0 AND 100)",
            name="ck_promos_discount_pct_range",
        ),
    )
    op.create_index(
        "ix_promos_restaurant_id",
        "promos",
        ["restaurant_id"],
    )


def downgrade() -> None:
    # Reverse dependency order: promos -> orders FK -> menus columns.
    op.drop_index("ix_promos_restaurant_id", table_name="promos")
    op.drop_table("promos")

    op.drop_constraint("fk_orders_menu_id", "orders", type_="foreignkey")
    op.drop_column("orders", "menu_id")

    op.drop_constraint("ck_menus_weekday_mask_range", "menus", type_="check")
    op.drop_column("menus", "weekday_mask")
    op.drop_column("menus", "end_time")
    op.drop_column("menus", "start_time")
    op.drop_column("menus", "is_default")
