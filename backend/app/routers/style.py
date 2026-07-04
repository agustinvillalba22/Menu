import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.restaurant import RestaurantRole
from app.models.user import User
from app.schemas.style import StyleRead, StyleUpdate
from app.services.style import get_style, update_style

router = APIRouter()


@router.get(
    "/{restaurant_id}/style", response_model=StyleRead, status_code=200
)
async def get_one(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_role(RestaurantRole.editor)),
    session: AsyncSession = Depends(get_db),
) -> StyleRead:
    style = await get_style(restaurant_id, session)
    return StyleRead.model_validate(style)


@router.patch(
    "/{restaurant_id}/style", response_model=StyleRead, status_code=200
)
async def patch(
    restaurant_id: uuid.UUID,
    data: StyleUpdate,
    _: User = Depends(require_role(RestaurantRole.owner)),
    session: AsyncSession = Depends(get_db),
) -> StyleRead:
    style = await update_style(restaurant_id, data, session)
    return StyleRead.model_validate(style)
