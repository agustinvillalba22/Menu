"""orders

Adds M11 (public orders) schema:
  - restaurants.orders_enabled flag (server_default false to backfill existing
    rows; the model uses default=False at the application level).
  - item_modifiers table (structured extras/removals per item).
  - orders / order_items / order_item_modifiers tables, with per-line snapshots
    so historical orders stay legible even if the live item/modifier changes.

Enum columns are stored as plain String (the models map their enums with
native_enum=False), matching categories.type / user_restaurant_roles.role.

order_items.item_id uses ondelete=SET NULL (not CASCADE) so deleting a live
Item leaves the historical order line intact with item_id=NULL and its
name/price snapshots preserved (M11 RNF-04 / CA-14).

NOTE: the test suite runs against SQLite in-memory built from the SQLAlchemy
models (Base.metadata.create_all in tests/conftest.py), so it does NOT execute
this migration. Column-for-column correctness was verified by hand against the
models; run this against real PostgreSQL before closing the milestone.

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, Sequence[str], None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "restaurants",
        sa.Column(
            "orders_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.create_table(
        "item_modifiers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("price_delta", sa.Numeric(10, 2), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("customer_name", sa.String(), nullable=False),
        sa.Column("order_type", sa.String(), nullable=False),
        sa.Column("table_or_address", sa.String(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("total", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name_snapshot", sa.String(), nullable=False),
        sa.Column("unit_price_snapshot", sa.Numeric(10, 2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("special_instructions", sa.String(), nullable=True),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "order_item_modifiers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name_snapshot", sa.String(), nullable=False),
        sa.Column("price_snapshot", sa.Numeric(10, 2), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["order_item_id"], ["order_items.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("order_item_modifiers")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("item_modifiers")
    op.drop_column("restaurants", "orders_enabled")
