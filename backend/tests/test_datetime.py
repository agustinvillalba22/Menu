"""
Tests for the shared tz helper (Fase 0a).

The helper is small but central — every tz-sensitive path in P2/P4/P5/P6
goes through ``now_in`` — so the test suite locks down its three
behaviors explicitly:

1. Falls back to ``settings.DEFAULT_TIMEZONE`` when the restaurant tz is
   ``None``, so restaurants without an explicit tz keep working.
2. Honors an explicit restaurant tz (e.g. ``America/Argentina/Buenos_Aires``).
3. Returns an aware ``datetime`` (no naive datetimes leak into scheduling
   comparisons).

``freezegun`` pins the wall clock and the log watchers in the helper —
replacing it with monkeypatching of ``datetime.now`` would also work but
freezegun is harder to misuse across the codebase.
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from freezegun import freeze_time

from app.core.config import settings
from app.services.datetime import now_in


def test_now_in_falls_back_to_default_timezone(monkeypatch):
    # Mirror the documented default without coupling to its value.
    monkeypatch.setattr(settings, "DEFAULT_TIMEZONE", "UTC")
    with freeze_time("2026-08-02 15:30:00", tz_offset=0):
        now = now_in(None)
    assert now == datetime(2026, 8, 2, 15, 30, tzinfo=timezone.utc)


def test_now_in_honors_explicit_tz():
    with freeze_time("2026-08-02 15:30:00", tz_offset=0):
        now = now_in("America/Argentina/Buenos_Aires")
    # Buenos Aires is UTC-3 in winter (no DST in August).
    assert now == datetime(2026, 8, 2, 12, 30, tzinfo=ZoneInfo("America/Argentina/Buenos_Aires"))


def test_now_in_returns_aware_datetime():
    with freeze_time("2026-08-02 15:30:00", tz_offset=0):
        now = now_in(None)
    assert now.tzinfo is not None
    assert now.utcoffset() is not None