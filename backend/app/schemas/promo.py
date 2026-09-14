"""Promo schemas (P4, Fase 2c) — dashboard CRUD shape.

Field bounds mirror the model/migration (0009): ``discount_pct`` 0-100,
title/substr ≤120/160, description ≤1000. Semantic validation (aware
datetimes, window ordering, item ownership) lives in the service layer as
``HTTPException(422)`` — same error-shape convention as the rest of the API
(a ``detail`` string, not pydantic's error list).
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.promo import Promo


class PromoBase(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    subtitle: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    discount_pct: int | None = Field(default=None, ge=0, le=100)
    image_url: str | None = None
    # Optional link to one of the restaurant's own items (verified at the
    # service layer — cross-restaurant ids are 404 item_not_found).
    item_id: uuid.UUID | None = None
    is_active: bool = False
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class PromoCreate(PromoBase):
    pass


class PromoUpdate(BaseModel):
    """Partial update — only the fields actually present are applied."""
    title: str | None = Field(default=None, min_length=1, max_length=120)
    subtitle: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    discount_pct: int | None = Field(default=None, ge=0, le=100)
    image_url: str | None = None
    item_id: uuid.UUID | None = None
    is_active: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class PromoRead(BaseModel):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    title: str
    subtitle: str | None
    description: str | None
    discount_pct: int | None
    image_url: str | None
    item_id: uuid.UUID | None
    is_active: bool
    starts_at: datetime | None
    ends_at: datetime | None
    # P5 (Fase 2d): calendar days until ends_at in the restaurant's tz —
    # computed server-side (never trusted from the client), None when the
    # promo has no end date. 0 = expires today (or already past).
    days_remaining: int | None = None

    model_config = ConfigDict(from_attributes=True)


class PromoImageUploadRequest(BaseModel):
    content_type: str
    file_size: int = Field(gt=0)


class PromoImageUploadResponse(BaseModel):
    upload_url: str
    object_key: str
    expires_in: int


class PromoImageConfirmRequest(BaseModel):
    object_key: str = Field(min_length=1)


__all__ = [
    "Promo",
    "PromoBase",
    "PromoCreate",
    "PromoUpdate",
    "PromoRead",
    "PromoImageUploadRequest",
    "PromoImageUploadResponse",
    "PromoImageConfirmRequest",
]
