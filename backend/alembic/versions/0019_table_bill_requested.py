"""table_bill_requested

M33 — mesas: `tables.bill_requested_at` (TIMESTAMPTZ, nullable, no server
default) records when guests asked for the bill; cleared on checkout.

The model declares the same column (the SQLite test suite does not run this
migration — verify with `alembic upgrade head` + `alembic check` on Postgres).

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, Sequence[str], None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tables",
        sa.Column("bill_requested_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tables", "bill_requested_at")
