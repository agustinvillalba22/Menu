"""orders_shift_and_staff

M28 — link completed orders to cash shifts and attribute them to staff.

New nullable columns on `orders`:
  - cash_shift_id  UUID, FK fk_orders_cash_shift_id -> cash_shifts.id
                   ON DELETE SET NULL, indexed (ix_orders_cash_shift_id)
  - handled_by_id  UUID, FK fk_orders_handled_by_id -> staff_members.id
                   ON DELETE SET NULL
  - handled_by_name VARCHAR (snapshot; survives deleting the staff member)

Backfill: every `completed` order is linked to the shift of its restaurant
whose [opened_at, closed_at] (or opened_at..now() while still open) contains
its updated_at — the same proxy the old expected-amount calculation used.
Already-closed shifts keep their stored expected_amount untouched.

The SQLAlchemy model declares the same columns/FKs/index (the test suite runs
on SQLite and does not execute this migration — verify against Postgres).

Revertible: drops the index, FKs and columns.

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, Sequence[str], None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    uuid_type = sa.dialects.postgresql.UUID(as_uuid=True)
    op.add_column("orders", sa.Column("cash_shift_id", uuid_type, nullable=True))
    op.add_column("orders", sa.Column("handled_by_id", uuid_type, nullable=True))
    op.add_column("orders", sa.Column("handled_by_name", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_orders_cash_shift_id",
        "orders",
        "cash_shifts",
        ["cash_shift_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_orders_handled_by_id",
        "orders",
        "staff_members",
        ["handled_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_orders_cash_shift_id", "orders", ["cash_shift_id"])

    op.execute(
        sa.text(
            "UPDATE orders AS o SET cash_shift_id = s.id "
            "FROM cash_shifts AS s "
            "WHERE o.status = 'completed' "
            "AND s.restaurant_id = o.restaurant_id "
            "AND o.updated_at >= s.opened_at "
            "AND o.updated_at <= COALESCE(s.closed_at, now())"
        )
    )


def downgrade() -> None:
    op.drop_index("ix_orders_cash_shift_id", table_name="orders")
    op.drop_constraint("fk_orders_handled_by_id", "orders", type_="foreignkey")
    op.drop_constraint("fk_orders_cash_shift_id", "orders", type_="foreignkey")
    op.drop_column("orders", "handled_by_name")
    op.drop_column("orders", "handled_by_id")
    op.drop_column("orders", "cash_shift_id")
