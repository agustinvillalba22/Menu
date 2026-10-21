import uuid
from typing import Any, TypeVar

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base

ModelT = TypeVar("ModelT", bound=Base)


async def get_owned(
    session: AsyncSession,
    model: type[ModelT],
    restaurant_id: uuid.UUID,
    object_id: uuid.UUID,
    not_found: str,
    *,
    for_update: bool = False,
) -> ModelT:
    """Fetch a row of ``model`` that belongs to the restaurant, or 404 ``not_found``.

    Another restaurant's id answers the same 404 as a missing one, so ids of
    other tenants are never confirmed. ``model`` needs ``id`` and ``restaurant_id``.
    """
    query = select(model).where(
        model.id == object_id,  # type: ignore[attr-defined]
        model.restaurant_id == restaurant_id,  # type: ignore[attr-defined]
    )
    if for_update:
        query = query.with_for_update()
    obj = (await session.execute(query)).scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail=not_found)
    return obj


def apply_patch(obj: Base, changes: dict[str, Any], *, skip_none: bool = False) -> None:
    """Set each changed field on ``obj``.

    ``skip_none`` ignores explicit nulls, for NOT NULL columns where a null in
    the PATCH body should be a no-op instead of an IntegrityError.
    """
    for field, value in changes.items():
        if skip_none and value is None:
            continue
        setattr(obj, field, value)
