"""restaurant_is_active

M13.1: adds ``restaurants.is_active`` (NOT NULL, default true). Every
existing/new restaurant starts active, so this is a pure additive change with
no behavior shift until a superadmin explicitly deactivates a restaurant via
``PATCH /admin/restaurants/{id}`` (RF-04/RF-12).

``server_default="true"`` is required (not just the Python-side model
default) so the ``ALTER TABLE ... ADD COLUMN`` backfills existing rows with a
concrete value instead of failing the NOT NULL constraint against rows that
already exist in Postgres.

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, Sequence[str], None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default=true both backfills existing rows and satisfies the
    # NOT NULL constraint; kept on the column afterward (same convention as
    # `orders_enabled` in 0005_orders.py).
    op.add_column(
        "restaurants",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("restaurants", "is_active")
