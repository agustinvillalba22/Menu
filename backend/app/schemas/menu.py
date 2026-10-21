import uuid
from datetime import time

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.menu import CategoryIcon, CategoryType


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: CategoryType
    # P8: nullable curated icon key. Defaults to None (text-only chip on the
    # public menu). Validated against the `CategoryIcon` enum by pydantic so a
    # typo in the dashboard can't reach the DB as a free string.
    icon: CategoryIcon | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: CategoryType | None = None
    # `None` here is meaningful (clears the icon), so the field is not flagged
    # `Optional[CategoryIcon | None]` — that would conflate "unset" with "null".
    # `exclude_unset=True` in `update_category` keeps a PATCH that omits the
    # field from touching the column, while an explicit `{"icon": null}` clears.
    icon: CategoryIcon | None = None


class CategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    type: CategoryType
    icon: CategoryIcon | None = None

    model_config = ConfigDict(from_attributes=True)


class SubcategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class SubcategoryUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class SubcategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    category_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class CategoryTreeRead(CategoryRead):
    """Category with its subcategories (editor tree, RF-08)."""

    subcategories: list[SubcategoryRead] = []


# ---------------------------------------------------------------------------
# Menus (M21)
# ---------------------------------------------------------------------------

WEEKDAY_MASK_MIN = 1
WEEKDAY_MASK_MAX = 127  # 7 bits: Mon..Sun


class MenuCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    is_default: bool = False
    start_time: time | None = None
    end_time: time | None = None
    weekday_mask: int | None = Field(
        default=None, ge=WEEKDAY_MASK_MIN, le=WEEKDAY_MASK_MAX
    )

    @model_validator(mode="after")
    def _check_schedule(self) -> "MenuCreate":
        validate_schedule(self.start_time, self.end_time)
        return self


class MenuUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_default: bool | None = None
    start_time: time | None = None
    end_time: time | None = None
    weekday_mask: int | None = Field(
        default=None, ge=WEEKDAY_MASK_MIN, le=WEEKDAY_MASK_MAX
    )
    # `model_fields_set` distinguishes "not sent" from an explicit null
    # (clearing the schedule = sending start_time and end_time as null).

    @model_validator(mode="after")
    def _check_fields(self) -> "MenuUpdate":
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name_required")
        # Only validate here when both ends are in the payload; a lone end is
        # re-checked by the service against the resulting state.
        if {"start_time", "end_time"} <= self.model_fields_set:
            validate_schedule(self.start_time, self.end_time)
        return self


class MenuRead(BaseModel):
    id: uuid.UUID
    name: str
    is_default: bool
    start_time: time | None
    end_time: time | None
    weekday_mask: int | None
    categories_count: int

    model_config = ConfigDict(from_attributes=True)


def validate_schedule(start: time | None, end: time | None) -> None:
    """Raise ValueError(code) if the start/end pair is not a valid schedule.

    Shared by the schemas (pydantic turns it into a 422) and the service
    (which re-checks the resulting state of a PATCH).
    """
    if (start is None) != (end is None):
        raise ValueError("incomplete_schedule")
    if start is not None and start == end:
        raise ValueError("invalid_schedule")
