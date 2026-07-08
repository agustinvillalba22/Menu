"""
Bootstrap script — grants is_superadmin=True to an existing user (M13.1, RF-03).

There is intentionally NO HTTP endpoint to create the first superadmin: this
script is the only way. It reuses the same engine/session configuration as
the running app (app.core.database.AsyncSessionLocal) instead of opening a
parallel DB connection, so it always talks to whatever DATABASE_URL the
backend is configured with.

Usage (run from the backend/ working directory, e.g. WORKDIR in Dockerfile):

    docker compose exec backend python scripts/promote_superadmin.py owner@test.com
    # or, equivalently:
    cd backend && python -m scripts.promote_superadmin owner@test.com

Exit code is 0 on success, 1 if no user with that email exists (no user is
ever created by this script). Per RNF-03, only the email and the resulting
is_superadmin state are ever printed — never the password or hash.
"""
import argparse
import asyncio
import sys

from sqlalchemy import select

from app.core.database import AsyncSessionLocal

# All model modules must be imported before any query runs so SQLAlchemy can
# resolve string-based relationship() references across modules (mirrors
# alembic/env.py, which needs the same for autogenerate). Importing only
# app.models.user is not enough: User.restaurant_roles references
# UserRestaurantRole, defined in app.models.restaurant.
import app.models.item          # noqa: F401
import app.models.item_modifier  # noqa: F401
import app.models.menu          # noqa: F401
import app.models.order         # noqa: F401
import app.models.restaurant    # noqa: F401
import app.models.style         # noqa: F401
from app.models.user import User


async def promote(email: str) -> int:
    normalized_email = email.strip().lower()
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.email == normalized_email)
        )
        user = result.scalar_one_or_none()
        if user is None:
            print(f"error: no user found with email '{normalized_email}'", file=sys.stderr)
            return 1

        user.is_superadmin = True
        await session.commit()
        print(f"ok: '{normalized_email}' is now a superadmin (is_superadmin=True)")
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Grant is_superadmin=True to an existing user, by email."
    )
    parser.add_argument("email", help="Email of an existing, already-registered user")
    args = parser.parse_args()

    exit_code = asyncio.run(promote(args.email))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
