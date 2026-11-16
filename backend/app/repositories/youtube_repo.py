from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import sqlite3
from typing import Any, Literal
import uuid

from app.core.config import YOUTUBE_API_CACHE_TTL_DAYS
from app.core.errors import AppError
from app.db.connection import read_db, write_db
from app.services.format_classifier import classify_video_format

ManualFormat = Literal["long_form", "shorts"]


def _normalize_utc(now_utc: datetime | None) -> datetime:
    if now_utc is None:
        return datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        return now_utc.replace(tzinfo=timezone.utc)
    return now_utc.astimezone(timezone.utc)


def compute_api_timestamps(now_utc: datetime | None = None) -> tuple[str, str]:
    """Return (api_fetched_at, api_expires_at) ISO timestamps with 30-calendar-day YouTube TTL."""
    utc_now = _normalize_utc(now_utc)
    expires = utc_now + timedelta(days=YOUTUBE_API_CACHE_TTL_DAYS)
    return utc_now.isoformat(), expires.isoformat()


def ensure_channel_stub_in_tx(conn: sqlite3.Connection, channel_id: str, now_iso: str) -> None:
    """Guarantee a parent youtube_channels row exists before inserting youtube_videos under FK RESTRICT."""
    row = conn.execute(
        "SELECT channel_id FROM youtube_channels WHERE channel_id = ?",
        (channel_id,),
    ).fetchone()
    if row is None:
        conn.execute(
            """
            INSERT INTO youtube_channels (channel_id, created_at)
            VALUES (?, ?)
            """,
            (channel_id, now_iso),
        )


def upsert_channel(
    *,
    channel_id: str,
    title: str | None,
    handle: str | None = None,
    description: str | None = None,
    country: str | None = None,
    thumbnail_url: str | None = None,
    uploads_playlist_id: str | None = None,
    subscriber_count: int | None = None,
    video_count: int | None = None,
    published_at: str | None = None,
    now_utc: datetime | None = None,
    conn: sqlite3.Connection | None = None,
) -> None:
    fetched_iso, expires_iso = compute_api_timestamps(now_utc)

    def _run(tx: sqlite3.Connection) -> None:
        tx.execute(
            """
            INSERT INTO youtube_channels (
                channel_id, title, handle, description, country, thumbnail_url,
                uploads_playlist_id, subscriber_count, video_count, published_at,
                api_fetched_at, api_expires_at, api_purged_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
            ON CONFLICT(channel_id) DO UPDATE SET
                title = excluded.title,
                handle = COALESCE(excluded.handle, youtube_channels.handle),
                description = excluded.description,
                country = excluded.country,
                thumbnail_url = excluded.thumbnail_url,
                uploads_playlist_id = COALESCE(excluded.uploads_playlist_id, youtube_channels.uploads_playlist_id),
                subscriber_count = excluded.subscriber_count,
                video_count = excluded.video_count,
                published_at = excluded.published_at,
                api_fetched_at = excluded.api_fetched_at,
                api_expires_at = excluded.api_expires_at,
                api_purged_at = NULL
            """,
            (
                channel_id,
                title,
                handle,
                description,
                country,
                thumbnail_url,
                uploads_playlist_id,
                subscriber_count,
                video_count,
                published_at,
                fetched_iso,
                expires_iso,
                fetched_iso,
            ),
        )

    if conn is not None:
        _run(conn)
        return
    with write_db() as tx:
        _run(tx)


def upsert_video_and_snapshot(
    *,
    video_id: str,
    channel_id: str | None,
    title: str | None,
    description: str | None = None,
    channel_title: str | None = None,
    published_at: str | None = None,
    thumbnail_url: str | None = None,
    duration_seconds: int | None = None,
    tags: list[str] | None = None,
    view_count: int | None = None,
    like_count: int | None = None,
    comment_count: int | None = None,
    is_live_streaming: bool = False,
    official_is_shorts: bool | None = None,
    now_utc: datetime | None = None,
    record_snapshot: bool = True,
    conn: sqlite3.Connection | None = None,
) -> dict[str, str | None]:
    fetched_iso, expires_iso = compute_api_timestamps(now_utc)
    clean_tags = [t.strip() for t in (tags or []) if isinstance(t, str) and t.strip()]
    format_info = classify_video_format(
        duration_seconds=duration_seconds,
        published_at=published_at,
        title=title,
        description=description,
        tags=clean_tags,
        is_live_streaming=is_live_streaming,
        official_is_shorts=official_is_shorts,
    )

    def _run(tx: sqlite3.Connection) -> None:
        if channel_id:
            ensure_channel_stub_in_tx(tx, channel_id, fetched_iso)
        tx.execute(
            """
            INSERT INTO youtube_videos (
                video_id, channel_id, title, description, channel_title, published_at,
                thumbnail_url, duration_seconds, tags_json, view_count, like_count,
                comment_count, is_live_streaming, source_format_status, format_hint,
                format_hint_confidence, format_hint_basis,
                api_fetched_at, api_expires_at, api_purged_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
            ON CONFLICT(video_id) DO UPDATE SET
                channel_id = COALESCE(excluded.channel_id, youtube_videos.channel_id),
                title = excluded.title,
                description = excluded.description,
                channel_title = excluded.channel_title,
                published_at = excluded.published_at,
                thumbnail_url = excluded.thumbnail_url,
                duration_seconds = excluded.duration_seconds,
                tags_json = excluded.tags_json,
                view_count = excluded.view_count,
                like_count = excluded.like_count,
                comment_count = excluded.comment_count,
                is_live_streaming = excluded.is_live_streaming,
                source_format_status = excluded.source_format_status,
                format_hint = excluded.format_hint,
                format_hint_confidence = excluded.format_hint_confidence,
                format_hint_basis = excluded.format_hint_basis,
                api_fetched_at = excluded.api_fetched_at,
                api_expires_at = excluded.api_expires_at,
                api_purged_at = NULL
            """,
            (
                video_id,
                channel_id,
                title,
                description,
                channel_title,
                published_at,
                thumbnail_url,
                duration_seconds,
                json.dumps(clean_tags, ensure_ascii=False),
                view_count,
                like_count,
                comment_count,
                1 if is_live_streaming else 0,
                format_info["source_format_status"],
                format_info["format_hint"],
                format_info["format_hint_confidence"],
                format_info["format_hint_basis"],
                fetched_iso,
                expires_iso,
                fetched_iso,
            ),
        )
        if record_snapshot:
            tx.execute(
                """
                INSERT OR IGNORE INTO youtube_video_snapshots (
                    video_id, captured_at, view_count, like_count, comment_count, api_expires_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (video_id, fetched_iso, view_count, like_count, comment_count, expires_iso),
            )

    if conn is not None:
        _run(conn)
    else:
        with write_db() as tx:
            _run(tx)
    return format_info


def set_manual_video_format(
    video_id: str,
    manual_format: ManualFormat | None,
    *,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Store or clear user's manual format label separately from YouTube source_format_status."""
    utc_now = _normalize_utc(now_utc)
    now_iso = utc_now.isoformat()

    with write_db() as conn:
        exists = conn.execute(
            "SELECT video_id FROM youtube_videos WHERE video_id = ?",
            (video_id,),
        ).fetchone()
        if exists is None:
            raise AppError(
                code="VIDEO_NOT_FOUND",
                message="Không tìm thấy bản ghi video để gắn nhãn định dạng thủ công.",
                status_code=404,
            )

        if manual_format is None:
            conn.execute("DELETE FROM user_video_format_labels WHERE video_id = ?", (video_id,))
        else:
            if manual_format not in ("long_form", "shorts"):
                raise AppError("INVALID_MANUAL_FORMAT", "Nhãn định dạng thủ công không hợp lệ.", status_code=400)
            conn.execute(
                """
                INSERT INTO user_video_format_labels (video_id, manual_format, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(video_id) DO UPDATE SET
                    manual_format = excluded.manual_format,
                    updated_at = excluded.updated_at
                """,
                (video_id, manual_format, now_iso),
            )

    return {
        "videoId": video_id,
        "manualFormat": manual_format,
        "updatedAt": now_iso,
    }


def _row_to_video_dto(row: sqlite3.Row, snapshots: list[dict[str, Any]], now_iso: str) -> dict[str, Any]:
    expires = row["api_expires_at"]
    purged_at = row["api_purged_at"]
    has_valid_api = bool(expires and expires > now_iso and purged_at is None)

    raw_tags: list[str] = []
    if has_valid_api and row["tags_json"]:
        try:
            decoded = json.loads(row["tags_json"])
            if isinstance(decoded, list):
                raw_tags = [str(item) for item in decoded]
        except ValueError:
            raw_tags = []

    return {
        "videoId": row["video_id"],
        "channelId": row["channel_id"],
        "hasValidApiData": has_valid_api,
        "apiPurged": not has_valid_api,
        "title": row["title"] if has_valid_api else None,
        "description": row["description"] if has_valid_api else None,
        "channelTitle": row["channel_title"] if has_valid_api else None,
        "publishedAt": row["published_at"] if has_valid_api else None,
        "thumbnailUrl": row["thumbnail_url"] if has_valid_api else None,
        "durationSeconds": row["duration_seconds"] if has_valid_api else None,
        "tags": raw_tags,
        "viewCount": row["view_count"] if has_valid_api else None,
        "likeCount": row["like_count"] if has_valid_api else None,
        "commentCount": row["comment_count"] if has_valid_api else None,
        "isLiveStreaming": bool(row["is_live_streaming"]) if has_valid_api and row["is_live_streaming"] is not None else False,
        "sourceFormatStatus": row["source_format_status"] if has_valid_api else "unknown",
        "formatHint": row["format_hint"] if has_valid_api else None,
        "formatHintConfidence": row["format_hint_confidence"] if has_valid_api else None,
        "formatHintBasis": row["format_hint_basis"] if has_valid_api else None,
        "manualFormat": row["manual_format"],
        "apiFetchedAt": row["api_fetched_at"] if has_valid_api else None,
        "apiExpiresAt": expires if has_valid_api else None,
        "snapshots30d": snapshots if has_valid_api else [],
    }


def get_video_record(
    video_id: str,
    *,
    require_valid_api: bool = False,
    now_utc: datetime | None = None,
) -> dict[str, Any] | None:
    """Read a video applying strict read-time 30-day expiry filtering on all YouTube API Data."""
    utc_now = _normalize_utc(now_utc)
    now_iso = utc_now.isoformat()

    with read_db() as conn:
        row = conn.execute(
            """
            SELECT v.*, ufl.manual_format
            FROM youtube_videos v
            LEFT JOIN user_video_format_labels ufl ON ufl.video_id = v.video_id
            WHERE v.video_id = ?
            """,
            (video_id,),
        ).fetchone()
        if row is None:
            return None

        snap_rows = conn.execute(
            """
            SELECT captured_at, view_count, like_count, comment_count, api_expires_at
            FROM youtube_video_snapshots
            WHERE video_id = ? AND api_expires_at > ?
            ORDER BY captured_at ASC
            """,
            (video_id, now_iso),
        ).fetchall()

    snapshots = [
        {
            "capturedAt": sr["captured_at"],
            "viewCount": sr["view_count"],
            "likeCount": sr["like_count"],
            "commentCount": sr["comment_count"],
        }
        for sr in snap_rows
    ]
    dto = _row_to_video_dto(row, snapshots, now_iso)
    if require_valid_api and not dto["hasValidApiData"]:
        return None
    return dto


def get_channel_record(
    channel_id: str,
    *,
    require_valid_api: bool = False,
    now_utc: datetime | None = None,
) -> dict[str, Any] | None:
    """Read a channel applying strict read-time 30-day expiry filtering on all YouTube API Data."""
    utc_now = _normalize_utc(now_utc)
    now_iso = utc_now.isoformat()

    with read_db() as conn:
        row = conn.execute(
            "SELECT * FROM youtube_channels WHERE channel_id = ?",
            (channel_id,),
        ).fetchone()
    if row is None:
        return None

    expires = row["api_expires_at"]
    has_valid_api = bool(expires and expires > now_iso and row["api_purged_at"] is None)
    if require_valid_api and not has_valid_api:
        return None

    return {
        "channelId": row["channel_id"],
        "hasValidApiData": has_valid_api,
        "apiPurged": not has_valid_api,
        "title": row["title"] if has_valid_api else None,
        "handle": row["handle"] if has_valid_api else None,
        "description": row["description"] if has_valid_api else None,
        "country": row["country"] if has_valid_api else None,
        "thumbnailUrl": row["thumbnail_url"] if has_valid_api else None,
        "uploadsPlaylistId": row["uploads_playlist_id"] if has_valid_api else None,
        "subscriberCount": row["subscriber_count"] if has_valid_api else None,
        "videoCount": row["video_count"] if has_valid_api else None,
        "publishedAt": row["published_at"] if has_valid_api else None,
        "apiFetchedAt": row["api_fetched_at"] if has_valid_api else None,
        "apiExpiresAt": expires if has_valid_api else None,
    }


def _load_snapshots_map(
    conn: sqlite3.Connection,
    video_ids: list[str],
    now_iso: str,
) -> dict[str, list[dict[str, Any]]]:
    if not video_ids:
        return {}
    placeholders = ",".join("?" for _ in video_ids)
    rows = conn.execute(
        f"""
        SELECT video_id, captured_at, view_count, like_count, comment_count
        FROM youtube_video_snapshots
        WHERE video_id IN ({placeholders}) AND api_expires_at > ?
        ORDER BY captured_at ASC
        """,
        (*video_ids, now_iso),
    ).fetchall()
    grouped: dict[str, list[dict[str, Any]]] = {}
    for sr in rows:
        grouped.setdefault(sr["video_id"], []).append(
            {
                "capturedAt": sr["captured_at"],
                "viewCount": sr["view_count"],
                "likeCount": sr["like_count"],
                "commentCount": sr["comment_count"],
            }
        )
    return grouped


def get_valid_videos_by_ids(
    conn: sqlite3.Connection,
    video_ids: list[str],
    *,
    now_iso: str,
) -> dict[str, dict[str, Any]]:
    """Return unexpired YouTube videos keyed by video_id applying strict read-time TTL filtering."""
    if not video_ids:
        return {}
    placeholders = ",".join("?" for _ in video_ids)
    rows = conn.execute(
        f"""
        SELECT v.*, ufl.manual_format
        FROM youtube_videos v
        LEFT JOIN user_video_format_labels ufl ON ufl.video_id = v.video_id
        WHERE v.video_id IN ({placeholders})
          AND v.api_expires_at IS NOT NULL
          AND v.api_expires_at > ?
          AND v.api_purged_at IS NULL
        """,
        (*video_ids, now_iso),
    ).fetchall()
    snaps = _load_snapshots_map(conn, [r["video_id"] for r in rows], now_iso)
    return {r["video_id"]: _row_to_video_dto(r, snaps.get(r["video_id"], []), now_iso) for r in rows}


def get_valid_channels_by_ids(
    conn: sqlite3.Connection,
    channel_ids: list[str],
    *,
    now_iso: str,
) -> dict[str, dict[str, Any]]:
    """Return unexpired YouTube channels keyed by channel_id applying strict read-time TTL filtering."""
    if not channel_ids:
        return {}
    placeholders = ",".join("?" for _ in channel_ids)
    rows = conn.execute(
        f"""
        SELECT *
        FROM youtube_channels
        WHERE channel_id IN ({placeholders})
          AND api_expires_at IS NOT NULL
          AND api_expires_at > ?
          AND api_purged_at IS NULL
        """,
        (*channel_ids, now_iso),
    ).fetchall()
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        result[row["channel_id"]] = {
            "channelId": row["channel_id"],
            "hasValidApiData": True,
            "apiPurged": False,
            "title": row["title"],
            "handle": row["handle"],
            "description": row["description"],
            "country": row["country"],
            "thumbnailUrl": row["thumbnail_url"],
            "uploadsPlaylistId": row["uploads_playlist_id"],
            "subscriberCount": row["subscriber_count"],
            "videoCount": row["video_count"],
            "publishedAt": row["published_at"],
            "apiFetchedAt": row["api_fetched_at"],
            "apiExpiresAt": row["api_expires_at"],
        }
    return result


def list_channel_valid_videos(
    channel_id: str,
    *,
    now_utc: datetime | None = None,
) -> list[dict[str, Any]]:
    """List unexpired cached videos belonging to channel_id ordered newest first."""
    now_iso = _normalize_utc(now_utc).isoformat()
    with read_db() as conn:
        rows = conn.execute(
            """
            SELECT v.*, ufl.manual_format
            FROM youtube_videos v
            LEFT JOIN user_video_format_labels ufl ON ufl.video_id = v.video_id
            WHERE v.channel_id = ?
              AND v.api_expires_at IS NOT NULL
              AND v.api_expires_at > ?
              AND v.api_purged_at IS NULL
            ORDER BY v.published_at DESC, v.view_count DESC
            """,
            (channel_id, now_iso),
        ).fetchall()
        snaps = _load_snapshots_map(conn, [r["video_id"] for r in rows], now_iso)
    return [_row_to_video_dto(r, snaps.get(r["video_id"], []), now_iso) for r in rows]


def upsert_project_video_breakout(
    project_id: str,
    video_id: str,
    *,
    is_user_breakout: bool | None = None,
    notes: str | None = None,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Create or update manual breakout flag and user notes isolated per project_id."""
    utc_now = _normalize_utc(now_utc)
    now_iso = utc_now.isoformat()

    with write_db() as conn:
        proj = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if proj is None:
            raise AppError("PROJECT_NOT_FOUND", "Không tìm thấy Project yêu cầu.", status_code=404)
        vid = conn.execute("SELECT video_id FROM youtube_videos WHERE video_id = ?", (video_id,)).fetchone()
        if vid is None:
            raise AppError("VIDEO_NOT_FOUND", "Không tìm thấy bản ghi video trong SQLite.", status_code=404)

        existing = conn.execute(
            "SELECT * FROM project_videos WHERE project_id = ? AND video_id = ?",
            (project_id, video_id),
        ).fetchone()
        if existing is None:
            flagged = bool(is_user_breakout) if is_user_breakout is not None else False
            clean_notes = "" if notes is None else notes.strip()
            marked_at = now_iso if flagged else None
            conn.execute(
                """
                INSERT INTO project_videos (id, project_id, video_id, is_user_breakout, notes, marked_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (f"pv-{uuid.uuid4().hex[:12]}", project_id, video_id, 1 if flagged else 0, clean_notes, marked_at),
            )
        else:
            flagged = bool(existing["is_user_breakout"]) if is_user_breakout is None else bool(is_user_breakout)
            clean_notes = existing["notes"] if notes is None else notes.strip()
            marked_at = existing["marked_at"]
            if is_user_breakout is not None:
                marked_at = now_iso if flagged else None
            conn.execute(
                """
                UPDATE project_videos
                SET is_user_breakout = ?, notes = ?, marked_at = ?
                WHERE id = ?
                """,
                (1 if flagged else 0, clean_notes, marked_at, existing["id"]),
            )

    return {
        "projectId": project_id,
        "videoId": video_id,
        "flagged": flagged,
        "notes": clean_notes,
        "markedAt": marked_at,
    }


def list_project_breakout_videos(
    project_id: str,
    *,
    days_window: int | None = None,
    source_format: str = "all",
    include_manual: bool = False,
    min_views: int | None = None,
    only_flagged: bool = False,
    sort_by: str = "viewCount",
    sort_dir: str = "desc",
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """
    Screen competitor and manually flagged project videos in Standard Mode.

    Reads only raw YouTube API fields within the <=30-day TTL (plus user flags/notes),
    strictly keeps 'unknown' separate from 'long_form' and 'shorts' counts, and
    never computes prohibited derived metrics (Outlier Multiplier, Views/day, Engagement Rate, Channel Median).
    """
    utc_now = _normalize_utc(now_utc)
    now_iso = utc_now.isoformat()

    with read_db() as conn:
        proj = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if proj is None:
            raise AppError("PROJECT_NOT_FOUND", "Không tìm thấy Project yêu cầu.", status_code=404)

        rows = conn.execute(
            """
            SELECT
                v.*,
                ufl.manual_format,
                COALESCE(pv.is_user_breakout, 0) AS is_user_breakout,
                COALESCE(pv.notes, '') AS breakout_notes,
                pv.marked_at
            FROM youtube_videos v
            LEFT JOIN user_video_format_labels ufl ON ufl.video_id = v.video_id
            LEFT JOIN project_videos pv ON pv.video_id = v.video_id AND pv.project_id = ?
            WHERE (
                v.channel_id IN (SELECT channel_id FROM project_channels WHERE project_id = ?)
                OR pv.id IS NOT NULL
            )
            """,
            (project_id, project_id),
        ).fetchall()
        snaps = _load_snapshots_map(conn, [str(r["video_id"]) for r in rows], now_iso)

    source_format_counts = {"longForm": 0, "shorts": 0, "unknown": 0}
    candidates: list[dict[str, Any]] = []
    cutoff_dt = (utc_now - timedelta(days=days_window)) if days_window and days_window > 0 else None

    for row in rows:
        vid = str(row["video_id"])
        dto = _row_to_video_dto(row, snaps.get(vid, []), now_iso)
        flagged = bool(row["is_user_breakout"])
        dto["isUserBreakout"] = flagged
        dto["breakoutNotes"] = row["breakout_notes"] or ""
        dto["breakoutMarkedAt"] = row["marked_at"]

        if not dto["hasValidApiData"]:
            if not (only_flagged and flagged):
                continue
        else:
            sf = dto["sourceFormatStatus"]
            if sf == "long_form":
                source_format_counts["longForm"] += 1
            elif sf == "shorts":
                source_format_counts["shorts"] += 1
            else:
                source_format_counts["unknown"] += 1

        if only_flagged and not flagged:
            continue

        if cutoff_dt is not None:
            if not dto["hasValidApiData"] or not dto["publishedAt"]:
                if not (only_flagged and flagged):
                    continue
            else:
                try:
                    pub_dt = datetime.fromisoformat(str(dto["publishedAt"]).replace("Z", "+00:00"))
                    if pub_dt.tzinfo is None:
                        pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                    if pub_dt.astimezone(timezone.utc) < cutoff_dt:
                        continue
                except ValueError:
                    continue

        if min_views is not None and min_views > 0:
            if dto["viewCount"] is None or int(dto["viewCount"]) < min_views:
                continue

        if source_format in ("long_form", "shorts", "unknown"):
            matches_source = dto["sourceFormatStatus"] == source_format
            matches_manual = include_manual and source_format != "unknown" and dto["manualFormat"] == source_format
            if not matches_source and not matches_manual:
                continue

        candidates.append(dto)

    reverse = sort_dir != "asc"

    def _sort_key(item: dict[str, Any]) -> tuple[int, Any]:
        if sort_by == "publishedAt":
            val = item.get("publishedAt") or ""
            return (0 if val else 1, str(val))
        if sort_by == "durationSeconds":
            val = item.get("durationSeconds")
            return (0 if val is not None else 1, int(val or 0))
        if sort_by == "likeCount":
            val = item.get("likeCount")
            return (0 if val is not None else 1, int(val or 0))
        if sort_by == "commentCount":
            val = item.get("commentCount")
            return (0 if val is not None else 1, int(val or 0))
        val = item.get("viewCount")
        return (0 if val is not None else 1, int(val or 0))

    if reverse:
        candidates.sort(key=_sort_key, reverse=True)
        # Put missing-value items (api_purged or missing stats) at the end even in descending order
        with_val = [item for item in candidates if _sort_key(item)[0] == 0]
        without_val = [item for item in candidates if _sort_key(item)[0] == 1]
        candidates = [*with_val, *without_val]
    else:
        candidates.sort(key=_sort_key)

    return {
        "projectId": project_id,
        "mode": "standard_mode",
        "formatCounts": source_format_counts,
        "totalCount": len(candidates),
        "items": candidates,
    }


def get_global_overview_summary(*, now_utc: datetime | None = None) -> dict[str, Any]:
    """Read lightweight global SQLite counts using 0 YouTube quota."""
    utc_now = _normalize_utc(now_utc)
    now_iso = utc_now.isoformat()
    soon_iso = (utc_now + timedelta(days=5)).isoformat()
    with read_db() as conn:
        valid_videos = int(
            conn.execute(
                """
                SELECT COUNT(*) AS cnt FROM youtube_videos
                WHERE api_purged_at IS NULL AND api_expires_at IS NOT NULL AND api_expires_at > ?
                """,
                (now_iso,),
            ).fetchone()["cnt"]
        )
        expiring_soon_videos = int(
            conn.execute(
                """
                SELECT COUNT(*) AS cnt FROM youtube_videos
                WHERE api_purged_at IS NULL AND api_expires_at IS NOT NULL
                  AND api_expires_at > ? AND api_expires_at <= ?
                """,
                (now_iso, soon_iso),
            ).fetchone()["cnt"]
        )
        valid_channels = int(
            conn.execute(
                """
                SELECT COUNT(*) AS cnt FROM youtube_channels
                WHERE api_purged_at IS NULL AND api_expires_at IS NOT NULL AND api_expires_at > ?
                """,
                (now_iso,),
            ).fetchone()["cnt"]
        )
        valid_sessions = int(
            conn.execute(
                """
                SELECT COUNT(*) AS cnt FROM search_sessions
                WHERE query_text NOT LIKE '__TREND__:%' AND api_expires_at > ?
                """,
                (now_iso,),
            ).fetchone()["cnt"]
        )
        ideas_total = int(
            conn.execute("SELECT COUNT(*) AS cnt FROM ideas WHERE in_global_vault = 1").fetchone()["cnt"]
        )
        ideas_unlinked = int(
            conn.execute(
                """
                SELECT COUNT(*) AS cnt FROM ideas i
                WHERE i.in_global_vault = 1
                  AND NOT EXISTS (SELECT 1 FROM project_ideas pi WHERE pi.idea_id = i.id)
                """
            ).fetchone()["cnt"]
        )
        projects_count = int(conn.execute("SELECT COUNT(*) AS cnt FROM projects").fetchone()["cnt"])
        rss_row = conn.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled_cnt,
                SUM(CASE WHEN last_status = 'error' THEN 1 ELSE 0 END) AS error_cnt
            FROM rss_feeds
            """
        ).fetchone()
        rss_articles_count = int(conn.execute("SELECT COUNT(*) AS cnt FROM rss_articles").fetchone()["cnt"])

    return {
        "validVideosCount": valid_videos,
        "expiringSoonVideosCount": expiring_soon_videos,
        "validChannelsCount": valid_channels,
        "validSearchSessionsCount": valid_sessions,
        "ideasTotalCount": ideas_total,
        "ideasUnlinkedCount": ideas_unlinked,
        "projectsCount": projects_count,
        "rssSummary": {
            "total": int(rss_row["total"] or 0),
            "enabled": int(rss_row["enabled_cnt"] or 0),
            "errorCount": int(rss_row["error_cnt"] or 0),
            "articlesCount": rss_articles_count,
        },
    }


def get_project_overview_summary(project_id: str, *, now_utc: datetime | None = None) -> dict[str, Any]:
    """Read real per-project SQLite summary counters keeping unknown video format strictly separated."""
    utc_now = _normalize_utc(now_utc)
    now_iso = utc_now.isoformat()
    recent_cutoff = (utc_now - timedelta(days=7)).isoformat()

    with read_db() as conn:
        proj = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if proj is None:
            raise AppError("PROJECT_NOT_FOUND", "Không tìm thấy Project yêu cầu.", status_code=404)

        ch_row = conn.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_cnt,
                SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused_cnt,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error_cnt
            FROM project_channels
            WHERE project_id = ?
            """,
            (project_id,),
        ).fetchone()

        vid_row = conn.execute(
            """
            SELECT
                COUNT(*) AS total_valid,
                SUM(CASE WHEN v.source_format_status = 'long_form' THEN 1 ELSE 0 END) AS long_form_cnt,
                SUM(CASE WHEN v.source_format_status = 'shorts' THEN 1 ELSE 0 END) AS shorts_cnt,
                SUM(CASE WHEN v.source_format_status = 'unknown' THEN 1 ELSE 0 END) AS unknown_cnt
            FROM youtube_videos v
            WHERE v.channel_id IN (SELECT channel_id FROM project_channels WHERE project_id = ?)
              AND v.api_purged_at IS NULL
              AND v.api_expires_at IS NOT NULL
              AND v.api_expires_at > ?
            """,
            (project_id, now_iso),
        ).fetchone()

        breakout_flagged = int(
            conn.execute(
                "SELECT COUNT(*) AS cnt FROM project_videos WHERE project_id = ? AND is_user_breakout = 1",
                (project_id,),
            ).fetchone()["cnt"]
        )

        kw_row = conn.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN s.id IS NOT NULL AND s.api_expires_at > ? THEN 1 ELSE 0 END) AS scanned_valid
            FROM project_keywords pk
            LEFT JOIN search_sessions s ON s.id = pk.last_session_id
            WHERE pk.project_id = ?
            """,
            (now_iso, project_id),
        ).fetchone()

        rss_feed_row = conn.execute(
            """
            SELECT
                COUNT(*) AS linked_feeds,
                SUM(CASE WHEN f.last_status = 'error' THEN 1 ELSE 0 END) AS broken_feeds
            FROM project_rss_feeds prf
            JOIN rss_feeds f ON f.id = prf.feed_id
            WHERE prf.project_id = ?
            """,
            (project_id,),
        ).fetchone()

        recent_rss_articles = int(
            conn.execute(
                """
                SELECT COUNT(*) AS cnt
                FROM rss_articles a
                JOIN project_rss_feeds prf ON prf.feed_id = a.feed_id
                WHERE prf.project_id = ? AND COALESCE(a.published_at, a.fetched_at) >= ?
                """,
                (project_id, recent_cutoff),
            ).fetchone()["cnt"]
        )

        idea_rows = conn.execute(
            """
            SELECT pi.status, COUNT(*) AS cnt
            FROM project_ideas pi
            WHERE pi.project_id = ?
            GROUP BY pi.status
            """,
            (project_id,),
        ).fetchall()
        funnel = {"new": 0, "researching": 0, "approved": 0, "produced": 0, "skipped": 0}
        for ir in idea_rows:
            st = str(ir["status"])
            if st in funnel:
                funnel[st] = int(ir["cnt"])

        recent_idea_rows = conn.execute(
            """
            SELECT i.id, i.title, pi.status, pi.priority, pi.project_angle, pi.status_updated_at
            FROM project_ideas pi
            JOIN ideas i ON i.id = pi.idea_id
            WHERE pi.project_id = ?
            ORDER BY pi.status_updated_at DESC
            LIMIT 5
            """,
            (project_id,),
        ).fetchall()

    return {
        "projectId": project_id,
        "competitorChannels": {
            "total": int(ch_row["total"] or 0),
            "active": int(ch_row["active_cnt"] or 0),
            "paused": int(ch_row["paused_cnt"] or 0),
            "error": int(ch_row["error_cnt"] or 0),
        },
        "competitorVideos": {
            "totalValid": int(vid_row["total_valid"] or 0),
            "longForm": int(vid_row["long_form_cnt"] or 0),
            "shorts": int(vid_row["shorts_cnt"] or 0),
            "unknown": int(vid_row["unknown_cnt"] or 0),
        },
        "breakoutFlaggedCount": breakout_flagged,
        "keywords": {
            "total": int(kw_row["total"] or 0),
            "scannedValid": int(kw_row["scanned_valid"] or 0),
        },
        "rss": {
            "linkedFeeds": int(rss_feed_row["linked_feeds"] or 0),
            "brokenFeeds": int(rss_feed_row["broken_feeds"] or 0),
            "recentArticlesCount": recent_rss_articles,
        },
        "ideas": {
            "total": sum(funnel.values()),
            "byStatus": funnel,
            "recent": [
                {
                    "id": r["id"],
                    "title": r["title"],
                    "status": r["status"],
                    "priority": r["priority"],
                    "projectAngle": r["project_angle"],
                    "statusUpdatedAt": r["status_updated_at"],
                }
                for r in recent_idea_rows
            ],
        },
    }
