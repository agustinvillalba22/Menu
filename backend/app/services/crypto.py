from cryptography.fernet import Fernet

from app.core.config import settings


def _fernet() -> Fernet:
    return Fernet(settings.MP_TOKEN_ENCRYPTION_KEY.encode())


def encrypt(value: str) -> str:
    """Encrypt ``value`` with the configured Fernet key (M36 RF-02)."""
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    """Inverse of :func:`encrypt`. Raises ``cryptography.fernet.InvalidToken``
    if the value was tampered with or encrypted under another key."""
    return _fernet().decrypt(value.encode()).decode()
