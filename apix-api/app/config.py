import json
import os
from typing import Dict, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    APP_NAME: str = "APIx - Real-Time Airfare Price Index API"
    APP_ENV: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # API Keys mapping JSON string -> { api_key: role }
    # e.g. {"mospi-nso-key-2026":"NSO_STATISTICIAN","rbi-mpd-key-2026":"RBI_ANALYST"}
    API_KEYS: str = Field(
        default='{"mospi-nso-key-2026":"NSO_STATISTICIAN","rbi-mpd-key-2026":"RBI_ANALYST"}'
    )

    DATABASE_URL: str = "postgresql+asyncpg://apix_user:apix_secret@localhost:5432/apix_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    RATE_LIMIT_PUBLIC: int = 30   # requests per minute
    RATE_LIMIT_AUTH: int = 600    # requests per minute

    BASE_PERIOD: str = "2025-01-01=100"
    CORS_ORIGINS: str = '["http://localhost:3000","http://127.0.0.1:3000"]'

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def api_keys_map(self) -> Dict[str, str]:
        try:
            val = json.loads(self.API_KEYS)
            if isinstance(val, dict):
                return val
            return {}
        except Exception:
            return {}

    @property
    def allowed_cors_origins(self) -> List[str]:
        try:
            val = json.loads(self.CORS_ORIGINS)
            if isinstance(val, list):
                return val
            return ["http://localhost:3000"]
        except Exception:
            return ["http://localhost:3000"]


settings = Settings()
