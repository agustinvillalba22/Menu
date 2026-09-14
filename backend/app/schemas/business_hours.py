"""Schemas for restaurant info (P6) and business hours (P6) — Fase 1d.

These mirror the columns added in migration 0008 and the new
``business_hours`` table. The existing ``RestaurantRead`` (in
``schemas/restaurant.py``) stays untouched — it is the covenant for the
authenticated owner/editor side and carries the caller's role; ``info`` and
``hours`` are separate concerns with a separate lifecycle, so they get their
own router and response shapes instead of bloating the restaurant router.
"""
import re
import uuid
from datetime import time

from pydantic import BaseModel, ConfigDict, Field, field_validator

# P7: international phone format accepted by `wa.me`. Digits only, 6 to 15,
# matching E.164 minus the leading `+` (we strip a leading `+` server-side so
# the owner can paste either form in the dashboard). Compiled once at import.
_WHATSAPP_PHONE_RE = re.compile(r"^\+?\d{6,15}$")


class BusinessHoursRead(BaseModel):
    id: uuid.UUID
    weekday: int = Field(ge=0, le=6)
    open_time: time
    close_time: time

    model_config = ConfigDict(from_attributes=True)


class BusinessHoursUpsert(BaseModel):
    """One day's open/close window.

    Used both for the bulk upsert on the dashboard "save all hours" form and
    for a single-day PUT. ``weekday`` is part of the payload (not the URL) so
    the bulk endpoint can take a list in one round trip — same pattern as the
    category style PATCH.
    """

    weekday: int = Field(ge=0, le=6)
    open_time: time
    # Documented DB CHECK (`close_time > open_time`) is enforced at the DB
    # layer; we still validate here so the dashboard gets a 422 with a clear
    # field instead of a 500 IntegrityError on the way down.
    close_time: time

    @field_validator("close_time")
    @classmethod
    def _close_after_open(cls, v: time, info) -> time:
        open_time = info.data.get("open_time")
        if open_time is not None and v <= open_time:
            raise ValueError("close_time must be after open_time")
        return v


class BusinessHoursBulkUpsert(BaseModel):
    """Body for ``PUT /restaurants/{id}/business-hours``.

    Replaces the whole week atomically: anything not in the list is deleted,
    so the dashboard form is the source of truth and stale rows can't linger
    after a day was unchecked. Capped at 7 because there are only 7 weekdays
    — two rows with the same weekday would otherwise 409 on the unique
    constraint mid-transaction.
    """

    hours: list[BusinessHoursUpsert] = Field(min_length=0, max_length=7)


class RestaurantInfoRead(BaseModel):
    """Restaurant contact info + schedule summary (P6, P7).

    Returned by ``GET /restaurants/{id}/info``. ``is_open_now`` is computed
    server-side using the restaurant's tz (via ``services.datetime.now_in``)
    so the public menu and the dashboard agree on the answer — no client-side
    clock guessing. ``whatsapp_enabled`` mirrors the public response so the
    dashboard can render a "the WhatsApp button is active" hint without
    parsing the raw phone.
    """

    address: str
    phone: str
    whatsapp_phone: str | None
    whatsapp_enabled: bool
    logo_url: str | None
    timezone: str
    business_hours: list[BusinessHoursRead]
    is_open_now: bool


class RestaurantInfoUpdate(BaseModel):
    """Partial PATCH for the restaurant's contact info (P6, P7).

    ``address``/``phone``/``timezone`` are NOT NULL with ``''`` default, so
    they accept an empty string (clear) and any value (set). ``whatsapp_phone``
    and ``logo_url`` are nullable — an explicit null clears them. ``logo_url``
    is normally set through the R2 logo upload endpoints rather than this
    PATCH, but staying writable keeps the contract uniform.
    """

    address: str | None = Field(default=None, max_length=300)
    phone: str | None = Field(default=None, max_length=60)
    whatsapp_phone: str | None = Field(default=None, max_length=20)
    timezone: str | None = Field(default=None, max_length=64)
    logo_url: str | None = Field(default=None, max_length=500)

    @field_validator("whatsapp_phone")
    @classmethod
    def _validate_whatsapp(cls, v: str | None) -> str | None:
        # None == clear the field (allowed); empty string == clear too, so the
        # dashboard can send `""` from an `<input type="tel">` cleanly without
        # having to thread special "null vs blank" semantics through the API.
        if v is None or v == "":
            return None
        if not _WHATSAPP_PHONE_RE.match(v):
            raise ValueError(
                "whatsapp_phone must be 6-15 digits, optional leading '+'"
            )
        # Strip the leading `+` so the stored form is what `wa.me/{phone}`
        # expects without further normalization in the message builder.
        return v.lstrip("+")