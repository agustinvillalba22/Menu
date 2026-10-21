"""Schemas for the restaurant's contact info (address, phones, timezone, logo).

These mirror the columns added in migration 0008. The existing
``RestaurantRead`` (in ``schemas/restaurant.py``) stays untouched: it is the
shape for the authenticated owner/editor side and carries the caller's role.
"""
import re

from pydantic import BaseModel, Field, field_validator

from app.schemas.business_hours import BusinessHoursRead

# International phone format accepted by `wa.me`. Digits only, 6 to 15,
# matching E.164 minus the leading `+` (we strip a leading `+` server-side so
# the owner can paste either form in the dashboard). Compiled once at import.
_WHATSAPP_PHONE_RE = re.compile(r"^\+?\d{6,15}$")


class RestaurantInfoRead(BaseModel):
    """Restaurant contact info + schedule summary.

    Returned by ``GET /restaurants/{id}/info``. ``is_open_now`` is computed
    server-side using the restaurant's tz (via ``services.datetime.now_in``)
    so the public menu and the dashboard agree on the answer — no client-side
    clock guessing.
    """

    address: str
    phone: str
    whatsapp_phone: str | None
    logo_url: str | None
    timezone: str
    business_hours: list[BusinessHoursRead]
    is_open_now: bool


class RestaurantInfoUpdate(BaseModel):
    """Partial PATCH for the restaurant's contact info.

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