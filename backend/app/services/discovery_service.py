from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
import uuid

import httpx

from app.clients import youtube_client
from app.core.config import SEARCH_MAX_RESULTS_PER_CALL
from app.core.errors import AppError
from app.db.connection import read_db, run_db_sync, write_db
from app.repositories import youtube_repo
from app.services import quota_service

TREND_SESSION_PREFIX = "__TREND__:"

DEFAULT_YOUTUBE_CATEGORIES: list[dict[str, str]] = [
    {"id": "all", "title": "Tất cả danh mục"},
    {"id": "28", "title": "Khoa học & Công nghệ"},
    {"id": "27", "title": "Giáo dục"},
    {"id": "20", "title": "Trò chơi (Gaming)"},
    {"id": "24", "title": "Giải trí"},
    {"id": "25", "title": "Tin tức & Chính trị"},
    {"id": "22", "title": "Mọi người & Blog"},
    {"id": "26", "title": "Hướng dẫn & Phong cách"},
]


def _normalize_now(now_utc: datetime | None) -> datetime:
    if now_utc is None:
        return datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        return now_utc.replace(tzinfo=timezone.utc)
    return now_utc.astimezone(timezone.utc)


def _validate_published_after(raw: str | None) -> str | None:
    if raw is None:
        return None
    cleaned = raw.strip()
    if not cleaned:
        return None
    normalized = f"{cleaned[:-1]}+00:00" if cleaned.endswith(("Z", "z")) else cleaned
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise AppError(
            code="INVALID_PUBLISHED_AFTER",
            message="Tham số publishedAfter phải có định dạng thời gian ISO-8601 hợp lệ.",
            status_code=400,
        ) from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _trend_query_key(region_code: str, category_id: str) -> str:
    clean_region = region_code.strip().upper()[:8] or "VN"
    clean_cat = category_id.strip() or "all"
    return f"{TREND_SESSION_PREFIX}{clean_region}:{clean_cat}"


def get_cached_trends(
    *,
    region_code: str = "VN",
    category_id: str = "all",
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Read cached non-expired YouTube mostPopular trends from SQLite with 0 API quota."""
    now_iso = _normalize_now(now_utc).isoformat()
    key = _trend_query_key(region_code, category_id)
    with read_db() as conn:
        sess = conn.execute(
            """
            SELECT id, region_code, api_fetched_at, api_expires_at
            FROM search_sessions
            WHERE query_text = ? AND api_expires_at > ?
            ORDER BY api_fetched_at DESC
            LIMIT 1
            """,
            (key, now_iso),
        ).fetchone()
        if sess is None:
            return {
                "regionCode": region_code.strip().upper()[:8] or "VN",
                "categoryId": category_id.strip() or "all",
                "fetchedAt": None,
                "expiresAt": None,
                "videos": [],
            }
        item_rows = conn.execute(
            """
            SELECT video_id
            FROM search_session_items
            WHERE session_id = ? AND video_id IS NOT NULL
            ORDER BY position ASC
            """,
            (sess["id"],),
        ).fetchall()
        ordered_ids = [r["video_id"] for r in item_rows]
        videos_map = youtube_repo.get_valid_videos_by_ids(conn, ordered_ids, now_iso=now_iso)
    ordered_videos = [videos_map[vid] for vid in ordered_ids if vid in videos_map]
    return {
        "regionCode": sess["region_code"],
        "categoryId": category_id.strip() or "all",
        "fetchedAt": sess["api_fetched_at"],
        "expiresAt": sess["api_expires_at"],
        "videos": ordered_videos,
    }


async def refresh_trends(
    *,
    region_code: str = "VN",
    category_id: str = "all",
    max_results: int = SEARCH_MAX_RESULTS_PER_CALL,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Fetch official YouTube mostPopular chart (1 unit general_data, 0 Search Queries) and persist <=30d."""
    clean_region = region_code.strip().upper()[:8] or "VN"
    clean_cat = category_id.strip() or "all"
    parsed_items = await youtube_client.fetch_most_popular_videos(
        region_code=clean_region,
        category_id=None if clean_cat == "all" else clean_cat,
        max_results=max_results,
        transport=transport,
        retry_backoff_sec=retry_backoff_sec,
    )

    utc_now = _normalize_now(now_utc)
    fetched_iso, expires_iso = youtube_repo.compute_api_timestamps(utc_now)
    key = _trend_query_key(clean_region, clean_cat)
    session_id = f"trend-{uuid.uuid4().hex[:10]}"

    def _save() -> dict[str, Any]:
        with write_db() as conn:
            ordered_ids: list[str] = []
            for item in parsed_items:
                youtube_repo.upsert_video_and_snapshot(
                    conn=conn,
                    now_utc=utc_now,
                    **item,
                )
                ordered_ids.append(item["video_id"])

            conn.execute("DELETE FROM search_sessions WHERE query_text = ?", (key,))
            conn.execute(
                """
                INSERT INTO search_sessions (
                    id, query_text, object_type, region_code, relevance_language,
                    published_after, order_by, result_count, api_fetched_at, api_expires_at
                ) VALUES (?, ?, 'video', ?, 'vi', NULL, 'mostPopular', ?, ?, ?)
                """,
                (session_id, key, clean_region, len(ordered_ids), fetched_iso, expires_iso),
            )
            for pos, vid in enumerate(ordered_ids, start=1):
                conn.execute(
                    "INSERT INTO search_session_items (session_id, position, video_id, channel_id) VALUES (?, ?, ?, NULL)",
                    (session_id, pos, vid),
                )
            videos_map = youtube_repo.get_valid_videos_by_ids(conn, ordered_ids, now_iso=fetched_iso)

        return {
            "regionCode": clean_region,
            "categoryId": clean_cat,
            "fetchedAt": fetched_iso,
            "expiresAt": expires_iso,
            "videos": [videos_map[vid] for vid in ordered_ids if vid in videos_map],
            "quota": quota_service.get_quota_status(now_utc=utc_now),
        }

    return await run_db_sync(_save)


def list_valid_search_sessions(*, now_utc: datetime | None = None) -> list[dict[str, Any]]:
    """List unexpired manual search sessions (excluding internal trend cache keys) using 0 quota."""
    now_iso = _normalize_now(now_utc).isoformat()
    with read_db() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM search_sessions
            WHERE query_text NOT LIKE ? AND api_expires_at > ?
            ORDER BY api_fetched_at DESC
            LIMIT 30
            """,
            (f"{TREND_SESSION_PREFIX}%", now_iso),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "query": r["query_text"],
            "objectType": r["object_type"],
            "regionCode": r["region_code"],
            "relevanceLanguage": r["relevance_language"],
            "publishedAfter": r["published_after"],
            "orderBy": r["order_by"],
            "resultCount": int(r["result_count"]),
            "apiFetchedAt": r["api_fetched_at"],
            "apiExpiresAt": r["api_expires_at"],
        }
        for r in rows
    ]


def get_search_session_detail(session_id: str, *, now_utc: datetime | None = None) -> dict[str, Any]:
    """Reopen a saved <=30d search session cleanly at 0 YouTube API quota cost."""
    now_iso = _normalize_now(now_utc).isoformat()
    with read_db() as conn:
        sess = conn.execute(
            """
            SELECT *
            FROM search_sessions
            WHERE id = ? AND query_text NOT LIKE ? AND api_expires_at > ?
            """,
            (session_id, f"{TREND_SESSION_PREFIX}%", now_iso),
        ).fetchone()
        if sess is None:
            raise AppError(
                code="SEARCH_SESSION_NOT_FOUND_OR_EXPIRED",
                message="Phiên tìm kiếm không tồn tại hoặc đã quá hạn lưu đệm 30 ngày.",
                status_code=404,
            )
        items = conn.execute(
            "SELECT position, video_id, channel_id FROM search_session_items WHERE session_id = ? ORDER BY position ASC",
            (session_id,),
        ).fetchall()
        video_ids = [r["video_id"] for r in items if r["video_id"]]
        channel_ids = [r["channel_id"] for r in items if r["channel_id"]]
        videos_map = youtube_repo.get_valid_videos_by_ids(conn, video_ids, now_iso=now_iso)
        channels_map = youtube_repo.get_valid_channels_by_ids(conn, channel_ids, now_iso=now_iso)

    return {
        "session": {
            "id": sess["id"],
            "query": sess["query_text"],
            "objectType": sess["object_type"],
            "regionCode": sess["region_code"],
            "relevanceLanguage": sess["relevance_language"],
            "publishedAfter": sess["published_after"],
            "orderBy": sess["order_by"],
            "resultCount": int(sess["result_count"]),
            "apiFetchedAt": sess["api_fetched_at"],
            "apiExpiresAt": sess["api_expires_at"],
        },
        "videos": [videos_map[vid] for vid in video_ids if vid in videos_map],
        "channels": [channels_map[cid] for cid in channel_ids if cid in channels_map],
    }


async def run_free_search(
    *,
    query: str,
    object_type: str = "video",
    region_code: str = "VN",
    relevance_language: str = "vi",
    published_after: str | None = None,
    order_by: str = "relevance",
    max_results: int = SEARCH_MAX_RESULTS_PER_CALL,
    page_token: str | None = None,
    append_session_id: str | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """
    Execute manual free research query:
    1) 1 search.list call (1 Search Queries unit, strictly 0 auto-retries)
    2) batched videos.list or channels.list (1+ General Data unit)
    """
    clean_query = query.strip()
    if not clean_query:
        raise AppError("SEARCH_QUERY_EMPTY", "Vui lòng nhập từ khóa trước khi tìm kiếm.", status_code=400)
    clean_published_after = _validate_published_after(published_after)
    clean_type = "channel" if object_type == "channel" else "video"
    clean_region = region_code.strip().upper()[:8] or "VN"
    clean_lang = relevance_language.strip().lower()[:16] or "vi"
    clean_order = order_by if order_by in ("relevance", "date", "viewCount", "rating") else "relevance"
    clean_append_id = append_session_id.strip() if append_session_id and append_session_id.strip() else None

    found_ids, next_page_token = await youtube_client.search_youtube_page(
        query=clean_query,
        object_type=clean_type,
        region_code=clean_region,
        relevance_language=clean_lang,
        published_after=clean_published_after,
        order_by=clean_order,
        max_results=max_results,
        page_token=page_token,
        transport=transport,
    )

    video_items: list[dict[str, Any]] = []
    channel_items: list[dict[str, Any]] = []
    if clean_type == "video" and found_ids:
        video_items = await youtube_client.fetch_videos_by_ids(
            found_ids,
            is_auto_refresh=False,
            transport=transport,
            retry_backoff_sec=retry_backoff_sec,
        )
    elif clean_type == "channel" and found_ids:
        channel_items = await youtube_client.fetch_channels_by_ids(
            found_ids,
            is_auto_refresh=False,
            transport=transport,
            retry_backoff_sec=retry_backoff_sec,
        )

    utc_now = _normalize_now(now_utc)
    fetched_iso, expires_iso = youtube_repo.compute_api_timestamps(utc_now)
    new_session_id = f"sess-{uuid.uuid4().hex[:10]}"

    def _persist() -> dict[str, Any]:
        with write_db() as conn:
            new_video_ids: list[str] = []
            new_channel_ids: list[str] = []

            if clean_type == "video":
                by_vid = {v["video_id"]: v for v in video_items}
                for vid in found_ids:
                    v = by_vid.get(vid)
                    if v is None:
                        continue
                    youtube_repo.upsert_video_and_snapshot(conn=conn, now_utc=utc_now, **v)
                    new_video_ids.append(vid)
            else:
                by_cid = {c["channel_id"]: c for c in channel_items}
                for cid in found_ids:
                    c = by_cid.get(cid)
                    if c is None:
                        continue
                    youtube_repo.upsert_channel(conn=conn, now_utc=utc_now, **c)
                    new_channel_ids.append(cid)

            existing_sess = None
            if clean_append_id is not None:
                existing_sess = conn.execute(
                    """
                    SELECT *
                    FROM search_sessions
                    WHERE id = ? AND object_type = ? AND query_text NOT LIKE ?
                    """,
                    (clean_append_id, clean_type, f"{TREND_SESSION_PREFIX}%"),
                ).fetchone()

            if existing_sess is not None:
                active_session_id = str(existing_sess["id"])
                existing_rows = conn.execute(
                    "SELECT position, video_id, channel_id FROM search_session_items WHERE session_id = ? ORDER BY position ASC",
                    (active_session_id,),
                ).fetchall()
                existing_video_ids = [str(r["video_id"]) for r in existing_rows if r["video_id"]]
                existing_channel_ids = [str(r["channel_id"]) for r in existing_rows if r["channel_id"]]
                seen_vids = set(existing_video_ids)
                seen_cids = set(existing_channel_ids)
                delta_vids = [vid for vid in new_video_ids if vid not in seen_vids and not seen_vids.add(vid)]
                delta_cids = [cid for cid in new_channel_ids if cid not in seen_cids and not seen_cids.add(cid)]
                next_pos = (max((int(r["position"]) for r in existing_rows), default=0)) + 1

                for vid in delta_vids:
                    conn.execute(
                        "INSERT INTO search_session_items (session_id, position, video_id, channel_id) VALUES (?, ?, ?, NULL)",
                        (active_session_id, next_pos, vid),
                    )
                    next_pos += 1
                for cid in delta_cids:
                    conn.execute(
                        "INSERT INTO search_session_items (session_id, position, video_id, channel_id) VALUES (?, ?, NULL, ?)",
                        (active_session_id, next_pos, cid),
                    )
                    next_pos += 1

                ordered_video_ids = existing_video_ids + delta_vids
                ordered_channel_ids = existing_channel_ids + delta_cids
                result_count = len(ordered_video_ids) + len(ordered_channel_ids)
                conn.execute(
                    """
                    UPDATE search_sessions
                    SET result_count = ?, api_fetched_at = ?, api_expires_at = ?
                    WHERE id = ?
                    """,
                    (result_count, fetched_iso, expires_iso, active_session_id),
                )
                session_query = str(existing_sess["query_text"])
                session_region = str(existing_sess["region_code"])
                session_lang = str(existing_sess["relevance_language"])
                session_pub_after = existing_sess["published_after"]
                session_order = str(existing_sess["order_by"])
            else:
                active_session_id = new_session_id
                ordered_video_ids = new_video_ids
                ordered_channel_ids = new_channel_ids
                result_count = len(ordered_video_ids) + len(ordered_channel_ids)
                conn.execute(
                    """
                    INSERT INTO search_sessions (
                        id, query_text, object_type, region_code, relevance_language,
                        published_after, order_by, result_count, api_fetched_at, api_expires_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        active_session_id,
                        clean_query,
                        clean_type,
                        clean_region,
                        clean_lang,
                        clean_published_after,
                        clean_order,
                        result_count,
                        fetched_iso,
                        expires_iso,
                    ),
                )
                pos = 1
                for vid in ordered_video_ids:
                    conn.execute(
                        "INSERT INTO search_session_items (session_id, position, video_id, channel_id) VALUES (?, ?, ?, NULL)",
                        (active_session_id, pos, vid),
                    )
                    pos += 1
                for cid in ordered_channel_ids:
                    conn.execute(
                        "INSERT INTO search_session_items (session_id, position, video_id, channel_id) VALUES (?, ?, NULL, ?)",
                        (active_session_id, pos, cid),
                    )
                    pos += 1
                session_query = clean_query
                session_region = clean_region
                session_lang = clean_lang
                session_pub_after = clean_published_after
                session_order = clean_order

            videos_map = youtube_repo.get_valid_videos_by_ids(conn, ordered_video_ids, now_iso=fetched_iso)
            channels_map = youtube_repo.get_valid_channels_by_ids(conn, ordered_channel_ids, now_iso=fetched_iso)

        return {
            "session": {
                "id": active_session_id,
                "query": session_query,
                "objectType": clean_type,
                "regionCode": session_region,
                "relevanceLanguage": session_lang,
                "publishedAfter": session_pub_after,
                "orderBy": session_order,
                "resultCount": result_count,
                "apiFetchedAt": fetched_iso,
                "apiExpiresAt": expires_iso,
            },
            "videos": [videos_map[vid] for vid in ordered_video_ids if vid in videos_map],
            "channels": [channels_map[cid] for cid in ordered_channel_ids if cid in channels_map],
            "nextPageToken": next_page_token,
            "quota": quota_service.get_quota_status(now_utc=utc_now),
        }

    return await run_db_sync(_persist)


def get_video_detail(
    video_id: str,
    *,
    project_id: str | None = None,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Read video details, respecting 30-day API TTL while keeping user manual format & breakout notes."""
    video = youtube_repo.get_video_record(video_id, require_valid_api=False, now_utc=now_utc)
    if video is None:
        raise AppError("VIDEO_NOT_FOUND", "Không tìm thấy video yêu cầu.", status_code=404)

    channel = (
        youtube_repo.get_channel_record(video["channelId"], require_valid_api=True, now_utc=now_utc)
        if video.get("channelId")
        else None
    )

    breakout: dict[str, Any] | None = None
    linked_ideas: list[dict[str, Any]] = []
    with read_db() as conn:
        if project_id:
            pv = conn.execute(
                "SELECT is_user_breakout, notes, marked_at FROM project_videos WHERE project_id = ? AND video_id = ?",
                (project_id, video_id),
            ).fetchone()
            breakout = {
                "flagged": bool(pv["is_user_breakout"]) if pv else False,
                "notes": pv["notes"] if pv else "",
                "markedAt": pv["marked_at"] if pv else None,
            }
        idea_rows = conn.execute(
            "SELECT id, title, updated_at FROM ideas WHERE linked_video_id = ? ORDER BY updated_at DESC",
            (video_id,),
        ).fetchall()
        linked_ideas = [{"id": r["id"], "title": r["title"], "updatedAt": r["updated_at"]} for r in idea_rows]

    return {
        "video": video,
        "channel": channel,
        "breakout": breakout,
        "linkedIdeas": linked_ideas,
    }


def get_channel_detail(channel_id: str, *, now_utc: datetime | None = None) -> dict[str, Any]:
    """Read channel details, unexpired cached videos of that channel, and linked project IDs."""
    channel = youtube_repo.get_channel_record(channel_id, require_valid_api=False, now_utc=now_utc)
    if channel is None:
        raise AppError("CHANNEL_NOT_FOUND", "Không tìm thấy kênh YouTube yêu cầu.", status_code=404)

    videos = youtube_repo.list_channel_valid_videos(channel_id, now_utc=now_utc)
    with read_db() as conn:
        rows = conn.execute(
            """
            SELECT p.id, p.name, pc.status, pc.notes
            FROM project_channels pc
            JOIN projects p ON p.id = pc.project_id
            WHERE pc.channel_id = ?
            ORDER BY p.name ASC
            """,
            (channel_id,),
        ).fetchall()
    linked_projects = [
        {"projectId": r["id"], "projectName": r["name"], "status": r["status"], "notes": r["notes"]}
        for r in rows
    ]
    return {
        "channel": channel,
        "videos": videos,
        "linkedProjects": linked_projects,
    }
