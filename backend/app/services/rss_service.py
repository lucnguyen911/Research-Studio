from __future__ import annotations

import asyncio
from collections import Counter
from datetime import datetime, timedelta, timezone
import re
from typing import Any

import httpx

from app.clients.rss_client import DnsResolver, fetch_and_parse_feed, validate_public_feed_url
from app.core.config import RSS_MAX_CONCURRENCY
from app.core.errors import AppError
from app.db.connection import run_db_sync
from app.repositories import rss_repo
from app.services.scheduler_service import in_flight_registry

_URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
_TOKEN_RE = re.compile(r"[a-zA-Z0-9À-ỹ]{2,}", re.UNICODE)
_BOILERPLATE_PHRASES = frozenset({"article url", "comments url", "comments points"})
_STOPWORDS = frozenset(
    {
        "và",
        "của",
        "cho",
        "các",
        "những",
        "trong",
        "trên",
        "với",
        "khi",
        "được",
        "không",
        "này",
        "một",
        "the",
        "and",
        "for",
        "with",
        "that",
        "this",
        "from",
        "into",
        "are",
        "was",
        "url",
        "comments",
        "points",
        "article",
        "item",
    }
)


async def add_rss_feed(
    *,
    name: str,
    url: str,
    group_tag: str = "",
    resolver: DnsResolver | None = None,
) -> dict[str, Any]:
    """Validate URL for SSRF before inserting feed record into SQLite."""
    safe_url = validate_public_feed_url(url, resolver=resolver)
    return await run_db_sync(rss_repo.create_feed, name=name, url=safe_url, group_tag=group_tag)


async def refresh_single_feed(
    feed_id: str,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
    resolver: DnsResolver | None = None,
) -> dict[str, Any]:
    """Refresh one feed while isolating network/XML/SSRF failures strictly to that feed row."""
    feed = await run_db_sync(rss_repo.get_feed, feed_id)
    lock_key = f"feed:{feed_id}"
    if not await in_flight_registry.try_acquire(lock_key):
        return {
            "feedId": feed_id,
            "status": "skipped_in_flight",
            "feed": feed,
        }
    try:
        articles = await fetch_and_parse_feed(feed["url"], transport=transport, resolver=resolver)
        outcome = await run_db_sync(rss_repo.record_feed_fetch_success, feed_id, articles)
        return {**outcome, "feed": await run_db_sync(rss_repo.get_feed, feed_id)}
    except AppError as exc:
        err = await run_db_sync(
            rss_repo.record_feed_fetch_error,
            feed_id,
            error_code=exc.code,
            error_message=exc.message,
        )
        return {**err, "feed": await run_db_sync(rss_repo.get_feed, feed_id)}
    except Exception:
        err = await run_db_sync(
            rss_repo.record_feed_fetch_error,
            feed_id,
            error_code="RSS_UNEXPECTED_ERROR",
            error_message="Lỗi không xác định khi tải nguồn RSS.",
        )
        return {**err, "feed": await run_db_sync(rss_repo.get_feed, feed_id)}
    finally:
        await in_flight_registry.release(lock_key)


async def refresh_all_enabled_feeds(
    *,
    transport: httpx.AsyncBaseTransport | None = None,
    resolver: DnsResolver | None = None,
) -> dict[str, Any]:
    """Refresh all enabled feeds concurrently with bounded concurrency and per-feed isolation."""
    feeds = await run_db_sync(rss_repo.list_feeds)
    enabled_feeds = [f for f in feeds if f["enabled"]]
    sem = asyncio.Semaphore(RSS_MAX_CONCURRENCY)

    async def _worker(fid: str) -> dict[str, Any]:
        async with sem:
            return await refresh_single_feed(fid, transport=transport, resolver=resolver)

    results = await asyncio.gather(*(_worker(f["id"]) for f in enabled_feeds))
    return {
        "refreshedCount": len(results),
        "okCount": sum(1 for r in results if r["status"] == "ok"),
        "errorCount": sum(1 for r in results if r["status"] == "error"),
        "results": results,
    }


def compute_rss_phrases(
    *,
    project_id: str | None = None,
    days: int = 7,
    limit: int = 10,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Compute deterministic RSS phrase frequency outside YouTube API using 0 API quota."""
    utc_now = (now_utc or datetime.now(timezone.utc)).astimezone(timezone.utc)
    since = utc_now - timedelta(days=max(1, days))
    articles = rss_repo.list_recent_articles_for_phrases(project_id=project_id, since_iso=since.isoformat())

    day_keys = [(utc_now - timedelta(days=offset)).strftime("%Y-%m-%d") for offset in range(days - 1, -1, -1)]
    phrase_counts: Counter[str] = Counter()
    daily_buckets: dict[str, Counter[str]] = {}

    for art in articles:
        raw_text = f"{art['title']} {art['summary_text']}"
        text = _URL_RE.sub(" ", raw_text)
        tokens = [
            t.lower()
            for t in _TOKEN_RE.findall(text)
            if not t.isdigit() and t.lower() not in _STOPWORDS
        ]
        doc_bigrams: set[str] = set()
        for idx in range(len(tokens) - 1):
            bg = f"{tokens[idx]} {tokens[idx + 1]}"
            if bg not in _BOILERPLATE_PHRASES:
                doc_bigrams.add(bg)
        if not doc_bigrams:
            doc_bigrams.update(tokens)

        eff_date = str(art["effective_at"] or "")[:10]
        for phrase in doc_bigrams:
            phrase_counts[phrase] += 1
            if eff_date in day_keys:
                daily_buckets.setdefault(phrase, Counter())[eff_date] += 1

    items: list[dict[str, Any]] = []
    for phrase, count in phrase_counts.most_common(max(1, min(30, limit))):
        points7d = [daily_buckets.get(phrase, {}).get(day, 0) for day in day_keys]
        non_zero_days = sum(1 for pt in points7d if pt > 0)
        recent_half = sum(points7d[-3:])
        older_half = sum(points7d[:-3])
        direction = "up" if non_zero_days >= 2 and recent_half > older_half else "flat"
        items.append(
            {
                "phrase": phrase,
                "articleCount": count,
                "points7d": points7d,
                "activeDays": non_zero_days,
                "direction": direction,
            }
        )

    return {
        "sourceLabel": "Nguồn: RSS (Dữ liệu ngoài YouTube)",
        "articleSampleSize": len(articles),
        "days": days,
        "items": items,
    }
