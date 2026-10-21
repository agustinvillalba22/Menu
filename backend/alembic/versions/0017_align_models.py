"""align_models

M30 — align the Postgres schema produced by the migrations with the models
(`alembic check` reported drift; SQLite tests never saw it).

Changes:
  1. Drop vestigial columns that no code reads or writes (all NOT NULL with a
     server_default, created by 0001): categories.sort_order,
     subcategories.sort_order, items.sort_order, items.is_available,
     menus.is_active. `restaurants.created_at` is KEPT; the model now declares
     it instead.
  2. Uniqueness of restaurants.slug, restaurants.qr_token and users.email:
     0001 created a UNIQUE constraint (`*_key`) plus a NON-unique index
     (`ix_*`), while the models declare a single unique index `ix_*`. Each
     pair is replaced by one unique index with the model's name, all inside
     this migration's transaction so there is never a window without
     uniqueness.
  3. `ix_promos_restaurant_id` already exists in the DB (0009); the model now
     declares it (index=True). No DDL needed.

Downgrade recreates the dropped columns with their original type, NOT NULL
and server_default, and restores constraint + non-unique index.

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, Sequence[str], None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, column, constraint name created by 0001, index name)
_UNIQUES = [
    ("restaurants", "slug", "restaurants_slug_key", "ix_restaurants_slug"),
    ("restaurants", "qr_token", "restaurants_qr_token_key", "ix_restaurants_qr_token"),
    ("users", "email", "users_email_key", "ix_users_email"),
]


def upgrade() -> None:
    for table, column, constraint, index in _UNIQUES:
        op.drop_constraint(constraint, table, type_="unique")
        op.drop_index(index, table_name=table)
        op.create_index(index, table, [column], unique=True)

    op.drop_column("categories", "sort_order")
    op.drop_column("subcategories", "sort_order")
    op.drop_column("items", "sort_order")
    op.drop_column("items", "is_available")
    op.drop_column("menus", "is_active")


def downgrade() -> None:
    op.add_column(
        "menus",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "items",
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    for table in ("items", "subcategories", "categories"):
        op.add_column(
            table,
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        )

    for table, column, constraint, index in reversed(_UNIQUES):
        op.drop_index(index, table_name=table)
        op.create_index(index, table, [column])
        op.create_unique_constraint(constraint, table, [column])
