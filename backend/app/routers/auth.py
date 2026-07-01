from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserRead
from app.services.auth import authenticate_user, create_access_token, register_user

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    data: RegisterRequest,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        user = await register_user(data, session)
    except ValueError as exc:
        if str(exc) == "email_taken":
            raise HTTPException(status_code=400, detail="email_taken")
        raise
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse, status_code=200)
async def login(
    data: LoginRequest,
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
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserRead, status_code=200)
async def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
