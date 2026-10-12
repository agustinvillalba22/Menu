"""staff_members

M18 — adds a lightweight staff roster per restaurant (name, position, PIN).
Identification only: no relation to `users`/auth, no login via PIN.

New table `staff_members`: `UNIQUE (restaurant_id, pin)` — two staff of the
same restaurant can't share a PIN (cross-restaurant collisions are fine).
`ON DELETE CASCADE` from restaurants, same as every other child table.

Revertible: drops the table.

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, Sequence[str], None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staff_members",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("restaurant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("position", sa.String(), nullable=False),
        sa.Column("pin", sa.String(length=4), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "restaurant_id", "pin", name="uq_staff_members_restaurant_pin"
        ),
        sa.CheckConstraint(
            "position IN ('mozo', 'bartender', 'jefe_cocina', 'cajero', 'gerente')",
            name="ck_staff_members_position",
        ),
        sa.CheckConstraint("pin ~ '^[0-9]{4}$'", name="ck_staff_members_pin_format"),
    )


def downgrade() -> None:
    op.drop_table("staff_members")
