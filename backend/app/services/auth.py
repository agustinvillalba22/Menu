from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> str:
    """Decode JWT and return the 'sub' claim. Raises JWTError if invalid or expired."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    sub: str | None = payload.get("sub")
    if sub is None:
        raise JWTError("missing sub claim")
    return sub


async def get_user_by_email(email: str, session: AsyncSession) -> User | None:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def register_user(data: RegisterRequest, session: AsyncSession) -> User:
    email = data.email.lower()
    existing = await get_user_by_email(email, session)
    if existing is not None:
        raise ValueError("email_taken")
    user = User(
        email=email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def authenticate_user(data: LoginRequest, session: AsyncSession) -> User:
    email = data.email.lower()
    user = await get_user_by_email(email, session)
    if user is None or not verify_password(data.password, user.hashed_password):
        raise ValueError("invalid_credentials")
    if not user.is_active:
        raise ValueError("inactive_user")
    return user
