"""stock_and_suppliers

M19 — adds manually-managed inventory (`stock_items`) and `suppliers`.
Scope: CRUD only, no auto-decrement on orders, no purchase orders. See
.agents/specs/M19_stock_suppliers.md.

`suppliers` has no FK of its own (free-text contact fields).

`stock_items.supplier_id` — nullable FK to `suppliers.id`, `ON DELETE SET
NULL`: deleting a supplier must not destroy stock rows, just unlink them
(same philosophy as `orders.table_id` in M17).

Revertible: drops `stock_items` first (depends on `suppliers`), then
`suppliers`.

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, Sequence[str], None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "suppliers",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("restaurant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("contact_person", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("address", sa.String(), nullable=True),
        sa.Column("delivery_days", sa.String(), nullable=True),
        sa.Column("payment_terms", sa.String(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "stock_items",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("restaurant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("unit", sa.String(), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("min_threshold", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("cost_per_unit", sa.Numeric(10, 2), nullable=True),
        sa.Column("supplier_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_restocked", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(
            ["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["supplier_id"], ["suppliers.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "category IN ('carnes_pescados', 'verduras_frescos', 'almacen_secos', "
            "'lacteos', 'bebidas_licores')",
            name="ck_stock_items_category",
        ),
        sa.CheckConstraint(
            "unit IN ('kg', 'g', 'l', 'unidades', 'botellas')",
            name="ck_stock_items_unit",
        ),
    )


def downgrade() -> None:
    op.drop_table("stock_items")
    op.drop_table("suppliers")
