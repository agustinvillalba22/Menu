"""tables

M17 — adds a real `Table` entity per restaurant (number + optional
capacity), and links `orders.table_id` to it.

New table `tables`: `UNIQUE (restaurant_id, number)` — two tables of the
same restaurant can't share a number. `ON DELETE CASCADE` from restaurants
(deleting a restaurant deletes its tables, same as every other child table).

`orders.table_id` — nullable FK to `tables.id`, `ON DELETE SET NULL` (same
philosophy as `orders.menu_id`, Fase 0009): deleting a table must not
destroy order history, the link just disappears and the order keeps its
`table_or_address` text snapshot.

Revertible: drops the FK + column, then the table, in reverse dependency
order.

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, Sequence[str], None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tables",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("restaurant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "restaurant_id", "number", name="uq_tables_restaurant_number"
        ),
    )

    op.add_column(
        "orders",
        sa.Column("table_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_orders_table_id",
        "orders",
        "tables",
        ["table_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_orders_table_id", "orders", type_="foreignkey")
    op.drop_column("orders", "table_id")

    op.drop_table("tables")
