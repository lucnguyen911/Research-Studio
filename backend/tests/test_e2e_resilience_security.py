from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
import tempfile
import time
import unittest

from fastapi.testclient import TestClient

from app.core.config import DATA_DIR_ENV_VAR
from app.core.security import CSRF_HEADER_NAME, CSRF_HEADER_VALUE
from app.db.connection import read_db, write_db
from app.db.migrator import run_migrations
from app.main import create_app
from app.repositories import idea_repo, keyword_repo, project_repo, rss_repo, settings_repo, youtube_repo
from app.services import quota_service, retention_service


class EndToEndResilienceSecurityAndBenchmarkTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._prev_dir = os.environ.get(DATA_DIR_ENV_VAR)
        os.environ[DATA_DIR_ENV_VAR] = self._tmp.name
        run_migrations()

    def tearDown(self) -> None:
        if self._prev_dir is None:
            os.environ.pop(DATA_DIR_ENV_VAR, None)
        else:
            os.environ[DATA_DIR_ENV_VAR] = self._prev_dir
        self._tmp.cleanup()

    def test_zero_project_global_offline_dual_quota_dpapi_and_security_invariants(self) -> None:
        headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}
        with TestClient(create_app()) as client:
            # 1) Global research & Idea Vault work seamlessly with 0 Projects (AC-02)
            assert client.get("/api/v1/global/overview", headers=headers).json()["projectsCount"] == 0
            vault_idea = client.post(
                "/api/v1/ideas",
                headers=headers,
                json={
                    "title": "Offline Global Idea",
                    "notes": "Works cleanly without API key or Projects",
                    "sourceType": "manual",
                    "inGlobalVault": True,
                },
            )
            self.assertEqual(vault_idea.status_code, 201)

            # 2) Legal consent gate & DPAPI encryption + unreadable key recovery (AC-15, AC-16, AC-17)
            blocked_key = client.put(
                "/api/v1/system/youtube-api-key",
                headers=headers,
                json={"apiKey": "AIzaSyForbiddenBeforeLegal1234"},
            )
            self.assertEqual(blocked_key.status_code, 400)

            client.post("/api/v1/system/legal-consent", headers=headers, json={"accepted": True})
            saved_key = client.put(
                "/api/v1/system/youtube-api-key",
                headers=headers,
                json={"apiKey": "AIzaSySecretDesktopDpapi9999"},
            )
            self.assertEqual(saved_key.status_code, 200)
            self.assertNotIn("SecretDesktopDpapi", saved_key.text)
            self.assertEqual(saved_key.json()["apiKeyStatus"], "configured")

            # Simulate corrupted DPAPI ciphertext in SQLite -> clean recovery without crash
            with write_db() as conn:
                conn.execute("UPDATE system_settings SET encrypted_youtube_api_key = ? WHERE id = 1", (b"bad_dpapi",))
            settings_after = client.get("/api/v1/system/settings", headers=headers).json()
            self.assertEqual(settings_after["apiKeyStatus"], "unreadable")

            # 3) Mutating request without CSRF header or from foreign Origin is blocked (AC-16)
            no_csrf = client.post("/api/v1/projects", json={"name": "Blocked"})
            self.assertEqual(no_csrf.status_code, 403)
            bad_origin = client.post(
                "/api/v1/projects",
                headers={**headers, "Origin": "http://evil.attacker.local"},
                json={"name": "BlockedOrigin"},
            )
            self.assertEqual(bad_origin.status_code, 403)

            # 4) Dual-bucket quota isolation: exhaust Search Queries 100/100 without locking General Data API (AC-05)
            now = datetime.now(timezone.utc)
            quota_service.mark_bucket_exhausted_403("search_queries", now_utc=now)
            q_state = client.get("/api/v1/system/quota", headers=headers).json()
            self.assertTrue(q_state["searchQueries"]["exhausted"])
            self.assertFalse(q_state["generalData"]["exhausted"])
            # General Data API unit reservation STILL succeeds!
            log_id = quota_service.reserve_quota_unit("general_data", "videos", now_utc=now)
            quota_service.refund_quota_on_connect_error(log_id, now_utc=now)
            self.assertEqual(quota_service.get_quota_status(now_utc=now)["generalData"]["used"], 0)

            # 5) Immediate YouTube cache purge preserves User-Created Data 100% (AC-12, AC-17)
            proj = project_repo.create_project("Purge Resilient Project")
            keyword_repo.create_project_keyword(proj["id"], keyword="resilience test")
            youtube_repo.upsert_video_and_snapshot(
                video_id="vid_e2e_keep",
                channel_id="UC_E2E_1",
                title="Transient YT Title",
                duration_seconds=600,
                view_count=10000,
                now_utc=now,
            )
            youtube_repo.set_manual_video_format("vid_e2e_keep", "long_form")
            youtube_repo.upsert_project_video_breakout(proj["id"], "vid_e2e_keep", is_user_breakout=True, notes="Keep note")
            purge_res = client.post("/api/v1/system/purge-youtube-cache", headers=headers)
            self.assertEqual(purge_res.status_code, 200)

            vid = youtube_repo.get_video_record("vid_e2e_keep", now_utc=now)
            self.assertFalse(vid["hasValidApiData"])
            self.assertIsNone(vid["title"])
            self.assertEqual(vid["manualFormat"], "long_form")
            breakout = youtube_repo.list_project_breakout_videos(proj["id"], only_flagged=True, now_utc=now)
            self.assertEqual(breakout["totalCount"], 1)
            self.assertEqual(breakout["items"][0]["breakoutNotes"], "Keep note")
            self.assertEqual(len(keyword_repo.list_project_keywords(proj["id"])), 1)
            self.assertEqual(idea_repo.get_idea(vault_idea.json()["idea"]["id"])["title"], "Offline Global Idea")

    def test_baseline_benchmark_550_videos_and_220_rss_articles(self) -> None:
        """Measure SQLite query latency on >=500 videos & >=200 RSS articles for Phase 11 tuning."""
        now = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)
        now_iso = now.isoformat()
        proj = project_repo.create_project("Benchmark Scale Proj")
        feed = rss_repo.create_feed(name="Bench Feed", url="https://example.com/bench.xml")
        project_repo.set_project_rss_feeds(proj["id"], [feed["id"]])

        with write_db() as conn:
            for c_idx in range(10):
                cid = f"UC_BENCH_{c_idx:04d}"
                youtube_repo.upsert_channel(channel_id=cid, title=f"Bench Channel {c_idx}", now_utc=now, conn=conn)
                conn.execute(
                    "INSERT INTO project_channels (id, project_id, channel_id, status, notes, added_at) VALUES (?, ?, ?, 'active', '', ?)",
                    (f"pc-bench-{c_idx}", proj["id"], cid, now_iso),
                )
            for v_idx in range(550):
                cid = f"UC_BENCH_{v_idx % 10:04d}"
                youtube_repo.upsert_video_and_snapshot(
                    video_id=f"vid_bench_{v_idx:04d}",
                    channel_id=cid,
                    title=f"Benchmark Video {v_idx} SQLite Local Architecture",
                    duration_seconds=120 + (v_idx % 900),
                    view_count=5000 + v_idx * 123,
                    like_count=100 + v_idx,
                    comment_count=10 + (v_idx % 80),
                    published_at=(now - timedelta(days=v_idx % 28)).isoformat(),
                    now_utc=now,
                    conn=conn,
                )

        articles = [
            {
                "dedup_key": f"https://example.com/bench/{idx}",
                "canonical_url": f"https://example.com/bench/{idx}",
                "title": f"Local Research Article {idx} SQLite FastAPI",
                "summary_text": f"Detailed benchmark analysis article number {idx} covering local sqlite storage.",
                "published_at": (now - timedelta(hours=idx)).isoformat(),
            }
            for idx in range(220)
        ]
        rss_repo.record_feed_fetch_success(feed["id"], articles)

        t0 = time.perf_counter()
        bo = youtube_repo.list_project_breakout_videos(proj["id"], days_window=30, now_utc=now)
        bo_ms = (time.perf_counter() - t0) * 1000.0

        t1 = time.perf_counter()
        ov = youtube_repo.get_project_overview_summary(proj["id"], now_utc=now)
        ov_ms = (time.perf_counter() - t1) * 1000.0

        t2 = time.perf_counter()
        arts = rss_repo.list_articles(project_id=proj["id"], limit=200)
        rss_ms = (time.perf_counter() - t2) * 1000.0

        t3 = time.perf_counter()
        purged = retention_service.purge_expired_api_data(now_utc=now + timedelta(days=31))
        purge_ms = (time.perf_counter() - t3) * 1000.0

        self.assertEqual(bo["totalCount"], 550)
        self.assertEqual(ov["competitorVideos"]["totalValid"], 550)
        self.assertEqual(len(arts), 200)
        self.assertEqual(purged["videosDeleted"], 550)
        print(
            f"[BENCHMARK BASELINE] breakout_550={bo_ms:.2f}ms project_overview={ov_ms:.2f}ms "
            f"rss_220_query={rss_ms:.2f}ms purge_550={purge_ms:.2f}ms",
            flush=True,
        )
        self.assertLess(bo_ms, 500.0)
        self.assertLess(ov_ms, 500.0)
        self.assertLess(rss_ms, 500.0)
        self.assertLess(purge_ms, 500.0)

        with read_db() as conn:
            rem = conn.execute("SELECT COUNT(*) AS cnt FROM youtube_videos").fetchone()["cnt"]
            self.assertEqual(rem, 0)
