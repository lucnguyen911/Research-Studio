from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import sqlite3
from typing import Any, Literal

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
