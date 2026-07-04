import uuid

from fastapi import Depends, HTTPException, Path, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.restaurant import RestaurantRole, UserRestaurantRole
from app.models.user import User
from app.services.auth import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_current_user(
    request: Request,
    header_token: str | None = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    # Precedence: httpOnly cookie first, Authorization header as fallback.
    token = request.cookies.get(settings.AUTH_COOKIE_NAME) or header_token
    if token is None:
        raise HTTPException(status_code=401, detail="not_authenticated")
    try:
        user_id_str = decode_token(token)
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="invalid_token")

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="user_not_found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="inactive_user")
    return user


_ROLE_HIERARCHY: dict[RestaurantRole, int] = {
    RestaurantRole.owner: 2,
    RestaurantRole.editor: 1,
}


def require_role(role: RestaurantRole):
    """Factory that returns a FastAPI dependency enforcing a minimum role."""

    async def _dependency(
        restaurant_id: uuid.UUID = Path(...),
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_db),
    ) -> User:
        result = await session.execute(
            select(UserRestaurantRole).where(
                UserRestaurantRole.user_id == current_user.id,
                UserRestaurantRole.restaurant_id == restaurant_id,
            )
        )
        assignment = result.scalar_one_or_none()
        if assignment is None:
            raise HTTPException(status_code=403, detail="no_role")
        if _ROLE_HIERARCHY[assignment.role] < _ROLE_HIERARCHY[role]:
            raise HTTPException(status_code=403, detail="insufficient_role")
        return current_user

    return _dependency
