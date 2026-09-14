"""Promo service (P4/P5, Fase 2c/2d).

Dashboard CRUD + the public "active promo" resolution. Same layering as the
other feature services: semantic validation (aware datetimes, window
ordering, item ownership) raises ``HTTPException`` here so every caller gets
the API's ``detail``-string error shape.

R2 images reuse the generic ``services.image_upload`` (Fase 0b) with the
``promos/{restaurant_id}/{promo_id}/`` object-key prefix — the binary never
passes through the API, exactly like item images (M4) and logos (P6).
"""
import uuid
from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.item import Item
from app.models.menu import Category, Menu, Subcategory
from app.models.promo import Promo
from app.models.restaurant import Restaurant
from app.schemas.promo import (
    PromoCreate,
    PromoImageConfirmRequest,
    PromoImageUploadRequest,
    PromoUpdate,
)
from app.services import image_upload
from app.services.datetime import now_in


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def _aware(value: datetime) -> datetime:
    """SQLite round-trips can hand back naive datetimes; assume UTC then.

    Postgres (DateTime(timezone=True)) always returns aware — this is a
    no-op there and only paper-overs the test engine's lossy parse.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=dt_timezone.utc)
    return value


def _reject_naive_input(**named: datetime | None) -> None:
    """Reject naive datetimes coming from client payloads (422).

    Only payload-sourced values: SQLite round-trips can hand back naive
    stored datetimes, which ``_validate_window`` tolerates via ``_aware``.
    """
    for name, value in named.items():
        if value is not None and value.tzinfo is None:
            raise HTTPException(status_code=422, detail="naive_datetime")


def _validate_window(starts_at: datetime | None, ends_at: datetime | None) -> None:
    """Reject inverted windows (422, detail-string).

    Naive values are normalized to UTC first — Postgres always returns
    aware; only the SQLite test engine is lossy there.
    """
    if starts_at is None or ends_at is None:
        return
    if _aware(starts_at) >= _aware(ends_at):
        raise HTTPException(status_code=422, detail="invalid_promo_window")


async def _check_item_owned(
    restaurant_id: uuid.UUID, item_id: uuid.UUID, session: AsyncSession
) -> None:
    """The linked item must belong to one of the restaurant's menus."""
    result = await session.execute(
        select(Item.id)
        .join(Subcategory, Item.subcategory_id == Subcategory.id)
        .join(Category, Subcategory.category_id == Category.id)
        .join(Menu, Category.menu_id == Menu.id)
        .where(Item.id == item_id, Menu.restaurant_id == restaurant_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="item_not_found")


# ---------------------------------------------------------------------------
# Dashboard CRUD
# ---------------------------------------------------------------------------


async def create_promo(
    restaurant_id: uuid.UUID, data: PromoCreate, session: AsyncSession
) -> Promo:
    _reject_naive_input(starts_at=data.starts_at, ends_at=data.ends_at)
    _validate_window(data.starts_at, data.ends_at)
    if data.item_id is not None:
        await _check_item_owned(restaurant_id, data.item_id, session)
    promo = Promo(restaurant_id=restaurant_id, **data.model_dump())
    session.add(promo)
    await session.commit()
    # Re-fetch through get_promo so Promo.restaurant is eager-loaded —
    # days_remaining (P5) reads the tz off it and must not lazy-load.
    return await get_promo(restaurant_id, promo.id, session)


async def list_promos(
    restaurant_id: uuid.UUID, session: AsyncSession
) -> list[Promo]:
    """All promos, newest first — the dashboard decides what to highlight.

    ``Promo.restaurant`` is eager-loaded: ``days_remaining`` (P5) reads the
    restaurant's tz off the row and must not lazy-load in async context.
    """
    result = await session.execute(
        select(Promo)
        .where(Promo.restaurant_id == restaurant_id)
        .options(selectinload(Promo.restaurant))
        .order_by(Promo.created_at.desc())
    )
    return list(result.scalars().all())


async def get_promo(
    restaurant_id: uuid.UUID, promo_id: uuid.UUID, session: AsyncSession
) -> Promo:
    result = await session.execute(
        select(Promo)
        .where(Promo.id == promo_id, Promo.restaurant_id == restaurant_id)
        .options(selectinload(Promo.restaurant))
    )
    promo = result.scalar_one_or_none()
    if promo is None:
        raise HTTPException(status_code=404, detail="promo_not_found")
    return promo


async def update_promo(
    restaurant_id: uuid.UUID,
    promo_id: uuid.UUID,
    data: PromoUpdate,
    session: AsyncSession,
) -> Promo:
    promo = await get_promo(restaurant_id, promo_id, session)
    changes = data.model_dump(exclude_unset=True)
    if "starts_at" in changes or "ends_at" in changes:
        _reject_naive_input(
            starts_at=changes.get("starts_at"), ends_at=changes.get("ends_at")
        )
    if "item_id" in changes and changes["item_id"] is not None:
        await _check_item_owned(restaurant_id, changes["item_id"], session)
    for field, value in changes.items():
        setattr(promo, field, value)
    # Validate the *effective* window: a PATCH that only touches ends_at
    # must still be checked against the already-stored starts_at.
    _validate_window(promo.starts_at, promo.ends_at)
    await session.commit()
    return await get_promo(restaurant_id, promo_id, session)


async def delete_promo(
    restaurant_id: uuid.UUID, promo_id: uuid.UUID, session: AsyncSession
) -> None:
    promo = await get_promo(restaurant_id, promo_id, session)
    if promo.image_url:
        await image_upload.delete_object_best_effort(
            image_upload.object_key_from_url(promo.image_url)
        )
    await session.delete(promo)
    await session.commit()


# ---------------------------------------------------------------------------
# P5 — expiry signal for the dashboard
# ---------------------------------------------------------------------------


def days_remaining(promo: Promo, now: datetime | None = None) -> int | None:
    """Calendar days until ``ends_at`` in the restaurant's tz (None if open).

    0 means "expires today (or already past)" — the dashboard badge treats
    0 as the urgent case, not negative numbers.
    """
    if promo.ends_at is None:
        return None
    restaurant = promo.restaurant
    tz_name = restaurant.timezone if restaurant is not None else None
    now = now or now_in(tz_name)
    ends_local = _aware(promo.ends_at).astimezone(
        ZoneInfo(tz_name or "UTC")
    )
    return max(0, (ends_local.date() - now.date()).days)


# ---------------------------------------------------------------------------
# Public — active promo resolution
# ---------------------------------------------------------------------------


def active_promo_for(
    restaurant: Restaurant, now: datetime | None = None
) -> Promo | None:
    """The promo the public menu should render, or None.

    Works off the eager-loaded ``restaurant.promos`` (no extra query):
    ``is_active`` AND ``now`` within ``[starts_at, ends_at]`` (bounds
    optional) in the restaurant's tz. No periodic job flips flags — the
    window check is implicit at read time. Deterministic when several
    overlap: newest ``created_at`` wins.
    """
    promos = list(restaurant.promos)
    if not promos:
        return None
    if now is None:
        now = now_in(restaurant.timezone)
    candidates = []
    for promo in promos:
        if not promo.is_active:
            continue
        starts_at = _aware(promo.starts_at) if promo.starts_at is not None else None
        ends_at = _aware(promo.ends_at) if promo.ends_at is not None else None
        if starts_at is not None and now < starts_at:
            continue
        if ends_at is not None and now > ends_at:
            continue
        candidates.append(promo)
    if not candidates:
        return None
    return max(candidates, key=lambda p: (p.created_at, p.id))


# ---------------------------------------------------------------------------
# R2 image upload (promos/{restaurant_id}/{promo_id}/)
# ---------------------------------------------------------------------------


def _image_prefix(restaurant_id: uuid.UUID, promo_id: uuid.UUID) -> str:
    return f"promos/{restaurant_id}/{promo_id}/"


async def create_promo_image_upload_url(
    restaurant_id: uuid.UUID,
    promo_id: uuid.UUID,
    data: PromoImageUploadRequest,
    session: AsyncSession,
) -> tuple[str, str, int]:
    """Validate content type/size and sign a presigned PUT URL.

    Returns ``(upload_url, object_key, expires_in)``; persistence happens on
    confirm so a signed-but-never-uploaded URL leaves no trace.
    """
    await get_promo(restaurant_id, promo_id, session)
    return await image_upload.sign_upload(
        data.content_type,
        data.file_size,
        _image_prefix(restaurant_id, promo_id),
    )


async def confirm_promo_image_upload(
    restaurant_id: uuid.UUID,
    promo_id: uuid.UUID,
    data: PromoImageConfirmRequest,
    session: AsyncSession,
) -> Promo:
    """Verify the R2 object and persist its public URL on the promo."""
    promo = await get_promo(restaurant_id, promo_id, session)
    public_url = await image_upload.verify_upload(
        data.object_key, _image_prefix(restaurant_id, promo_id)
    )
    if promo.image_url:
        await image_upload.delete_object_best_effort(
            image_upload.object_key_from_url(promo.image_url)
        )
    promo.image_url = public_url
    await session.commit()
    await session.refresh(promo)
    return promo


async def delete_promo_image(
    restaurant_id: uuid.UUID, promo_id: uuid.UUID, session: AsyncSession
) -> Promo:
    """Remove the promo image from R2 (best-effort) and clear image_url."""
    promo = await get_promo(restaurant_id, promo_id, session)
    if not promo.image_url:
        raise HTTPException(status_code=404, detail="promo_image_not_found")
    await image_upload.delete_object_best_effort(
        image_upload.object_key_from_url(promo.image_url)
    )
    promo.image_url = None
    await session.commit()
    await session.refresh(promo)
    return promo
