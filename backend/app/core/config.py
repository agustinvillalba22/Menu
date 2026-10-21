from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    APP_NAME: str = "Menu"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    AUTH_COOKIE_NAME: str = "access_token"
    COOKIE_SECURE: bool = False
    # Browsers reject SameSite=None without Secure; enforced in the validator.
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    LOG_LEVEL: str = "INFO"

    # Tz fallback for restaurants whose `timezone` is null and for
    # flows without a restaurant context. IANA name; UTC is a safe no-op.
    DEFAULT_TIMEZONE: str = "UTC"

    # Global kill-switch for multi-menu auto-switching. Off =
    # every restaurant serves its `is_default` menu (pre-multi-menu behavior, total
    # back-compat). On = menus with `start_time` are filtered by the current
    # time in the restaurant's tz, falling back to `is_default` when none
    # matches. Per-restaurant gating is not implemented.
    MENU_SCHEDULING_ENABLED: bool = True

    # Cloudflare R2 (S3-compatible object storage) — item images.
    # No defaults: missing any of these fails app startup (fail-fast, same
    # pattern as DATABASE_URL / SECRET_KEY).
    R2_ACCOUNT_ID: str
    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_ENDPOINT_URL: str
    R2_BUCKET_NAME: str
    R2_PUBLIC_URL: str

    # Mercado Pago (Checkout Pro, marketplace model). All optional with
    # empty defaults: a missing value must never break startup or tests; the
    # integration simply reports itself as not configured (see
    # `mercadopago_configured` / `mercadopago_oauth_configured`).
    MP_CLIENT_ID: str = ""
    MP_CLIENT_SECRET: str = ""
    MP_WEBHOOK_SECRET: str = ""
    # Fernet key (urlsafe base64, 32 bytes) used to encrypt sellers' tokens.
    MP_TOKEN_ENCRYPTION_KEY: str = ""
    # Public base URL of this backend (OAuth redirect_uri, webhook URL).
    # Development only: access token of a Mercado Pago *test* seller, used by
    # scripts/connect_test_seller.py to skip the OAuth step. Never set in prod.
    MP_TEST_SELLER_ACCESS_TOKEN: str = ""
    PUBLIC_API_URL: str = ""
    # Base URL of the frontend (payment back_urls, OAuth result redirect).
    FRONTEND_URL: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def mercadopago_configured(self) -> bool:
        """Enough to charge and confirm payments with an already-stored seller
        token (preference, webhook, public flag). Needs no client credentials."""
        return all(
            (
                self.MP_WEBHOOK_SECRET,
                self.MP_TOKEN_ENCRYPTION_KEY,
                self.PUBLIC_API_URL,
                self.FRONTEND_URL,
            )
        )

    @property
    def mercadopago_oauth_configured(self) -> bool:
        """Additionally needed to connect a restaurant by OAuth (and to refresh
        its token): the application's client id and secret."""
        return bool(
            self.mercadopago_configured and self.MP_CLIENT_ID and self.MP_CLIENT_SECRET
        )

    @model_validator(mode="after")
    def _samesite_none_requires_secure(self) -> "Settings":
        if self.COOKIE_SAMESITE == "none" and not self.COOKIE_SECURE:
            raise ValueError(
                "COOKIE_SAMESITE=none requires COOKIE_SECURE=true "
                "(browsers reject SameSite=None cookies without Secure)"
            )
        return self


settings = Settings()
