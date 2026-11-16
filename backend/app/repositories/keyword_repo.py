from __future__ import annotations

from datetime import datetime, timezone
import sqlite3
from typing import Any
import uuid

from app.core.errors import AppError
from app.db.connection import read_db, write_db


def _normalize_now_iso(now_utc: datetime | None) -> str:
    if now_utc is None:
        return datetime.now(timezone.utc).isoformat()
    if now_utc.tzinfo is None:
        return now_utc.replace(tzinfo=timezone.utc).isoformat()
    return now_utc.astimezone(timezone.utc).isoformat()


def _row_to_keyword(row: sqlite3.Row, *, now_iso: str) -> dict[str, Any]:
    expires = row["session_expires_at"] if "session_expires_at" in row.keys() else None
    has_valid_session = bool(row["last_session_id"] and expires and expires > now_iso)
    result_count = int(row["session_result_count"]) if has_valid_session and row["session_result_count"] is not None else 0
    return {
        "id": row["id"],
        "projectId": row["project_id"],
        "keyword": row["keyword"],
        "priority": row["priority"],
        "notes": row["notes"],
        "lastScannedAt": row["last_scanned_at"] if has_valid_session else None,
        "lastSessionId": row["last_session_id"] if has_valid_session else None,
        "sessionExpiresAt": expires if has_valid_session else None,
        "cachedResultCount": result_count,
        "createdAt": row["created_at"],
    }


def list_project_keywords(project_id: str, *, now_utc: datetime | None = None) -> list[dict[str, Any]]:
    now_iso = _normalize_now_iso(now_utc)
    with read_db() as conn:
        rows = conn.execute(
            """
            SELECT
                pk.*,
                s.api_expires_at AS session_expires_at,
                s.result_count AS session_result_count
            FROM project_keywords pk
            LEFT JOIN search_sessions s ON s.id = pk.last_session_id
            WHERE pk.project_id = ?
            ORDER BY
                CASE pk.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                pk.created_at DESC
            """,
            (project_id,),
        ).fetchall()
    return [_row_to_keyword(r, now_iso=now_iso) for r in rows]


def get_project_keyword(project_id: str, keyword_id: str, *, now_utc: datetime | None = None) -> dict[str, Any]:
    now_iso = _normalize_now_iso(now_utc)
    with read_db() as conn:
        row = conn.execute(
            """
            SELECT
                pk.*,
                s.api_expires_at AS session_expires_at,
                s.result_count AS session_result_count
            FROM project_keywords pk
            LEFT JOIN search_sessions s ON s.id = pk.last_session_id
            WHERE pk.project_id = ? AND pk.id = ?
            """,
            (project_id, keyword_id),
        ).fetchone()
    if row is None:
        raise AppError("KEYWORD_NOT_FOUND", "Không tìm thấy từ khóa trong Project này.", status_code=404)
    return _row_to_keyword(row, now_iso=now_iso)


def create_project_keyword(
    project_id: str,
    *,
    keyword: str,
    priority: str = "medium",
    notes: str = "",
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    clean_kw = keyword.strip()
    if not clean_kw:
        raise AppError("KEYWORD_EMPTY", "Vui lòng nhập cụm từ khóa hợp lệ.", status_code=400)
    if priority not in ("high", "medium", "low"):
        raise AppError("INVALID_KEYWORD_PRIORITY", "Mức ưu tiên từ khóa không hợp lệ.", status_code=400)
    now_iso = _normalize_now_iso(now_utc)
    kw_id = f"kw-{uuid.uuid4().hex[:10]}"

    with write_db() as conn:
        proj = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if proj is None:
            raise AppError("PROJECT_NOT_FOUND", "Không tìm thấy Project yêu cầu.", status_code=404)
        existing = conn.execute(
            "SELECT id, priority, notes FROM project_keywords WHERE project_id = ? AND keyword = ? COLLATE NOCASE",
            (project_id, clean_kw),
        ).fetchone()
        if existing is not None:
            next_notes = notes.strip() if notes.strip() else existing["notes"]
            conn.execute(
                "UPDATE project_keywords SET priority = ?, notes = ? WHERE id = ?",
                (priority, next_notes, existing["id"]),
            )
            target_id = str(existing["id"])
        else:
            conn.execute(
                """
                INSERT INTO project_keywords (id, project_id, keyword, priority, notes, last_scanned_at, last_session_id, created_at)
                VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)
                """,
                (kw_id, project_id, clean_kw, priority, notes.strip(), now_iso),
            )
            target_id = kw_id
    return get_project_keyword(project_id, target_id, now_utc=now_utc)


def update_project_keyword(
    project_id: str,
    keyword_id: str,
    *,
    priority: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    with write_db() as conn:
        proj = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if proj is None:
            raise AppError("PROJECT_NOT_FOUND", "Không tìm thấy Project yêu cầu.", status_code=404)
        existing = conn.execute(
            "SELECT id, priority, notes FROM project_keywords WHERE project_id = ? AND id = ?",
            (project_id, keyword_id),
        ).fetchone()
        if existing is None:
            raise AppError("KEYWORD_NOT_FOUND", "Không tìm thấy từ khóa trong Project này.", status_code=404)
        next_priority = existing["priority"] if priority is None else priority
        if next_priority not in ("high", "medium", "low"):
            raise AppError("INVALID_KEYWORD_PRIORITY", "Mức ưu tiên từ khóa không hợp lệ.", status_code=400)
        next_notes = existing["notes"] if notes is None else notes.strip()
        conn.execute(
            "UPDATE project_keywords SET priority = ?, notes = ? WHERE id = ?",
            (next_priority, next_notes, keyword_id),
        )
    return get_project_keyword(project_id, keyword_id)


def delete_project_keyword(project_id: str, keyword_id: str) -> None:
    with write_db() as conn:
        cur = conn.execute(
            "DELETE FROM project_keywords WHERE project_id = ? AND id = ?",
            (project_id, keyword_id),
        )
        if cur.rowcount == 0:
            raise AppError("KEYWORD_NOT_FOUND", "Không tìm thấy từ khóa để xóa.", status_code=404)


def set_keyword_last_session(
    project_id: str,
    keyword_id: str,
    *,
    session_id: str,
    scanned_at_iso: str,
) -> None:
    with write_db() as conn:
        conn.execute(
            """
            UPDATE project_keywords
            SET last_session_id = ?, last_scanned_at = ?
            WHERE project_id = ? AND id = ?
            """,
            (session_id, scanned_at_iso, project_id, keyword_id),
        )
