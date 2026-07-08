"""item_tag_unique_case_insensitive

M12.3: replaces the exact-match uq_item_tag constraint on item_tags
(item_id, name), added in 0002_item_tag_unique.py, with a case-insensitive
unique index uq_item_tag_ci on (item_id, lower(name)). This closes the gap
noted by the M12.2 reviewer: two tags differing only by case (e.g. "vegano"
and "Vegano") on the same item were already prevented at the application
level (services/item.py::add_tag), but not at the DB level, leaving a
genuine race window between two concurrent requests.

Order of operations matters here. Real dev/staging data already has
case-variant duplicates for item_tags (e.g. the "Napolitana" item of
Boulette Pizzeria has both "vegano" and "Vegano" — confirmed directly in the
dev DB). Creating the new unique index directly would fail against that
data, since the duplicates already violate the constraint before it exists.
So upgrade() first deduplicates existing rows per (item_id, lower(name))
group, keeping the row with the lowest id (a simple, deterministic — not
"correct" — survivor: ItemTag has no columns besides name, so there is
nothing to merge), THEN drops the old constraint, THEN creates the new
index. The dedup step uses ROW_NUMBER() OVER (... ORDER BY id) rather than
GROUP BY + MIN(id): PostgreSQL has no MIN(uuid) aggregate, which only
surfaced when this migration was run against real Postgres data (RNF-02) —
SQLite's test suite never exercises this SQL at all.

downgrade() reverts in the opposite order: drops the new index, recreates
the old exact-match constraint. It does NOT restore the rows deleted by the
upgrade's dedup step — that data loss is accepted (the deleted rows were
already duplicates of surviving rows from the DB's point of view).

NOTE: the test suite runs against SQLite in-memory and builds the schema
directly from the SQLAlchemy models (Base.metadata.create_all in
tests/conftest.py), so it does NOT execute this migration — this file is
only relevant for real/prod PostgreSQL. The model carries the equivalent
Index("uq_item_tag_ci", "item_id", func.lower(name), unique=True) in
app/models/item.py. Verified manually against Postgres per RNF-02.

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-08

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0006"
down_revision: Union[str, Sequence[str], None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Deduplicate existing case-variant rows per (item_id, lower(name)),
    #    keeping the row with the lowest id in each group.
    #    NOTE: PostgreSQL has no MIN(uuid) aggregate (discovered running this
    #    migration against real dev data, RNF-02) — GROUP BY + MIN(id) fails
    #    with "function min(uuid) does not exist". ROW_NUMBER() OVER (...
    #    ORDER BY id) works instead, since uuid does support ordering.
    op.execute(
        """
        DELETE FROM item_tags
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY item_id, lower(name) ORDER BY id
                ) AS rn
                FROM item_tags
            ) ranked
            WHERE rn > 1
        )
        """
    )

    # 2. Drop the old exact-match constraint.
    op.drop_constraint("uq_item_tag", "item_tags", type_="unique")

    # 3. Create the new case-insensitive unique index.
    op.execute(
        "CREATE UNIQUE INDEX uq_item_tag_ci ON item_tags (item_id, lower(name))"
    )


def downgrade() -> None:
    op.drop_index("uq_item_tag_ci", table_name="item_tags")
    op.create_unique_constraint(
        "uq_item_tag", "item_tags", ["item_id", "name"]
    )
