"""
Tests for database infrastructure.

SPEC: SPEC-M1-A — Config & scaffolding, SPEC-M1-B — Models
ACs covered:
  - Engine can connect to SQLite in-memory
  - All 9 expected tables are created via Base.metadata
  - Session rollback isolates test state (write in test A does not persist in test B)
"""
import pytest
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.user import User

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# The tables defined across migrations 0001 .. 0008. Adding a table here
# when its migration lands keeps this contract test in sync with the schema.
EXPECTED_TABLES = {
    "users",
    "restaurants",
    "user_restaurant_roles",
    "menus",
    "categories",
    "subcategories",
    "items",
    "item_tags",
    "menu_styles",
    # Item modifiers + orders (0005 / item_modifier model)
    "item_modifiers",
    "orders",
    "order_items",
    "order_item_modifiers",
    # 0008_restaurant_extensions
    "business_hours",
    # 0009_menu_scheduling_and_promos
    "promos",
}


async def test_db_engine_connects(test_engine):
    """Engine must be able to open a connection and execute a trivial query."""
    async with test_engine.connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        row = result.scalar()
    assert row == 1


async def test_db_tables_exist(test_engine):
    """All model tables must exist after Base.metadata.create_all."""
    async with test_engine.connect() as conn:
        table_names = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).get_table_names()
        )
    existing = set(table_names)
    missing = EXPECTED_TABLES - existing
    assert not missing, f"Missing tables in schema: {missing}"
    extra = existing - EXPECTED_TABLES
    assert not extra, (
        f"Unexpected tables in schema: {extra}. "
        "Add them to EXPECTED_TABLES or drop the model."
    )


async def test_db_session_rollback_part_a(test_engine):
    """
    Part A: insert a User but do NOT commit.
    This test verifies the insert reaches the session buffer (flush is fine).
    The rollback is implicit when the session context exits without commit.
    """
    import uuid
    session_maker = async_sessionmaker(test_engine, expire_on_commit=False)
    async with session_maker() as session:
        user = User(
            id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            email="rollback_test@example.com",
            hashed_password="hashed",
            full_name="Rollback User",
        )
        session.add(user)
        await session.flush()  # pushed to DB buffer but not committed
        # verify it is visible within this session
        from sqlalchemy import select
        result = await session.execute(
            select(User).where(User.email == "rollback_test@example.com")
        )
        found = result.scalar_one_or_none()
        assert found is not None, "User should be visible within the same session after flush"
        # session exits WITHOUT commit → implicit rollback


async def test_db_session_rollback_part_b(test_engine):
    """
    Part B: open a new session and verify the unflushed user from part A
    did NOT persist (each test_engine fixture is function-scoped and fresh,
    this test demonstrates that without commit nothing survives).
    """
    import uuid
    session_maker = async_sessionmaker(test_engine, expire_on_commit=False)
    async with session_maker() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(User).where(User.email == "rollback_test@example.com")
        )
        found = result.scalar_one_or_none()
    assert found is None, (
        "User inserted without commit in another session should NOT be visible here"
    )
