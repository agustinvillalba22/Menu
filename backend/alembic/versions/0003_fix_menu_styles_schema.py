"""fix_menu_styles_schema

Realigns the menu_styles table with the MenuStyle model (app/models/style.py),
which drifted from the initial migration (0001).

The model defines primary_color/secondary_color as nullable with no default
(M8 creates a MenuStyle row on restaurant creation leaving both as NULL by
design), and does NOT define template_id, background_color or logo_url. The
0001 migration, however, created primary_color/secondary_color as NOT NULL
with server defaults and added three columns absent from the model. Against
real PostgreSQL this made POST /restaurants fail: the NULL colors violated the
NOT NULL constraint -> IntegrityError -> 500.

This migration:
  - drops NOT NULL + server_default on primary_color / secondary_color
  - drops the unused columns template_id, background_color, logo_url
    (verified unused across app code and frontend)

NOTE: the test suite runs against SQLite in-memory and builds the schema
directly from the SQLAlchemy models (Base.metadata.create_all in
tests/conftest.py), so it does NOT execute these migrations. This drift was
therefore invisible to the test suite and only surfaced against real
PostgreSQL. The fix adjusts the migration to the model, not the other way
around.

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Align color columns with the model: nullable, no server default.
    op.alter_column(
        "menu_styles",
        "primary_color",
        existing_type=sa.String(),
        nullable=True,
        server_default=None,
    )
    op.alter_column(
        "menu_styles",
        "secondary_color",
        existing_type=sa.String(),
        nullable=True,
        server_default=None,
    )

    # Drop columns that do not exist in the model and are unused in the app.
    op.drop_column("menu_styles", "template_id")
    op.drop_column("menu_styles", "background_color")
    op.drop_column("menu_styles", "logo_url")


def downgrade() -> None:
    # Re-add the dropped columns with their original 0001 definitions.
    op.add_column(
        "menu_styles",
        sa.Column(
            "logo_url",
            sa.String(),
            nullable=True,
        ),
    )
    op.add_column(
        "menu_styles",
        sa.Column(
            "background_color",
            sa.String(),
            nullable=False,
            server_default="#FFFFFF",
        ),
    )
    op.add_column(
        "menu_styles",
        sa.Column(
            "template_id",
            sa.String(),
            nullable=False,
            server_default="classic",
        ),
    )

    # Backfill any NULL colors before restoring the NOT NULL constraint.
    op.execute(
        "UPDATE menu_styles SET primary_color = '#E53E3E' "
        "WHERE primary_color IS NULL"
    )
    op.execute(
        "UPDATE menu_styles SET secondary_color = '#718096' "
        "WHERE secondary_color IS NULL"
    )

    op.alter_column(
        "menu_styles",
        "secondary_color",
        existing_type=sa.String(),
        nullable=False,
        server_default="#718096",
    )
    op.alter_column(
        "menu_styles",
        "primary_color",
        existing_type=sa.String(),
        nullable=False,
        server_default="#E53E3E",
    )
