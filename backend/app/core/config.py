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
