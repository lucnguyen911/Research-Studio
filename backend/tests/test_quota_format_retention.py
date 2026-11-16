from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import tempfile
import unittest

from fastapi.testclient import TestClient

from app.core.errors import AppError
from app.core.security import CSRF_HEADER_NAME, CSRF_HEADER_VALUE
from app.db.connection import read_db, write_db
from app.db.migrator import create_sqlite_backup, run_migrations
from app.main import create_app
from app.repositories import project_repo, youtube_repo
from app.services import format_classifier, quota_service, retention_service


class QuotaFormatRetentionTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._prev_dir = os.environ.get("RESEARCH_STUDIO_DATA_DIR")
        os.environ["RESEARCH_STUDIO_DATA_DIR"] = self._tmp.name
        run_migrations()

    def tearDown(self) -> None:
        if self._prev_dir is None:
            os.environ.pop("RESEARCH_STUDIO_DATA_DIR", None)
        else:
            os.environ["RESEARCH_STUDIO_DATA_DIR"] = self._prev_dir
        self._tmp.cleanup()

    def test_dst_midnight_pt_window_calculation(self) -> None:
        # Spring-forward DST day in US Pacific: 2026-03-08 switches from PST (-08:00) to PDT (-07:00)
        utc_during_spring = datetime(2026, 3, 8, 12, 0, 0, tzinfo=timezone.utc)
        pt_date, _now, reset_utc = quota_service.compute_pt_window(utc_during_spring)
        self.assertEqual(pt_date, "2026-03-08")
        self.assertEqual(reset_utc, datetime(2026, 3, 9, 7, 0, 0, tzinfo=timezone.utc))

        # Fall-back DST day in US Pacific: 2026-11-01 switches from PDT (-07:00) to PST (-08:00)
        utc_during_fall = datetime(2026, 11, 1, 12, 0, 0, tzinfo=timezone.utc)
        pt_date_fall, _now_f, reset_utc_fall = quota_service.compute_pt_window(utc_during_fall)
        self.assertEqual(pt_date_fall, "2026-11-01")
        self.assertEqual(reset_utc_fall, datetime(2026, 11, 2, 8, 0, 0, tzinfo=timezone.utc))

    def test_atomic_concurrent_search_quota_prevents_overrun_and_supports_connect_refund(self) -> None:
        fixed_now = datetime(2026, 11, 16, 20, 0, 0, tzinfo=timezone.utc)
        pt_date, _n, _r = quota_service.compute_pt_window(fixed_now)
        with write_db() as conn:
            conn.execute(
                """
                INSERT INTO quota_daily_ledger (
                    pt_date, search_queries_used, general_data_used, updated_at
                ) VALUES (?, 95, 0, ?)
                """,
                (pt_date, fixed_now.isoformat()),
            )

        def _try_reserve(_idx: int) -> bool:
            try:
                quota_service.reserve_quota_unit("search_queries", "search.list", now_utc=fixed_now)
                return True
            except AppError as exc:
                if exc.code == "QUOTA_SEARCH_EXHAUSTED":
                    return False
                raise

        with ThreadPoolExecutor(max_workers=10) as pool:
            outcomes = list(pool.map(_try_reserve, range(10)))

        self.assertEqual(outcomes.count(True), 5)
        self.assertEqual(outcomes.count(False), 5)

        status = quota_service.get_quota_status(now_utc=fixed_now)
        self.assertEqual(status["searchQueries"]["used"], 100)
        self.assertTrue(status["searchQueries"]["exhausted"])
        self.assertEqual(status["generalData"]["used"], 0)

        # Auto-refresh may never call search.list
        with self.assertRaises(AppError) as auto_ctx:
            quota_service.reserve_quota_unit(
                "search_queries",
                "search.list",
                is_auto_refresh=True,
                now_utc=fixed_now,
            )
        self.assertEqual(auto_ctx.exception.code, "AUTO_REFRESH_SEARCH_FORBIDDEN")

        # ConnectError refund restores General Data unit exactly once
        gen_log_id = quota_service.reserve_quota_unit("general_data", "videos.list", now_utc=fixed_now)
        self.assertEqual(quota_service.get_quota_status(now_utc=fixed_now)["generalData"]["used"], 1)
        self.assertTrue(quota_service.refund_quota_on_connect_error(gen_log_id, now_utc=fixed_now))
        self.assertFalse(quota_service.refund_quota_on_connect_error(gen_log_id, now_utc=fixed_now))
        self.assertEqual(quota_service.get_quota_status(now_utc=fixed_now)["generalData"]["used"], 0)

    def test_three_layer_video_format_classification_never_uses_60s_shorts_rule(self) -> None:
        self.assertEqual(format_classifier.parse_iso8601_duration_seconds("PT4M13S"), 253)
        self.assertEqual(format_classifier.parse_iso8601_duration_seconds("PT45S"), 45)
        self.assertEqual(format_classifier.parse_iso8601_duration_seconds("P1DT1H2S"), 90002)

        short_unverified = format_classifier.classify_video_format(duration_seconds=45)
        self.assertEqual(short_unverified["source_format_status"], "unknown")
        self.assertIsNone(short_unverified["format_hint"])

        boundary_180 = format_classifier.classify_video_format(duration_seconds=180)
        self.assertEqual(boundary_180["source_format_status"], "unknown")

        long_181 = format_classifier.classify_video_format(duration_seconds=181)
        self.assertEqual(long_181["source_format_status"], "long_form")
        self.assertIsNone(long_181["format_hint"])

        live_long = format_classifier.classify_video_format(duration_seconds=3600, is_live_streaming=True)
        self.assertEqual(live_long["source_format_status"], "unknown")

        pre_cutoff = format_classifier.classify_video_format(
            duration_seconds=110,
            published_at="2024-09-01T10:00:00Z",
        )
        self.assertEqual(pre_cutoff["source_format_status"], "unknown")
        self.assertEqual(pre_cutoff["format_hint"], "likely_long_form")
        self.assertEqual(pre_cutoff["format_hint_confidence"], "medium_high")

        hashtag_hint = format_classifier.classify_video_format(
            duration_seconds=35,
            published_at="2025-02-01T10:00:00Z",
            title="Test clip #shorts",
        )
        self.assertEqual(hashtag_hint["source_format_status"], "unknown")
        self.assertEqual(hashtag_hint["format_hint"], "likely_shorts")
        self.assertEqual(hashtag_hint["format_hint_confidence"], "low_medium")

    def test_30_day_retention_and_user_purge_preserve_user_data_and_clean_db_backups(self) -> None:
        proj = project_repo.create_project("Kênh Công Nghệ")
        t_old = datetime(2026, 9, 1, 10, 0, 0, tzinfo=timezone.utc)
        t_fresh = datetime(2026, 11, 10, 10, 0, 0, tzinfo=timezone.utc)
        t_now = datetime(2026, 11, 16, 10, 0, 0, tzinfo=timezone.utc)

        youtube_repo.upsert_channel(
            channel_id="UC_KEEP",
            title="Kênh Có Ý Tưởng",
            now_utc=t_old,
        )
        youtube_repo.upsert_channel(
            channel_id="UC_ORPHAN_OLD",
            title="Kênh Rác Hết Hạn",
            now_utc=t_old,
        )
        youtube_repo.upsert_video_and_snapshot(
            video_id="VID_KEEP",
            channel_id="UC_KEEP",
            title="Video Hết Hạn Nhưng Có Ý Tưởng",
            duration_seconds=420,
            view_count=50000,
            now_utc=t_old,
        )
        youtube_repo.upsert_video_and_snapshot(
            video_id="VID_ORPHAN_OLD",
            channel_id="UC_ORPHAN_OLD",
            title="Video Cache Hết Hạn",
            duration_seconds=300,
            view_count=12000,
            now_utc=t_old,
        )
        youtube_repo.upsert_video_and_snapshot(
            video_id="VID_FRESH",
            channel_id="UC_KEEP",
            title="Video Mới Còn Hạn",
            duration_seconds=400,
            view_count=9000,
            now_utc=t_fresh,
        )
        youtube_repo.set_manual_video_format("VID_KEEP", "long_form", now_utc=t_now)

        with write_db() as conn:
            conn.execute(
                """
                INSERT INTO project_channels (id, project_id, channel_id, status, notes, added_at)
                VALUES ('pc1', ?, 'UC_KEEP', 'active', 'Theo dõi đối thủ chính', ?)
                """,
                (proj["id"], t_now.isoformat()),
            )
            conn.execute(
                """
                INSERT INTO ideas (
                    id, title, notes, source_type, source_ref_id, source_title_snapshot,
                    source_url, linked_video_id, linked_channel_id, in_global_vault, created_at, updated_at
                ) VALUES (
                    'idea-1', 'Ý tưởng của tôi', 'Ghi chú bền vững', 'youtube_video', 'VID_KEEP',
                    'Snapshot', 'https://www.youtube.com/watch?v=VID_KEEP', 'VID_KEEP', 'UC_KEEP',
                    1, ?, ?
                )
                """,
                (t_now.isoformat(), t_now.isoformat()),
            )

        # Read-time filter hides expired API data even before background purge runs
        self.assertIsNone(youtube_repo.get_video_record("VID_KEEP", require_valid_api=True, now_utc=t_now))
        self.assertIsNotNone(youtube_repo.get_video_record("VID_FRESH", require_valid_api=True, now_utc=t_now))

        # Run scheduled/startup 30d purge
        purge_result = retention_service.purge_expired_api_data(now_utc=t_now)
        self.assertGreaterEqual(purge_result["videosTombstoned"], 1)
        self.assertGreaterEqual(purge_result["videosDeleted"], 1)

        tombstoned_vid = youtube_repo.get_video_record("VID_KEEP", require_valid_api=False, now_utc=t_now)
        self.assertIsNotNone(tombstoned_vid)
        assert tombstoned_vid is not None
        self.assertIsNone(tombstoned_vid["title"])
        self.assertIsNone(tombstoned_vid["viewCount"])
        self.assertEqual(tombstoned_vid["manualFormat"], "long_form")
        self.assertIsNotNone(youtube_repo.get_video_record("VID_FRESH", require_valid_api=True, now_utc=t_now))

        # Create a .db backup and a user JSON recovery file, then trigger user purge endpoint
        create_sqlite_backup(Path(self._tmp.name) / "data" / "research_studio.db", Path(self._tmp.name) / "backups")
        recovery_json = Path(self._tmp.name) / "backups" / "project_recovery_manual.json"
        recovery_json.write_text('{"ok": true}', encoding="utf-8")

        app = create_app()
        with TestClient(app) as client:
            headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}
            resp = client.post("/api/v1/system/purge-youtube-cache", headers=headers)
            self.assertEqual(resp.status_code, 200)
            body = resp.json()
            self.assertGreaterEqual(body["dbBackupsDeleted"], 1)

            quota_resp = client.get("/api/v1/system/quota")
            self.assertEqual(quota_resp.status_code, 200)
            self.assertIn("searchQueries", quota_resp.json())

        # Fresh video was also purged by explicit user action, while idea + project + recovery json survived
        self.assertIsNone(youtube_repo.get_video_record("VID_FRESH", require_valid_api=True, now_utc=t_now))
        self.assertEqual(list((Path(self._tmp.name) / "backups").glob("*.db")), [])
        self.assertTrue(recovery_json.exists())
        with read_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM ideas").fetchone()[0], 1)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0], 1)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM user_video_format_labels").fetchone()[0], 1)
