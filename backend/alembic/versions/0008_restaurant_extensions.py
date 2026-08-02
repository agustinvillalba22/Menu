"""restaurant_extensions

Fase 0008 — adds the columns and the one new table that P3 (dominio/plan),
P6 (info local + business hours) and P7 (whatsapp_phone) all need to model
before their respective router/dashboard phases land. P8 (Category.icon) rides
along since it's a single nullable column.

Columns on `restaurants`:
  - `address`, `phone`, `timezone` — NOT NULL with `''` server_default,
    so existing rows backfill cleanly and partial updates never trip a
    NOT NULL constraint (same convention as `is_active` in 0007).
  - `whatsapp_phone`, `logo_url`, `custom_domain` — nullable.
  - `plan` — NOT NULL enum `free|pro|premium`, server_default `'free'`.
    `free` is the lowest tier; existing restaurants drop in there and the
    dominio-propio feature gate (P3) can later promote them with a single
    UPDATE.

New table `business_hours` (P6): one row per (restaurant, weekday) with a
`UNIQUE (restaurant_id, weekday)` constraint so the dashboard "save all
hours" form can upsert by weekday without races.

`categories.icon` (P8): nullable enum, `native_enum=False`, so adding new
icon keys later is a Python-only change — no migration required.

Revertible: `downgrade` drops the three column adds + the one table + the
one column add, in reverse dependency order, leaving the schema exactly as
it was at 0007.

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, Sequence[str], None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- restaurants: nullable-friendly columns first, then enum (plan) ---
    # Strings default to '' (NOT NULL) so existing rows backfill cleanly.
    op.add_column(
        "restaurants",
        sa.Column("address", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "restaurants",
        sa.Column("phone", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "restaurants",
        sa.Column("timezone", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "restaurants",
        sa.Column("whatsapp_phone", sa.String(), nullable=True),
    )
    op.add_column(
        "restaurants",
        sa.Column("logo_url", sa.String(), nullable=True),
    )
    op.add_column(
        "restaurants",
        sa.Column("custom_domain", sa.String(), nullable=True),
    )
    # Native enum stored as text (native_enum=False on the model side), so the
    # column type is a plain VARCHAR with a CHECK — no Postgres enum type to
    # manage in subsequent migrations.
    op.add_column(
        "restaurants",
        sa.Column("plan", sa.String(), nullable=False, server_default="free"),
    )
    op.create_check_constraint(
        "ck_restaurants_plan",
        "restaurants",
        "plan IN ('free', 'pro', 'premium')",
    )

    # --- business_hours (P6) ---
    op.create_table(
        "business_hours",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("restaurant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("open_time", sa.Time(), nullable=False),
        sa.Column("close_time", sa.Time(), nullable=False),
        sa.ForeignKeyConstraint(
            ["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "restaurant_id", "weekday", name="uq_business_hours_restaurant_weekday"
        ),
        sa.CheckConstraint(
            "weekday BETWEEN 0 AND 6", name="ck_business_hours_weekday_range"
        ),
        sa.CheckConstraint(
            "close_time > open_time", name="ck_business_hours_close_after_open"
        ),
    )

    # --- categories.icon (P8) ---
    op.add_column(
        "categories",
        sa.Column("icon", sa.String(), nullable=True),
    )


def downgrade() -> None:
    # Reverse dependency order: `categories.icon` -> `business_hours` -> the
    # `restaurants` columns. Drop CHECK constraints implicitly with the
    # column/table.
    op.drop_column("categories", "icon")

    op.drop_table("business_hours")

    op.drop_constraint("ck_restaurants_plan", "restaurants", type_="check")
    op.drop_column("restaurants", "plan")
    op.drop_column("restaurants", "custom_domain")
    op.drop_column("restaurants", "logo_url")
    op.drop_column("restaurants", "whatsapp_phone")
    op.drop_column("restaurants", "timezone")
    op.drop_column("restaurants", "phone")
    op.drop_column("restaurants", "address")