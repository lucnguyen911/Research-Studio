from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
import tempfile
import unittest

from app.db.connection import write_db
from app.db.migrator import run_migrations
from app.repositories import project_repo, youtube_repo


class BreakoutStandardModeTests(unittest.TestCase):
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

    def test_standard_mode_filtering_unknown_format_isolation_and_project_flags(self) -> None:
        now = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)
        proj_a = project_repo.create_project("Breakout A")
        proj_b = project_repo.create_project("Breakout B")

        youtube_repo.upsert_channel(
            channel_id="UC_BO_1",
            title="Comp Channel",
            now_utc=now,
        )
        with write_db() as conn:
            conn.execute(
                "INSERT INTO project_channels (id, project_id, channel_id, status, notes, added_at) VALUES (?, ?, ?, 'active', '', ?)",
                ("pc-bo-a", proj_a["id"], "UC_BO_1", now.isoformat()),
            )

        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_long_recent",
            channel_id="UC_BO_1",
            title="Long Recent High Views",
            published_at=(now - timedelta(days=2)).isoformat(),
            duration_seconds=900,
            view_count=120000,
            like_count=5000,
            comment_count=300,
            now_utc=now,
        )
        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_short_unknown",
            channel_id="UC_BO_1",
            title="Short Under 60s #shorts",
            published_at=(now - timedelta(days=5)).isoformat(),
            duration_seconds=45,
            view_count=95000,
            like_count=4000,
            comment_count=120,
            now_utc=now,
        )
        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_long_older",
            channel_id="UC_BO_1",
            title="Older Video 20d",
            published_at=(now - timedelta(days=20)).isoformat(),
            duration_seconds=1200,
            view_count=30000,
            like_count=900,
            comment_count=40,
            now_utc=now,
        )

        # User labels vid_short_unknown manually as 'shorts'; sourceFormatStatus must remain 'unknown'
        youtube_repo.set_manual_video_format("vid_short_unknown", "shorts", now_utc=now)

        # Flag vid_long_recent in Project A ONLY
        youtube_repo.upsert_project_video_breakout(
            proj_a["id"],
            "vid_long_recent",
            is_user_breakout=True,
            notes="Strong hook in first 20s",
            now_utc=now,
        )

        res_all = youtube_repo.list_project_breakout_videos(proj_a["id"], now_utc=now)
        self.assertEqual(res_all["mode"], "standard_mode")
        # Unknown 45s video MUST NEVER merge into longForm or shorts counts
        self.assertEqual(res_all["formatCounts"], {"longForm": 2, "shorts": 0, "unknown": 1})
        self.assertEqual(res_all["totalCount"], 3)

        # Verify no prohibited derived metrics exist on returned items
        first_item = res_all["items"][0]
        for forbidden in ("outlierMultiplier", "viewsPerDay", "engagementRate", "channelMedian"):
            self.assertNotIn(forbidden, first_item)

        # Filtering by shorts with includeManual=False returns 0; includeManual=True returns vid_short_unknown
        self.assertEqual(
            youtube_repo.list_project_breakout_videos(proj_a["id"], source_format="shorts", include_manual=False, now_utc=now)["totalCount"],
            0,
        )
        self.assertEqual(
            youtube_repo.list_project_breakout_videos(proj_a["id"], source_format="shorts", include_manual=True, now_utc=now)["totalCount"],
            1,
        )

        # 7-day window + min_views filter + only_flagged
        res_7d = youtube_repo.list_project_breakout_videos(proj_a["id"], days_window=7, min_views=100000, only_flagged=True, now_utc=now)
        self.assertEqual(len(res_7d["items"]), 1)
        self.assertEqual(res_7d["items"][0]["videoId"], "vid_long_recent")
        self.assertEqual(res_7d["items"][0]["breakoutNotes"], "Strong hook in first 20s")

        # Project B isolation
        res_b = youtube_repo.list_project_breakout_videos(proj_b["id"], only_flagged=True, now_utc=now)
        self.assertEqual(res_b["totalCount"], 0)
