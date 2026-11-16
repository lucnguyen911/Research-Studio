from __future__ import annotations

from datetime import datetime, timezone
import re
import sqlite3
from typing import Any
from urllib.parse import urlsplit
import uuid

import httpx

from app.clients import youtube_client
from app.core.config import COMPETITOR_VIDEOS_PER_REFRESH
from app.core.errors import AppError
from app.db.connection import read_db, run_db_sync, write_db
from app.repositories import project_repo, youtube_repo
from app.services import quota_service
from app.services.scheduler_service import in_flight_registry

_CHANNEL_ID_RE = re.compile(r"^UC[A-Za-z0-9_-]{20,40}$")
_HANDLE_RE = re.compile(r"^@[A-Za-z0-9._-]{2,80}$")
_BARE_HANDLE_RE = re.compile(r"^[A-Za-z0-9._-]{3,80}$")
_ALLOWED_YOUTUBE_HOSTS = frozenset(
    {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"}
)
_FATAL_YOUTUBE_CODES = frozenset(
    {
        "YOUTUBE_API_KEY_MISSING",
        "YOUTUBE_API_KEY_INVALID",
        "YOUTUBE_API_KEY_UNREADABLE",
        "LEGAL_CONSENT_REQUIRED",
        "QUOTA_GENERAL_EXHAUSTED",
        "AUTO_REFRESH_QUOTA_CAP_REACHED",
    }
)


def _normalize_now(now_utc: datetime | None) -> datetime:
    if now_utc is None:
        return datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        return now_utc.replace(tzinfo=timezone.utc)
    return now_utc.astimezone(timezone.utc)


def parse_competitor_identifier(raw: str) -> tuple[str | None, str | None]:
    """
    Parse channel_id, @handle, or YouTube channel URL strictly without calling search.list.

    Rejects legacy /c/ and /user/ URLs because resolving them safely without guessing
    would require a paid Search Queries call.
    """
    text = raw.strip()
    if not text:
        raise AppError(
            code="INVALID_CHANNEL_IDENTIFIER",
            message="Vui lòng nhập URL kênh YouTube, @handle hoặc channel_id (UC...).",
            status_code=400,
        )

    if _CHANNEL_ID_RE.fullmatch(text):
        return text, None
    if _HANDLE_RE.fullmatch(text):
        return None, text

    lowered = text.lower()
    if "://" in text or "youtube.com" in lowered or "youtu.be" in lowered:
        normalized_url = text if "://" in text else f"https://{text}"
        parsed = urlsplit(normalized_url)
        host = (parsed.hostname or "").lower()
        if host not in _ALLOWED_YOUTUBE_HOSTS:
            raise AppError(
                code="UNSUPPORTED_CHANNEL_URL",
                message="URL không thuộc tên miền youtube.com hợp lệ (hãy dùng @handle hoặc /channel/UC...).",
                status_code=400,
            )
        segments = [seg.strip() for seg in parsed.path.split("/") if seg.strip()]
        if not segments:
            raise AppError(
                code="UNSUPPORTED_CHANNEL_URL",
                message="URL kênh thiếu định danh @handle hoặc /channel/UC....",
                status_code=400,
            )
        if _HANDLE_RE.fullmatch(segments[0]):
            return None, segments[0]
        if segments[0].lower() == "channel" and len(segments) >= 2 and _CHANNEL_ID_RE.fullmatch(segments[1]):
            return segments[1], None
        if segments[0].lower() in ("c", "user"):
            raise AppError(
                code="UNSUPPORTED_CHANNEL_URL",
                message="URL dạng /c/ hoặc /user/ cũ không được tự động phân giải qua search.list để bảo vệ quota. Hãy dùng @handle hoặc UC....",
                status_code=400,
            )
        raise AppError(
            code="UNSUPPORTED_CHANNEL_URL",
            message="Chỉ hỗ trợ URL dạng youtube.com/@handle hoặc youtube.com/channel/UC....",
            status_code=400,
        )

    if _BARE_HANDLE_RE.fullmatch(text):
        return None, f"@{text}"

    raise AppError(
        code="INVALID_CHANNEL_IDENTIFIER",
        message="Định dạng kênh không hợp lệ. Hỗ trợ: @handle, UC..., hoặc URL youtube.com/@handle.",
        status_code=400,
    )


def _find_reusable_cached_channel(
    channel_id: str | None,
    handle: str | None,
    *,
    now_iso: str,
) -> str | None:
    with read_db() as conn:
        row: sqlite3.Row | None = None
        if channel_id:
            row = conn.execute(
                """
                SELECT channel_id, uploads_playlist_id, api_expires_at, api_purged_at
                FROM youtube_channels
                WHERE channel_id = ?
                """,
                (channel_id,),
            ).fetchone()
        elif handle:
            row = conn.execute(
                """
                SELECT channel_id, uploads_playlist_id, api_expires_at, api_purged_at
                FROM youtube_channels
                WHERE lower(handle) = lower(?)
                """,
                (handle,),
            ).fetchone()

        if row is None or row["api_purged_at"] is not None:
            return None
        expires = row["api_expires_at"]
        if not expires or expires <= now_iso or not row["uploads_playlist_id"]:
            return None

        vid_row = conn.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM youtube_videos
            WHERE channel_id = ?
              AND api_purged_at IS NULL
              AND api_expires_at IS NOT NULL
              AND api_expires_at > ?
            """,
            (row["channel_id"], now_iso),
        ).fetchone()
        if int(vid_row["cnt"]) > 0:
            return str(row["channel_id"])
    return None


async def _fetch_and_persist_channel_bundle(
    *,
    channel_id: str | None = None,
    handle: str | None = None,
    is_auto_refresh: bool = False,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    channel_payload = await youtube_client.fetch_channel_by_identifier(
        channel_id=channel_id,
        for_handle=handle,
        is_auto_refresh=is_auto_refresh,
        transport=transport,
        retry_backoff_sec=retry_backoff_sec,
    )
    if channel_payload is None:
        raise AppError(
            code="CHANNEL_NOT_FOUND_ON_YOUTUBE",
            message="Không tìm thấy kênh YouTube tương ứng với thông tin đã nhập.",
            status_code=404,
        )

    units_spent = 1
    video_items: list[dict[str, Any]] = []
    uploads_id = channel_payload.get("uploads_playlist_id")
    if isinstance(uploads_id, str) and uploads_id:
        units_spent += 1
        video_ids = await youtube_client.fetch_playlist_video_ids(
            uploads_id,
            max_results=COMPETITOR_VIDEOS_PER_REFRESH,
            is_auto_refresh=is_auto_refresh,
            transport=transport,
            retry_backoff_sec=retry_backoff_sec,
        )
        if video_ids:
            units_spent += (len(video_ids) + 49) // 50
            video_items = await youtube_client.fetch_videos_by_ids(
                video_ids,
                is_auto_refresh=is_auto_refresh,
                transport=transport,
                retry_backoff_sec=retry_backoff_sec,
            )

    utc_now = _normalize_now(now_utc)

    def _save() -> str:
        with write_db() as conn:
            youtube_repo.upsert_channel(conn=conn, now_utc=utc_now, **channel_payload)
            for item in video_items:
                if not item.get("channel_id"):
                    item["channel_id"] = channel_payload["channel_id"]
                youtube_repo.upsert_video_and_snapshot(conn=conn, now_utc=utc_now, **item)
        return str(channel_payload["channel_id"])

    resolved_id = await run_db_sync(_save)
    return {"channelId": resolved_id, "videosFetched": len(video_items), "unitsSpent": units_spent}


async def add_competitor_to_project(
    project_id: str,
    identifier: str,
    notes: str = "",
    *,
    force_refresh: bool = False,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Resolve and attach a competitor channel to a Project using 0 Search Queries units."""
    await run_db_sync(project_repo.get_project, project_id)
    channel_id, handle = parse_competitor_identifier(identifier)

    utc_now = _normalize_now(now_utc)
    now_iso = utc_now.isoformat()

    reused_id: str | None = None
    if not force_refresh:
        reused_id = await run_db_sync(
            _find_reusable_cached_channel,
            channel_id,
            handle,
            now_iso=now_iso,
        )

    fetched_from_api = False
    if reused_id is not None:
        resolved_channel_id = reused_id
    else:
        bundle = await _fetch_and_persist_channel_bundle(
            channel_id=channel_id,
            handle=handle,
            is_auto_refresh=False,
            transport=transport,
            retry_backoff_sec=retry_backoff_sec,
            now_utc=utc_now,
        )
        resolved_channel_id = bundle["channelId"]
        fetched_from_api = True

    def _link() -> None:
        with write_db() as conn:
            existing = conn.execute(
                "SELECT id, notes FROM project_channels WHERE project_id = ? AND channel_id = ?",
                (project_id, resolved_channel_id),
            ).fetchone()
            clean_notes = notes.strip()
            if existing is None:
                conn.execute(
                    """
                    INSERT INTO project_channels (id, project_id, channel_id, status, notes, added_at)
                    VALUES (?, ?, ?, 'active', ?, ?)
                    """,
                    (f"pc-{uuid.uuid4().hex[:10]}", project_id, resolved_channel_id, clean_notes, now_iso),
                )
            elif clean_notes:
                conn.execute(
                    "UPDATE project_channels SET notes = ?, status = 'active' WHERE id = ?",
                    (clean_notes, existing["id"]),
                )

    await run_db_sync(_link)
    data = await run_db_sync(list_project_competitors, project_id, now_utc=utc_now)
    return {
        **data,
        "addedChannelId": resolved_channel_id,
        "reusedCache": not fetched_from_api,
        "quota": await run_db_sync(quota_service.get_quota_status, now_utc=utc_now),
    }


async def refresh_competitor_channel(
    channel_id: str,
    *,
    is_auto_refresh: bool = False,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Refresh one canonical channel and up to 40 recent videos once for all Projects sharing it."""
    lock_key = f"channel:{channel_id}"
    if not await in_flight_registry.try_acquire(lock_key):
        if is_auto_refresh:
            return {"channelId": channel_id, "videosFetched": 0, "skippedInFlight": True}
        raise AppError(
            code="REFRESH_IN_PROGRESS",
            message="Kênh đối thủ này đang được làm mới, vui lòng đợi hoàn tất.",
            status_code=409,
        )

    utc_now = _normalize_now(now_utc)
    try:
        bundle = await _fetch_and_persist_channel_bundle(
            channel_id=channel_id,
            handle=None,
            is_auto_refresh=is_auto_refresh,
            transport=transport,
            retry_backoff_sec=retry_backoff_sec,
            now_utc=utc_now,
        )
    finally:
        await in_flight_registry.release(lock_key)

    def _clear_errors() -> None:
        with write_db() as conn:
            conn.execute(
                "UPDATE project_channels SET status = 'active' WHERE channel_id = ? AND status = 'error'",
                (channel_id,),
            )

    await run_db_sync(_clear_errors)
    return bundle


async def refresh_project_competitors(
    project_id: str,
    *,
    channel_id: str | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Refresh one or all tracked channels of a Project with per-channel error isolation."""
    await run_db_sync(project_repo.get_project, project_id)

    def _select_targets() -> list[str]:
        with read_db() as conn:
            if channel_id:
                row = conn.execute(
                    "SELECT channel_id FROM project_channels WHERE project_id = ? AND channel_id = ?",
                    (project_id, channel_id),
                ).fetchone()
                if row is None:
                    raise AppError("COMPETITOR_NOT_LINKED", "Kênh đối thủ không thuộc Project này.", status_code=404)
                return [str(row["channel_id"])]
            rows = conn.execute(
                """
                SELECT channel_id
                FROM project_channels
                WHERE project_id = ? AND status != 'paused'
                ORDER BY added_at DESC
                """,
                (project_id,),
            ).fetchall()
            return [str(r["channel_id"]) for r in rows]

    targets = await run_db_sync(_select_targets)
    utc_now = _normalize_now(now_utc)
    ok_count = 0
    error_count = 0
    results: list[dict[str, Any]] = []

    for cid in targets:
        try:
            bundle = await refresh_competitor_channel(
                cid,
                is_auto_refresh=False,
                transport=transport,
                retry_backoff_sec=retry_backoff_sec,
                now_utc=utc_now,
            )
            ok_count += 1
            results.append({"channelId": cid, "status": "ok", "videosFetched": bundle["videosFetched"]})
        except AppError as exc:
            if exc.code in _FATAL_YOUTUBE_CODES:
                if ok_count == 0:
                    raise
                results.append(
                    {
                        "channelId": cid,
                        "status": "skipped_fatal",
                        "errorCode": exc.code,
                        "errorMessage": exc.message,
                    }
                )
                break
            error_count += 1
            await run_db_sync(
                _mark_project_channel_error,
                project_id,
                cid,
            )
            results.append(
                {
                    "channelId": cid,
                    "status": "error",
                    "errorCode": exc.code,
                    "errorMessage": exc.message,
                }
            )

    listing = await run_db_sync(list_project_competitors, project_id, now_utc=utc_now)
    return {
        **listing,
        "refreshedCount": len(results),
        "okCount": ok_count,
        "errorCount": error_count,
        "results": results,
        "quota": await run_db_sync(quota_service.get_quota_status, now_utc=utc_now),
    }


def _mark_project_channel_error(project_id: str, channel_id: str) -> None:
    with write_db() as conn:
        conn.execute(
            "UPDATE project_channels SET status = 'error' WHERE project_id = ? AND channel_id = ?",
            (project_id, channel_id),
        )


def mark_channel_error_globally(channel_id: str) -> None:
    """Isolate an unavailable/deleted channel across all active project links so scheduler stops polling it."""
    with write_db() as conn:
        conn.execute(
            "UPDATE project_channels SET status = 'error' WHERE channel_id = ? AND status = 'active'",
            (channel_id,),
        )


def update_project_competitor(
    project_id: str,
    channel_id: str,
    *,
    status: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    project_repo.get_project(project_id)
    with write_db() as conn:
        existing = conn.execute(
            "SELECT * FROM project_channels WHERE project_id = ? AND channel_id = ?",
            (project_id, channel_id),
        ).fetchone()
        if existing is None:
            raise AppError("COMPETITOR_NOT_LINKED", "Không tìm thấy kênh đối thủ trong Project này.", status_code=404)
        next_status = existing["status"]
        if status is not None:
            if status not in ("active", "paused", "error"):
                raise AppError("INVALID_COMPETITOR_STATUS", "Trạng thái theo dõi không hợp lệ.", status_code=400)
            next_status = status
        next_notes = existing["notes"] if notes is None else notes.strip()
        conn.execute(
            "UPDATE project_channels SET status = ?, notes = ? WHERE id = ?",
            (next_status, next_notes, existing["id"]),
        )
    return list_project_competitors(project_id)


def remove_competitor_from_project(project_id: str, channel_id: str) -> dict[str, Any]:
    """Detach competitor from Project without deleting canonical channel or affecting other Projects."""
    project_repo.get_project(project_id)
    with write_db() as conn:
        cur = conn.execute(
            "DELETE FROM project_channels WHERE project_id = ? AND channel_id = ?",
            (project_id, channel_id),
        )
        if cur.rowcount == 0:
            raise AppError("COMPETITOR_NOT_LINKED", "Kênh đối thủ không gắn với Project này.", status_code=404)
    return list_project_competitors(project_id)


def list_project_competitors(project_id: str, *, now_utc: datetime | None = None) -> dict[str, Any]:
    """Read competitor channels and their unexpired <=30d videos for one Project at 0 quota."""
    project_repo.get_project(project_id)
    now_iso = _normalize_now(now_utc).isoformat()

    with read_db() as conn:
        channel_rows = conn.execute(
            """
            SELECT
                pc.channel_id,
                pc.status,
                pc.notes,
                pc.added_at,
                c.title,
                c.handle,
                c.country,
                c.thumbnail_url,
                c.subscriber_count,
                c.video_count,
                c.api_fetched_at,
                c.api_expires_at,
                c.api_purged_at,
                (
                    SELECT COUNT(*) FROM project_channels pc2 WHERE pc2.channel_id = pc.channel_id
                ) AS shared_projects_count,
                (
                    SELECT COUNT(*)
                    FROM youtube_videos yv
                    WHERE yv.channel_id = pc.channel_id
                      AND yv.api_purged_at IS NULL
                      AND yv.api_expires_at IS NOT NULL
                      AND yv.api_expires_at > ?
                ) AS cached_video_count
            FROM project_channels pc
            JOIN youtube_channels c ON c.channel_id = pc.channel_id
            WHERE pc.project_id = ?
            ORDER BY pc.added_at DESC, c.title COLLATE NOCASE ASC
            """,
            (now_iso, project_id),
        ).fetchall()

        channels: list[dict[str, Any]] = []
        channel_ids: list[str] = []
        for r in channel_rows:
            cid = str(r["channel_id"])
            channel_ids.append(cid)
            expires = r["api_expires_at"]
            has_valid = bool(expires and expires > now_iso and r["api_purged_at"] is None)
            channels.append(
                {
                    "channelId": cid,
                    "projectId": project_id,
                    "status": r["status"],
                    "notes": r["notes"],
                    "addedAt": r["added_at"],
                    "sharedProjectsCount": int(r["shared_projects_count"]),
                    "cachedVideoCount": int(r["cached_video_count"]),
                    "hasValidApiData": has_valid,
                    "apiPurged": not has_valid,
                    "title": r["title"] if has_valid else None,
                    "handle": r["handle"] if has_valid else None,
                    "country": r["country"] if has_valid else None,
                    "thumbnailUrl": r["thumbnail_url"] if has_valid else None,
                    "subscriberCount": r["subscriber_count"] if has_valid else None,
                    "videoCount": r["video_count"] if has_valid else None,
                    "apiFetchedAt": r["api_fetched_at"] if has_valid else None,
                    "apiExpiresAt": expires if has_valid else None,
                }
            )

        videos: list[dict[str, Any]] = []
        if channel_ids:
            placeholders = ",".join("?" for _ in channel_ids)
            vid_rows = conn.execute(
                f"""
                SELECT v.*, ufl.manual_format, pv.is_user_breakout, pv.notes AS breakout_notes
                FROM youtube_videos v
                LEFT JOIN user_video_format_labels ufl ON ufl.video_id = v.video_id
                LEFT JOIN project_videos pv ON pv.video_id = v.video_id AND pv.project_id = ?
                WHERE v.channel_id IN ({placeholders})
                  AND v.api_purged_at IS NULL
                  AND v.api_expires_at IS NOT NULL
                  AND v.api_expires_at > ?
                ORDER BY v.published_at DESC, v.view_count DESC
                """,
                (project_id, *channel_ids, now_iso),
            ).fetchall()
            snaps = youtube_repo._load_snapshots_map(conn, [str(vr["video_id"]) for vr in vid_rows], now_iso)
            for vr in vid_rows:
                dto = youtube_repo._row_to_video_dto(vr, snaps.get(str(vr["video_id"]), []), now_iso)
                dto["isUserBreakout"] = bool(vr["is_user_breakout"]) if vr["is_user_breakout"] is not None else False
                dto["breakoutNotes"] = vr["breakout_notes"] or ""
                videos.append(dto)

    return {
        "projectId": project_id,
        "channels": channels,
        "videos": videos,
    }
