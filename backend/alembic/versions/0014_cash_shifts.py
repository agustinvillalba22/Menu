"""cash_shifts

M20 — cash-register shifts (open/close with arqueo) per restaurant.

New table `cash_shifts`. `opened_by_id`/`closed_by_id` reference
`staff_members` with ON DELETE SET NULL (name snapshots keep history
legible). ON DELETE CASCADE from restaurants.

Partial unique index `ux_cash_shifts_one_open (restaurant_id) WHERE
closed_at IS NULL` guarantees a single open shift per restaurant.

Revertible: drops the index and the table.

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, Sequence[str], None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cash_shifts",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("restaurant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("opened_by_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("opened_by_name", sa.String(), nullable=False),
        sa.Column(
            "opened_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("opening_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("closed_by_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("closed_by_name", sa.String(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("counted_amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("expected_amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["opened_by_id"], ["staff_members.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["closed_by_id"], ["staff_members.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ux_cash_shifts_one_open",
        "cash_shifts",
        ["restaurant_id"],
        unique=True,
        postgresql_where=sa.text("closed_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ux_cash_shifts_one_open", table_name="cash_shifts")
    op.drop_table("cash_shifts")
