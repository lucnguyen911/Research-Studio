from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import SEARCH_MAX_RESULTS_PER_CALL
from app.core.errors import AppError
from app.db.connection import read_db, run_db_sync
from app.repositories import keyword_repo, project_repo, rss_repo
from app.services import discovery_service, quota_service, rss_service


def _normalize_now(now_utc: datetime | None) -> datetime:
    if now_utc is None:
        return datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        return now_utc.replace(tzinfo=timezone.utc)
    return now_utc.astimezone(timezone.utc)


def _load_project_rss_articles(project_id: str) -> list[dict[str, Any]]:
    return rss_repo.list_articles(project_id=project_id, limit=200)


def _match_articles_for_keyword(keyword_text: str, articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    needle = keyword_text.strip().lower()
    if not needle:
        return []
    tokens = [tok for tok in needle.split() if len(tok) >= 2]
    matched: list[dict[str, Any]] = []
    for art in articles:
        haystack = f"{art['title']} {art['summaryText']}".lower()
        if needle in haystack or (len(tokens) >= 2 and all(tok in haystack for tok in tokens)):
            matched.append(art)
    return matched


def list_keywords_with_project_rss_overview(
    project_id: str,
    *,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """List Project keywords with deterministic RSS cross-reference strictly from project_rss_feeds."""
    project = project_repo.get_project(project_id)
    utc_now = _normalize_now(now_utc)
    keywords = keyword_repo.list_project_keywords(project_id, now_utc=utc_now)
    project_articles = _load_project_rss_articles(project_id)
    phrases = rss_service.compute_rss_phrases(project_id=project_id, days=7, limit=8, now_utc=utc_now)

    enriched: list[dict[str, Any]] = []
    for kw in keywords:
        matched_articles = _match_articles_for_keyword(kw["keyword"], project_articles)
        enriched.append(
            {
                **kw,
                "rssMatchCount": len(matched_articles),
            }
        )

    return {
        "projectId": project_id,
        "regionCode": project["regionCode"],
        "relevanceLanguage": project["relevanceLanguage"],
        "linkedFeedCount": len(project["linkedFeedIds"]),
        "items": enriched,
        "rssSignals": phrases,
    }


def get_keyword_cached_results(
    project_id: str,
    keyword_id: str,
    *,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Reopen cached <=30d YouTube results and Project RSS cross-reference at 0 API quota."""
    project_repo.get_project(project_id)
    utc_now = _normalize_now(now_utc)
    kw = keyword_repo.get_project_keyword(project_id, keyword_id, now_utc=utc_now)

    videos: list[dict[str, Any]] = []
    session: dict[str, Any] | None = None
    if kw["lastSessionId"]:
        try:
            detail = discovery_service.get_search_session_detail(kw["lastSessionId"], now_utc=utc_now)
            session = detail["session"]
            videos = detail["videos"]
        except AppError as exc:
            if exc.code != "SEARCH_SESSION_NOT_FOUND_OR_EXPIRED":
                raise

    with read_db() as conn:
        linked_feed_rows = conn.execute(
            "SELECT COUNT(*) AS cnt FROM project_rss_feeds WHERE project_id = ?",
            (project_id,),
        ).fetchone()
    linked_count = int(linked_feed_rows["cnt"]) if linked_feed_rows else 0

    project_articles = _load_project_rss_articles(project_id)
    matched_articles = _match_articles_for_keyword(kw["keyword"], project_articles)

    return {
        "keyword": {**kw, "rssMatchCount": len(matched_articles)},
        "session": session,
        "videos": videos,
        "rssSourceLabel": "Nguồn: RSS (Dữ liệu ngoài YouTube)",
        "linkedFeedCount": linked_count,
        "matchedRssArticles": matched_articles[:25],
    }


async def scan_project_keywords(
    project_id: str,
    keyword_ids: list[str],
    *,
    max_results: int = SEARCH_MAX_RESULTS_PER_CALL,
    transport: httpx.AsyncBaseTransport | None = None,
    retry_backoff_sec: float = 0.15,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Manually scan 1+ Project keywords via search.list using project regionCode/relevanceLanguage."""
    project = await run_db_sync(project_repo.get_project, project_id)
    if not keyword_ids:
        raise AppError("NO_KEYWORDS_SELECTED", "Vui lòng chọn ít nhất một từ khóa để quét YouTube.", status_code=400)

    utc_now = _normalize_now(now_utc)
    unique_ids: list[str] = []
    seen: set[str] = set()
    for raw_id in keyword_ids:
        cleaned = raw_id.strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            unique_ids.append(cleaned)

    target_keywords: list[dict[str, Any]] = []
    for kid in unique_ids:
        kw = await run_db_sync(keyword_repo.get_project_keyword, project_id, kid, now_utc=utc_now)
        target_keywords.append(kw)

    scanned_results: list[dict[str, Any]] = []
    for kw in target_keywords:
        search_res = await discovery_service.run_free_search(
            query=kw["keyword"],
            object_type="video",
            region_code=project["regionCode"],
            relevance_language=project["relevanceLanguage"],
            order_by="relevance",
            max_results=max_results,
            transport=transport,
            retry_backoff_sec=retry_backoff_sec,
            now_utc=utc_now,
        )
        session = search_res["session"]
        await run_db_sync(
            keyword_repo.set_keyword_last_session,
            project_id,
            kw["id"],
            session_id=session["id"],
            scanned_at_iso=session["apiFetchedAt"],
        )
        scanned_results.append(
            {
                "keywordId": kw["id"],
                "keyword": kw["keyword"],
                "session": session,
                "videos": search_res["videos"],
            }
        )

    overview = await run_db_sync(list_keywords_with_project_rss_overview, project_id, now_utc=utc_now)
    return {
        "scannedCount": len(scanned_results),
        "scanned": scanned_results,
        "overview": overview,
        "quota": await run_db_sync(quota_service.get_quota_status, now_utc=utc_now),
    }
