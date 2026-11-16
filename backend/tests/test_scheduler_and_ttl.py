from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import os
import socket
import tempfile
import unittest

import httpx

from app.db.migrator import run_migrations
from app.repositories import idea_repo, project_repo, rss_repo, settings_repo, youtube_repo
from app.services import quota_service, scheduler_service


def _public_dns(host: str, port: int) -> list[tuple[object, ...]]:
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port))]


class SchedulerAndTtlTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._prev_dir = os.environ.get("RESEARCH_STUDIO_DATA_DIR")
        os.environ["RESEARCH_STUDIO_DATA_DIR"] = self._tmp.name
        run_migrations()
        settings_repo.set_legal_consent(True)
        settings_repo.save_youtube_api_key("AIzaSyTestSchedulerKey12345")

    def tearDown(self) -> None:
        if self._prev_dir is None:
            os.environ.pop("RESEARCH_STUDIO_DATA_DIR", None)
        else:
            os.environ["RESEARCH_STUDIO_DATA_DIR"] = self._prev_dir
        self._tmp.cleanup()

    async def test_disabled_auto_refresh_makes_zero_network_calls_yet_still_purges_30d_ttl(self) -> None:
        settings_repo.update_public_settings({"autoRefreshEnabled": False})
        old_time = datetime(2026, 9, 1, 12, 0, tzinfo=timezone.utc)
        now = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)

        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_expired_idea",
            channel_id="UC_SCH_EXPIRED",
            title="Expired Video Linked To Idea",
            duration_seconds=800,
            view_count=45000,
            now_utc=old_time,
        )
        youtube_repo.set_manual_video_format("vid_expired_idea", "long_form", now_utc=old_time)
        idea = idea_repo.create_idea(
            title="Keep Forever Even After 30d Purge",
            notes="User research note",
            source_type="youtube_video",
            source_ref_id="vid_expired_idea",
            source_title_snapshot="Expired Video Linked To Idea",
            source_url="https://www.youtube.com/watch?v=vid_expired_idea",
            tags=[],
            in_global_vault=True,
            target_project_ids=[],
            project_angle="",
        )

        network_calls = 0

        def _should_not_be_called(_req: httpx.Request) -> httpx.Response:
            nonlocal network_calls
            network_calls += 1
            return httpx.Response(500)

        sched = scheduler_service.LifespanScheduler(startup_delay_sec=0.01)
        purge_res = await sched.run_ttl_purge_once(now_utc=now)
        tick_res = await sched.run_auto_refresh_tick(
            now_utc=now,
            yt_transport=httpx.MockTransport(_should_not_be_called),
            rss_transport=httpx.MockTransport(_should_not_be_called),
            rss_resolver=_public_dns,
            retry_backoff_sec=0.0,
        )

        self.assertEqual(network_calls, 0)
        self.assertFalse(tick_res["executed"])
        self.assertEqual(tick_res["reason"], "auto_refresh_disabled")
        self.assertGreaterEqual(purge_res["videosTombstoned"], 1)

        # User-created Idea & manual format label survive unconditionally
        vid_after = youtube_repo.get_video_record("vid_expired_idea", now_utc=now)
        self.assertIsNotNone(vid_after)
        self.assertFalse(vid_after["hasValidApiData"])
        self.assertEqual(vid_after["manualFormat"], "long_form")
        idea_after = idea_repo.get_idea(idea["id"], now_utc=now)
        self.assertTrue(idea_after["apiPurged"])
        self.assertEqual(idea_after["notes"], "User research note")

    async def test_controlled_auto_refresh_priorities_caps_zero_search_and_clean_shutdown(self) -> None:
        now = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)
        near_expiry_fetch = now - timedelta(days=27)  # expires in 3 days (<= 5d Priority 1!)
        stale_channel_fetch = now - timedelta(hours=20)  # > 12h interval Priority 2!

        proj = project_repo.create_project("AutoRefresh Proj")
        youtube_repo.upsert_channel(
            channel_id="UC_AUTO_1",
            title="Competitor Auto 1",
            uploads_playlist_id="UU_AUTO_1",
            now_utc=stale_channel_fetch,
        )
        # Attach competitor channel
        from app.db.connection import write_db

        with write_db() as conn:
            conn.execute(
                "INSERT INTO project_channels (id, project_id, channel_id, status, notes, added_at) VALUES (?, ?, ?, 'active', '', ?)",
                ("pc-auto-1", proj["id"], "UC_AUTO_1", now.isoformat()),
            )

        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_idea_expiring",
            channel_id="UC_AUTO_1",
            title="Old Expiring Title",
            duration_seconds=900,
            view_count=50000,
            now_utc=near_expiry_fetch,
        )
        idea_repo.create_idea(
            title="Priority 1 Video Idea",
            notes="",
            source_type="youtube_video",
            source_ref_id="vid_idea_expiring",
            source_title_snapshot="Old Expiring Title",
            source_url="https://www.youtube.com/watch?v=vid_idea_expiring",
            tags=[],
            in_global_vault=True,
            target_project_ids=[],
            project_angle="",
        )
        feed = rss_repo.create_feed(name="Auto RSS", url="https://example.com/auto.xml")

        yt_paths: list[str] = []

        def _yt_handler(request: httpx.Request) -> httpx.Response:
            yt_paths.append(request.url.path)
            if request.url.path.endswith("/channels"):
                return httpx.Response(
                    200,
                    json={
                        "items": [
                            {
                                "id": "UC_AUTO_1",
                                "snippet": {"title": "Competitor Auto 1 Updated"},
                                "contentDetails": {"relatedPlaylists": {"uploads": "UU_AUTO_1"}},
                                "statistics": {"subscriberCount": "20000", "videoCount": "50"},
                            }
                        ]
                    },
                )
            if request.url.path.endswith("/playlistItems"):
                return httpx.Response(200, json={"items": [{"contentDetails": {"videoId": "vid_idea_expiring"}}]})
            if request.url.path.endswith("/videos"):
                return httpx.Response(
                    200,
                    json={
                        "items": [
                            {
                                "id": "vid_idea_expiring",
                                "snippet": {"title": "Refreshed Expiring Title", "channelId": "UC_AUTO_1"},
                                "contentDetails": {"duration": "PT15M"},
                                "statistics": {"viewCount": "65000"},
                            }
                        ]
                    },
                )
            return httpx.Response(404)

        rss_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Auto</title>
  <item><title>Auto Feed Story</title><link>https://example.com/story-1</link></item>
</channel></rss>"""

        sched = scheduler_service.LifespanScheduler(startup_delay_sec=0.05)
        # Verify startup delay blocks immediate tick before 50ms when lifecycle loop runs
        await sched.start()
        self.assertEqual(sched.auto_refresh_ticks, 0)
        await asyncio.sleep(0.02)
        await sched.stop()
        self.assertGreaterEqual(sched.purge_ticks, 1)
        self.assertEqual(sched.auto_refresh_ticks, 0)  # Stopped cleanly before startup delay fired!

        # Execute controlled tick directly and inspect priority ordering & caps
        summary = await sched.run_auto_refresh_tick(
            now_utc=now,
            yt_transport=httpx.MockTransport(_yt_handler),
            rss_transport=httpx.MockTransport(lambda _r: httpx.Response(200, content=rss_xml)),
            rss_resolver=_public_dns,
            retry_backoff_sec=0.0,
        )
        self.assertTrue(summary["executed"])
        self.assertEqual(summary["rssRefreshed"], 1)
        self.assertEqual(summary["ideaVideosRenewed"], 1)
        self.assertEqual(summary["channelsRefreshed"], 1)
        self.assertEqual(summary["searchQueriesSpent"], 0)
        self.assertEqual(quota_service.get_quota_status(now_utc=now)["searchQueries"]["used"], 0)
        # Priority 1 videos.list batch MUST happen BEFORE Priority 2 channel refresh, and ZERO search.list calls
        self.assertTrue(yt_paths[0].endswith("/videos"))
        self.assertFalse(any(p.endswith("/search") for p in yt_paths))

        # Push quota up to the minimum configurable daily cap (10) on `now`'s PT window and verify auto-refresh halts YouTube calls cleanly
        settings_repo.update_public_settings({"autoRefreshDailyQuotaCap": 10})
        for _ in range(10):
            quota_service.reserve_quota_unit("general_data", "videos", now_utc=now)
        yt_calls_before = len(yt_paths)
        halted = await sched.run_auto_refresh_tick(
            now_utc=now,
            yt_transport=httpx.MockTransport(_yt_handler),
            rss_transport=httpx.MockTransport(lambda _r: httpx.Response(200, content=rss_xml)),
            rss_resolver=_public_dns,
            retry_backoff_sec=0.0,
        )
        self.assertEqual(len(yt_paths), yt_calls_before)
        self.assertEqual(halted["youtubeSkippedReason"], "quota_threshold_reached")
        _ = feed
