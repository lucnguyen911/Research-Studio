from __future__ import annotations

import sqlite3
from typing import Any

from app.core.config import QUOTA_GENERAL_DAILY_LIMIT, QUOTA_SEARCH_DAILY_LIMIT


def ensure_ledger_row(conn: sqlite3.Connection, pt_date: str, updated_at_utc: str) -> sqlite3.Row:
    """Create today's PT quota ledger row if missing and return it inside caller transaction."""
    row = conn.execute(
        "SELECT * FROM quota_daily_ledger WHERE pt_date = ?",
        (pt_date,),
    ).fetchone()
    if row is not None:
        return row
    conn.execute(
        """
        INSERT INTO quota_daily_ledger (
            pt_date, search_queries_used, general_data_used,
            search_exhausted_until_utc, general_exhausted_until_utc, updated_at
        ) VALUES (?, 0, 0, NULL, NULL, ?)
        """,
        (pt_date, updated_at_utc),
    )
    created = conn.execute(
        "SELECT * FROM quota_daily_ledger WHERE pt_date = ?",
        (pt_date,),
    ).fetchone()
    assert created is not None
    return created


def read_ledger_row(conn: sqlite3.Connection, pt_date: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM quota_daily_ledger WHERE pt_date = ?",
        (pt_date,),
    ).fetchone()


def read_quota_settings(conn: sqlite3.Connection) -> tuple[float, int]:
    """Return (warning_ratio, auto_refresh_daily_quota_cap) from system_settings with safe defaults."""
    row = conn.execute(
        "SELECT quota_warning_ratio, auto_refresh_daily_quota_cap FROM system_settings WHERE id = 1"
    ).fetchone()
    if row is None:
        return 0.80, 3000
    ratio = float(row["quota_warning_ratio"])
    daily_cap = int(row["auto_refresh_daily_quota_cap"])
    return ratio, min(QUOTA_GENERAL_DAILY_LIMIT, max(10, daily_cap))


def update_ledger_usage(
    conn: sqlite3.Connection,
    pt_date: str,
    *,
    search_used: int,
    general_used: int,
    updated_at_utc: str,
) -> None:
    conn.execute(
        """
        UPDATE quota_daily_ledger
        SET search_queries_used = ?,
            general_data_used = ?,
            updated_at = ?
        WHERE pt_date = ?
        """,
        (search_used, general_used, updated_at_utc, pt_date),
    )


def insert_quota_call_log(
    conn: sqlite3.Connection,
    *,
    pt_date: str,
    bucket: str,
    endpoint: str,
    units_cost: int,
    outcome: str,
    created_at_utc: str,
) -> int:
    cursor = conn.execute(
        """
        INSERT INTO quota_call_log (
            pt_date, bucket, endpoint, units_cost, status_code, outcome, created_at_utc
        ) VALUES (?, ?, ?, ?, NULL, ?, ?)
        """,
        (pt_date, bucket, endpoint, units_cost, outcome, created_at_utc),
    )
    assert cursor.lastrowid is not None
    return int(cursor.lastrowid)


def get_call_log_row(conn: sqlite3.Connection, call_log_id: int) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM quota_call_log WHERE id = ?",
        (call_log_id,),
    ).fetchone()


def update_call_log_outcome(
    conn: sqlite3.Connection,
    call_log_id: int,
    *,
    status_code: int | None,
    outcome: str,
) -> None:
    conn.execute(
        """
        UPDATE quota_call_log
        SET status_code = ?, outcome = ?
        WHERE id = ?
        """,
        (status_code, outcome, call_log_id),
    )


def set_bucket_exhausted_until(
    conn: sqlite3.Connection,
    pt_date: str,
    bucket: str,
    exhausted_until_utc: str,
    updated_at_utc: str,
) -> None:
    if bucket == "search_queries":
        conn.execute(
            """
            UPDATE quota_daily_ledger
            SET search_exhausted_until_utc = ?,
                search_queries_used = MAX(search_queries_used, ?),
                updated_at = ?
            WHERE pt_date = ?
            """,
            (exhausted_until_utc, QUOTA_SEARCH_DAILY_LIMIT, updated_at_utc, pt_date),
        )
    else:
        conn.execute(
            """
            UPDATE quota_daily_ledger
            SET general_exhausted_until_utc = ?,
                general_data_used = MAX(general_data_used, ?),
                updated_at = ?
            WHERE pt_date = ?
            """,
            (exhausted_until_utc, QUOTA_GENERAL_DAILY_LIMIT, updated_at_utc, pt_date),
        )


def ledger_to_dict(row: sqlite3.Row | None, pt_date: str) -> dict[str, Any]:
    if row is None:
        return {
            "pt_date": pt_date,
            "search_queries_used": 0,
            "general_data_used": 0,
            "search_exhausted_until_utc": None,
            "general_exhausted_until_utc": None,
        }
    return {
        "pt_date": row["pt_date"],
        "search_queries_used": int(row["search_queries_used"]),
        "general_data_used": int(row["general_data_used"]),
        "search_exhausted_until_utc": row["search_exhausted_until_utc"],
        "general_exhausted_until_utc": row["general_exhausted_until_utc"],
    }
