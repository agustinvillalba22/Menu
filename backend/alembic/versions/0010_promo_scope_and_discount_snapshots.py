"""promo_scope_and_discount_snapshots

Fase 0010 — makes the promo discount actually apply (P4 follow-up).

``promos`` gains the scope model:
  - ``scope`` — NOT NULL enum ``none|item|category|catalog``, server_default
    ``none`` (existing rows keep "banner only, no discount").
  - ``category_id`` — nullable FK to ``categories`` with SET NULL (same
    philosophy as ``item_id``: a category-scoped promo survives its
    category being deleted, the link just disappears).

``order_items`` gains ``discount_pct`` — the snapshot of the promo discount
actually applied to that line (NULL = none). Mirrors the M11 snapshot
discipline: ``unit_price_snapshot`` keeps the LIST price, ``subtotal`` the
actually-paid amount, and ``discount_pct`` explains the difference so order
history stays auditable after the promo is edited/deleted.

Revertible: drops the FK, the two column adds and the two CHECKs in reverse
dependency order.

Revision ID: 0010
Revises: 0009
Create Date: 2026-09-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, Sequence[str], None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- promos: scope model ---
    op.add_column(
        "promos",
        sa.Column("scope", sa.String(), nullable=False, server_default="none"),
    )
    op.create_check_constraint(
        "ck_promos_scope",
        "promos",
        "scope IN ('none', 'item', 'category', 'catalog')",
    )
    op.add_column(
        "promos",
        sa.Column("category_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_promos_category_id",
        "promos",
        "categories",
        ["category_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- order_items: applied-discount snapshot ---
    op.add_column(
        "order_items",
        sa.Column("discount_pct", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_order_items_discount_pct_range",
        "order_items",
        "discount_pct IS NULL OR (discount_pct BETWEEN 0 AND 100)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_order_items_discount_pct_range", "order_items", type_="check"
    )
    op.drop_column("order_items", "discount_pct")

    op.drop_constraint("fk_promos_category_id", "promos", type_="foreignkey")
    op.drop_column("promos", "category_id")
    op.drop_constraint("ck_promos_scope", "promos", type_="check")
    op.drop_column("promos", "scope")
