from __future__ import annotations

import os
from pathlib import Path

APP_NAME = "Research Studio"
DATA_DIR_ENV_VAR = "RESEARCH_STUDIO_DATA_DIR"

# TUNING REQUIRED safe initial defaults (SPEC.md §18.3)
COMPETITOR_VIDEOS_PER_REFRESH = 40
SEARCH_MAX_RESULTS_PER_CALL = 25
QUOTA_SEARCH_DAILY_LIMIT = 100
QUOTA_GENERAL_DAILY_LIMIT = 10000
QUOTA_WARNING_RATIO = 0.80
AUTO_REFRESH_STARTUP_DELAY_SEC = 30
AUTO_REFRESH_CHANNEL_INTERVAL_HOURS = 12
AUTO_REFRESH_RSS_INTERVAL_HOURS = 4
AUTO_REFRESH_MAX_API_UNITS_PER_BATCH = 15
AUTO_REFRESH_DAILY_QUOTA_CAP = 3000
HTTP_CONNECT_TIMEOUT_SEC = 10.0
HTTP_READ_TIMEOUT_SEC = 20.0
HTTP_RETRY_MAX_ATTEMPTS = 2
RSS_MAX_PAYLOAD_BYTES = 5 * 1024 * 1024
RSS_MAX_CONCURRENCY = 3
RSS_CACHE_RETENTION_DAYS = 60
YOUTUBE_API_CACHE_TTL_DAYS = 30
SQLITE_BUSY_TIMEOUT_MS = 5000
TABLE_PAGE_SIZE = 50

YOUTUBE_TOS_URL = "https://www.youtube.com/t/terms"
GOOGLE_PRIVACY_POLICY_URL = "https://policies.google.com/privacy"
YOUTUBE_BRANDING_URL = "https://developers.google.com/youtube/terms/branding-guidelines"

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]


def get_data_dir() -> Path:
    """Resolve user data directory cleanly outside the source repository."""
    override = os.environ.get(DATA_DIR_ENV_VAR, "").strip()
    if override:
        return Path(override).expanduser().resolve()
    local_app_data = os.environ.get("LOCALAPPDATA", "").strip()
    base = Path(local_app_data) if local_app_data else (Path.home() / "AppData" / "Local")
    return (base / "ResearchStudio").resolve()


def ensure_runtime_dirs(data_dir: Path | None = None) -> dict[str, Path]:
    """Create and return isolated runtime subdirectories for SQLite, backups, logs, and config."""
    root = (data_dir or get_data_dir()).resolve()
    paths = {
        "root": root,
        "data": root / "data",
        "backups": root / "backups",
        "logs": root / "logs",
        "config": root / "config",
        "db_path": root / "data" / "research_studio.db",
    }
    for key in ("root", "data", "backups", "logs", "config"):
        paths[key].mkdir(parents=True, exist_ok=True)
    return paths


def get_allowed_origins() -> list[str]:
    """Return explicit localhost origins allowed for CORS and mutation origin checks."""
    raw = os.getenv("CORS_ORIGINS", "")
    if raw.strip():
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return list(DEFAULT_ALLOWED_ORIGINS)
