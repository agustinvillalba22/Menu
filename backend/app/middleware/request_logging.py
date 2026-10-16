import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse

logger = logging.getLogger("app.request")

REQUEST_ID_HEADER = "X-Request-ID"
_MS_PER_SECOND = 1000
# Accept only short, log-safe incoming ids (prevents log injection).
_SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,128}")


def _resolve_request_id(request: Request) -> str:
    incoming = request.headers.get(REQUEST_ID_HEADER, "")
    if _SAFE_REQUEST_ID.fullmatch(incoming):
        return incoming
    return str(uuid.uuid4())


async def request_logging_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Log one line per request and turn unhandled exceptions into a 500.

    Only method, path (no query string), status, duration and request id are
    logged: never bodies, cookies or auth headers.
    """
    request_id = _resolve_request_id(request)
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "Unhandled exception %s %s request_id=%s",
            request.method,
            request.url.path,
            request_id,
        )
        response = JSONResponse({"detail": "internal_error"}, status_code=500)
    duration_ms = (time.perf_counter() - start) * _MS_PER_SECOND
    response.headers[REQUEST_ID_HEADER] = request_id
    logger.info(
        "%s %s %d %.1fms request_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        request_id,
    )
    return response
