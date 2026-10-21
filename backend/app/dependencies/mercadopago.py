from collections.abc import AsyncGenerator

import httpx

# Every call to Mercado Pago has a hard 10 s timeout.
MP_TIMEOUT_SECONDS = 10.0


async def get_mp_client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """HTTP client for Mercado Pago calls. Tests override this dependency with
    an ``httpx.MockTransport``-backed client so nothing touches the network."""
    async with httpx.AsyncClient(timeout=MP_TIMEOUT_SECONDS) as client:
        yield client
