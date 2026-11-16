from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
import sqlite3
from typing import TypeVar

import anyio

from app.core.config import SQLITE_BUSY_TIMEOUT_MS, ensure_runtime_dirs

T = TypeVar("T")


def resolve_db_path(db_path: Path | None = None) -> Path:
    """Resolve the active SQLite database path cleanly inside runtime dirs."""
    if db_path is not None:
        resolved = db_path.expanduser().resolve()
        resolved.parent.mkdir(parents=True, exist_ok=True)
        return resolved
    return ensure_runtime_dirs()["db_path"]


def open_connection(db_path: Path | None = None) -> sqlite3.Connection:
    """Open a short-lived SQLite connection configured for crash-safe local concurrency."""
    resolved = resolve_db_path(db_path)
    conn = sqlite3.connect(
        str(resolved),
        timeout=SQLITE_BUSY_TIMEOUT_MS / 1000.0,
        isolation_level=None,
        check_same_thread=False,
    )
    conn.row_factory = sqlite3.Row
    conn.execute(f"PRAGMA busy_timeout = {SQLITE_BUSY_TIMEOUT_MS};")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA secure_delete = ON;")
    return conn


@contextmanager
def read_db(db_path: Path | None = None) -> Iterator[sqlite3.Connection]:
    """Yield a short-lived SQLite read connection guaranteed to close on exit."""
    conn = open_connection(db_path)
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def write_db(db_path: Path | None = None) -> Iterator[sqlite3.Connection]:
    """Yield a SQLite write connection wrapped in an atomic BEGIN IMMEDIATE transaction."""
    conn = open_connection(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE;")
        yield conn
        if conn.in_transaction:
            conn.execute("COMMIT;")
    except BaseException:
        if conn.in_transaction:
            conn.execute("ROLLBACK;")
        raise
    finally:
        conn.close()


async def run_db_sync(fn: Callable[..., T], *args: object, **kwargs: object) -> T:
    """Run synchronous SQLite/file work on AnyIO's worker thread so async loops stay unblocked."""
    return await anyio.to_thread.run_sync(lambda: fn(*args, **kwargs))
