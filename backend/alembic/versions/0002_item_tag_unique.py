"""item_tag_unique

Adds a UNIQUE constraint on item_tags(item_id, name) to enforce tag
idempotency (PA-01) at the database level and close a race condition under
concurrent add_tag calls.

NOTE: the test suite runs against SQLite in-memory and builds the schema
directly from the SQLAlchemy models (Base.metadata.create_all in
tests/conftest.py), so it does NOT execute these migrations — this file is
only relevant for real/prod PostgreSQL. The model carries the equivalent
UniqueConstraint("item_id", "name", name="uq_item_tag") in app/models/item.py.

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-02

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_item_tag", "item_tags", ["item_id", "name"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_item_tag", "item_tags", type_="unique")
