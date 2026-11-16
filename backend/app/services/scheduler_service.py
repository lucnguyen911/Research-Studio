from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import datetime, timedelta, timezone
import logging
from typing import Any

import httpx

from app.clients import youtube_client
from app.clients.rss_client import DnsResolver
from app.core.config import (
    AUTO_REFRESH_STARTUP_DELAY_SEC,
    QUOTA_GENERAL_DAILY_LIMIT,
    RSS_CACHE_RETENTION_DAYS,
    RSS_MAX_CONCURRENCY,
)
from app.core.errors import AppError
from app.db.connection import read_db, run_db_sync, write_db
from app.repositories import rss_repo, settings_repo, youtube_repo
from app.services import quota_service, retention_service

logger = logging.getLogger("research_studio")


class InFlightRegistry:
    """Coroutine-safe registry preventing overlapping refreshes for identical resource keys."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._active: set[str] = set()

    async def try_acquire(self, key: str) -> bool:
        async with self._lock:
            if key in self._active:
                return False
            self._active.add(key)
            return True

    async def release(self, key: str) -> None:
        async with self._lock:
            self._active.discard(key)

    async def active_keys(self) -> list[str]:
        async with self._lock:
            return sorted(self._active)


in_flight_registry = InFlightRegistry()


def _normalize_utc(now_utc: datetime | None) -> datetime:
    if now_utc is None:
        return datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        return now_utc.replace(tzinfo=timezone.utc)
    return now_utc.astimezone(timezone.utc)


def _select_expiring_idea_video_ids(now_utc: datetime, horizon_days: int = 5) -> list[str]:
    now_iso = now_utc.isoformat()
    horizon_iso = (now_utc + timedelta(days=horizon_days)).isoformat()
    with read_db() as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT v.video_id
            FROM youtube_videos v
            WHERE v.api_purged_at IS NULL
              AND v.api_expires_at IS NOT NULL
              AND v.api_expires_at > ?
              AND v.api_expires_at <= ?
              AND (
                  v.video_id IN (SELECT linked_video_id FROM ideas WHERE linked_video_id IS NOT NULL)
                  OR v.video_id IN (SELECT video_id FROM project_videos WHERE is_user_breakout = 1)
              )
            ORDER BY v.api_expires_at ASC
            LIMIT 200
            """,
            (now_iso, horizon_iso),
        ).fetchall()
    return [str(r["video_id"]) for r in rows]


def _select_due_competitor_channels(now_utc: datetime, interval_hours: int) -> list[str]:
    cutoff_iso = (now_utc - timedelta(hours=max(1, interval_hours))).isoformat()
    with read_db() as conn:
        rows = conn.execute(
            """
            SELECT c.channel_id
            FROM youtube_channels c
            WHERE EXISTS (
                SELECT 1
                FROM project_channels pc
                WHERE pc.channel_id = c.channel_id
                  AND pc.status = 'active'
            )
              AND (c.api_fetched_at IS NULL OR c.api_fetched_at <= ?)
            ORDER BY COALESCE(c.api_fetched_at, '') ASC
            LIMIT 30
            """,
            (cutoff_iso,),
        ).fetchall()
    return [str(r["channel_id"]) for r in rows]


def _select_due_rss_feeds(now_utc: datetime, interval_hours: int) -> list[str]:
    cutoff_iso = (now_utc - timedelta(hours=max(1, interval_hours))).isoformat()
    with read_db() as conn:
        rows = conn.execute(
            """
            SELECT id
            FROM rss_feeds
            WHERE enabled = 1
              AND (last_fetched_at IS NULL OR last_fetched_at <= ?)
            ORDER BY COALESCE(last_fetched_at, '') ASC
            LIMIT 20
            """,
            (cutoff_iso,),
        ).fetchall()
    return [str(r["id"]) for r in rows]


def _purge_stale_unlinked_rss_articles(now_utc: datetime) -> int:
    cutoff_iso = (now_utc - timedelta(days=RSS_CACHE_RETENTION_DAYS)).isoformat()
    with write_db() as conn:
        cur = conn.execute(
            """
            DELETE FROM rss_articles
            WHERE fetched_at <= ?
              AND bookmarked = 0
              AND COALESCE(user_notes, '') = ''
              AND id NOT IN (SELECT linked_article_id FROM ideas WHERE linked_article_id IS NOT NULL)
            """,
            (cutoff_iso,),
        )
        return max(0, cur.rowcount)


class LifespanScheduler:
    """
    In-process FastAPI lifespan scheduler with strict dual separation:
    1) Unconditional local 30-day TTL purge (runs even when auto_refresh_enabled is False).
    2) Controlled background refresh (waits startup delay, never calls search.list, honors caps).
    """

    def __init__(
        self,
        *,
        startup_delay_sec: float = AUTO_REFRESH_STARTUP_DELAY_SEC,
        purge_interval_sec: float = 3600.0,
        refresh_interval_sec: float = 900.0,
    ) -> None:
        self.startup_delay_sec = startup_delay_sec
        self.purge_interval_sec = purge_interval_sec
        self.refresh_interval_sec = refresh_interval_sec
        self._running = False
        self._purge_task: asyncio.Task[None] | None = None
        self._refresh_task: asyncio.Task[None] | None = None
        self.purge_ticks = 0
        self.auto_refresh_ticks = 0
        self.last_purge_at_utc: str | None = None
        self.last_purge_counts: dict[str, int] | None = None
        self.last_auto_refresh_at_utc: str | None = None
        self.last_auto_refresh_summary: dict[str, Any] | None = None

    async def run_ttl_purge_once(self, *, now_utc: datetime | None = None) -> dict[str, int]:
        """Run unconditional local 30-day YouTube TTL purge (0 network calls)."""
        utc_now = _normalize_utc(now_utc)
        counts = await run_db_sync(retention_service.purge_expired_api_data, now_utc=utc_now)
        rss_pruned = await run_db_sync(_purge_stale_unlinked_rss_articles, utc_now)
        result = {**counts, "staleRssPruned": rss_pruned}
        self.purge_ticks += 1
        self.last_purge_at_utc = utc_now.isoformat()
        self.last_purge_counts = result
        return result

    async def run_auto_refresh_tick(
        self,
        *,
        now_utc: datetime | None = None,
        yt_transport: httpx.AsyncBaseTransport | None = None,
        rss_transport: httpx.AsyncBaseTransport | None = None,
        rss_resolver: DnsResolver | None = None,
        retry_backoff_sec: float = 0.15,
    ) -> dict[str, Any]:
        """Execute one controlled auto-refresh cycle obeying priority queue and quota caps."""
        from app.services import competitor_service, rss_service

        utc_now = _normalize_utc(now_utc)
        settings = await run_db_sync(settings_repo.get_public_settings)

        if not settings["autoRefreshEnabled"]:
            summary: dict[str, Any] = {
                "executed": False,
                "reason": "auto_refresh_disabled",
                "rssRefreshed": 0,
                "youtubeUnitsSpent": 0,
                "searchQueriesSpent": 0,
            }
            self.auto_refresh_ticks += 1
            self.last_auto_refresh_at_utc = utc_now.isoformat()
            self.last_auto_refresh_summary = summary
            return summary

        rss_refreshed = 0
        rss_errors = 0
        due_feeds = await run_db_sync(
            _select_due_rss_feeds,
            utc_now,
            int(settings["autoRefreshRssIntervalHours"]),
        )
        if due_feeds:
            sem = asyncio.Semaphore(RSS_MAX_CONCURRENCY)

            async def _run_feed(fid: str) -> None:
                nonlocal rss_refreshed, rss_errors
                async with sem:
                    res = await rss_service.refresh_single_feed(
                        fid,
                        transport=rss_transport,
                        resolver=rss_resolver,
                    )
                    if res.get("status") == "ok":
                        rss_refreshed += 1
                    elif res.get("status") == "error":
                        rss_errors += 1

            await asyncio.gather(*(_run_feed(fid) for fid in due_feeds))

        quota = await run_db_sync(quota_service.get_quota_status, now_utc=utc_now)
        units_spent = 0
        idea_videos_renewed = 0
        channels_refreshed = 0
        youtube_skipped_reason: str | None = None

        warning_ratio = float(settings["quotaWarningRatio"])
        daily_auto_cap = int(settings["autoRefreshDailyQuotaCap"])
        batch_cap = int(settings["autoRefreshMaxApiUnitsPerBatch"])
        warning_limit = int(QUOTA_GENERAL_DAILY_LIMIT * warning_ratio)
        general_used = int(quota["generalData"]["used"])
        remaining_auto_budget = min(
            batch_cap,
            max(0, daily_auto_cap - general_used),
            max(0, warning_limit - general_used),
        )

        if settings["apiKeyStatus"] != "configured" or not settings["legalConsentAccepted"]:
            youtube_skipped_reason = "api_key_or_legal_not_ready"
        elif quota["generalData"]["exhausted"] or quota["generalData"]["warning"] or remaining_auto_budget <= 0:
            youtube_skipped_reason = "quota_threshold_reached"
        else:
            # Priority 1: Expiring Idea / Flagged Breakout Videos (up to 50 IDs = 1 unit per chunk)
            expiring_ids = await run_db_sync(_select_expiring_idea_video_ids, utc_now, 5)
            for start in range(0, len(expiring_ids), 50):
                if units_spent >= remaining_auto_budget:
                    break
                chunk = expiring_ids[start : start + 50]
                if not await in_flight_registry.try_acquire("idea_videos_batch"):
                    continue
                try:
                    fetched = await youtube_client.fetch_videos_by_ids(
                        chunk,
                        is_auto_refresh=True,
                        transport=yt_transport,
                        retry_backoff_sec=retry_backoff_sec,
                    )
                    units_spent += 1

                    def _save_batch(items: list[dict[str, Any]]) -> None:
                        with write_db() as conn:
                            for item in items:
                                youtube_repo.upsert_video_and_snapshot(conn=conn, now_utc=utc_now, **item)

                    await run_db_sync(_save_batch, fetched)
                    idea_videos_renewed += len(fetched)
                except AppError as exc:
                    youtube_skipped_reason = exc.code
                    break
                finally:
                    await in_flight_registry.release("idea_videos_batch")

            # Priority 2: Active Competitor Channels due by interval (~3 units each)
            if youtube_skipped_reason is None and units_spent + 3 <= remaining_auto_budget:
                due_channels = await run_db_sync(
                    _select_due_competitor_channels,
                    utc_now,
                    int(settings["autoRefreshChannelIntervalHours"]),
                )
                for cid in due_channels:
                    if units_spent + 3 > remaining_auto_budget:
                        break
                    try:
                        await competitor_service.refresh_competitor_channel(
                            cid,
                            is_auto_refresh=True,
                            transport=yt_transport,
                            retry_backoff_sec=retry_backoff_sec,
                            now_utc=utc_now,
                        )
                        units_spent += 3
                        channels_refreshed += 1
                    except AppError as exc:
                        if exc.code in (
                            "AUTO_REFRESH_QUOTA_CAP_REACHED",
                            "QUOTA_GENERAL_EXHAUSTED",
                            "YOUTUBE_API_KEY_INVALID",
                            "YOUTUBE_API_KEY_MISSING",
                            "YOUTUBE_API_KEY_UNREADABLE",
                            "LEGAL_CONSENT_REQUIRED",
                        ):
                            youtube_skipped_reason = exc.code
                            break

        summary = {
            "executed": True,
            "rssRefreshed": rss_refreshed,
            "rssErrors": rss_errors,
            "ideaVideosRenewed": idea_videos_renewed,
            "channelsRefreshed": channels_refreshed,
            "youtubeUnitsSpent": units_spent,
            "searchQueriesSpent": 0,
            "youtubeSkippedReason": youtube_skipped_reason,
        }
        self.auto_refresh_ticks += 1
        self.last_auto_refresh_at_utc = utc_now.isoformat()
        self.last_auto_refresh_summary = summary
        return summary

    async def _purge_loop(self) -> None:
        try:
            while self._running:
                await asyncio.sleep(self.purge_interval_sec)
                if not self._running:
                    return
                try:
                    await self.run_ttl_purge_once()
                except Exception as exc:
                    logger.warning("TTL purge loop encountered error: %s", exc)
        except asyncio.CancelledError:
            return

    async def _refresh_loop(self) -> None:
        try:
            await asyncio.sleep(self.startup_delay_sec)
            while self._running:
                try:
                    await self.run_auto_refresh_tick()
                except Exception as exc:
                    logger.warning("Auto-refresh loop encountered error: %s", exc)
                await asyncio.sleep(self.refresh_interval_sec)
        except asyncio.CancelledError:
            return

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        await self.run_ttl_purge_once()
        self._purge_task = asyncio.create_task(self._purge_loop(), name="rs-ttl-purge-loop")
        self._refresh_task = asyncio.create_task(self._refresh_loop(), name="rs-auto-refresh-loop")

    async def stop(self) -> None:
        self._running = False
        tasks = [t for t in (self._purge_task, self._refresh_task) if t is not None]
        for task in tasks:
            task.cancel()
        for task in tasks:
            with suppress(asyncio.CancelledError):
                await task
        self._purge_task = None
        self._refresh_task = None

    def get_status(self) -> dict[str, Any]:
        return {
            "running": self._running,
            "startupDelaySec": self.startup_delay_sec,
            "purgeTicks": self.purge_ticks,
            "lastPurgeAtUtc": self.last_purge_at_utc,
            "lastPurgeCounts": self.last_purge_counts,
            "autoRefreshTicks": self.auto_refresh_ticks,
            "lastAutoRefreshAtUtc": self.last_auto_refresh_at_utc,
            "lastAutoRefreshSummary": self.last_auto_refresh_summary,
        }


scheduler = LifespanScheduler()
