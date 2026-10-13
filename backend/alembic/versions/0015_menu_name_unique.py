"""menu_name_unique

M21 (Fase 3) — menu names are unique per restaurant, case-insensitively:
unique index ux_menus_restaurant_name_lower (restaurant_id, lower(name)).

No data is deleted or rewritten: if case-insensitive duplicates already exist
the upgrade aborts with an explicit message listing them, so they can be
renamed by hand first.

Revertible: downgrade drops the index.

The SQLAlchemy model declares the same Index so SQLite (tests) enforces it;
tests do not run this migration (verify against Postgres manually).

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, Sequence[str], None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEX_NAME = "ux_menus_restaurant_name_lower"


def upgrade() -> None:
    bind = op.get_bind()
    duplicates = bind.execute(
        sa.text(
            "SELECT restaurant_id, lower(name) AS lname, count(*) AS n "
            "FROM menus GROUP BY restaurant_id, lower(name) HAVING count(*) > 1"
        )
    ).fetchall()
    if duplicates:
        detail = "; ".join(
            f"restaurant {row.restaurant_id}: '{row.lname}' x{row.n}"
            for row in duplicates
        )
        raise RuntimeError(
            "Cannot create unique index on menus (restaurant_id, lower(name)): "
            f"case-insensitive duplicate menu names exist ({detail}). "
            "Rename the duplicates and re-run the migration."
        )
    op.create_index(
        INDEX_NAME,
        "menus",
        ["restaurant_id", sa.text("lower(name)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="menus")
