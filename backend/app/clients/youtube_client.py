from __future__ import annotations

import asyncio
from typing import Any

import httpx

from app.core.config import (
    HTTP_CONNECT_TIMEOUT_SEC,
    HTTP_READ_TIMEOUT_SEC,
    HTTP_RETRY_MAX_ATTEMPTS,
    SEARCH_MAX_RESULTS_PER_CALL,
)
from app.core.errors import AppError
from app.db.connection import run_db_sync
from app.repositories import settings_repo
from app.services import quota_service
from app.services.format_classifier import parse_iso8601_duration_seconds

YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3"

_QUOTA_EXHAUSTED_REASONS = frozenset({"quotaExceeded", "dailyLimitExceeded"})
_KEY_OR_AUTH_REASONS = frozenset({"keyInvalid", "accessNotConfigured", "ipRefererBlocked"})
_RETRYABLE_STATUS_CODES = frozenset({429, 502, 503, 504})


def _extract_youtube_error_reason(response: httpx.Response) -> tuple[str | None, str | None]:
    try:
        payload = response.json()
    except ValueError:
        return None, None
    err = payload.get("error")
    if not isinstance(err, dict):
        return None, None
    message = str(err.get("message") or "").strip() or None
    errors = err.get("errors")
    if isinstance(errors, list) and errors:
        first = errors[0]
        if isinstance(first, dict):
            reason = str(first.get("reason") or "").strip() or None
            return reason, message
    return None, message


async def call_youtube_api(
    endpoint: str,
    params: dict[str, Any],
    *,
    bucket: quota_service.QuotaBucket,
    is_auto_refresh: bool = False,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
) -> dict[str, Any]:
    """
    Call YouTube Data API v3 with strict dual-bucket accounting:
    - Reserves 1 unit per wire attempt atomically in BEGIN IMMEDIATE.
    - Refunds ONLY on local httpx.ConnectError before TCP/TLS establishment.
    - Enforces 0 auto-retries on search_queries (search.list).
    - Allows up to HTTP_RETRY_MAX_ATTEMPTS retries on transient 429/502/503/504 for general_data.
    """
    api_key = await run_db_sync(settings_repo.get_decrypted_youtube_api_key)
    max_attempts = 1 if bucket == "search_queries" else (1 + HTTP_RETRY_MAX_ATTEMPTS)
    timeout = httpx.Timeout(timeout=HTTP_READ_TIMEOUT_SEC, connect=HTTP_CONNECT_TIMEOUT_SEC)
    url = f"{YOUTUBE_API_BASE_URL}/{endpoint.lstrip('/')}"
    query_params = {**params, "key": api_key}

    async with httpx.AsyncClient(timeout=timeout, transport=transport, follow_redirects=False) as client:
        for attempt in range(1, max_attempts + 1):
            call_log_id = await run_db_sync(
                quota_service.reserve_quota_unit,
                bucket,
                endpoint,
                units=1,
                is_auto_refresh=is_auto_refresh,
            )
            try:
                response = await client.get(url, params=query_params)
            except httpx.ConnectError as exc:
                await run_db_sync(quota_service.refund_quota_on_connect_error, call_log_id)
                raise AppError(
                    code="YOUTUBE_NETWORK_UNREACHABLE",
                    message="Không kết nối được tới máy chủ YouTube Data API v3 (đã hoàn lại 1 unit dự giữ).",
                    status_code=503,
                ) from exc
            except httpx.TimeoutException as exc:
                await run_db_sync(
                    quota_service.finalize_quota_call,
                    call_log_id,
                    status_code=None,
                    outcome="timeout",
                )
                raise AppError(
                    code="YOUTUBE_TIMEOUT",
                    message="Kết nối tới YouTube Data API v3 vượt quá thời gian chờ.",
                    status_code=504,
                ) from exc
            except httpx.HTTPError as exc:
                await run_db_sync(
                    quota_service.finalize_quota_call,
                    call_log_id,
                    status_code=None,
                    outcome="transport_error",
                )
                raise AppError(
                    code="YOUTUBE_TRANSPORT_ERROR",
                    message="Lỗi truyền tải khi giao tiếp với YouTube Data API v3.",
                    status_code=502,
                ) from exc

            if response.status_code == 200:
                await run_db_sync(
                    quota_service.finalize_quota_call,
                    call_log_id,
                    status_code=200,
                    outcome="ok",
                )
                try:
                    data = response.json()
                except ValueError as exc:
                    raise AppError(
                        code="YOUTUBE_INVALID_RESPONSE",
                        message="Phản hồi từ YouTube Data API không phải JSON hợp lệ.",
                        status_code=502,
                    ) from exc
                if not isinstance(data, dict):
                    raise AppError(
                        code="YOUTUBE_INVALID_RESPONSE",
                        message="Cấu trúc JSON từ YouTube Data API không hợp lệ.",
                        status_code=502,
                    )
                return data

            reason, upstream_message = _extract_youtube_error_reason(response)

            if response.status_code == 403 and reason in _QUOTA_EXHAUSTED_REASONS:
                await run_db_sync(
                    quota_service.mark_bucket_exhausted_403,
                    bucket,
                    call_log_id=call_log_id,
                )
                raise AppError(
                    code="QUOTA_SEARCH_EXHAUSTED" if bucket == "search_queries" else "QUOTA_GENERAL_EXHAUSTED",
                    message="YouTube báo hết hạn mức quota hàng ngày cho bucket này (403 quotaExceeded).",
                    status_code=429,
                    details={"bucket": bucket, "reason": reason},
                )

            if response.status_code in (400, 403) and reason in _KEY_OR_AUTH_REASONS:
                await run_db_sync(
                    quota_service.finalize_quota_call,
                    call_log_id,
                    status_code=response.status_code,
                    outcome="auth_or_key_error",
                )
                raise AppError(
                    code="YOUTUBE_API_KEY_INVALID",
                    message="YouTube API Key không hợp lệ hoặc chưa kích hoạt YouTube Data API v3.",
                    status_code=400,
                    details={"reason": reason},
                )

            if (
                bucket == "general_data"
                and response.status_code in _RETRYABLE_STATUS_CODES
                and attempt < max_attempts
            ):
                await run_db_sync(
                    quota_service.finalize_quota_call,
                    call_log_id,
                    status_code=response.status_code,
                    outcome="transient_retry",
                )
                if retry_backoff_sec > 0:
                    await asyncio.sleep(retry_backoff_sec * attempt)
                continue

            await run_db_sync(
                quota_service.finalize_quota_call,
                call_log_id,
                status_code=response.status_code,
                outcome="http_error",
            )
            raise AppError(
                code="YOUTUBE_UPSTREAM_ERROR",
                message=upstream_message or f"YouTube Data API trả về lỗi HTTP {response.status_code}.",
                status_code=502,
                details={"statusCode": response.status_code, "reason": reason},
            )

    raise AppError("YOUTUBE_UPSTREAM_ERROR", "Không thể hoàn tất yêu cầu tới YouTube Data API.", status_code=502)


def _pick_thumbnail_url(snippet: dict[str, Any]) -> str | None:
    thumbs = snippet.get("thumbnails")
    if not isinstance(thumbs, dict):
        return None
    for size in ("high", "medium", "default", "standard"):
        entry = thumbs.get(size)
        if isinstance(entry, dict) and entry.get("url"):
            return str(entry["url"])
    return None


def _to_int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_youtube_video_item(item: dict[str, Any]) -> dict[str, Any]:
    """Parse raw YouTube videos.list item into canonical fields without prohibited derived metrics."""
    snippet = item.get("snippet") if isinstance(item.get("snippet"), dict) else {}
    content = item.get("contentDetails") if isinstance(item.get("contentDetails"), dict) else {}
    stats = item.get("statistics") if isinstance(item.get("statistics"), dict) else {}
    live = item.get("liveStreamingDetails")

    raw_tags = snippet.get("tags")
    tags = [str(tag).strip() for tag in raw_tags if isinstance(tag, str) and tag.strip()] if isinstance(raw_tags, list) else []
    live_broadcast_content = str(snippet.get("liveBroadcastContent") or "").lower()
    is_live = live_broadcast_content in ("live", "upcoming") or (
        isinstance(live, dict) and bool(live.get("actualStartTime")) and not live.get("actualEndTime")
    )

    return {
        "video_id": str(item.get("id") or "").strip(),
        "channel_id": str(snippet.get("channelId") or "").strip() or None,
        "title": str(snippet.get("title") or "").strip() or None,
        "description": str(snippet.get("description") or "").strip() or "",
        "channel_title": str(snippet.get("channelTitle") or "").strip() or None,
        "published_at": str(snippet.get("publishedAt") or "").strip() or None,
        "thumbnail_url": _pick_thumbnail_url(snippet),
        "duration_seconds": parse_iso8601_duration_seconds(content.get("duration")),
        "tags": tags,
        "view_count": _to_int_or_none(stats.get("viewCount")),
        "like_count": _to_int_or_none(stats.get("likeCount")),
        "comment_count": _to_int_or_none(stats.get("commentCount")),
        "is_live_streaming": is_live,
    }


def parse_youtube_channel_item(item: dict[str, Any]) -> dict[str, Any]:
    """Parse raw YouTube channels.list item into canonical channel fields."""
    snippet = item.get("snippet") if isinstance(item.get("snippet"), dict) else {}
    content = item.get("contentDetails") if isinstance(item.get("contentDetails"), dict) else {}
    stats = item.get("statistics") if isinstance(item.get("statistics"), dict) else {}
    related = content.get("relatedPlaylists") if isinstance(content.get("relatedPlaylists"), dict) else {}
    custom_url = str(snippet.get("customUrl") or "").strip() or None

    return {
        "channel_id": str(item.get("id") or "").strip(),
        "title": str(snippet.get("title") or "").strip() or None,
        "handle": custom_url,
        "description": str(snippet.get("description") or "").strip() or "",
        "country": str(snippet.get("country") or "").strip() or None,
        "thumbnail_url": _pick_thumbnail_url(snippet),
        "uploads_playlist_id": str(related.get("uploads") or "").strip() or None,
        "subscriber_count": _to_int_or_none(stats.get("subscriberCount")),
        "video_count": _to_int_or_none(stats.get("videoCount")),
        "published_at": str(snippet.get("publishedAt") or "").strip() or None,
    }


def _dedup_ordered(ids: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in ids:
        cleaned = raw.strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            result.append(cleaned)
    return result


async def fetch_videos_by_ids(
    video_ids: list[str],
    *,
    is_auto_refresh: bool = False,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
) -> list[dict[str, Any]]:
    unique_ids = _dedup_ordered(video_ids)
    parsed: list[dict[str, Any]] = []
    for start in range(0, len(unique_ids), 50):
        chunk = unique_ids[start : start + 50]
        payload = await call_youtube_api(
            "videos",
            {
                "part": "snippet,contentDetails,statistics,liveStreamingDetails",
                "id": ",".join(chunk),
                "maxResults": len(chunk),
            },
            bucket="general_data",
            is_auto_refresh=is_auto_refresh,
            transport=transport,
            retry_backoff_sec=retry_backoff_sec,
        )
        for item in payload.get("items") or []:
            if isinstance(item, dict) and item.get("id"):
                parsed.append(parse_youtube_video_item(item))
    return parsed


async def fetch_channels_by_ids(
    channel_ids: list[str],
    *,
    is_auto_refresh: bool = False,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
) -> list[dict[str, Any]]:
    unique_ids = _dedup_ordered(channel_ids)
    parsed: list[dict[str, Any]] = []
    for start in range(0, len(unique_ids), 50):
        chunk = unique_ids[start : start + 50]
        payload = await call_youtube_api(
            "channels",
            {
                "part": "snippet,contentDetails,statistics",
                "id": ",".join(chunk),
                "maxResults": len(chunk),
            },
            bucket="general_data",
            is_auto_refresh=is_auto_refresh,
            transport=transport,
            retry_backoff_sec=retry_backoff_sec,
        )
        for item in payload.get("items") or []:
            if isinstance(item, dict) and item.get("id"):
                parsed.append(parse_youtube_channel_item(item))
    return parsed


async def fetch_most_popular_videos(
    *,
    region_code: str = "VN",
    category_id: str | None = None,
    max_results: int = SEARCH_MAX_RESULTS_PER_CALL,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {
        "part": "snippet,contentDetails,statistics,liveStreamingDetails",
        "chart": "mostPopular",
        "regionCode": region_code.strip().upper()[:8] or "VN",
        "maxResults": max(1, min(50, int(max_results))),
    }
    if category_id and category_id != "all":
        params["videoCategoryId"] = category_id
    payload = await call_youtube_api(
        "videos",
        params,
        bucket="general_data",
        is_auto_refresh=False,
        transport=transport,
        retry_backoff_sec=retry_backoff_sec,
    )
    items = payload.get("items") or []
    return [parse_youtube_video_item(item) for item in items if isinstance(item, dict) and item.get("id")]


async def fetch_video_categories(
    *,
    region_code: str = "VN",
    language: str = "vi",
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
) -> list[dict[str, str]]:
    payload = await call_youtube_api(
        "videoCategories",
        {
            "part": "snippet",
            "regionCode": region_code.strip().upper()[:8] or "VN",
            "hl": language.strip().lower()[:8] or "vi",
        },
        bucket="general_data",
        is_auto_refresh=False,
        transport=transport,
        retry_backoff_sec=retry_backoff_sec,
    )
    results: list[dict[str, str]] = []
    for item in payload.get("items") or []:
        if not isinstance(item, dict):
            continue
        snippet = item.get("snippet") if isinstance(item.get("snippet"), dict) else {}
        if not snippet.get("assignable", True):
            continue
        cid = str(item.get("id") or "").strip()
        title = str(snippet.get("title") or "").strip()
        if cid and title:
            results.append({"id": cid, "title": title})
    return results


async def search_youtube(
    *,
    query: str,
    object_type: str = "video",
    region_code: str = "VN",
    relevance_language: str = "vi",
    published_after: str | None = None,
    order_by: str = "relevance",
    max_results: int = SEARCH_MAX_RESULTS_PER_CALL,
    transport: httpx.AsyncBaseTransport | None = None,
) -> list[str]:
    """Execute manual search.list (1 Search Queries unit, strictly 0 auto-retries) and return IDs."""
    params: dict[str, Any] = {
        "part": "id",
        "q": query.strip(),
        "type": "channel" if object_type == "channel" else "video",
        "regionCode": region_code.strip().upper()[:8] or "VN",
        "relevanceLanguage": relevance_language.strip().lower()[:16] or "vi",
        "order": order_by,
        "maxResults": max(1, min(50, int(max_results))),
    }
    if published_after:
        params["publishedAfter"] = published_after

    payload = await call_youtube_api(
        "search",
        params,
        bucket="search_queries",
        is_auto_refresh=False,
        transport=transport,
    )
    ids: list[str] = []
    for item in payload.get("items") or []:
        if not isinstance(item, dict):
            continue
        id_obj = item.get("id")
        if not isinstance(id_obj, dict):
            continue
        target_id = id_obj.get("channelId") if object_type == "channel" else id_obj.get("videoId")
        if target_id:
            ids.append(str(target_id).strip())
    return _dedup_ordered(ids)


async def fetch_channel_by_identifier(
    *,
    channel_id: str | None = None,
    for_handle: str | None = None,
    is_auto_refresh: bool = False,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
) -> dict[str, Any] | None:
    """Resolve channel using 1 unit of General Data API (channels.list by id or forHandle, 0 Search Queries)."""
    params: dict[str, Any] = {"part": "snippet,contentDetails,statistics"}
    if channel_id:
        params["id"] = channel_id.strip()
    elif for_handle:
        cleaned = for_handle.strip()
        params["forHandle"] = cleaned if cleaned.startswith("@") else f"@{cleaned}"
    else:
        return None

    payload = await call_youtube_api(
        "channels",
        params,
        bucket="general_data",
        is_auto_refresh=is_auto_refresh,
        transport=transport,
        retry_backoff_sec=retry_backoff_sec,
    )
    items = payload.get("items") or []
    for item in items:
        if isinstance(item, dict) and item.get("id"):
            return parse_youtube_channel_item(item)
    return None


async def fetch_playlist_video_ids(
    playlist_id: str,
    *,
    max_results: int = 40,
    is_auto_refresh: bool = False,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
) -> list[str]:
    """Fetch recent uploaded video IDs from a channel's uploads playlist (1 unit general_data per page)."""
    payload = await call_youtube_api(
        "playlistItems",
        {
            "part": "contentDetails",
            "playlistId": playlist_id.strip(),
            "maxResults": max(1, min(50, int(max_results))),
        },
        bucket="general_data",
        is_auto_refresh=is_auto_refresh,
        transport=transport,
        retry_backoff_sec=retry_backoff_sec,
    )
    ids: list[str] = []
    for item in payload.get("items") or []:
        if not isinstance(item, dict):
            continue
        cd = item.get("contentDetails")
        if isinstance(cd, dict) and cd.get("videoId"):
            ids.append(str(cd["videoId"]).strip())
    return _dedup_ordered(ids)
