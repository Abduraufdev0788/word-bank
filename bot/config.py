import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class BotSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    TELEGRAM_BOT_TOKEN: str = ""
    BACKEND_INTERNAL_API_URL: str = "http://localhost:8000/api/v1"
    TELEGRAM_BOT_USERNAME: str = "SmartVocabAIBot"


bot_settings = BotSettings()
