"""
Development helper (M36) — connects a restaurant to a Mercado Pago TEST seller
without going through OAuth.

The OAuth connection needs the application's Client Secret, which is not
always available while testing. A test seller's access token (from the app's
test credentials) is the same kind of token OAuth would hand us, so storing it
directly lets the rest of the flow (preference, checkout, webhook) be
exercised against the real Mercado Pago test environment.

The token is read from MP_TEST_SELLER_ACCESS_TOKEN (backend/.env), never from
the command line, and is stored Fernet-encrypted exactly like an OAuth token.
Refuses to run when ENVIRONMENT=production.

Usage (from the backend/ working directory):

    docker compose exec backend python -m scripts.connect_test_seller <restaurant-slug>
"""
import argparse
import asyncio
import sys
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal

# See promote_superadmin.py: every model module must be imported so SQLAlchemy
# can resolve relationship() references across modules.
import app.models.item          # noqa: F401
import app.models.item_modifier  # noqa: F401
import app.models.menu          # noqa: F401
import app.models.order         # noqa: F401
import app.models.restaurant    # noqa: F401
import app.models.style         # noqa: F401
import app.models.user          # noqa: F401
from app.models.payment_account import PaymentAccount, PaymentAccountStatus
from app.models.restaurant import Restaurant
from app.services import crypto

MP_API_BASE = "https://api.mercadopago.com"
# Test tokens are not refreshable; keep the account "valid" long enough that
# the lazy refresh (triggered within 7 days of expiry) never kicks in.
_FAKE_VALIDITY = timedelta(days=180)
_NO_REFRESH = "test-seller-has-no-refresh-token"


async def _seller_user_id(token: str) -> str | None:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{MP_API_BASE}/users/me", headers={"Authorization": f"Bearer {token}"}
        )
    if response.status_code != 200:
        print(f"error: Mercado Pago rejected the token (HTTP {response.status_code})", file=sys.stderr)
        return None
    return str(response.json()["id"])


async def connect(slug: str) -> int:
    if settings.ENVIRONMENT.lower() == "production":
        print("error: refusing to run with ENVIRONMENT=production", file=sys.stderr)
        return 1
    if not settings.MP_TEST_SELLER_ACCESS_TOKEN or not settings.MP_TOKEN_ENCRYPTION_KEY:
        print(
            "error: MP_TEST_SELLER_ACCESS_TOKEN and MP_TOKEN_ENCRYPTION_KEY must be set",
            file=sys.stderr,
        )
        return 1
    token = settings.MP_TEST_SELLER_ACCESS_TOKEN
    user_id = await _seller_user_id(token)
    if user_id is None:
        return 1

    async with AsyncSessionLocal() as session:
        restaurant = (
            await session.execute(select(Restaurant).where(Restaurant.slug == slug))
        ).scalar_one_or_none()
        if restaurant is None:
            print(f"error: no restaurant with slug '{slug}'", file=sys.stderr)
            return 1
        account = (
            await session.execute(
                select(PaymentAccount).where(PaymentAccount.restaurant_id == restaurant.id)
            )
        ).scalar_one_or_none()
        if account is None:
            account = PaymentAccount(restaurant_id=restaurant.id, provider="mercadopago")
            session.add(account)
        account.mp_user_id = user_id
        account.access_token_enc = crypto.encrypt(token)
        account.refresh_token_enc = crypto.encrypt(_NO_REFRESH)
        account.expires_at = datetime.now(timezone.utc) + _FAKE_VALIDITY
        account.status = PaymentAccountStatus.connected
        await session.commit()
    print(f"ok: '{slug}' connected to Mercado Pago test seller {user_id}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Connect a restaurant to a Mercado Pago TEST seller (dev only)."
    )
    parser.add_argument("slug", help="Slug of an existing restaurant")
    args = parser.parse_args()
    sys.exit(asyncio.run(connect(args.slug)))


if __name__ == "__main__":
    main()
