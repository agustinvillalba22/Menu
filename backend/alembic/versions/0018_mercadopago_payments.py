"""mercadopago_payments

M36 — cobro de pedidos con Mercado Pago (Checkout Pro, modelo marketplace).

New table `payment_accounts` (one per restaurant):
  - id UUID PK
  - restaurant_id UUID NOT NULL, FK -> restaurants.id ON DELETE CASCADE,
    UNIQUE through the unique index ix_payment_accounts_restaurant_id (the
    model declares `unique=True, index=True`, which emits exactly that)
  - provider VARCHAR NOT NULL, mp_user_id VARCHAR NOT NULL
  - access_token_enc / refresh_token_enc VARCHAR NOT NULL (Fernet ciphertext)
  - expires_at TIMESTAMPTZ NOT NULL
  - status VARCHAR NOT NULL (non-native enum: connected | disconnected)
  - created_at / updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

New columns on `orders` (existing rows are backfilled through the
server_default: every order so far is a cash order):
  - payment_method  VARCHAR NOT NULL DEFAULT 'cash'
  - payment_status  VARCHAR NOT NULL DEFAULT 'none'
  - mp_preference_id VARCHAR NULL
  - mp_payment_id   VARCHAR NULL, indexed (ix_orders_mp_payment_id)

The SQLAlchemy models declare the same columns/defaults/index (the test suite
runs on SQLite and does not execute this migration — verify against Postgres
with `alembic upgrade head` + `alembic check`).

Revertible: drops the index, the columns and the table.

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018"
down_revision: Union[str, Sequence[str], None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payment_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("mp_user_id", sa.String(), nullable=False),
        sa.Column("access_token_enc", sa.String(), nullable=False),
        sa.Column("refresh_token_enc", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
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
    op.create_index(
        "ix_payment_accounts_restaurant_id",
        "payment_accounts",
        ["restaurant_id"],
        unique=True,
    )

    op.add_column(
        "orders",
        sa.Column(
            "payment_method", sa.String(), nullable=False, server_default="cash"
        ),
    )
    op.add_column(
        "orders",
        sa.Column(
            "payment_status", sa.String(), nullable=False, server_default="none"
        ),
    )
    op.add_column("orders", sa.Column("mp_preference_id", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("mp_payment_id", sa.String(), nullable=True))
    op.create_index("ix_orders_mp_payment_id", "orders", ["mp_payment_id"])


def downgrade() -> None:
    op.drop_index("ix_orders_mp_payment_id", table_name="orders")
    op.drop_column("orders", "mp_payment_id")
    op.drop_column("orders", "mp_preference_id")
    op.drop_column("orders", "payment_status")
    op.drop_column("orders", "payment_method")
    op.drop_index("ix_payment_accounts_restaurant_id", table_name="payment_accounts")
    op.drop_table("payment_accounts")
