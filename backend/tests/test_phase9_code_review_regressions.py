from __future__ import annotations

from datetime import datetime, timedelta, timezone
import io
import logging
import os
import socket
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
import httpcore
import httpx

from app.clients import rss_client, youtube_client
from app.core.config import DATA_DIR_ENV_VAR, ensure_runtime_dirs
from app.core.errors import AppError
from app.core.logging_setup import close_logging_handlers, configure_logging
from app.core.security import CSRF_HEADER_NAME, CSRF_HEADER_VALUE
from app.db.connection import read_db, write_db
from app.db.migrator import run_migrations, split_sql_statements
from app.main import create_app
from app.repositories import (
    idea_repo,
    keyword_repo,
    project_repo,
    rss_repo,
    settings_repo,
    youtube_repo,
)
from app.services import discovery_service, quota_service, scheduler_service


def _public_dns_v4(_host: str, port: int) -> list[tuple[object, ...]]:
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port))]


class Phase9CodeReviewRegressionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._prev_dir = os.environ.get(DATA_DIR_ENV_VAR)
        os.environ[DATA_DIR_ENV_VAR] = self._tmp.name
        run_migrations()
        settings_repo.set_legal_consent(True)
        settings_repo.save_youtube_api_key("AIzaSyPhase9DefaultKey12345")

    def tearDown(self) -> None:
        close_logging_handlers()
        if self._prev_dir is None:
            os.environ.pop(DATA_DIR_ENV_VAR, None)
        else:
            os.environ[DATA_DIR_ENV_VAR] = self._prev_dir
        self._tmp.cleanup()

    async def test_cr01_httpx_info_logger_never_leaks_api_key_to_root_handlers(self) -> None:
        secret = "AIzaSyPhase9RootLoggerSecret777"
        settings_repo.save_youtube_api_key(secret)

        root_logger = logging.getLogger()
        httpx_logger = logging.getLogger("httpx")
        httpcore_logger = logging.getLogger("httpcore")
        prev_root_level = root_logger.level
        prev_httpx_level = httpx_logger.level
        prev_httpcore_level = httpcore_logger.level

        root_stream = io.StringIO()
        root_handler = logging.StreamHandler(root_stream)
        root_logger.addHandler(root_handler)
        root_logger.setLevel(logging.DEBUG)

        try:
            configure_logging()
            self.assertGreaterEqual(httpx_logger.level, logging.WARNING)
            self.assertGreaterEqual(httpcore_logger.level, logging.WARNING)

            def _yt_ok(_request: httpx.Request) -> httpx.Response:
                return httpx.Response(200, json={"items": []})

            await youtube_client.call_youtube_api(
                "videos",
                {"part": "id", "id": "v1"},
                bucket="general_data",
                transport=httpx.MockTransport(_yt_ok),
                retry_backoff_sec=0.0,
            )

            # Even if external code re-enables INFO on httpx, LogRedactionFilter must redact before propagation
            httpx_logger.setLevel(logging.INFO)
            httpx_logger.info(
                'HTTP Request: GET https://www.googleapis.com/youtube/v3/videos?part=id&key=%s "HTTP/1.1 200 OK"',
                secret,
            )
        finally:
            close_logging_handlers()
            root_logger.removeHandler(root_handler)
            root_logger.setLevel(prev_root_level)
            httpx_logger.setLevel(prev_httpx_level)
            httpcore_logger.setLevel(prev_httpcore_level)

        captured_root = root_stream.getvalue()
        self.assertNotIn(secret, captured_root)
        self.assertIn("[REDACTED]", captured_root)
        log_path = ensure_runtime_dirs()["logs"] / "research_studio.log"
        if log_path.exists():
            self.assertNotIn(secret, log_path.read_text(encoding="utf-8"))

    async def test_cr02_rss_ipv6_transition_ssrf_dual_stack_timeout_fallback_and_pinned_transport(self) -> None:
        self.assertTrue(issubclass(rss_client._PinnedPublicHTTPTransport, httpx.AsyncBaseTransport))
        self.assertFalse(issubclass(rss_client._PinnedPublicHTTPTransport, httpx.AsyncHTTPTransport))

        blocked_transition_urls = [
            "http://[2002:7f00:1::1]/feed.xml",       # 6to4 -> 127.0.0.1
            "http://[2002:a9fe:a9fe::1]/feed.xml",   # 6to4 -> 169.254.169.254
            "http://[64:ff9b::127.0.0.1]/feed.xml",  # NAT64 well-known -> 127.0.0.1
            "http://[64:ff9b:1::1]/feed.xml",        # NAT64 local-use
        ]
        for url in blocked_transition_urls:
            with self.subTest(url=url):
                with self.assertRaises(AppError) as ctx:
                    rss_client.validate_public_feed_url(url)
                self.assertEqual(ctx.exception.code, "RSS_SSRF_BLOCKED")

        # Valid globally routable IPv6 literal must remain permitted
        self.assertEqual(
            rss_client.validate_public_feed_url("https://[2606:4700:4700::1111]/feed.xml"),
            "https://[2606:4700:4700::1111]/feed.xml",
        )

        # Dual-stack fallback: IPv6 ConnectTimeout must fall back to IPv4 public candidate
        tried_ips: list[str] = []
        sentinel_stream = object()

        def _dual_stack_resolver(_host: str, port: int) -> list[tuple[object, ...]]:
            return [
                (socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("2606:4700:4700::1111", port, 0, 0)),
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port)),
            ]

        backend = rss_client._SafePublicNetworkBackend(resolver=_dual_stack_resolver)

        async def _fake_connect_tcp(
            target_ip: str,
            port: int,
            timeout: float | None = None,
            local_address: str | None = None,
            socket_options: object = None,
        ) -> object:
            _ = (port, timeout, local_address, socket_options)
            tried_ips.append(target_ip)
            if target_ip.startswith("2606:"):
                raise httpcore.ConnectTimeout("IPv6 route timed out")
            return sentinel_stream

        setattr(backend._inner, "connect_tcp", _fake_connect_tcp)
        connected = await backend.connect_tcp("dualstack.example", 443)
        self.assertIs(connected, sentinel_stream)
        self.assertEqual(tried_ips, ["2606:4700:4700::1111", "93.184.216.34"])

    async def test_cr03_scheduler_isolates_deleted_channels_and_tombstones_missing_expiring_videos(self) -> None:
        now = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)
        near_expiry = now - timedelta(days=27)
        stale_ch = now - timedelta(hours=20)

        proj = project_repo.create_project("Dead Resource Scheduler Proj")
        youtube_repo.upsert_channel(
            channel_id="UC_DELETED_CHANNEL",
            title="Soon Deleted Channel",
            uploads_playlist_id="UU_DEL",
            now_utc=stale_ch,
        )
        youtube_repo.upsert_channel(
            channel_id="UC_INFLIGHT_CHAN",
            title="InFlight Channel",
            uploads_playlist_id="UU_INF",
            now_utc=stale_ch,
        )
        with write_db() as conn:
            conn.execute(
                """
                INSERT INTO project_channels (id, project_id, channel_id, status, notes, added_at)
                VALUES ('pc-del', ?, 'UC_DELETED_CHANNEL', 'active', '', ?),
                       ('pc-inf', ?, 'UC_INFLIGHT_CHAN', 'active', '', ?)
                """,
                (proj["id"], now.isoformat(), proj["id"], now.isoformat()),
            )

        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_deleted_upstream",
            channel_id="UC_DELETED_CHANNEL",
            title="Deleted Private Video",
            duration_seconds=500,
            view_count=12000,
            now_utc=near_expiry,
        )
        youtube_repo.set_manual_video_format("vid_deleted_upstream", "long_form", now_utc=near_expiry)
        idea = idea_repo.create_idea(
            title="Preserved Idea On Deleted Video",
            notes="Must keep notes & manual format",
            source_type="youtube_video",
            source_ref_id="vid_deleted_upstream",
            source_title_snapshot="Deleted Private Video",
            source_url="https://www.youtube.com/watch?v=vid_deleted_upstream",
            tags=[],
            in_global_vault=True,
            target_project_ids=[proj["id"]],
            project_angle="Preserve angle",
        )

        api_calls: list[str] = []

        def _yt_missing_handler(request: httpx.Request) -> httpx.Response:
            api_calls.append(request.url.path)
            if request.url.path.endswith("/videos"):
                return httpx.Response(200, json={"items": []})
            if request.url.path.endswith("/channels"):
                return httpx.Response(200, json={"items": []})
            return httpx.Response(404)

        sched = scheduler_service.LifespanScheduler(startup_delay_sec=0.01)
        await scheduler_service.in_flight_registry.try_acquire("channel:UC_INFLIGHT_CHAN")
        try:
            summary1 = await sched.run_auto_refresh_tick(
                now_utc=now,
                yt_transport=httpx.MockTransport(_yt_missing_handler),
                rss_resolver=_public_dns_v4,
                retry_backoff_sec=0.0,
            )
        finally:
            await scheduler_service.in_flight_registry.release("channel:UC_INFLIGHT_CHAN")

        # 1 unit for videos.list (vid_deleted_upstream) + 1 unit for UC_DELETED_CHANNEL; UC_INFLIGHT_CHAN skipped cleanly!
        self.assertEqual(summary1["youtubeUnitsSpent"], 2)
        self.assertEqual(summary1["channelsRefreshed"], 0)

        vid_after = youtube_repo.get_video_record("vid_deleted_upstream", now_utc=now)
        self.assertIsNotNone(vid_after)
        assert vid_after is not None
        self.assertFalse(vid_after["hasValidApiData"])
        self.assertIsNone(vid_after["title"])
        self.assertEqual(vid_after["manualFormat"], "long_form")
        idea_after = idea_repo.get_idea(idea["id"], now_utc=now)
        self.assertTrue(idea_after["apiPurged"])
        self.assertEqual(idea_after["notes"], "Must keep notes & manual format")

        with read_db() as conn:
            del_status = conn.execute(
                "SELECT status FROM project_channels WHERE channel_id = 'UC_DELETED_CHANNEL'"
            ).fetchone()["status"]
            inf_status = conn.execute(
                "SELECT status FROM project_channels WHERE channel_id = 'UC_INFLIGHT_CHAN'"
            ).fetchone()["status"]
        self.assertEqual(del_status, "error")
        self.assertEqual(inf_status, "active")

        # Detach INFLIGHT channel from test now and verify second tick performs 0 redundant YouTube API calls for dead video/channel
        with write_db() as conn:
            conn.execute("UPDATE project_channels SET status = 'paused' WHERE channel_id = 'UC_INFLIGHT_CHAN'")

        calls_before_second = len(api_calls)
        summary2 = await sched.run_auto_refresh_tick(
            now_utc=now + timedelta(minutes=15),
            yt_transport=httpx.MockTransport(_yt_missing_handler),
            rss_resolver=_public_dns_v4,
            retry_backoff_sec=0.0,
        )
        self.assertEqual(summary2["youtubeUnitsSpent"], 0)
        self.assertEqual(len(api_calls), calls_before_second)

    def test_cr04_unlinked_idea_cannot_be_hidden_from_global_vault(self) -> None:
        proj = project_repo.create_project("Idea Vault Guard Proj")
        idea = idea_repo.create_idea(
            title="Vault Only Idea",
            notes="Must never vanish",
            source_type="manual",
            source_ref_id="m-1",
            source_title_snapshot="",
            source_url="",
            tags=[],
            in_global_vault=True,
            target_project_ids=[],
            project_angle="",
        )
        headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}
        with TestClient(create_app()) as client:
            blocked = client.put(
                f"/api/v1/ideas/{idea['id']}",
                headers=headers,
                json={"inGlobalVault": False},
            )
            self.assertEqual(blocked.status_code, 400)
            self.assertEqual(blocked.json()["error"]["code"], "IDEA_MUST_HAVE_LOCATION")

            idea_repo.upsert_project_idea_link(idea["id"], proj["id"], {"status": "new"})
            allowed = client.put(
                f"/api/v1/ideas/{idea['id']}",
                headers=headers,
                json={"inGlobalVault": False},
            )
            self.assertEqual(allowed.status_code, 200)
            self.assertFalse(allowed.json()["idea"]["inGlobalVault"])

    async def test_cr05_free_search_append_session_pagination_and_published_after_validation(self) -> None:
        with self.assertRaises(AppError) as bad_pa:
            await discovery_service.run_free_search(
                query="sqlite",
                published_after="invalid-date-string",
            )
        self.assertEqual(bad_pa.exception.code, "INVALID_PUBLISHED_AFTER")
        self.assertEqual(quota_service.get_quota_status()["searchQueries"]["used"], 0)

        def _paged_handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/search"):
                token = request.url.params.get("pageToken", "")
                if token == "PAGE_2":
                    return httpx.Response(
                        200,
                        json={"items": [{"id": {"videoId": "vid_page_2"}}]},
                    )
                return httpx.Response(
                    200,
                    json={
                        "nextPageToken": "PAGE_2",
                        "items": [{"id": {"videoId": "vid_page_1"}}],
                    },
                )
            ids = str(request.url.params.get("id", "")).split(",")
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "id": vid,
                            "snippet": {"title": f"Title {vid}", "channelId": "UC_PG_1"},
                            "contentDetails": {"duration": "PT5M"},
                            "statistics": {"viewCount": "100"},
                        }
                        for vid in ids
                        if vid
                    ]
                },
            )

        transport = httpx.MockTransport(_paged_handler)
        page1 = await discovery_service.run_free_search(
            query="pagination test",
            transport=transport,
            retry_backoff_sec=0.0,
        )
        self.assertEqual(len(page1["videos"]), 1)
        self.assertEqual(page1["nextPageToken"], "PAGE_2")

        page2 = await discovery_service.run_free_search(
            query="pagination test",
            page_token="PAGE_2",
            append_session_id=page1["session"]["id"],
            transport=transport,
            retry_backoff_sec=0.0,
        )
        self.assertEqual(page2["session"]["id"], page1["session"]["id"])
        self.assertEqual([v["videoId"] for v in page2["videos"]], ["vid_page_1", "vid_page_2"])
        self.assertEqual(len(discovery_service.list_valid_search_sessions()), 1)

        reopened = discovery_service.get_search_session_detail(page1["session"]["id"])
        self.assertEqual([v["videoId"] for v in reopened["videos"]], ["vid_page_1", "vid_page_2"])

    async def test_cr06_project_refresh_reports_rss_ok_and_error_counts_accurately(self) -> None:
        proj = project_repo.create_project("Project Refresh Honest Counts")
        ok_feed = rss_repo.create_feed(name="OK Feed", url="https://ok.example.com/feed.xml")
        bad_feed = rss_repo.create_feed(name="Bad Feed", url="https://bad.example.com/feed.xml")
        project_repo.set_project_rss_feeds(proj["id"], [ok_feed["id"], bad_feed["id"]])

        rss_xml = b"""<?xml version="1.0"?><rss version="2.0"><channel><title>OK</title><item><title>Story</title><link>https://ok.example.com/1</link></item></channel></rss>"""

        def _rss_handler(request: httpx.Request) -> httpx.Response:
            if request.url.host == "ok.example.com":
                return httpx.Response(200, content=rss_xml)
            return httpx.Response(500, content=b"Server error")

        async def _patched_fetch(url: str, **_kwargs: object) -> list[dict[str, object]]:
            return await rss_client.fetch_and_parse_feed(
                url,
                transport=httpx.MockTransport(_rss_handler),
                resolver=_public_dns_v4,
            )

        with patch("app.services.rss_service.fetch_and_parse_feed", side_effect=_patched_fetch):
            with TestClient(create_app()) as client:
                res = client.post(
                    f"/api/v1/projects/{proj['id']}/refresh",
                    headers={CSRF_HEADER_NAME: CSRF_HEADER_VALUE},
                )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["rssRefreshedCount"], 2)
        self.assertEqual(body["rssOkCount"], 1)
        self.assertEqual(body["rssErrorCount"], 1)

    def test_cr07_migrator_trigger_semicolon_and_keyword_missing_project_404(self) -> None:
        trigger_sql = """
        -- Trigger comment with semicolon; ignored
        CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, val TEXT DEFAULT 'a;b');
        CREATE TRIGGER IF NOT EXISTS trg_items_audit
        AFTER INSERT ON items
        BEGIN
            UPDATE items SET val = 'updated;tag' WHERE id = NEW.id;
        END;
        """
        stmts = split_sql_statements(trigger_sql)
        self.assertEqual(len(stmts), 2)
        self.assertIn("CREATE TRIGGER", stmts[1])
        self.assertTrue(stmts[1].endswith("END;"))

        with self.assertRaises(AppError) as ctx:
            keyword_repo.create_project_keyword("proj-does-not-exist", keyword="orphan")
        self.assertEqual(ctx.exception.code, "PROJECT_NOT_FOUND")
        self.assertEqual(ctx.exception.status_code, 404)
