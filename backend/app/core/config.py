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

    # Fase 0a — tz fallback for restaurants whose `timezone` is null and for
    # flows without a restaurant context. IANA name; UTC is a safe no-op.
    DEFAULT_TIMEZONE: str = "UTC"

    # Fase 2b (P2) — global kill-switch for multi-menu auto-switching. Off =
    # every restaurant serves its `is_default` menu (pre-P2 behavior, total
    # back-compat). On = menus with `start_time` are filtered by the current
    # time in the restaurant's tz, falling back to `is_default` when none
    # matches. Per-restaurant gating arrives with the Fase 3 CRUD.
    MENU_SCHEDULING_ENABLED: bool = False

    # Cloudflare R2 (S3-compatible object storage) — M4 item images.
    # No defaults: missing any of these fails app startup (fail-fast, same
    # pattern as DATABASE_URL / SECRET_KEY).
    R2_ACCOUNT_ID: str
    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_ENDPOINT_URL: str
    R2_BUCKET_NAME: str
    R2_PUBLIC_URL: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
