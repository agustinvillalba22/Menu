import re

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.style import FontFamily

_HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def _validate_hex_color(v: str | None) -> str | None:
    """Accept a CSS hex color (#RGB or #RRGGBB, case-insensitive) or None."""
    if v is not None and not _HEX_COLOR_RE.match(v):
        raise ValueError("invalid_hex_color")
    return v


class StyleRead(BaseModel):
    font_family: FontFamily
    primary_color: str | None
    secondary_color: str | None

    model_config = ConfigDict(from_attributes=True)


class StyleUpdate(BaseModel):
    font_family: FontFamily | None = None
    primary_color: str | None = None
    secondary_color: str | None = None

    @field_validator("primary_color", "secondary_color")
    @classmethod
    def _check_hex(cls, v: str | None) -> str | None:
        return _validate_hex_color(v)
