"""
Timezone-aware current-time helper (Fase 0a).

Centralizes every "now in this restaurant's tz" call so P2/P4/P5/P6 all
share one definition and one set of tests (via freezegun), instead of
sprinkling ``datetime.now(ZoneInfo(...))`` across the codebase.

``DEFAULT_TIMEZONE`` lives in ``app.core.config`` so callers without a
restaurant (or with a restaurant whose ``timezone`` is null) keep working —
``now_in(None)`` falls back to the configured default (UTC by default).
"""
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings


def now_in(restaurant_tz: str | None) -> datetime:
    """Return the current aware datetime in ``restaurant_tz``.

    ``None`` (or empty string) falls back to ``settings.DEFAULT_TIMEZONE``.
    An invalid tz string raises ``ZoneInfoNotFoundError`` — let it surface
    to the caller; restaurants are expected to pick from a curated tz list
    in the dashboard, so a bad value is a bug, not a runtime condition.
    """
    tz_name = restaurant_tz or settings.DEFAULT_TIMEZONE
    return datetime.now(ZoneInfo(tz_name))