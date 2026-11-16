from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
import os
import socket
import tempfile
import time
from typing import TypeVar
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
import httpx

from app.clients import rss_client, youtube_client
from app.core.config import DATA_DIR_ENV_VAR, ensure_runtime_dirs
from app.core.errors import AppError
from app.core.logging_setup import close_logging_handlers, configure_logging
from app.core.security import CSRF_HEADER_NAME, CSRF_HEADER_VALUE
from app.db.connection import read_db, write_db
from app.db.migrator import create_sqlite_backup, resolve_db_path, run_migrations
from app.main import create_app
from app.repositories import idea_repo, keyword_repo, project_repo, rss_repo, settings_repo, youtube_repo
from app.services import (
    competitor_service,
    discovery_service,
    keyword_service,
    quota_service,
    retention_service,
    rss_service,
)


class Phase8VerificationMatrixTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._prev_dir = os.environ.get(DATA_DIR_ENV_VAR)
        os.environ[DATA_DIR_ENV_VAR] = self._tmp.name
        run_migrations()
        settings_repo.set_legal_consent(True)
        settings_repo.save_youtube_api_key("AIzaSyPhase8TestMockKey98765")

    def tearDown(self) -> None:
        close_logging_handlers()
        if self._prev_dir is None:
            os.environ.pop(DATA_DIR_ENV_VAR, None)
        else:
            os.environ[DATA_DIR_ENV_VAR] = self._prev_dir
        self._tmp.cleanup()

    def test_defect01_secret_redaction_in_exception_traceback(self) -> None:
        logger = configure_logging()
        try:
            raise RuntimeError(
                "Upstream failed url=https://www.googleapis.com/youtube/v3/search?part=id&key=AIzaSySecretKey987654321 "
                "auth=Bearer ya29.SuperSecretToken"
            )
        except RuntimeError:
            logger.exception("Request crashed with upstream credentials")
        finally:
            close_logging_handlers()

        log_path = ensure_runtime_dirs()["logs"] / "research_studio.log"
        log_text = log_path.read_text(encoding="utf-8")
        self.assertNotIn("AIzaSySecretKey987654321", log_text)
        self.assertNotIn("ya29.SuperSecretToken", log_text)
        self.assertIn("[REDACTED]", log_text)

    def test_defect02_project_videos_id_collision_across_projects(self) -> None:
        now = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)
        now_iso = now.isoformat()
        proj_a = "proj-a111111111"
        proj_b = "proj-a222222222"

        with write_db() as conn:
            conn.execute(
                """
                INSERT INTO projects (id, name, description, region_code, relevance_language, target_format, created_at, updated_at)
                VALUES (?, 'Project A1', '', 'VN', 'vi', 'all', ?, ?),
                       (?, 'Project A2', '', 'VN', 'vi', 'all', ?, ?)
                """,
                (proj_a, now_iso, now_iso, proj_b, now_iso, now_iso),
            )

        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_shared_01",
            channel_id="UC_SHARED_01",
            title="Shared Canonical Breakout Video",
            duration_seconds=640,
            view_count=55000,
            now_utc=now,
        )

        res_a = youtube_repo.upsert_project_video_breakout(
            proj_a,
            "vid_shared_01",
            is_user_breakout=True,
            notes="Alpha breakout note",
            now_utc=now,
        )
        res_b = youtube_repo.upsert_project_video_breakout(
            proj_b,
            "vid_shared_01",
            is_user_breakout=False,
            notes="Beta observation note",
            now_utc=now,
        )

        self.assertTrue(res_a["flagged"])
        self.assertEqual(res_a["notes"], "Alpha breakout note")
        self.assertFalse(res_b["flagged"])
        self.assertEqual(res_b["notes"], "Beta observation note")

        list_a = youtube_repo.list_project_breakout_videos(proj_a, now_utc=now)
        list_b = youtube_repo.list_project_breakout_videos(proj_b, now_utc=now)
        self.assertEqual(list_a["totalCount"], 1)
        self.assertTrue(list_a["items"][0]["isUserBreakout"])
        self.assertEqual(list_a["items"][0]["breakoutNotes"], "Alpha breakout note")
        self.assertEqual(list_b["totalCount"], 1)
        self.assertFalse(list_b["items"][0]["isUserBreakout"])
        self.assertEqual(list_b["items"][0]["breakoutNotes"], "Beta observation note")

    async def test_defect03_rss_dns_rebinding_toctou_blocked(self) -> None:
        scenarios = [
            ("loopback_v4", "127.0.0.1", socket.AF_INET),
            ("metadata_v4", "169.254.169.254", socket.AF_INET),
            ("loopback_v6", "::1", socket.AF_INET6),
        ]
        for label, rebind_ip, family in scenarios:
            with self.subTest(scenario=label, rebind_ip=rebind_ip):
                call_count = 0

                def _stateful_resolver(_host: str, port: int) -> list[tuple[object, ...]]:
                    nonlocal call_count
                    call_count += 1
                    if call_count == 1:
                        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port))]
                    if family == socket.AF_INET6:
                        return [(socket.AF_INET6, socket.SOCK_STREAM, 6, "", (rebind_ip, port, 0, 0))]
                    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (rebind_ip, port))]

                with self.assertRaises(AppError) as ctx:
                    await rss_client.fetch_and_parse_feed(
                        f"http://{label}.rebind.example/feed.xml",
                        resolver=_stateful_resolver,
                    )
                self.assertEqual(ctx.exception.code, "RSS_SSRF_BLOCKED")
                self.assertGreaterEqual(call_count, 2)

    async def test_defect06a_free_search_channel_published_after_and_page_token(self) -> None:
        seen_search_params: list[dict[str, str]] = []

        def _handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/search"):
                seen_search_params.append(dict(request.url.params))
                return httpx.Response(
                    200,
                    json={
                        "nextPageToken": "CAUQAA",
                        "items": [
                            {"id": {"kind": "youtube#channel", "channelId": "UC_CHAN_SEARCH_01"}},
                        ],
                    },
                )
            if request.url.path.endswith("/channels"):
                return httpx.Response(
                    200,
                    json={
                        "items": [
                            {
                                "id": "UC_CHAN_SEARCH_01",
                                "snippet": {
                                    "title": "Automation Studio VN",
                                    "customUrl": "@automationvn",
                                    "description": "Channel from G3 channel search",
                                    "country": "VN",
                                },
                                "contentDetails": {"relatedPlaylists": {"uploads": "UU_CHAN_SEARCH_01"}},
                                "statistics": {"subscriberCount": "42000", "videoCount": "120"},
                            }
                        ]
                    },
                )
            return httpx.Response(404)

        mock_transport = httpx.MockTransport(_handler)
        result = await discovery_service.run_free_search(
            query="automation",
            object_type="channel",
            region_code="VN",
            relevance_language="vi",
            published_after="2026-11-01T00:00:00Z",
            order_by="relevance",
            max_results=10,
            page_token="CGQQAA",
            transport=mock_transport,
        )

        self.assertEqual(seen_search_params[0]["type"], "channel")
        self.assertEqual(seen_search_params[0]["publishedAfter"], "2026-11-01T00:00:00Z")
        self.assertEqual(seen_search_params[0]["pageToken"], "CGQQAA")
        self.assertEqual(result["nextPageToken"], "CAUQAA")
        self.assertEqual(result["session"]["objectType"], "channel")
        self.assertEqual(len(result["channels"]), 1)
        self.assertEqual(result["channels"][0]["channelId"], "UC_CHAN_SEARCH_01")

        reopened = discovery_service.get_search_session_detail(result["session"]["id"])
        self.assertEqual(len(reopened["channels"]), 1)
        self.assertEqual(reopened["channels"][0]["handle"], "@automationvn")

        async def _fake_call_youtube(
            endpoint: str,
            params: dict[str, object],
            **_kwargs: object,
        ) -> dict[str, object]:
            if endpoint == "search":
                return {
                    "nextPageToken": "PAGE_2_TOKEN",
                    "items": [{"id": {"channelId": "UC_CHAN_HTTP_01"}}],
                }
            return {
                "items": [
                    {
                        "id": "UC_CHAN_HTTP_01",
                        "snippet": {"title": "HTTP Channel Route", "customUrl": "@httproute"},
                        "contentDetails": {"relatedPlaylists": {"uploads": "UU_HTTP_01"}},
                        "statistics": {"subscriberCount": "1500", "videoCount": "12"},
                    }
                ]
            }

        with patch("app.clients.youtube_client.call_youtube_api", side_effect=_fake_call_youtube):
            with TestClient(create_app()) as client:
                http_res = client.post(
                    "/api/v1/global/search",
                    headers={CSRF_HEADER_NAME: CSRF_HEADER_VALUE},
                    json={
                        "query": "automation",
                        "objectType": "channel",
                        "regionCode": "VN",
                        "relevanceLanguage": "vi",
                        "publishedAfter": "2026-11-01T00:00:00Z",
                        "orderBy": "relevance",
                        "maxResults": 10,
                        "pageToken": "PAGE_1_TOKEN",
                    },
                )
        self.assertEqual(http_res.status_code, 200)
        body = http_res.json()
        self.assertEqual(body["nextPageToken"], "PAGE_2_TOKEN")
        self.assertEqual(body["channels"][0]["channelId"], "UC_CHAN_HTTP_01")

    async def test_defect07_timeout_retry_and_fatal_competitor_refresh(self) -> None:
        now = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)
        gen_attempts = 0

        def _timeout_then_ok(request: httpx.Request) -> httpx.Response:
            nonlocal gen_attempts
            gen_attempts += 1
            if gen_attempts == 1:
                raise httpx.ReadTimeout("Transient upstream read timeout", request=request)
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "id": "vid_timeout_retry_ok",
                            "snippet": {"title": "Recovered After Timeout", "channelId": "UC_TO_1"},
                            "contentDetails": {"duration": "PT4M20S"},
                            "statistics": {"viewCount": "900"},
                        }
                    ]
                },
            )

        res = await youtube_client.fetch_videos_by_ids(
            ["vid_timeout_retry_ok"],
            transport=httpx.MockTransport(_timeout_then_ok),
            retry_backoff_sec=0.0,
        )
        self.assertEqual(gen_attempts, 2)
        self.assertEqual(len(res), 1)
        self.assertEqual(quota_service.get_quota_status()["generalData"]["used"], 2)

        search_attempts = 0

        def _search_timeout(request: httpx.Request) -> httpx.Response:
            nonlocal search_attempts
            search_attempts += 1
            raise httpx.ReadTimeout("Search timeout must not retry", request=request)

        with self.assertRaises(AppError) as search_ctx:
            await youtube_client.search_youtube_page(
                query="no retry",
                transport=httpx.MockTransport(_search_timeout),
            )
        self.assertEqual(search_ctx.exception.code, "YOUTUBE_TIMEOUT")
        self.assertEqual(search_attempts, 1)

        proj = project_repo.create_project("Fatal Error Isolation Proj")
        youtube_repo.upsert_channel(channel_id="UC_FATAL_1", title="Fatal Test 1", now_utc=now)
        youtube_repo.upsert_channel(channel_id="UC_FATAL_2", title="Fatal Test 2", now_utc=now)
        with write_db() as conn:
            conn.execute(
                """
                INSERT INTO project_channels (id, project_id, channel_id, status, notes, added_at)
                VALUES ('pc-f1', ?, 'UC_FATAL_1', 'active', '', ?),
                       ('pc-f2', ?, 'UC_FATAL_2', 'active', '', ?)
                """,
                (proj["id"], now.isoformat(), proj["id"], now.isoformat()),
            )
            conn.execute("UPDATE system_settings SET encrypted_youtube_api_key = ? WHERE id = 1", (b"corrupted_blob",))

        with self.assertRaises(AppError) as fatal_ctx:
            await competitor_service.refresh_project_competitors(proj["id"], now_utc=now)
        self.assertEqual(fatal_ctx.exception.code, "YOUTUBE_API_KEY_UNREADABLE")
        self.assertEqual(fatal_ctx.exception.status_code, 400)

        with read_db() as conn:
            statuses = [
                r["status"]
                for r in conn.execute(
                    "SELECT status FROM project_channels WHERE project_id = ?",
                    (proj["id"],),
                ).fetchall()
            ]
        self.assertEqual(statuses, ["active", "active"])

    async def test_edge_cases_malformed_youtube_atom_sqli_inflight_and_purge(self) -> None:
        now = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)

        # Malformed / sparse YouTube item + 400 keyInvalid + 404
        sparse = youtube_client.parse_youtube_video_item(
            {
                "id": "vid_sparse_live",
                "snippet": {"title": "Live Stream Without Stats", "liveBroadcastContent": "live"},
                "contentDetails": {},
                "statistics": {},
            }
        )
        self.assertIsNone(sparse["view_count"])
        self.assertIsNone(sparse["duration_seconds"])
        self.assertTrue(sparse["is_live_streaming"])

        def _key_invalid(_req: httpx.Request) -> httpx.Response:
            return httpx.Response(400, json={"error": {"errors": [{"reason": "keyInvalid"}], "message": "Bad key"}})

        with self.assertRaises(AppError) as key_ctx:
            await youtube_client.call_youtube_api(
                "videos",
                {"part": "id", "id": "x"},
                bucket="general_data",
                transport=httpx.MockTransport(_key_invalid),
                retry_backoff_sec=0.0,
            )
        self.assertEqual(key_ctx.exception.code, "YOUTUBE_API_KEY_INVALID")

        def _not_found(_req: httpx.Request) -> httpx.Response:
            return httpx.Response(404, json={"error": {"message": "Playlist not found"}})

        with self.assertRaises(AppError) as nf_ctx:
            await youtube_client.call_youtube_api(
                "playlistItems",
                {"part": "contentDetails", "playlistId": "UU_MISSING"},
                bucket="general_data",
                transport=httpx.MockTransport(_not_found),
                retry_backoff_sec=0.0,
            )
        self.assertEqual(nf_ctx.exception.code, "YOUTUBE_UPSTREAM_ERROR")

        # Atom 1.0 + XSS link stripping + XXE/entity expansion rejection
        atom_xml = b"""<?xml version="1.0" encoding="utf-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Atom Feed</title>
          <entry>
            <id>urn:uuid:atom-1</id>
            <title>Atom Title &lt;script&gt;alert(1)&lt;/script&gt;</title>
            <link rel="alternate" href="https://news.example.com/atom-1"/>
            <link rel="related" href="javascript:alert(1)"/>
            <summary type="html">&lt;p&gt;Safe &lt;img src=x onerror=alert(1)/&gt; summary&lt;/p&gt;</summary>
            <published>2026-11-16T08:00:00Z</published>
          </entry>
          <entry>
            <id>urn:uuid:atom-2</id>
            <title>Blocked JS Link</title>
            <link rel="alternate" href="javascript:void(0)"/>
            <updated>2026-11-16T09:00:00Z</updated>
          </entry>
        </feed>"""
        parsed_atom = rss_client.parse_feed_xml(atom_xml)
        self.assertEqual(len(parsed_atom), 2)
        self.assertEqual(parsed_atom[0]["title"], "Atom Title")
        self.assertEqual(parsed_atom[0]["canonical_url"], "https://news.example.com/atom-1")
        self.assertEqual(parsed_atom[0]["summary_text"], "Safe summary")
        self.assertEqual(parsed_atom[1]["canonical_url"], "")

        xxe_xml = b"""<?xml version="1.0"?>
        <!DOCTYPE lolz [<!ENTITY lol "lol">]>
        <rss version="2.0"><channel><item><title>&lol;</title></item></channel></rss>"""
        with self.assertRaises(AppError) as xml_ctx:
            rss_client.parse_feed_xml(xxe_xml)
        self.assertEqual(xml_ctx.exception.code, "RSS_INVALID_XML")

        # SQL injection payloads stay parameterized
        sqli = "' OR '1'='1'; DROP TABLE projects; --"
        proj = project_repo.create_project(sqli)
        kw = keyword_repo.create_project_keyword(proj["id"], keyword=sqli)
        self.assertEqual(rss_repo.list_articles(search=sqli), [])
        self.assertEqual(idea_repo.list_ideas(search=sqli), [])
        self.assertEqual(len(keyword_service.list_keywords_with_project_rss_overview(proj["id"])["items"]), 1)
        self.assertEqual(keyword_service.get_keyword_cached_results(proj["id"], kw["id"])["keyword"]["rssMatchCount"], 0)
        self.assertIsNotNone(project_repo.get_project(proj["id"]))

        # in_flight_registry deduplicates concurrent channel refreshes
        youtube_repo.upsert_channel(
            channel_id="UC_CONCURRENT",
            title="Concurrent Channel",
            uploads_playlist_id="UU_CONCURRENT",
            now_utc=now,
        )
        upstream_channel_calls = 0

        class _SlowYoutubeTransport(httpx.AsyncBaseTransport):
            async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
                nonlocal upstream_channel_calls
                if request.url.path.endswith("/channels"):
                    upstream_channel_calls += 1
                    await asyncio.sleep(0.05)
                    return httpx.Response(
                        200,
                        json={
                            "items": [
                                {
                                    "id": "UC_CONCURRENT",
                                    "snippet": {"title": "Concurrent Updated"},
                                    "contentDetails": {"relatedPlaylists": {"uploads": "UU_CONCURRENT"}},
                                    "statistics": {"subscriberCount": "100", "videoCount": "1"},
                                }
                            ]
                        },
                    )
                if request.url.path.endswith("/playlistItems"):
                    return httpx.Response(200, json={"items": []})
                return httpx.Response(404)

        slow_transport = _SlowYoutubeTransport()
        manual_task = asyncio.create_task(
            competitor_service.refresh_competitor_channel(
                "UC_CONCURRENT",
                is_auto_refresh=False,
                transport=slow_transport,
                retry_backoff_sec=0.0,
                now_utc=now,
            )
        )
        await asyncio.sleep(0.01)
        auto_res = await competitor_service.refresh_competitor_channel(
            "UC_CONCURRENT",
            is_auto_refresh=True,
            transport=slow_transport,
            retry_backoff_sec=0.0,
            now_utc=now,
        )
        manual_res = await manual_task
        self.assertTrue(auto_res["skippedInFlight"])
        self.assertEqual(manual_res["channelId"], "UC_CONCURRENT")
        self.assertEqual(upstream_channel_calls, 1)

        # Backup .db purge + Project recovery JSON preservation
        dirs = ensure_runtime_dirs()
        db_backup = create_sqlite_backup(resolve_db_path(), dirs["backups"], prefix="pre_migration")
        recovery_json = dirs["backups"] / "project_recovery_20261116T120000Z_keep.json"
        recovery_json.write_text('{"keep": true}', encoding="utf-8")

        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_purge_me",
            channel_id="UC_CONCURRENT",
            title="Transient Title",
            duration_seconds=700,
            view_count=999,
            now_utc=now,
        )
        youtube_repo.set_manual_video_format("vid_purge_me", "long_form", now_utc=now)
        feed = rss_repo.create_feed(name="Keep RSS", url="https://rss.example.com/feed.xml")
        rss_repo.record_feed_fetch_success(
            feed["id"],
            [
                {
                    "dedup_key": "k1",
                    "canonical_url": "https://rss.example.com/a1",
                    "title": "Keep RSS Article",
                    "summary_text": "Preserved summary",
                    "published_at": now.isoformat(),
                }
            ],
        )
        idea = idea_repo.create_idea(
            title="Keep Multi-Project Idea",
            notes="User research insight",
            source_type="youtube_video",
            source_ref_id="vid_purge_me",
            source_title_snapshot="Transient Title",
            source_url="https://www.youtube.com/watch?v=vid_purge_me",
            tags=["architecture"],
            in_global_vault=True,
            target_project_ids=[proj["id"]],
            project_angle="Deep dive",
            initial_status="approved",
            now_utc=now,
        )

        purge_result = retention_service.purge_all_youtube_api_data_by_user_request(now_utc=now)
        self.assertGreaterEqual(int(purge_result["dbBackupsDeleted"]), 1)
        self.assertFalse(db_backup.exists())
        self.assertTrue(recovery_json.exists())
        self.assertEqual(youtube_repo.get_video_record("vid_purge_me", now_utc=now)["manualFormat"], "long_form")
        self.assertEqual(idea_repo.get_idea(idea["id"], now_utc=now)["projectLinks"][proj["id"]]["status"], "approved")
        self.assertEqual(len(rss_repo.list_articles()), 1)

    def test_backend_scale_latency_800_videos_300_rss_60_ideas(self) -> None:
        now = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)
        now_iso = now.isoformat()
        projects = [project_repo.create_project(f"Scale Proj {i}") for i in range(3)]
        feeds = [rss_repo.create_feed(name=f"Scale Feed {i}", url=f"https://scale.example.com/feed-{i}.xml") for i in range(6)]
        for proj in projects:
            project_repo.set_project_rss_feeds(proj["id"], [f["id"] for f in feeds])

        with write_db() as conn:
            for c_idx in range(12):
                cid = f"UC_SCALE_{c_idx:03d}"
                youtube_repo.upsert_channel(channel_id=cid, title=f"Scale Channel {c_idx}", now_utc=now, conn=conn)
                for proj in projects[:2] if c_idx < 6 else projects[1:]:
                    conn.execute(
                        "INSERT INTO project_channels (id, project_id, channel_id, status, notes, added_at) VALUES (?, ?, ?, 'active', '', ?)",
                        (f"pc-{proj['id'][-6:]}-{c_idx}", proj["id"], cid, now_iso),
                    )

            for v_idx in range(800):
                cid = f"UC_SCALE_{v_idx % 12:03d}"
                vid = f"vid_scale_{v_idx:04d}"
                youtube_repo.upsert_video_and_snapshot(
                    video_id=vid,
                    channel_id=cid,
                    title=f"Scale Research Video {v_idx} Local SQLite",
                    duration_seconds=90 if v_idx % 5 == 0 else 420 + (v_idx % 500),
                    view_count=1000 + v_idx * 97,
                    like_count=50 + v_idx,
                    comment_count=5 + (v_idx % 40),
                    published_at=(now - timedelta(days=v_idx % 25)).isoformat(),
                    now_utc=now - timedelta(hours=2),
                    conn=conn,
                )
                youtube_repo.upsert_video_and_snapshot(
                    video_id=vid,
                    channel_id=cid,
                    title=f"Scale Research Video {v_idx} Local SQLite",
                    duration_seconds=90 if v_idx % 5 == 0 else 420 + (v_idx % 500),
                    view_count=1500 + v_idx * 103,
                    like_count=60 + v_idx,
                    comment_count=6 + (v_idx % 40),
                    published_at=(now - timedelta(days=v_idx % 25)).isoformat(),
                    now_utc=now,
                    conn=conn,
                )

        per_feed = 50
        for f_idx, feed in enumerate(feeds):
            batch = [
                {
                    "dedup_key": f"https://scale.example.com/{f_idx}/{a_idx}",
                    "canonical_url": f"https://scale.example.com/{f_idx}/{a_idx}",
                    "title": f"Local Architecture Signal {f_idx}-{a_idx}",
                    "summary_text": f"Research insight covering SQLite WAL indexing and RSS ingestion #{a_idx}.",
                    "published_at": (now - timedelta(hours=(f_idx * per_feed + a_idx) % 140)).isoformat(),
                }
                for a_idx in range(per_feed)
            ]
            rss_repo.record_feed_fetch_success(feed["id"], batch)

        statuses = ("new", "researching", "approved", "produced", "skipped")
        for i_idx in range(60):
            idea_repo.create_idea(
                title=f"Scale Multi-Project Idea {i_idx}",
                notes=f"Structured note {i_idx}",
                source_type="youtube_video" if i_idx % 2 == 0 else "manual",
                source_ref_id=f"vid_scale_{i_idx:04d}" if i_idx % 2 == 0 else "",
                source_title_snapshot=f"Video {i_idx}",
                source_url="",
                tags=["scale", statuses[i_idx % 5]],
                in_global_vault=True,
                target_project_ids=[projects[0]["id"], projects[1]["id"]],
                project_angle=f"Angle {i_idx}",
                initial_status=statuses[i_idx % 5],
                now_utc=now,
            )

        T = TypeVar("T")
        timings_ms: dict[str, float] = {}

        def _measure(label: str, fn: Callable[[], T]) -> T:
            t0 = time.perf_counter()
            res = fn()
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            timings_ms[label] = elapsed_ms
            self.assertLess(elapsed_ms, 250.0, f"{label} took {elapsed_ms:.2f}ms >= 250ms")
            return res

        global_ov = _measure("global_overview", lambda: youtube_repo.get_global_overview_summary(now_utc=now))
        proj_ov = _measure(
            "project_overview",
            lambda: youtube_repo.get_project_overview_summary(projects[1]["id"], now_utc=now),
        )
        comp = _measure("list_competitors", lambda: competitor_service.list_project_competitors(projects[1]["id"], now_utc=now))
        brk = _measure("list_breakout", lambda: youtube_repo.list_project_breakout_videos(projects[1]["id"], now_utc=now))
        rss_arts = _measure(
            "list_rss_articles",
            lambda: rss_repo.list_articles(project_id=projects[0]["id"], search="SQLite", limit=200),
        )
        phrases = _measure(
            "rss_phrases_7d",
            lambda: rss_service.compute_rss_phrases(project_id=projects[0]["id"], days=7, limit=10, now_utc=now),
        )
        ideas_filtered = _measure(
            "list_ideas_filtered",
            lambda: idea_repo.list_ideas(project_id=projects[0]["id"], status="approved", now_utc=now),
        )

        self.assertEqual(global_ov["validVideosCount"], 800)
        self.assertEqual(global_ov["rssSummary"]["articlesCount"], 300)
        self.assertEqual(proj_ov["competitorVideos"]["totalValid"], 800)
        self.assertEqual(len(comp["videos"]), 800)
        self.assertEqual(brk["totalCount"], 800)
        self.assertEqual(len(rss_arts), 200)
        self.assertGreater(len(phrases["items"]), 0)
        self.assertEqual(len(ideas_filtered), 12)
        summary = " ".join(f"{k}={v:.2f}ms" for k, v in timings_ms.items())
        print(f"[SCALE BENCHMARK 800v/300rss/60ideas] {summary}")
