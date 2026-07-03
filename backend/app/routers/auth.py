from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserRead
from app.services.auth import authenticate_user, create_access_token, register_user

router = APIRouter()

_SECONDS_PER_MINUTE = 60


def _set_auth_cookie(response: Response, token: str) -> None:
    """Store the JWT in an httpOnly cookie so browser clients never touch it."""
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=settings.JWT_EXPIRE_MINUTES * _SECONDS_PER_MINUTE,
        secure=settings.COOKIE_SECURE,
    )


def _clear_auth_cookie(response: Response) -> None:
    """Expire the auth cookie using the same attributes _set_auth_cookie writes.

    key + path must match the original for the browser to drop the right cookie;
    httponly/samesite/secure are kept symmetric so proxies don't reject it.
    """
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    data: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        user = await register_user(data, session)
    except ValueError as exc:
        if str(exc) == "email_taken":
            raise HTTPException(status_code=400, detail="email_taken")
        raise
    token = create_access_token(str(user.id))
    _set_auth_cookie(response, token)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse, status_code=200)
async def login(
    data: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        user = await authenticate_user(data, session)
    except ValueError as exc:
        msg = str(exc)
        if msg == "invalid_credentials":
            raise HTTPException(status_code=401, detail="invalid_credentials")
        if msg == "inactive_user":
            raise HTTPException(status_code=403, detail="inactive_user")
        raise
    token = create_access_token(str(user.id))
    _set_auth_cookie(response, token)
    return TokenResponse(access_token=token)


@router.post("/logout", status_code=204)
async def logout(response: Response) -> None:
    """Clear the auth cookie. Idempotent: no auth or DB access required, so it
    succeeds whether or not a cookie is present. Returns 204 No Content."""
    _clear_auth_cookie(response)


@router.get("/me", response_model=UserRead, status_code=200)
async def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
