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
        # Cosine similarity threshold for a positive match (0–1).
        self.match_threshold: float = float(os.getenv("MATCH_THRESHOLD", "0.6"))

        # Comma-separated list of allowed frontend origins for CORS.
        # Default allows local Vite dev server.
        self.allowed_origins: list[str] = _parse_origins(
            os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")
        )

        # SQLite database path (relative paths resolve from process CWD).
        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./campus_access.db")

        # Optional override for the SQLite file path when using the sqlite3 driver directly.
        self.sqlite_path: str = os.getenv("SQLITE_PATH", "./campus_access.db")


@lru_cache
def get_settings() -> Settings:
    return Settings()
