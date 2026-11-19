from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

APP_NAME = "Research Studio"
DATA_DIR_ENV_VAR = "RESEARCH_STUDIO_DATA_DIR"
BOOTSTRAP_DIR_ENV_VAR = "RESEARCH_STUDIO_BOOTSTRAP_DIR"
STORAGE_CONFIG_FILENAME = "storage.json"
USER_BACKUP_KEEP_COUNT = 7
PRE_RESTORE_BACKUP_KEEP_COUNT = 3
REPO_ROOT = Path(__file__).resolve().parents[3]

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

DEFAULT_BIND_HOST = "127.0.0.1"
ALLOWED_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1", "[::1]"})

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
]


def validate_loopback_bind_host(host: str) -> str:
    """Ensure the local server binds strictly to a loopback interface rather than 0.0.0.0 or LAN IPs."""
    cleaned = host.strip()
    lowered = cleaned.lower()
    if lowered not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError(
            f"Refusing non-loopback bind host {host!r}; Research Studio must bind strictly to 127.0.0.1/localhost/::1."
        )
    return cleaned


def get_default_bootstrap_dir() -> Path:
    """Return the default Research Studio bootstrap directory outside the repository."""
    override = os.environ.get(BOOTSTRAP_DIR_ENV_VAR, "").strip()
    if override:
        return Path(override).expanduser().resolve()
    local_app_data = os.environ.get("LOCALAPPDATA", "").strip()
    base = Path(local_app_data) if local_app_data else (Path.home() / "AppData" / "Local")
    return (base / "ResearchStudio").resolve()


def get_storage_config_path() -> Path:
    """Return the persistent storage.json config path inside the bootstrap config folder."""
    return get_default_bootstrap_dir() / "config" / STORAGE_CONFIG_FILENAME


def _default_storage_config() -> dict[str, Any]:
    return {
        "activeDataDir": None,
        "externalBackupDir": None,
        "autoBackupEnabled": True,
        "lastBackupAtUtc": None,
        "lastBackupFilename": None,
    }


def read_storage_bootstrap_config() -> dict[str, Any]:
    """Read storage.json safely, returning normalized defaults if absent or malformed."""
    defaults = _default_storage_config()
    cfg_path = get_storage_config_path()
    try:
        if not cfg_path.is_file():
            return defaults
        parsed = json.loads(cfg_path.read_text(encoding="utf-8"))
        if not isinstance(parsed, dict):
            return defaults
    except (OSError, ValueError):
        return defaults

    def _clean_opt_str(key: str) -> str | None:
        val = parsed.get(key)
        if isinstance(val, str):
            stripped = val.strip()
            return stripped or None
        return None

    return {
        "activeDataDir": _clean_opt_str("activeDataDir"),
        "externalBackupDir": _clean_opt_str("externalBackupDir"),
        "autoBackupEnabled": bool(parsed.get("autoBackupEnabled", True)),
        "lastBackupAtUtc": _clean_opt_str("lastBackupAtUtc"),
        "lastBackupFilename": _clean_opt_str("lastBackupFilename"),
    }


def write_storage_bootstrap_config(data: dict[str, Any]) -> None:
    """Atomically write normalized storage configuration to bootstrap storage.json."""
    cfg_path = get_storage_config_path()
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    normalized = _default_storage_config()
    for key in ("activeDataDir", "externalBackupDir", "lastBackupAtUtc", "lastBackupFilename"):
        val = data.get(key)
        normalized[key] = str(val).strip() if isinstance(val, str) and val.strip() else None
    normalized["autoBackupEnabled"] = bool(data.get("autoBackupEnabled", True))

    tmp_path = cfg_path.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp_path, cfg_path)


def get_data_dir() -> Path:
    """Resolve user data directory cleanly outside the source repository."""
    override = os.environ.get(DATA_DIR_ENV_VAR, "").strip()
    if override:
        return Path(override).expanduser().resolve()

    cfg = read_storage_bootstrap_config()
    configured = cfg.get("activeDataDir")
    if isinstance(configured, str) and configured:
        if not configured.startswith("\\\\") and not configured.startswith("//"):
            candidate = Path(configured).expanduser()
            if candidate.is_absolute():
                try:
                    resolved = candidate.resolve()
                    if not str(resolved).startswith("\\\\"):
                        resolved.mkdir(parents=True, exist_ok=True)
                        return resolved
                except OSError:
                    pass

    return get_default_bootstrap_dir()


def ensure_runtime_dirs(data_dir: Path | None = None) -> dict[str, Path]:
    """Create and return isolated runtime subdirectories for SQLite, backups, logs, and config."""
    root = (data_dir or get_data_dir()).resolve()
    paths = {
        "root": root,
        "data": root / "data",
        "backups": root / "backups",
        "user_backups": root / "user_backups",
        "logs": root / "logs",
        "config": root / "config",
        "db_path": root / "data" / "research_studio.db",
    }
    for key in ("root", "data", "backups", "user_backups", "logs", "config"):
        paths[key].mkdir(parents=True, exist_ok=True)
    return paths


def get_allowed_origins() -> list[str]:
    """Return explicit localhost origins allowed for CORS and mutation origin checks."""
    raw = os.getenv("CORS_ORIGINS", "")
    if raw.strip():
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return list(DEFAULT_ALLOWED_ORIGINS)
