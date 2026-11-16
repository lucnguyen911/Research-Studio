from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sqlite3
from typing import Any
import unicodedata
import uuid

from app.core.config import ensure_runtime_dirs
from app.core.errors import AppError
from app.db.connection import read_db, write_db

_WINDOWS_RESERVED_NAMES = frozenset(
    {"CON", "PRN", "AUX", "NUL"}
    | {f"COM{i}" for i in range(1, 10)}
    | {f"LPT{i}" for i in range(1, 10)}
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_project_slug(name: str, fallback_id: str) -> str:
    """Normalize arbitrary Unicode project names into a safe ASCII filename stem on Windows."""
    normalized = unicodedata.normalize("NFKD", name).replace("đ", "d").replace("Đ", "D")
    ascii_only = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", ascii_only.lower()).strip("-_.")
    if not slug:
        slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", fallback_id.lower()).strip("-_.") or "project"
    slug = slug[:48]
    if slug.upper() in _WINDOWS_RESERVED_NAMES:
        slug = f"project-{slug}"
    return slug


def resolve_safe_child_path(base_dir: Path, filename: str) -> Path:
    """Resolve a filename safely inside base_dir, rejecting path traversal and device names."""
    if not filename or "/" in filename or "\\" in filename or "\x00" in filename:
        raise AppError("UNSAFE_FILENAME", "Tên tệp không hợp lệ.", status_code=400)
    stem = Path(filename).stem.upper()
    if stem in _WINDOWS_RESERVED_NAMES:
        raise AppError("UNSAFE_FILENAME", "Tên tệp trùng tên thiết bị hệ thống Windows.", status_code=400)
    resolved_base = base_dir.resolve()
    resolved_target = (resolved_base / filename).resolve()
    if not resolved_target.is_relative_to(resolved_base):
        raise AppError("PATH_TRAVERSAL_BLOCKED", "Đường dẫn tệp vượt ra ngoài thư mục cho phép.", status_code=400)
    return resolved_target


def _row_to_project(row: sqlite3.Row, linked_feed_ids: list[str]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "regionCode": row["region_code"],
        "relevanceLanguage": row["relevance_language"],
        "targetFormat": row["target_format"],
        "linkedFeedIds": linked_feed_ids,
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _get_linked_feed_ids(conn: sqlite3.Connection, project_id: str) -> list[str]:
    rows = conn.execute(
        "SELECT feed_id FROM project_rss_feeds WHERE project_id = ? ORDER BY linked_at ASC",
        (project_id,),
    ).fetchall()
    return [r["feed_id"] for r in rows]


def list_projects() -> list[dict[str, Any]]:
    """List all user projects ordered by updated timestamp descending."""
    with read_db() as conn:
        rows = conn.execute("SELECT * FROM projects ORDER BY updated_at DESC, created_at DESC").fetchall()
        feeds_by_project: dict[str, list[str]] = {}
        for link_row in conn.execute("SELECT project_id, feed_id FROM project_rss_feeds ORDER BY linked_at ASC").fetchall():
            feeds_by_project.setdefault(link_row["project_id"], []).append(link_row["feed_id"])
    return [_row_to_project(row, feeds_by_project.get(row["id"], [])) for row in rows]


def get_project(project_id: str) -> dict[str, Any]:
    """Fetch a single project by explicit project_id or raise PROJECT_NOT_FOUND."""
    with read_db() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if row is None:
            raise AppError("PROJECT_NOT_FOUND", "Không tìm thấy Project yêu cầu.", status_code=404)
        feed_ids = _get_linked_feed_ids(conn, project_id)
    return _row_to_project(row, feed_ids)


def create_project(
    name: str,
    description: str = "",
    region_code: str = "VN",
    relevance_language: str = "vi",
    target_format: str = "all",
) -> dict[str, Any]:
    """Create a new project cleanly enforcing unique non-empty names."""
    cleaned_name = name.strip()
    if not cleaned_name:
        raise AppError("PROJECT_NAME_EMPTY", "Tên Project không được để trống.", status_code=400)
    if target_format not in ("all", "long_form", "shorts"):
        raise AppError("INVALID_TARGET_FORMAT", "Định dạng trọng tâm không hợp lệ.", status_code=400)

    project_id = f"proj-{uuid.uuid4().hex[:10]}"
    now = _utc_now_iso()
    clean_region = region_code.strip().upper()[:8] or "VN"
    clean_lang = relevance_language.strip().lower()[:16] or "vi"

    with write_db() as conn:
        dup = conn.execute("SELECT id FROM projects WHERE name = ? COLLATE NOCASE", (cleaned_name,)).fetchone()
        if dup is not None:
            raise AppError("PROJECT_NAME_DUPLICATE", "Tên Project đã tồn tại.", status_code=409)
        conn.execute(
            """
            INSERT INTO projects (
                id, name, description, region_code, relevance_language,
                target_format, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (project_id, cleaned_name, description.strip(), clean_region, clean_lang, target_format, now, now),
        )
        created = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        assert created is not None
    return _row_to_project(created, [])


def update_project(project_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    """Update project configuration fields strictly scoped to project_id."""
    with write_db() as conn:
        current = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if current is None:
            raise AppError("PROJECT_NOT_FOUND", "Không tìm thấy Project để cập nhật.", status_code=404)

        next_name = str(patch.get("name", current["name"])).strip()
        if not next_name:
            raise AppError("PROJECT_NAME_EMPTY", "Tên Project không được để trống.", status_code=400)
        dup = conn.execute(
            "SELECT id FROM projects WHERE name = ? COLLATE NOCASE AND id != ?",
            (next_name, project_id),
        ).fetchone()
        if dup is not None:
            raise AppError("PROJECT_NAME_DUPLICATE", "Tên Project đã tồn tại ở dự án khác.", status_code=409)

        next_desc = str(patch.get("description", current["description"])).strip()
        next_region = str(patch.get("regionCode", current["region_code"])).strip().upper()[:8] or "VN"
        next_lang = str(patch.get("relevanceLanguage", current["relevance_language"])).strip().lower()[:16] or "vi"
        next_fmt = patch.get("targetFormat", current["target_format"])
        if next_fmt not in ("all", "long_form", "shorts"):
            raise AppError("INVALID_TARGET_FORMAT", "Định dạng trọng tâm không hợp lệ.", status_code=400)

        now = _utc_now_iso()
        conn.execute(
            """
            UPDATE projects
            SET name = ?, description = ?, region_code = ?, relevance_language = ?,
                target_format = ?, updated_at = ?
            WHERE id = ?
            """,
            (next_name, next_desc, next_region, next_lang, next_fmt, now, project_id),
        )
        updated = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        assert updated is not None
        feed_ids = _get_linked_feed_ids(conn, project_id)
    return _row_to_project(updated, feed_ids)


def build_project_export_payload(project_id: str) -> dict[str, Any]:
    """Build a read-only JSON export containing ONLY user-created data for the target project (0 API keys)."""
    with read_db() as conn:
        proj_row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if proj_row is None:
            raise AppError("PROJECT_NOT_FOUND", "Không tìm thấy Project cần xuất dữ liệu.", status_code=404)

        keywords = [
            dict(r)
            for r in conn.execute(
                "SELECT id, keyword, priority, notes, last_scanned_at, created_at FROM project_keywords WHERE project_id = ?",
                (project_id,),
            ).fetchall()
        ]
        channels = [
            dict(r)
            for r in conn.execute(
                "SELECT channel_id, status, notes, added_at FROM project_channels WHERE project_id = ?",
                (project_id,),
            ).fetchall()
        ]
        videos = [
            dict(r)
            for r in conn.execute(
                "SELECT video_id, is_user_breakout, notes, marked_at FROM project_videos WHERE project_id = ?",
                (project_id,),
            ).fetchall()
        ]
        rss_links = [
            dict(r)
            for r in conn.execute(
                "SELECT feed_id, linked_at FROM project_rss_feeds WHERE project_id = ?",
                (project_id,),
            ).fetchall()
        ]
        ideas = [
            dict(r)
            for r in conn.execute(
                """
                SELECT pi.idea_id, i.title, i.notes, i.source_type, i.source_ref_id,
                       i.source_url, i.in_global_vault, pi.status, pi.priority,
                       pi.project_angle, pi.project_notes, pi.published_video_url,
                       pi.status_updated_at
                FROM project_ideas pi
                JOIN ideas i ON i.id = pi.idea_id
                WHERE pi.project_id = ?
                """,
                (project_id,),
            ).fetchall()
        ]

    return {
        "schemaVersion": "research-studio-project-export-v1",
        "exportedAtUtc": _utc_now_iso(),
        "containsApiKeys": False,
        "containsYoutubeApiCache": False,
        "project": _row_to_project(proj_row, [link["feed_id"] for link in rss_links]),
        "keywords": keywords,
        "competitorChannelRefs": channels,
        "videoNotes": videos,
        "linkedRssFeeds": rss_links,
        "ideas": ideas,
    }


def delete_project_safely(project_id: str, confirm_name: str) -> dict[str, Any]:
    """Verify exact project name match, write a recovery JSON snapshot in backups/, and delete safely."""
    payload = build_project_export_payload(project_id)
    actual_name = payload["project"]["name"]
    if confirm_name.strip() != actual_name:
        raise AppError(
            code="DELETE_CONFIRM_MISMATCH",
            message="Tên xác nhận không khớp với tên Project. Đã hủy thao tác xóa.",
            status_code=400,
        )

    dirs = ensure_runtime_dirs()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    slug = safe_project_slug(actual_name, project_id)
    recovery_filename = f"project_recovery_{stamp}_{slug}.json"
    recovery_path = resolve_safe_child_path(dirs["backups"], recovery_filename)
    recovery_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    try:
        with write_db() as conn:
            linked_idea_ids = [
                r["idea_id"]
                for r in conn.execute("SELECT idea_id FROM project_ideas WHERE project_id = ?", (project_id,)).fetchall()
            ]
            conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            for idea_id in linked_idea_ids:
                remaining = conn.execute(
                    "SELECT COUNT(*) FROM project_ideas WHERE idea_id = ?",
                    (idea_id,),
                ).fetchone()[0]
                if remaining == 0:
                    conn.execute(
                        "DELETE FROM ideas WHERE id = ? AND in_global_vault = 0",
                        (idea_id,),
                    )
    except BaseException:
        recovery_path.unlink(missing_ok=True)
        raise

    return {
        "deletedProjectId": project_id,
        "deletedProjectName": actual_name,
        "recoveryBackupFilename": recovery_filename,
        "sharedEntitiesPreserved": True,
    }


def set_project_rss_feeds(project_id: str, feed_ids: list[str]) -> dict[str, Any]:
    """Atomically replace global RSS feed links scoped to project_id inside project_rss_feeds."""
    clean_ids: list[str] = []
    seen: set[str] = set()
    for raw in feed_ids:
        cleaned = str(raw).strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            clean_ids.append(cleaned)

    now = _utc_now_iso()
    with write_db() as conn:
        proj = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if proj is None:
            raise AppError("PROJECT_NOT_FOUND", "Không tìm thấy Project để gắn nguồn RSS.", status_code=404)

        if clean_ids:
            placeholders = ",".join("?" for _ in clean_ids)
            found_rows = conn.execute(
                f"SELECT id FROM rss_feeds WHERE id IN ({placeholders})",
                clean_ids,
            ).fetchall()
            valid_set = {r["id"] for r in found_rows}
            missing = [fid for fid in clean_ids if fid not in valid_set]
            if missing:
                raise AppError(
                    code="RSS_FEED_NOT_FOUND",
                    message="Một hoặc nhiều nguồn RSS không tồn tại.",
                    status_code=404,
                    details={"missingFeedIds": missing},
                )

        conn.execute("DELETE FROM project_rss_feeds WHERE project_id = ?", (project_id,))
        for fid in clean_ids:
            conn.execute(
                """
                INSERT INTO project_rss_feeds (id, project_id, feed_id, linked_at)
                VALUES (?, ?, ?, ?)
                """,
                (f"prf-{uuid.uuid4().hex[:10]}", project_id, fid, now),
            )
        conn.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))
        updated = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        assert updated is not None
        final_feed_ids = _get_linked_feed_ids(conn, project_id)
    return _row_to_project(updated, final_feed_ids)
