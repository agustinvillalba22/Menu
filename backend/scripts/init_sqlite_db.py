"""One-off helper to create all tables in the local SQLite dev DB."""
import asyncio

from app.core.database import engine
from app.models.base import Base
import app.models.user  # noqa: F401
import app.models.restaurant  # noqa: F401
import app.models.menu  # noqa: F401
import app.models.item  # noqa: F401
import app.models.item_modifier  # noqa: F401
import app.models.order  # noqa: F401
import app.models.style  # noqa: F401


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


if __name__ == "__main__":
    asyncio.run(main())
