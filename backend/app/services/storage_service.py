from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import threading
from typing import Any, Literal

from app.core.config import (
    DATA_DIR_ENV_VAR,
    PRE_RESTORE_BACKUP_KEEP_COUNT,
    REPO_ROOT,
    USER_BACKUP_KEEP_COUNT,
    ensure_runtime_dirs,
    get_default_bootstrap_dir,
    read_storage_bootstrap_config,
    write_storage_bootstrap_config,
)
from app.core.errors import AppError
from app.core.logging_setup import close_logging_handlers, configure_logging
from app.core.security import dpapi_unprotect
from app.db.connection import open_connection
from app.db.migrator import run_migrations
from app.services import retention_service

_storage_lock = threading.RLock()

_RESERVED_WIN_NAMES = frozenset(
    {
        "CON",
        "PRN",
        "AUX",
        "NUL",
        *(f"COM{i}" for i in range(1, 10)),
        *(f"LPT{i}" for i in range(1, 10)),
    }
)
_FORBIDDEN_WIN_SYSTEM_ROOT_DIRS = frozenset(
    {
        "windows",
        "program files",
        "program files (x86)",
        "programdata",
    }
)
_SQLITE_HEADER = b"SQLite format 3\x00"
_REQUIRED_SCHEMA_TABLES = frozenset(
    {
        "projects",
        "ideas",
        "project_ideas",
        "rss_feeds",
        "system_settings",
    }
)
_MIN_BACKUP_SIZE_BYTES = 4096
_MAX_BACKUP_SIZE_BYTES = 500 * 1024 * 1024
_AUTO_BACKUP_MIN_AGE_HOURS = 20

_FOLDER_PICKER_PS = r"""
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.ShowNewFolderButton = $true
$dlg.Description = 'Chon thu muc luu tru cho Research Studio'
$init = $env:RS_PICKER_INITIAL_DIR
if ($init -and (Test-Path -LiteralPath $init -PathType Container)) {
    $dlg.SelectedPath = $init
}
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$res = $dlg.ShowDialog($owner)
$owner.Dispose()
if ($res -eq [System.Windows.Forms.DialogResult]::OK -and $dlg.SelectedPath) {
    Write-Output $dlg.SelectedPath
}
"""

_FILE_PICKER_PS = r"""
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title = 'Chon tep sao luu Research Studio (.db)'
$dlg.Filter = 'Research Studio Backup (*.db)|*.db'
$dlg.Multiselect = $false
$init = $env:RS_PICKER_INITIAL_DIR
if ($init -and (Test-Path -LiteralPath $init -PathType Container)) {
    $dlg.InitialDirectory = $init
}
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$res = $dlg.ShowDialog($owner)
$owner.Dispose()
if ($res -eq [System.Windows.Forms.DialogResult]::OK -and $dlg.FileName) {
    Write-Output $dlg.FileName
}
"""


def _normalize_utc(now_utc: datetime | None = None) -> datetime:
    if now_utc is None:
        return datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        return now_utc.replace(tzinfo=timezone.utc)
    return now_utc.astimezone(timezone.utc)


def _is_env_overridden() -> bool:
    return bool(os.environ.get(DATA_DIR_ENV_VAR, "").strip())


def _has_reserved_win_segment(parts: tuple[str, ...]) -> bool:
    for part in parts:
        base = part.split(".")[0].rstrip(". ").upper()
        if base in _RESERVED_WIN_NAMES:
            return True
    return False


def _validate_path_basics(raw_path: str) -> Path:
    cleaned = (raw_path or "").strip().strip('"')
    if not cleaned or any(ord(ch) < 32 for ch in cleaned):
        raise AppError(
            code="STORAGE_PATH_INVALID",
            message="Đường dẫn thư mục hoặc tệp không hợp lệ.",
            status_code=400,
        )
    if cleaned.startswith("\\\\") or cleaned.startswith("//"):
        raise AppError(
            code="STORAGE_PATH_FORBIDDEN",
            message="Không hỗ trợ đường dẫn mạng (UNC). Vui lòng chọn ổ đĩa cục bộ hoặc thư mục đồng bộ ngay trên máy.",
            status_code=400,
        )

    candidate = Path(cleaned).expanduser()
    if _has_reserved_win_segment(candidate.parts):
        raise AppError(
            code="STORAGE_PATH_FORBIDDEN",
            message="Đường dẫn chứa tên thiết bị hệ thống Windows không hợp lệ.",
            status_code=400,
        )
    if not candidate.is_absolute():
        raise AppError(
            code="STORAGE_PATH_INVALID",
            message="Vui lòng nhập đường dẫn tuyệt đối (ví dụ F:\\ResearchStudioData).",
            status_code=400,
        )

    try:
        resolved = candidate.resolve()
    except OSError as exc:
        raise AppError(
            code="STORAGE_PATH_INVALID",
            message="Không thể phân giải đường dẫn đã chọn.",
            status_code=400,
        ) from exc

    if str(resolved).startswith("\\\\") or _has_reserved_win_segment(resolved.parts):
        raise AppError(
            code="STORAGE_PATH_FORBIDDEN",
            message="Đường dẫn đích không an toàn hoặc không phải ổ đĩa cục bộ.",
            status_code=400,
        )

    repo = REPO_ROOT.resolve()
    if resolved == repo or repo in resolved.parents:
        raise AppError(
            code="STORAGE_PATH_FORBIDDEN",
            message="Không được lưu dữ liệu hoặc bản sao lưu bên trong thư mục mã nguồn ứng dụng.",
            status_code=400,
        )
    return resolved


def validate_local_dir_path(raw_path: str, *, role: Literal["data_root", "external_backup"]) -> Path:
    """Validate that a user-provided folder path is local, non-system, non-root, and outside the repo."""
    resolved = _validate_path_basics(raw_path)

    if resolved == Path(resolved.anchor):
        raise AppError(
            code="STORAGE_PATH_FORBIDDEN",
            message="Vui lòng chọn một thư mục con thay vì trực tiếp thư mục gốc ổ đĩa (như C:\\ hay F:\\).",
            status_code=400,
        )

    sys_root = Path(os.environ.get("SystemRoot", r"C:\Windows")).resolve()
    if resolved.anchor.lower() == sys_root.anchor.lower():
        sub_parts = [part.lower() for part in resolved.parts[1:]]
        if sub_parts and sub_parts[0] in _FORBIDDEN_WIN_SYSTEM_ROOT_DIRS:
            raise AppError(
                code="STORAGE_PATH_FORBIDDEN",
                message="Không được phép lưu dữ liệu trong thư mục hệ thống Windows hoặc Program Files.",
                status_code=400,
            )
        if sub_parts == ["users"]:
            raise AppError(
                code="STORAGE_PATH_FORBIDDEN",
                message="Vui lòng chọn thư mục con bên trong tài khoản của bạn thay vì thư mục gốc Users.",
                status_code=400,
            )

    if resolved.exists() and not resolved.is_dir():
        raise AppError(
            code="STORAGE_PATH_INVALID",
            message="Đường dẫn đã chọn là một tệp, không phải thư mục.",
            status_code=400,
        )

    if role not in ("data_root", "external_backup"):
        raise ValueError(f"Unsupported storage role: {role}")
    return resolved


def validate_backup_file_path(raw_path: str) -> Path:
    """Validate an external or local `.db` backup file before staging or inspection."""
    resolved = _validate_path_basics(raw_path)
    if resolved.suffix.lower() != ".db":
        raise AppError(
            code="INVALID_BACKUP_FILE",
            message="Tệp sao lưu phải có phần mở rộng .db.",
            status_code=400,
        )
    if not resolved.is_file():
        raise AppError(
            code="INVALID_BACKUP_FILE",
            message="Không tìm thấy tệp sao lưu đã chọn.",
            status_code=404,
        )

    size = resolved.stat().st_size
    if size < _MIN_BACKUP_SIZE_BYTES or size > _MAX_BACKUP_SIZE_BYTES:
        raise AppError(
            code="INVALID_BACKUP_FILE",
            message="Tệp sao lưu có kích thước không hợp lệ hoặc đã bị cắt xén.",
            status_code=400,
        )

    with resolved.open("rb") as fh:
        header = fh.read(len(_SQLITE_HEADER))
    if header != _SQLITE_HEADER:
        raise AppError(
            code="INVALID_BACKUP_FILE",
            message="Tệp đã chọn không phải tệp cơ sở dữ liệu Research Studio hợp lệ.",
            status_code=400,
        )
    return resolved


def _verify_dir_writable(directory: Path) -> None:
    try:
        directory.mkdir(parents=True, exist_ok=True)
        probe = directory / f".rs_write_probe_{os.getpid()}.tmp"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
    except OSError as exc:
        raise AppError(
            code="STORAGE_DIR_NOT_WRITABLE",
            message=f"Không thể ghi vào thư mục '{directory}'. Hãy kiểm tra quyền truy cập hoặc ổ đĩa.",
            status_code=400,
        ) from exc


def _inspect_candidate_db(db_path: Path) -> tuple[int, int]:
    """Validate SQLite integrity & Research Studio tables on a candidate DB, returning (projects, ideas)."""
    try:
        with db_path.open("rb") as fh:
            if fh.read(len(_SQLITE_HEADER)) != _SQLITE_HEADER:
                raise AppError(
                    code="INVALID_BACKUP_FILE",
                    message="Tệp cơ sở dữ liệu không đúng định dạng hoặc đã bị hỏng.",
                    status_code=400,
                )
        conn = sqlite3.connect(str(db_path), timeout=5.0, isolation_level=None)
        conn.row_factory = sqlite3.Row
        try:
            chk = conn.execute("PRAGMA integrity_check;").fetchone()
            if chk is None or str(chk[0]).lower() != "ok":
                raise AppError(
                    code="INVALID_BACKUP_FILE",
                    message="Kiểm tra toàn vẹn tệp cơ sở dữ liệu thất bại.",
                    status_code=400,
                )
            tables = {
                str(row[0])
                for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
            }
            if not _REQUIRED_SCHEMA_TABLES.issubset(tables):
                raise AppError(
                    code="INVALID_BACKUP_FILE",
                    message="Tệp cơ sở dữ liệu không chứa cấu trúc dữ liệu hợp lệ của Research Studio.",
                    status_code=400,
                )
            p_cnt = int(conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0])
            i_cnt = int(conn.execute("SELECT COUNT(*) FROM ideas").fetchone()[0])
            return p_cnt, i_cnt
        finally:
            conn.close()
    except AppError:
        raise
    except (OSError, sqlite3.Error) as exc:
        raise AppError(
            code="INVALID_BACKUP_FILE",
            message="Không thể đọc tệp cơ sở dữ liệu đã chọn (có thể đang bị khóa hoặc hỏng).",
            status_code=400,
        ) from exc


def _read_valid_dpapi_credentials(db_path: Path) -> tuple[bytes, int, str | None] | None:
    """Extract current machine's readable DPAPI API Key + legal consent before destructive DB swaps."""
    if not db_path.is_file():
        return None
    try:
        conn = sqlite3.connect(str(db_path), timeout=5.0, isolation_level=None)
        conn.row_factory = sqlite3.Row
        try:
            row = conn.execute(
                "SELECT encrypted_youtube_api_key, legal_consent_accepted, legal_consent_accepted_at FROM system_settings WHERE id = 1"
            ).fetchone()
            if row is None or not row["encrypted_youtube_api_key"]:
                return None
            blob = bytes(row["encrypted_youtube_api_key"])
            decrypted = dpapi_unprotect(blob).decode("utf-8").strip()
            if not decrypted:
                return None
            return (
                blob,
                int(row["legal_consent_accepted"]),
                str(row["legal_consent_accepted_at"]) if row["legal_consent_accepted_at"] else None,
            )
        finally:
            conn.close()
    except Exception:
        return None


def _preserve_dpapi_credentials_if_needed(
    target_db_path: Path,
    live_creds: tuple[bytes, int, str | None] | None,
) -> None:
    """Restore this PC's working DPAPI key & legal consent if the target DB lacks a readable key."""
    if live_creds is None or not target_db_path.is_file():
        return
    blob, legal_accepted, legal_at = live_creds
    now_iso = _normalize_utc().isoformat()
    conn = open_connection(target_db_path)
    try:
        conn.execute("BEGIN IMMEDIATE;")
        row = conn.execute(
            "SELECT encrypted_youtube_api_key, legal_consent_accepted FROM system_settings WHERE id = 1"
        ).fetchone()
        need_replace = row is None or not row["encrypted_youtube_api_key"]
        if not need_replace and row is not None:
            try:
                raw = dpapi_unprotect(bytes(row["encrypted_youtube_api_key"])).decode("utf-8").strip()
                need_replace = not raw
            except Exception:
                need_replace = True
        if need_replace:
            if row is None:
                conn.execute(
                    """
                    INSERT INTO system_settings (
                        id, encrypted_youtube_api_key, legal_consent_accepted, legal_consent_accepted_at, updated_at
                    ) VALUES (1, ?, ?, ?, ?)
                    """,
                    (sqlite3.Binary(blob), legal_accepted, legal_at, now_iso),
                )
            else:
                conn.execute(
                    """
                    UPDATE system_settings
                    SET encrypted_youtube_api_key = ?,
                        legal_consent_accepted = CASE WHEN legal_consent_accepted = 1 THEN 1 ELSE ? END,
                        legal_consent_accepted_at = COALESCE(legal_consent_accepted_at, ?),
                        updated_at = ?
                    WHERE id = 1
                    """,
                    (sqlite3.Binary(blob), legal_accepted, legal_at, now_iso),
                )
        conn.execute("COMMIT;")
    except BaseException:
        if conn.in_transaction:
            conn.execute("ROLLBACK;")
        raise
    finally:
        conn.close()


def _parse_backup_kind(filename: str) -> Literal["manual", "auto", "pre_restore"]:
    if "_pre_restore_" in filename:
        return "pre_restore"
    if "_auto_" in filename:
        return "auto"
    return "manual"


def _prune_backup_files(directory: Path) -> None:
    if not directory.is_dir():
        return
    user_regular: list[Path] = []
    pre_restore: list[Path] = []
    for item in directory.glob("rs_backup_*.db"):
        if not item.is_file():
            continue
        kind = _parse_backup_kind(item.name)
        if kind == "pre_restore":
            pre_restore.append(item)
        else:
            user_regular.append(item)

    user_regular.sort(key=lambda p: (p.stat().st_mtime, p.name), reverse=True)
    for stale in user_regular[USER_BACKUP_KEEP_COUNT:]:
        stale.unlink(missing_ok=True)

    pre_restore.sort(key=lambda p: (p.stat().st_mtime, p.name), reverse=True)
    for stale in pre_restore[PRE_RESTORE_BACKUP_KEEP_COUNT:]:
        stale.unlink(missing_ok=True)


def _collect_recent_backups(local_dir: Path, external_dir: Path | None) -> list[dict[str, Any]]:
    by_name: dict[str, dict[str, Any]] = {}

    def _scan(folder: Path, source_loc: Literal["local", "external"]) -> None:
        if not folder.is_dir():
            return
        for item in folder.glob("rs_backup_*.db"):
            if not item.is_file():
                continue
            try:
                st = item.stat()
            except OSError:
                continue
            created_iso = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()
            existing = by_name.get(item.name)
            if existing is not None:
                existing["location"] = "both"
                continue
            by_name[item.name] = {
                "filename": item.name,
                "fullPath": str(item.resolve()),
                "sizeBytes": int(st.st_size),
                "createdAtUtc": created_iso,
                "location": source_loc,
                "kind": _parse_backup_kind(item.name),
            }

    _scan(local_dir, "local")
    if external_dir is not None:
        _scan(external_dir, "external")

    items = list(by_name.values())
    items.sort(key=lambda entry: (entry["createdAtUtc"], entry["filename"]), reverse=True)
    return items[:10]


def get_storage_status() -> dict[str, Any]:
    """Return current storage paths, DB size, external backup status, and recent backup list."""
    with _storage_lock:
        dirs = ensure_runtime_dirs()
        default_dir = get_default_bootstrap_dir()
        env_overridden = _is_env_overridden()
        cfg = {} if env_overridden else read_storage_bootstrap_config()

        db_path = dirs["db_path"]
        wal_path = db_path.with_name(f"{db_path.name}-wal")
        db_size_bytes = db_path.stat().st_size if db_path.is_file() else 0
        if wal_path.is_file():
            db_size_bytes += wal_path.stat().st_size

        ext_raw = cfg.get("externalBackupDir")
        ext_path: Path | None = None
        ext_accessible = False
        if isinstance(ext_raw, str) and ext_raw:
            try:
                ext_path = Path(ext_raw).expanduser().resolve()
                ext_accessible = ext_path.is_dir() and not str(ext_path).startswith("\\\\")
            except OSError:
                ext_accessible = False

        recent = _collect_recent_backups(dirs["user_backups"], ext_path if ext_accessible else None)
        last_backup_at = cfg.get("lastBackupAtUtc")
        if not last_backup_at and recent:
            last_backup_at = str(recent[0]["createdAtUtc"])

        return {
            "activeDataDir": str(dirs["root"]),
            "defaultDataDir": str(default_dir),
            "isDefaultDataDir": dirs["root"] == default_dir,
            "isEnvOverridden": env_overridden,
            "dbFilePath": str(db_path),
            "dbSizeBytes": int(db_size_bytes),
            "userBackupsDir": str(dirs["user_backups"]),
            "externalBackupDir": str(ext_path) if ext_path is not None else ext_raw,
            "externalBackupAccessible": ext_accessible,
            "autoBackupEnabled": bool(cfg.get("autoBackupEnabled", True)),
            "lastBackupAtUtc": last_backup_at,
            "recentBackups": recent,
        }


def update_backup_config(
    *,
    auto_backup_enabled: bool | None = None,
    external_backup_dir: str | None = None,
) -> dict[str, Any]:
    """Update external backup location and daily auto-backup toggle in storage.json."""
    with _storage_lock:
        if _is_env_overridden():
            raise AppError(
                code="STORAGE_ENV_LOCKED",
                message="Thư mục dữ liệu đang được khóa qua biến môi trường.",
                status_code=400,
            )

        dirs = ensure_runtime_dirs()
        cfg = read_storage_bootstrap_config()

        if external_backup_dir is not None:
            cleaned = external_backup_dir.strip()
            if not cleaned:
                cfg["externalBackupDir"] = None
            else:
                validated = validate_local_dir_path(cleaned, role="external_backup")
                if validated in (dirs["root"], dirs["data"], dirs["backups"]):
                    raise AppError(
                        code="STORAGE_PATH_FORBIDDEN",
                        message="Thư mục sao lưu dự phòng phải tách biệt khỏi thư mục chứa tệp dữ liệu chính.",
                        status_code=400,
                    )
                _verify_dir_writable(validated)
                cfg["externalBackupDir"] = str(validated)

        if auto_backup_enabled is not None:
            cfg["autoBackupEnabled"] = bool(auto_backup_enabled)

        write_storage_bootstrap_config(cfg)
        return get_storage_status()


def create_user_backup(
    *,
    trigger: Literal["manual", "auto", "pre_restore"] = "manual",
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Create a standalone sanitized SQLite backup (0 API key, 0 transient YT API cache)."""
    with _storage_lock:
        utc_now = _normalize_utc(now_utc)
        now_iso = utc_now.isoformat()
        dirs = ensure_runtime_dirs()
        db_path = dirs["db_path"]
        if not db_path.is_file():
            run_migrations(db_path=db_path, backups_dir=dirs["backups"])

        stamp = utc_now.strftime("%Y%m%d_%H%M%S_%f")
        filename = f"rs_backup_{trigger}_{stamp}.db"
        stage_path = dirs["config"] / f"_backup_stage_{os.getpid()}_{stamp}.db"
        local_dest = dirs["user_backups"] / filename

        try:
            src_conn = open_connection(db_path)
            stage_conn = sqlite3.connect(str(stage_path), isolation_level=None)
            try:
                src_conn.backup(stage_conn)
            finally:
                src_conn.close()
                stage_conn.close()

            stage_conn = sqlite3.connect(str(stage_path), isolation_level=None)
            try:
                stage_conn.execute("PRAGMA foreign_keys = ON;")
                stage_conn.execute("BEGIN IMMEDIATE;")
                stage_conn.execute("UPDATE system_settings SET encrypted_youtube_api_key = NULL;")
                retention_service._tombstone_expired_youtube_data_in_tx(
                    stage_conn,
                    now_iso=now_iso,
                    purge_all=True,
                )
                stage_conn.execute("COMMIT;")
                stage_conn.execute("PRAGMA journal_mode = DELETE;")
                stage_conn.execute("VACUUM;")
                chk = stage_conn.execute("PRAGMA integrity_check;").fetchone()
                if chk is None or str(chk[0]).lower() != "ok":
                    raise AppError(
                        code="BACKUP_CREATION_FAILED",
                        message="Kiểm tra toàn vẹn bản sao lưu thất bại.",
                        status_code=500,
                    )
            finally:
                stage_conn.close()

            for sidecar_suffix in ("-wal", "-shm"):
                sidecar = Path(f"{stage_path}{sidecar_suffix}")
                sidecar.unlink(missing_ok=True)

            os.replace(stage_path, local_dest)
            _prune_backup_files(dirs["user_backups"])
        finally:
            if stage_path.exists():
                stage_path.unlink(missing_ok=True)

        external_path_str: str | None = None
        external_warning: str | None = None
        env_overridden = _is_env_overridden()
        cfg = {} if env_overridden else read_storage_bootstrap_config()

        if trigger != "pre_restore":
            ext_raw = cfg.get("externalBackupDir")
            if isinstance(ext_raw, str) and ext_raw:
                try:
                    ext_dir = validate_local_dir_path(ext_raw, role="external_backup")
                    ext_dir.mkdir(parents=True, exist_ok=True)
                    tmp_ext = ext_dir / f".{filename}.{os.getpid()}.tmp"
                    ext_dest = ext_dir / filename
                    shutil.copyfile(local_dest, tmp_ext)
                    os.replace(tmp_ext, ext_dest)
                    _prune_backup_files(ext_dir)
                    external_path_str = str(ext_dest)
                except (AppError, OSError) as exc:
                    external_warning = f"Đã lưu bản sao lưu trong máy nhưng chưa chép được sang thư mục ngoài: {exc}"

            if not env_overridden:
                cfg["lastBackupAtUtc"] = now_iso
                cfg["lastBackupFilename"] = filename
                write_storage_bootstrap_config(cfg)

        size_bytes = int(local_dest.stat().st_size)
        return {
            "backupFilename": filename,
            "localPath": str(local_dest),
            "externalPath": external_path_str,
            "sizeBytes": size_bytes,
            "createdAtUtc": now_iso,
            "externalWarning": external_warning,
            "status": get_storage_status(),
        }


def run_auto_backup_if_due(*, now_utc: datetime | None = None) -> dict[str, Any]:
    """Create at most one automatic sanitized backup per day when user workspace data exists."""
    with _storage_lock:
        utc_now = _normalize_utc(now_utc)
        env_overridden = _is_env_overridden()
        cfg = {} if env_overridden else read_storage_bootstrap_config()
        if not bool(cfg.get("autoBackupEnabled", True)):
            return {"executed": False, "reason": "disabled"}

        dirs = ensure_runtime_dirs()
        db_path = dirs["db_path"]
        if not db_path.is_file():
            return {"executed": False, "reason": "no_database"}

        conn = open_connection(db_path)
        try:
            row = conn.execute(
                """
                SELECT (
                    (SELECT COUNT(*) FROM projects)
                    + (SELECT COUNT(*) FROM ideas)
                    + (SELECT COUNT(*) FROM project_keywords)
                    + (SELECT COUNT(*) FROM project_channels)
                    + (SELECT COUNT(*) FROM rss_feeds)
                ) AS total_user_records
                """
            ).fetchone()
            total_records = int(row["total_user_records"]) if row is not None else 0
        finally:
            conn.close()

        if total_records <= 0:
            return {"executed": False, "reason": "empty_workspace"}

        regular_backups = [
            item
            for item in dirs["user_backups"].glob("rs_backup_*.db")
            if item.is_file() and _parse_backup_kind(item.name) in ("manual", "auto")
        ]
        if regular_backups:
            newest_mtime = max(p.stat().st_mtime for p in regular_backups)
            newest_dt = datetime.fromtimestamp(newest_mtime, tz=timezone.utc)
            if utc_now - newest_dt < timedelta(hours=_AUTO_BACKUP_MIN_AGE_HOURS):
                return {"executed": False, "reason": "recent_backup_exists"}

        created = create_user_backup(trigger="auto", now_utc=utc_now)
        return {
            "executed": True,
            "backupFilename": created["backupFilename"],
            "externalWarning": created["externalWarning"],
        }


def migrate_active_data_dir(
    target_dir_raw: str | None = None,
    *,
    if_exists: Literal["error", "use_existing", "copy_overwrite"] = "error",
    reset_to_default: bool = False,
) -> dict[str, Any]:
    """Safely switch active data folder after verification, keeping the previous folder intact."""
    with _storage_lock:
        if _is_env_overridden():
            raise AppError(
                code="STORAGE_ENV_LOCKED",
                message="Thư mục dữ liệu đang được cố định qua biến môi trường.",
                status_code=400,
            )

        current_dirs = ensure_runtime_dirs()
        current_root = current_dirs["root"]
        current_db = current_dirs["db_path"]

        target_root = (
            get_default_bootstrap_dir()
            if reset_to_default
            else validate_local_dir_path(target_dir_raw or "", role="data_root")
        )

        cfg = read_storage_bootstrap_config()
        ext_raw = cfg.get("externalBackupDir")
        if isinstance(ext_raw, str) and ext_raw:
            try:
                ext_resolved = Path(ext_raw).expanduser().resolve()
                if target_root == ext_resolved:
                    raise AppError(
                        code="STORAGE_PATH_FORBIDDEN",
                        message="Thư mục dữ liệu chính không được trùng với thư mục sao lưu dự phòng.",
                        status_code=400,
                    )
            except OSError:
                pass

        if target_root == current_root:
            cfg["activeDataDir"] = None if reset_to_default else str(target_root)
            write_storage_bootstrap_config(cfg)
            return {
                "previousDataDir": str(current_root),
                "activeDataDir": str(target_root),
                "modeUsed": "unchanged",
                "status": get_storage_status(),
            }

        target_dirs = ensure_runtime_dirs(target_root)
        _verify_dir_writable(target_dirs["data"])
        _verify_dir_writable(target_dirs["user_backups"])
        target_db = target_dirs["db_path"]

        if target_db.is_file() and if_exists == "error":
            try:
                p_cnt, i_cnt = _inspect_candidate_db(target_db)
            except AppError:
                p_cnt, i_cnt = 0, 0
            raise AppError(
                code="TARGET_DB_ALREADY_EXISTS",
                message="Thư mục đích đã có sẵn cơ sở dữ liệu Research Studio.",
                status_code=409,
                details={
                    "targetDir": str(target_root),
                    "projectsCount": p_cnt,
                    "ideasCount": i_cnt,
                },
            )

        live_creds = _read_valid_dpapi_credentials(current_db)
        close_logging_handlers()
        migrated_ok = False
        try:
            if target_db.is_file() and if_exists == "use_existing":
                _inspect_candidate_db(target_db)
                run_migrations(db_path=target_db, backups_dir=target_dirs["backups"])
                _preserve_dpapi_credentials_if_needed(target_db, live_creds)
                mode_used = "use_existing"
            else:
                if target_db.is_file() and if_exists == "copy_overwrite":
                    stamp = _normalize_utc().strftime("%Y%m%d_%H%M%S_%f")
                    overwritten_backup = target_dirs["user_backups"] / f"rs_backup_pre_restore_{stamp}.db"
                    src_existing = sqlite3.connect(str(target_db), timeout=5.0, isolation_level=None)
                    dest_existing = sqlite3.connect(str(overwritten_backup), isolation_level=None)
                    try:
                        src_existing.backup(dest_existing)
                    finally:
                        dest_existing.close()
                        src_existing.close()

                stage_db = target_dirs["data"] / f"_migrate_stage_{os.getpid()}.db"
                try:
                    if not current_db.is_file():
                        run_migrations(db_path=current_db, backups_dir=current_dirs["backups"])
                    src_conn = open_connection(current_db)
                    try:
                        src_conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
                        dest_conn = sqlite3.connect(str(stage_db), isolation_level=None)
                        try:
                            src_conn.backup(dest_conn)
                        finally:
                            dest_conn.close()
                    finally:
                        src_conn.close()

                    _inspect_candidate_db(stage_db)
                    for suffix in ("-wal", "-shm"):
                        Path(f"{target_db}{suffix}").unlink(missing_ok=True)
                    os.replace(stage_db, target_db)
                    run_migrations(db_path=target_db, backups_dir=target_dirs["backups"])
                finally:
                    if stage_db.exists():
                        stage_db.unlink(missing_ok=True)

                for old_backup in current_dirs["user_backups"].glob("rs_backup_*.db"):
                    if old_backup.is_file():
                        dest_backup = target_dirs["user_backups"] / old_backup.name
                        if not dest_backup.exists():
                            shutil.copy2(old_backup, dest_backup)
                _prune_backup_files(target_dirs["user_backups"])
                mode_used = "copy_overwrite" if if_exists == "copy_overwrite" else "copied"

            cfg["activeDataDir"] = None if reset_to_default else str(target_root)
            write_storage_bootstrap_config(cfg)
            migrated_ok = True
        finally:
            configure_logging(target_root if migrated_ok else current_root)

        return {
            "previousDataDir": str(current_root),
            "activeDataDir": str(target_root),
            "modeUsed": mode_used,
            "status": get_storage_status(),
        }


def restore_user_backup(backup_file_raw: str) -> dict[str, Any]:
    """Validate, stage, preserve local API Key, safety-backup current DB, and restore cleanly."""
    with _storage_lock:
        backup_path = validate_backup_file_path(backup_file_raw)
        dirs = ensure_runtime_dirs()
        live_db = dirs["db_path"]

        stamp = _normalize_utc().strftime("%Y%m%d_%H%M%S_%f")
        stage_path = dirs["config"] / f"_restore_stage_{os.getpid()}_{stamp}.db"
        try:
            shutil.copyfile(backup_path, stage_path)
            _inspect_candidate_db(stage_path)
            run_migrations(db_path=stage_path, backups_dir=dirs["backups"])

            live_creds = _read_valid_dpapi_credentials(live_db)
            _preserve_dpapi_credentials_if_needed(stage_path, live_creds)

            pre_restore = create_user_backup(trigger="pre_restore")

            stage_conn = sqlite3.connect(str(stage_path), timeout=5.0, isolation_level=None)
            live_conn = open_connection(live_db)
            try:
                stage_conn.backup(live_conn)
                live_conn.execute("PRAGMA journal_mode = WAL;")
                live_conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
            finally:
                live_conn.close()
                stage_conn.close()
        finally:
            if stage_path.exists():
                stage_path.unlink(missing_ok=True)
            for suffix in ("-wal", "-shm"):
                Path(f"{stage_path}{suffix}").unlink(missing_ok=True)

        return {
            "restoredFrom": backup_path.name,
            "preRestoreBackupFilename": pre_restore["backupFilename"],
            "status": get_storage_status(),
        }


def open_configured_folder(target: Literal["data_root", "user_backups", "external_backup"]) -> dict[str, str]:
    """Open one of the active configured storage folders safely in Windows Explorer."""
    status = get_storage_status()
    if target == "data_root":
        raw_folder = status["activeDataDir"]
    elif target == "user_backups":
        raw_folder = status["userBackupsDir"]
    elif target == "external_backup":
        raw_folder = status["externalBackupDir"]
    else:
        raise AppError("INVALID_FOLDER_TARGET", "Mục tiêu thư mục không hợp lệ.", status_code=400)

    if not raw_folder:
        raise AppError("STORAGE_FOLDER_NOT_SET", "Chưa thiết lập thư mục sao lưu ngoài.", status_code=400)

    folder = Path(str(raw_folder)).resolve()
    if not folder.is_dir():
        raise AppError("STORAGE_FOLDER_MISSING", "Thư mục đích không tồn tại hoặc chưa kết nối.", status_code=404)

    if os.name == "nt":
        subprocess.Popen(["explorer.exe", str(folder)])
    return {"openedPath": str(folder)}


def pick_folder_dialog(initial_dir: str | None = None) -> dict[str, str | None]:
    """Open native Windows folder picker dialog and return selected local path if confirmed."""
    if os.name != "nt":
        return {"selectedPath": None}
    env = os.environ.copy()
    if initial_dir and initial_dir.strip():
        env["RS_PICKER_INITIAL_DIR"] = initial_dir.strip()
    else:
        env["RS_PICKER_INITIAL_DIR"] = str(ensure_runtime_dirs()["root"])
    proc = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Sta", "-Command", _FOLDER_PICKER_PS],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        timeout=120,
    )
    selected = proc.stdout.strip() if proc.returncode == 0 else ""
    return {"selectedPath": selected or None}


def pick_backup_file_dialog(initial_dir: str | None = None) -> dict[str, str | None]:
    """Open native Windows file picker filtered to `.db` backup files."""
    if os.name != "nt":
        return {"selectedPath": None}
    env = os.environ.copy()
    status = get_storage_status()
    if initial_dir and initial_dir.strip():
        env["RS_PICKER_INITIAL_DIR"] = initial_dir.strip()
    elif status["externalBackupDir"] and status["externalBackupAccessible"]:
        env["RS_PICKER_INITIAL_DIR"] = str(status["externalBackupDir"])
    else:
        env["RS_PICKER_INITIAL_DIR"] = str(status["userBackupsDir"])
    proc = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Sta", "-Command", _FILE_PICKER_PS],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        timeout=120,
    )
    selected = proc.stdout.strip() if proc.returncode == 0 else ""
    return {"selectedPath": selected or None}
