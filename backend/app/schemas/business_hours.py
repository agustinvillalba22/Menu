"""Schemas for the restaurant's weekly business hours."""
import uuid
from datetime import time

from pydantic import BaseModel, ConfigDict, Field, field_validator

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
