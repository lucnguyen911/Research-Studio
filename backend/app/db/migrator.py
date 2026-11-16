from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import sqlite3

from app.core.config import ensure_runtime_dirs
from app.db.connection import open_connection, resolve_db_path

DEFAULT_MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def split_sql_statements(sql_text: str) -> list[str]:
    """Split a SQL migration script into standalone statements runnable inside BEGIN IMMEDIATE."""
    cleaned_lines = [line for line in sql_text.splitlines() if not line.lstrip().startswith("--")]
    cleaned_sql = "\n".join(cleaned_lines)
    return [stmt.strip() for stmt in cleaned_sql.split(";") if stmt.strip()]


def create_sqlite_backup(
    db_path: Path,
    backups_dir: Path,
    prefix: str = "pre_migration",
    keep_latest: int = 3,
) -> Path:
    """Create a consistent SQLite backup using Online Backup API and prune older backups."""
    backups_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    backup_path = backups_dir / f"{prefix}_{stamp}.db"

    src_conn = open_connection(db_path)
    dest_conn = sqlite3.connect(str(backup_path), isolation_level=None)
    try:
        src_conn.backup(dest_conn)
    finally:
        dest_conn.close()
        src_conn.close()

    existing = sorted(backups_dir.glob(f"{prefix}_*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    for stale in existing[keep_latest:]:
        stale.unlink(missing_ok=True)
    return backup_path


def run_migrations(
    db_path: Path | None = None,
    migrations_dir: Path | None = None,
    backups_dir: Path | None = None,
) -> list[str]:
    """Apply forward-only SQLite migrations atomically with mandatory pre-upgrade backups."""
    resolved_db = resolve_db_path(db_path)
    dirs = ensure_runtime_dirs()
    resolved_backups = backups_dir or dirs["backups"]
    mig_dir = migrations_dir or DEFAULT_MIGRATIONS_DIR

    conn = open_connection(resolved_db)
    applied_now: list[str] = []
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
            """
        )
        applied_versions = {
            row["version"] for row in conn.execute("SELECT version FROM schema_migrations").fetchall()
        }
        has_existing_tables = (
            conn.execute(
                "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name != 'schema_migrations'"
            ).fetchone()["cnt"]
            > 0
        )
    finally:
        conn.close()

    migration_files = sorted(mig_dir.glob("*.sql"), key=lambda p: p.name)
    pending_files = [f for f in migration_files if f.name not in applied_versions]
    if not pending_files:
        return applied_now

    if applied_versions or has_existing_tables:
        create_sqlite_backup(resolved_db, resolved_backups, prefix="pre_migration", keep_latest=3)

    for sql_file in pending_files:
        statements = split_sql_statements(sql_file.read_text(encoding="utf-8"))
        now_utc = datetime.now(timezone.utc).isoformat()
        conn = open_connection(resolved_db)
        try:
            conn.execute("BEGIN IMMEDIATE;")
            for stmt in statements:
                conn.execute(stmt)
            conn.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
                (sql_file.name, now_utc),
            )
            conn.execute("COMMIT;")
            applied_now.append(sql_file.name)
        except BaseException:
            if conn.in_transaction:
                conn.execute("ROLLBACK;")
            raise
        finally:
            conn.close()

    return applied_now
