from __future__ import annotations

from datetime import datetime, timezone
import json
import sqlite3
from typing import Any
import uuid

from app.core.errors import AppError
from app.db.connection import read_db, write_db


def _utc_now_iso(now_utc: datetime | None = None) -> str:
    if now_utc is None:
        return datetime.now(timezone.utc).isoformat()
    if now_utc.tzinfo is None:
        return now_utc.replace(tzinfo=timezone.utc).isoformat()
    return now_utc.astimezone(timezone.utc).isoformat()


def _parse_tags(raw_json: str | None) -> list[str]:
    if not raw_json:
        return []
    try:
        decoded = json.loads(raw_json)
        if isinstance(decoded, list):
            return [str(t).strip() for t in decoded if str(t).strip()]
    except ValueError:
        pass
    return []


def _load_project_links_map(conn: sqlite3.Connection, idea_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not idea_ids:
        return {}
    placeholders = ",".join("?" for _ in idea_ids)
    rows = conn.execute(
        f"""
        SELECT project_id, idea_id, status, priority, project_angle,
               project_notes, published_video_url, status_updated_at
        FROM project_ideas
        WHERE idea_id IN ({placeholders})
        ORDER BY status_updated_at DESC
        """,
        idea_ids,
    ).fetchall()
    grouped: dict[str, dict[str, Any]] = {}
    for r in rows:
        grouped.setdefault(r["idea_id"], {})[r["project_id"]] = {
            "status": r["status"],
            "priority": r["priority"],
            "projectAngle": r["project_angle"],
            "projectNotes": r["project_notes"],
            "publishedVideoUrl": r["published_video_url"],
            "statusUpdatedAt": r["status_updated_at"],
        }
    return grouped


def _row_to_idea_dto(
    row: sqlite3.Row,
    links: dict[str, Any],
    *,
    now_iso: str,
) -> dict[str, Any]:
    linked_video_id = row["linked_video_id"]
    api_purged = False
    if linked_video_id:
        expires = row["video_expires_at"]
        purged_at = row["video_purged_at"]
        if not expires or expires <= now_iso or purged_at is not None:
            api_purged = True

    snapshot = row["source_title_snapshot"] or ""
    if api_purged and row["source_type"] == "youtube_video":
        snapshot = "Video YouTube — Metadata API đã hết hạn 30 ngày (Ý tưởng & URL giữ nguyên)"

    return {
        "id": row["id"],
        "title": row["title"],
        "notes": row["notes"],
        "sourceType": row["source_type"],
        "sourceRefId": row["source_ref_id"] or "",
        "sourceTitleSnapshot": snapshot,
        "sourceUrl": row["source_url"] or "",
        "linkedVideoId": linked_video_id,
        "linkedChannelId": row["linked_channel_id"],
        "linkedArticleId": row["linked_article_id"],
        "apiPurged": api_purged,
        "inGlobalVault": bool(row["in_global_vault"]),
        "tags": _parse_tags(row["tags_json"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "projectLinks": links,
    }


def list_ideas(
    *,
    project_id: str | None = None,
    only_global_vault: bool = False,
    status: str | None = None,
    priority: str | None = None,
    source_type: str | None = None,
    link_state: str | None = None,
    search: str = "",
    now_utc: datetime | None = None,
) -> list[dict[str, Any]]:
    """Query ideas across Global Vault or scoped to project_id via LEFT JOIN preserving purged sources."""
    now_iso = _utc_now_iso(now_utc)
    clauses: list[str] = ["1 = 1"]
    params: list[Any] = []

    if only_global_vault:
        clauses.append("i.in_global_vault = 1")
    if source_type and source_type != "all":
        clauses.append("i.source_type = ?")
        params.append(source_type)

    if project_id:
        clauses.append("EXISTS (SELECT 1 FROM project_ideas pi WHERE pi.idea_id = i.id AND pi.project_id = ?)")
        params.append(project_id)
        if status and status != "all":
            clauses.append(
                "EXISTS (SELECT 1 FROM project_ideas pi WHERE pi.idea_id = i.id AND pi.project_id = ? AND pi.status = ?)"
            )
            params.extend([project_id, status])
        if priority and priority != "all":
            clauses.append(
                "EXISTS (SELECT 1 FROM project_ideas pi WHERE pi.idea_id = i.id AND pi.project_id = ? AND pi.priority = ?)"
            )
            params.extend([project_id, priority])
    elif link_state == "unlinked":
        clauses.append("NOT EXISTS (SELECT 1 FROM project_ideas pi WHERE pi.idea_id = i.id)")
    elif link_state == "linked":
        clauses.append("EXISTS (SELECT 1 FROM project_ideas pi WHERE pi.idea_id = i.id)")

    if search.strip():
        like = f"%{search.strip()}%"
        if project_id:
            clauses.append(
                """
                (
                    i.title LIKE ? OR i.notes LIKE ?
                    OR EXISTS (
                        SELECT 1 FROM project_ideas pi
                        WHERE pi.idea_id = i.id AND pi.project_id = ?
                          AND (pi.project_angle LIKE ? OR pi.project_notes LIKE ?)
                    )
                )
                """
            )
            params.extend([like, like, project_id, like, like])
        else:
            clauses.append("(i.title LIKE ? OR i.notes LIKE ? OR i.source_title_snapshot LIKE ?)")
            params.extend([like, like, like])

    where_sql = " AND ".join(clauses)
    with read_db() as conn:
        rows = conn.execute(
            f"""
            SELECT i.*,
                   v.api_expires_at AS video_expires_at,
                   v.api_purged_at AS video_purged_at
            FROM ideas i
            LEFT JOIN youtube_videos v ON v.video_id = i.linked_video_id
            WHERE {where_sql}
            ORDER BY i.updated_at DESC, i.created_at DESC
            """,
            params,
        ).fetchall()
        links_map = _load_project_links_map(conn, [r["id"] for r in rows])

    return [_row_to_idea_dto(r, links_map.get(r["id"], {}), now_iso=now_iso) for r in rows]


def get_idea(idea_id: str, *, now_utc: datetime | None = None) -> dict[str, Any]:
    now_iso = _utc_now_iso(now_utc)
    with read_db() as conn:
        row = conn.execute(
            """
            SELECT i.*,
                   v.api_expires_at AS video_expires_at,
                   v.api_purged_at AS video_purged_at
            FROM ideas i
            LEFT JOIN youtube_videos v ON v.video_id = i.linked_video_id
            WHERE i.id = ?
            """,
            (idea_id,),
        ).fetchone()
        if row is None:
            raise AppError("IDEA_NOT_FOUND", "Không tìm thấy Ý tưởng yêu cầu.", status_code=404)
        links_map = _load_project_links_map(conn, [idea_id])
    return _row_to_idea_dto(row, links_map.get(idea_id, {}), now_iso=now_iso)


def create_idea(
    *,
    title: str,
    notes: str,
    source_type: str,
    source_ref_id: str,
    source_title_snapshot: str,
    source_url: str,
    tags: list[str],
    in_global_vault: bool,
    target_project_ids: list[str],
    project_angle: str,
    priority: str = "medium",
    initial_status: str = "new",
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Create 1 canonical ideas row and N independent project_ideas link rows atomically."""
    now_iso = _utc_now_iso(now_utc)
    idea_id = f"idea-{uuid.uuid4().hex[:10]}"
    effective_vault = True if not target_project_ids else in_global_vault

    with write_db() as conn:
        if target_project_ids:
            placeholders = ",".join("?" for _ in target_project_ids)
            found = {
                r["id"]
                for r in conn.execute(
                    f"SELECT id FROM projects WHERE id IN ({placeholders})",
                    target_project_ids,
                ).fetchall()
            }
            missing = [pid for pid in target_project_ids if pid not in found]
            if missing:
                raise AppError(
                    code="PROJECT_NOT_FOUND",
                    message="Một hoặc nhiều Project được chọn không còn tồn tại.",
                    status_code=404,
                    details={"missingProjectIds": missing},
                )

        linked_video_id: str | None = None
        linked_channel_id: str | None = None
        linked_article_id: str | None = None

        if source_type == "youtube_video" and source_ref_id:
            linked_video_id = source_ref_id
            conn.execute(
                """
                INSERT OR IGNORE INTO youtube_videos (video_id, source_format_status, created_at)
                VALUES (?, 'unknown', ?)
                """,
                (linked_video_id, now_iso),
            )
            vid_row = conn.execute(
                "SELECT channel_id FROM youtube_videos WHERE video_id = ?",
                (linked_video_id,),
            ).fetchone()
            if vid_row is not None and vid_row["channel_id"]:
                linked_channel_id = vid_row["channel_id"]
        elif source_type == "rss_article" and source_ref_id:
            art_row = conn.execute(
                "SELECT id FROM rss_articles WHERE id = ?",
                (source_ref_id,),
            ).fetchone()
            if art_row is not None:
                linked_article_id = art_row["id"]

        conn.execute(
            """
            INSERT INTO ideas (
                id, title, notes, source_type, source_ref_id, source_title_snapshot,
                source_url, linked_video_id, linked_channel_id, linked_article_id,
                tags_json, in_global_vault, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                idea_id,
                title,
                notes,
                source_type,
                source_ref_id or None,
                source_title_snapshot,
                source_url,
                linked_video_id,
                linked_channel_id,
                linked_article_id,
                json.dumps(tags, ensure_ascii=False),
                1 if effective_vault else 0,
                now_iso,
                now_iso,
            ),
        )

        angle_value = project_angle.strip() or title
        for pid in target_project_ids:
            conn.execute(
                """
                INSERT INTO project_ideas (
                    id, project_id, idea_id, status, priority, project_angle,
                    project_notes, published_video_url, status_updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, '', '', ?)
                """,
                (
                    f"pi-{uuid.uuid4().hex[:10]}",
                    pid,
                    idea_id,
                    initial_status,
                    priority,
                    angle_value,
                    now_iso,
                ),
            )

    return get_idea(idea_id, now_utc=now_utc)


def update_idea_core(
    idea_id: str,
    patch: dict[str, Any],
    *,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    now_iso = _utc_now_iso(now_utc)
    with write_db() as conn:
        current = conn.execute("SELECT * FROM ideas WHERE id = ?", (idea_id,)).fetchone()
        if current is None:
            raise AppError("IDEA_NOT_FOUND", "Không tìm thấy Ý tưởng để cập nhật.", status_code=404)

        next_title = str(patch.get("title", current["title"])).strip()
        if not next_title:
            raise AppError("IDEA_TITLE_EMPTY", "Tiêu đề Ý tưởng không được để trống.", status_code=400)
        next_notes = str(patch.get("notes", current["notes"])).strip()
        next_vault = 1 if patch.get("inGlobalVault", bool(current["in_global_vault"])) else 0
        if "tags" in patch:
            tags_val = json.dumps(patch["tags"], ensure_ascii=False)
        else:
            tags_val = current["tags_json"]

        conn.execute(
            """
            UPDATE ideas
            SET title = ?, notes = ?, in_global_vault = ?, tags_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (next_title, next_notes, next_vault, tags_val, now_iso, idea_id),
        )
    return get_idea(idea_id, now_utc=now_utc)


def upsert_project_idea_link(
    idea_id: str,
    project_id: str,
    patch: dict[str, Any],
    *,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Attach an idea to project_id or update its independent status/angle/notes/URL."""
    now_iso = _utc_now_iso(now_utc)
    with write_db() as conn:
        idea_row = conn.execute("SELECT title FROM ideas WHERE id = ?", (idea_id,)).fetchone()
        if idea_row is None:
            raise AppError("IDEA_NOT_FOUND", "Không tìm thấy Ý tưởng gốc.", status_code=404)
        proj_row = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if proj_row is None:
            raise AppError("PROJECT_NOT_FOUND", "Không tìm thấy Project đích.", status_code=404)

        existing = conn.execute(
            "SELECT * FROM project_ideas WHERE idea_id = ? AND project_id = ?",
            (idea_id, project_id),
        ).fetchone()

        if existing is None:
            status = patch.get("status", "new")
            priority = patch.get("priority", "medium")
            angle = str(patch.get("projectAngle") or idea_row["title"]).strip()
            notes = str(patch.get("projectNotes") or "").strip()
            pub_url = str(patch.get("publishedVideoUrl") or "").strip()
            conn.execute(
                """
                INSERT INTO project_ideas (
                    id, project_id, idea_id, status, priority, project_angle,
                    project_notes, published_video_url, status_updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (f"pi-{uuid.uuid4().hex[:10]}", project_id, idea_id, status, priority, angle, notes, pub_url, now_iso),
            )
        else:
            status = patch.get("status", existing["status"])
            priority = patch.get("priority", existing["priority"])
            angle = str(patch.get("projectAngle", existing["project_angle"])).strip()
            notes = str(patch.get("projectNotes", existing["project_notes"])).strip()
            pub_url = str(patch.get("publishedVideoUrl", existing["published_video_url"])).strip()
            conn.execute(
                """
                UPDATE project_ideas
                SET status = ?, priority = ?, project_angle = ?, project_notes = ?,
                    published_video_url = ?, status_updated_at = ?
                WHERE idea_id = ? AND project_id = ?
                """,
                (status, priority, angle, notes, pub_url, now_iso, idea_id, project_id),
            )
        conn.execute("UPDATE ideas SET updated_at = ? WHERE id = ?", (now_iso, idea_id))
    return get_idea(idea_id, now_utc=now_utc)


def remove_project_idea_link(
    idea_id: str,
    project_id: str,
    *,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Detach an idea from one project while preserving the canonical idea in Global Vault."""
    now_iso = _utc_now_iso(now_utc)
    with write_db() as conn:
        existing = conn.execute(
            "SELECT id FROM project_ideas WHERE idea_id = ? AND project_id = ?",
            (idea_id, project_id),
        ).fetchone()
        if existing is None:
            raise AppError("PROJECT_IDEA_LINK_NOT_FOUND", "Ý tưởng chưa được gắn vào Project này.", status_code=404)
        conn.execute("DELETE FROM project_ideas WHERE idea_id = ? AND project_id = ?", (idea_id, project_id))
        remaining = conn.execute("SELECT COUNT(*) FROM project_ideas WHERE idea_id = ?", (idea_id,)).fetchone()[0]
        if remaining == 0:
            conn.execute(
                "UPDATE ideas SET in_global_vault = 1, updated_at = ? WHERE id = ?",
                (now_iso, idea_id),
            )
        else:
            conn.execute("UPDATE ideas SET updated_at = ? WHERE id = ?", (now_iso, idea_id))
    return get_idea(idea_id, now_utc=now_utc)


def delete_idea(idea_id: str) -> dict[str, str]:
    with write_db() as conn:
        row = conn.execute("SELECT id FROM ideas WHERE id = ?", (idea_id,)).fetchone()
        if row is None:
            raise AppError("IDEA_NOT_FOUND", "Không tìm thấy Ý tưởng cần xóa.", status_code=404)
        conn.execute("DELETE FROM ideas WHERE id = ?", (idea_id,))
    return {"deletedIdeaId": idea_id}
