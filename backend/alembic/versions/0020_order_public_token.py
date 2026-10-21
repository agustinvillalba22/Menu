"""order_public_token

M37 — `orders.public_token` (VARCHAR(64), nullable, unique index): the
per-order credential the anonymous guest keeps on their device. Pre-M37 orders
stay NULL (never reachable through the public flow); no backfill.

The model declares the same column with `unique=True, index=True` (index name
`ix_orders_public_token`). The SQLite test suite does not run this migration —
verify with `alembic upgrade head` + `alembic check` on Postgres.

Revision ID: 0020
Revises: 0019
Create Date: 2026-10-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: Union[str, Sequence[str], None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("public_token", sa.String(length=64), nullable=True))
    op.create_index(
        op.f("ix_orders_public_token"), "orders", ["public_token"], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_orders_public_token"), table_name="orders")
    op.drop_column("orders", "public_token")
