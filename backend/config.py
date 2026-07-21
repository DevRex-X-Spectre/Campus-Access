"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from functools import lru_cache


def _parse_origins(raw: str) -> list[str]:
    """Split comma-separated CORS origins; strip whitespace; drop empties."""
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


class Settings:
    """Runtime settings for the Campus Access API."""

    def __init__(self) -> None:
        self.match_threshold: float = float(os.getenv("MATCH_THRESHOLD", "0.6"))
        self.allowed_origins: list[str] = _parse_origins(
            os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")
        )
        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./campus_access.db")
        self.sqlite_path: str = os.getenv("SQLITE_PATH", "./campus_access.db")
        # Simple admin gate PIN (prototype). Override via ADMIN_PIN in production demos.
        self.admin_pin: str = os.getenv("ADMIN_PIN", "0852")


@lru_cache
def get_settings() -> Settings:
    return Settings()
