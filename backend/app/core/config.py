from typing import List, Optional, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Project metadata
    PROJECT_NAME: str = "SmartVocab AI"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    APP_URL: str = "http://localhost:5173"

    # Security & Auth
    SECRET_KEY: str = Field(
        default="smartvocab_development_secret_key_must_be_overridden_in_prod_min_32_chars",
        description="Cryptographic secret key for signing JWT tokens",
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://smartvocab_user:strong_password_here@localhost:5432/smartvocab_db"
    )

    # Google Gemini AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-flash-lite-latest"
    GEMINI_REQUEST_TIMEOUT_SECONDS: int = 30
    GEMINI_MAX_RETRIES: int = 3

    # Google Cloud Translate (optional, falls back to fast translation)
    GOOGLE_TRANSLATE_API_KEY: Optional[str] = None

    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_BOT_USERNAME: str = "english_learn_daily_robot"
    TELEGRAM_LINK_TOKEN_EXPIRE_MINUTES: int = 15
    BACKEND_INTERNAL_API_URL: str = "http://localhost:8000/api/v1"

    # Learning & Study Time Tracking
    STUDY_SESSION_IDLE_TIMEOUT_MINUTES: int = 5
    STUDY_HEARTBEAT_INTERVAL_SECONDS: int = 30
    MAX_WORDS_PER_BATCH: int = 20
    DEFAULT_DAILY_WORDS_GOAL: int = 10
    DEFAULT_DAILY_STUDY_TIME_MINUTES: int = 20


settings = Settings()
