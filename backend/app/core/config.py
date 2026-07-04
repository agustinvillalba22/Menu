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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
