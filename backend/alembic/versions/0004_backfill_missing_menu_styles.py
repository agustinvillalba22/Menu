"""backfill_missing_menu_styles

Backfills a menu_styles row for every restaurant that predates M8 and therefore
has no style row.

Since M8, create_restaurant (app/services/restaurant.py) inserts a MenuStyle row
on restaurant creation, and GET/PATCH /restaurants/{id}/style assume that row
exists (they return 404 style_not_found otherwise). Restaurants created BEFORE
M8 never got that row, so their owners cannot view or edit the menu appearance
(e.g. "Boulette Pizzeria", created in an earlier session, returned 404 on
GET /restaurants/{id}/style). M8 explicitly deferred this backfill to a
separate migration (spec PA-01); this is that migration.

This is a data-only migration. It inserts one row per restaurant WITHOUT an
existing menu_styles row, using the same defaults as the model / create_restaurant:
  - font_family = 'inter'
  - primary_color = NULL, secondary_color = NULL
  - a fresh uuid id (gen_random_uuid(), built-in on PostgreSQL 16)

font_family is stored as a plain String/text column (the model maps FontFamily
with native_enum=False), but SQLAlchemy's Enum persists the enum MEMBER NAME,
not its value: FontFamily.inter is stored as 'inter' (confirmed against the
existing app-created rows, which hold 'inter'/'playfair_display'). Inserting the
value 'Inter' here would break reads with a LookupError, so the literal must be
the member name 'inter'. menu_styles has no created_at/updated_at columns
(MenuStyle does not use TimestampMixin).

Idempotent: the NOT EXISTS guard means re-running upgrade() over a database that
already has some (or all) style rows inserts nothing for those restaurants and
never creates duplicates (restaurant_id is also UNIQUE).

NOTE: the test suite runs against SQLite in-memory built from the SQLAlchemy
models (Base.metadata.create_all in tests/conftest.py), so it does not execute
this migration. Backfill correctness is verified against real PostgreSQL.

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-04

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Insert a default style row for every restaurant that lacks one.
    # NOT EXISTS keeps this idempotent and duplicate-free.
    op.execute(
        """
        INSERT INTO menu_styles (id, restaurant_id, font_family)
        SELECT gen_random_uuid(), r.id, 'inter'
        FROM restaurants r
        WHERE NOT EXISTS (
            SELECT 1 FROM menu_styles ms WHERE ms.restaurant_id = r.id
        )
        """
    )


def downgrade() -> None:
    # No-op by design. This is an idempotent data backfill: once applied, the
    # app itself also inserts menu_styles rows (create_restaurant), so there is
    # no reliable way to distinguish rows created by this backfill from rows
    # created by normal restaurant creation afterwards. Deleting rows here could
    # destroy legitimate, user-edited styles. Leaving it as a documented no-op
    # is the safe, accepted choice for a backfill migration.
    pass
