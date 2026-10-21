import os
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

from alembic import context

load_dotenv()

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models so autogenerate can detect them
import app.models.user       # noqa: F401
import app.models.restaurant  # noqa: F401
import app.models.menu        # noqa: F401
import app.models.item        # noqa: F401
import app.models.item_modifier  # noqa: F401
import app.models.table       # noqa: F401
import app.models.staff_member  # noqa: F401
import app.models.cash_shift  # noqa: F401
import app.models.supplier    # noqa: F401
import app.models.stock_item  # noqa: F401
import app.models.order       # noqa: F401
import app.models.payment_account  # noqa: F401
import app.models.promo       # noqa: F401
import app.models.style       # noqa: F401

from app.models.base import Base

target_metadata = Base.metadata


def _get_sync_url() -> str:
    """Convert asyncpg URL to psycopg2 URL for Alembic's sync engine."""
    url = os.environ["DATABASE_URL"]
    # Explicit driver: SQLAlchemy 2.1 made bare "postgresql://" default to
    # psycopg (v3), which is not installed; requirements ship psycopg2-binary.
    return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://").replace(
        "postgresql+asyncpg+", "postgresql+"
    )


def run_migrations_offline() -> None:
    url = _get_sync_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _get_sync_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
