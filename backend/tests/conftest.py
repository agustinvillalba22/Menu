"""
Test infrastructure for MenuQR backend.

Uses SQLite in-memory — no PostgreSQL required.
asyncio_mode = auto via pytest.ini — no @pytest.mark.asyncio needed.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from main import app
from app.core.database import get_db
from app.models.base import Base

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    """
    Create an in-memory SQLite engine with all tables.
    Scoped per function so each test gets a clean schema.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(test_engine):
    """
    Provide a direct AsyncSession for inserting/querying test data.
    Does NOT commit — each test starts from a blank slate via test_engine.
    """
    session_maker = async_sessionmaker(test_engine, expire_on_commit=False)
    async with session_maker() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(test_engine) -> AsyncClient:
    """
    AsyncClient wired to the FastAPI app with the DB dependency overridden
    to use the in-memory SQLite engine.
    """
    session_maker = async_sessionmaker(test_engine, expire_on_commit=False)

    async def override_get_db():
        async with session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
