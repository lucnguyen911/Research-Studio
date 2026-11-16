from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
import tempfile
import unittest

from fastapi.testclient import TestClient

from app.core.security import CSRF_HEADER_NAME, CSRF_HEADER_VALUE
from app.db.connection import write_db
from app.db.migrator import run_migrations
from app.main import create_app
from app.repositories import idea_repo, keyword_repo, project_repo, rss_repo, youtube_repo


class OverviewEndpointsTests(unittest.TestCase):
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

    def test_global_and_project_overviews_separate_unknown_format_and_count_5_idea_states(self) -> None:
        now = datetime.now(timezone.utc)
        proj = project_repo.create_project("Overview Tech")

        youtube_repo.upsert_channel(channel_id="UC_OV_1", title="Overview Channel", now_utc=now)
        with write_db() as conn:
            conn.execute(
                "INSERT INTO project_channels (id, project_id, channel_id, status, notes, added_at) VALUES (?, ?, ?, 'active', '', ?)",
                ("pc-ov-1", proj["id"], "UC_OV_1", now.isoformat()),
            )

        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_ov_long",
            channel_id="UC_OV_1",
            title="Long Overview Video",
            duration_seconds=900,
            view_count=50000,
            now_utc=now,
        )
        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_ov_unknown_expiring",
            channel_id="UC_OV_1",
            title="Unknown <=180s Expiring Video",
            duration_seconds=45,
            view_count=12000,
            now_utc=now - timedelta(days=27),
        )
        # Expired video (> 30d) MUST NOT be counted in totalValid/longForm/shorts/unknown!
        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_ov_expired",
            channel_id="UC_OV_1",
            title="Already Expired Video",
            duration_seconds=900,
            view_count=99000,
            now_utc=now - timedelta(days=31),
        )
        youtube_repo.upsert_project_video_breakout(proj["id"], "vid_ov_long", is_user_breakout=True)

        keyword_repo.create_project_keyword(proj["id"], keyword="overview sqlite", priority="high")
        idea1 = idea_repo.create_idea(
            title="Idea One",
            notes="",
            source_type="manual",
            source_ref_id="manual-1",
            source_title_snapshot="Viết tay",
            source_url="",
            tags=[],
            in_global_vault=True,
            target_project_ids=[proj["id"]],
            project_angle="Angle 1",
        )
        idea_repo.upsert_project_idea_link(idea1["id"], proj["id"], {"status": "approved"})
        idea_repo.create_idea(
            title="Unlinked Global Idea",
            notes="",
            source_type="manual",
            source_ref_id="manual-2",
            source_title_snapshot="Viết tay",
            source_url="",
            tags=[],
            in_global_vault=True,
            target_project_ids=[],
            project_angle="",
        )

        feed = rss_repo.create_feed(name="Overview RSS", url="https://example.com/ov.xml")
        rss_repo.record_feed_fetch_success(
            feed["id"],
            [
                {
                    "dedup_key": "https://example.com/post-1",
                    "canonical_url": "https://example.com/post-1",
                    "title": "Latest Overview Article",
                    "summary_text": "Summary body",
                    "published_at": now.isoformat(),
                }
            ],
        )
        project_repo.set_project_rss_feeds(proj["id"], [feed["id"]])

        with TestClient(create_app()) as client:
            headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}
            g_resp = client.get("/api/v1/global/overview", headers=headers)
            self.assertEqual(g_resp.status_code, 200)
            g_data = g_resp.json()
            self.assertEqual(g_data["projectsCount"], 1)
            self.assertEqual(g_data["validVideosCount"], 2)
            self.assertEqual(g_data["expiringSoonVideosCount"], 1)
            self.assertEqual(g_data["ideasTotalCount"], 2)
            self.assertEqual(g_data["ideasUnlinkedCount"], 1)
            self.assertEqual(g_data["rssSummary"]["articlesCount"], 1)
            self.assertEqual(len(g_data["latestRssArticles"]), 1)

            p_resp = client.get(f"/api/v1/projects/{proj['id']}/overview", headers=headers)
            self.assertEqual(p_resp.status_code, 200)
            p_data = p_resp.json()
            self.assertEqual(p_data["competitorChannels"]["active"], 1)
            # Unknown format MUST NOT merge into longForm or shorts
            self.assertEqual(
                p_data["competitorVideos"],
                {"totalValid": 2, "longForm": 1, "shorts": 0, "unknown": 1},
            )
            self.assertEqual(p_data["breakoutFlaggedCount"], 1)
            self.assertEqual(p_data["keywords"]["total"], 1)
            self.assertEqual(p_data["rss"]["linkedFeeds"], 1)
            self.assertEqual(p_data["ideas"]["byStatus"]["approved"], 1)
            self.assertEqual(p_data["ideas"]["byStatus"]["new"], 0)
