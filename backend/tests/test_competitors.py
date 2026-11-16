from __future__ import annotations

import os
import tempfile
import unittest

import httpx

from app.core.errors import AppError
from app.db.connection import read_db
from app.db.migrator import run_migrations
from app.repositories import project_repo, settings_repo
from app.services import competitor_service, quota_service


class CompetitorTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._prev_dir = os.environ.get("RESEARCH_STUDIO_DATA_DIR")
        os.environ["RESEARCH_STUDIO_DATA_DIR"] = self._tmp.name
        run_migrations()
        settings_repo.set_legal_consent(True)
        settings_repo.save_youtube_api_key("AIzaSyTestCompetitorKey12345")

    def tearDown(self) -> None:
        if self._prev_dir is None:
            os.environ.pop("RESEARCH_STUDIO_DATA_DIR", None)
        else:
            os.environ["RESEARCH_STUDIO_DATA_DIR"] = self._prev_dir
        self._tmp.cleanup()

    def test_parse_identifier_rejects_legacy_user_and_c_urls_without_search_list(self) -> None:
        cid, handle = competitor_service.parse_competitor_identifier("https://www.youtube.com/@ailabvn")
        self.assertIsNone(cid)
        self.assertEqual(handle, "@ailabvn")

        cid2, handle2 = competitor_service.parse_competitor_identifier(
            "https://youtube.com/channel/UC1234567890abcdefghijkl"
        )
        self.assertEqual(cid2, "UC1234567890abcdefghijkl")
        self.assertIsNone(handle2)

        with self.assertRaises(AppError) as ctx:
            competitor_service.parse_competitor_identifier("https://www.youtube.com/c/OldCustomUrl")
        self.assertEqual(ctx.exception.code, "UNSUPPORTED_CHANNEL_URL")

        with self.assertRaises(AppError) as ctx2:
            competitor_service.parse_competitor_identifier("https://www.youtube.com/user/LegacyUser")
        self.assertEqual(ctx2.exception.code, "UNSUPPORTED_CHANNEL_URL")

    async def test_shared_channel_zero_search_quota_and_cross_project_isolation(self) -> None:
        proj_a = project_repo.create_project("Channel Alpha", region_code="VN", relevance_language="vi")
        proj_b = project_repo.create_project("Channel Beta", region_code="US", relevance_language="en")
        seen_paths: list[str] = []

        def _handler(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            seen_paths.append(path)
            if path.endswith("/channels"):
                return httpx.Response(
                    200,
                    json={
                        "items": [
                            {
                                "id": "UC_SHARED_TECH_0000001",
                                "snippet": {
                                    "title": "AI Lab VN",
                                    "customUrl": "@ailabvn",
                                    "country": "VN",
                                },
                                "contentDetails": {"relatedPlaylists": {"uploads": "UU_SHARED_001"}},
                                "statistics": {"subscriberCount": "320000", "videoCount": "415"},
                            }
                        ]
                    },
                )
            if path.endswith("/playlistItems"):
                return httpx.Response(
                    200,
                    json={
                        "items": [
                            {"contentDetails": {"videoId": "vid_comp_long_1"}},
                            {"contentDetails": {"videoId": "vid_comp_short_unclear"}},
                        ]
                    },
                )
            if path.endswith("/videos"):
                return httpx.Response(
                    200,
                    json={
                        "items": [
                            {
                                "id": "vid_comp_long_1",
                                "snippet": {
                                    "title": "SQLite Local Architecture",
                                    "channelId": "UC_SHARED_TECH_0000001",
                                    "channelTitle": "AI Lab VN",
                                    "publishedAt": "2026-11-12T10:00:00Z",
                                },
                                "contentDetails": {"duration": "PT16M40S"},
                                "statistics": {"viewCount": "85000", "likeCount": "3200", "commentCount": "140"},
                            },
                            {
                                "id": "vid_comp_short_unclear",
                                "snippet": {
                                    "title": "Quick GPU Tip #shorts",
                                    "channelId": "UC_SHARED_TECH_0000001",
                                    "channelTitle": "AI Lab VN",
                                    "publishedAt": "2026-11-14T10:00:00Z",
                                },
                                "contentDetails": {"duration": "PT42S"},
                                "statistics": {"viewCount": "44000", "likeCount": "2100", "commentCount": "55"},
                            },
                        ]
                    },
                )
            return httpx.Response(404)

        transport = httpx.MockTransport(_handler)

        res_a = await competitor_service.add_competitor_to_project(
            proj_a["id"],
            "@ailabvn",
            notes="Direct AI competitor",
            transport=transport,
            retry_backoff_sec=0.0,
        )
        self.assertFalse(res_a["reusedCache"])
        self.assertEqual(len(res_a["channels"]), 1)
        self.assertEqual(len(res_a["videos"]), 2)
        self.assertEqual(quota_service.get_quota_status()["searchQueries"]["used"], 0)
        self.assertEqual(quota_service.get_quota_status()["generalData"]["used"], 3)
        self.assertFalse(any(p.endswith("/search") for p in seen_paths))

        # Attaching the same channel to Project B reuses valid canonical cache with 0 additional API units!
        res_b = await competitor_service.add_competitor_to_project(
            proj_b["id"],
            "UC_SHARED_TECH_0000001",
            notes="Reference channel",
            transport=transport,
            retry_backoff_sec=0.0,
        )
        self.assertTrue(res_b["reusedCache"])
        self.assertEqual(quota_service.get_quota_status()["generalData"]["used"], 3)
        self.assertEqual(res_b["channels"][0]["sharedProjectsCount"], 2)

        with read_db() as conn:
            ch_count = conn.execute(
                "SELECT COUNT(*) AS cnt FROM youtube_channels WHERE channel_id = ?",
                ("UC_SHARED_TECH_0000001",),
            ).fetchone()["cnt"]
            self.assertEqual(ch_count, 1)

        # Detach from Project A -> Project B keeps canonical channel and videos intact
        after_remove_a = competitor_service.remove_competitor_from_project(proj_a["id"], "UC_SHARED_TECH_0000001")
        self.assertEqual(len(after_remove_a["channels"]), 0)
        list_b = competitor_service.list_project_competitors(proj_b["id"])
        self.assertEqual(len(list_b["channels"]), 1)
        self.assertEqual(len(list_b["videos"]), 2)
        self.assertEqual(list_b["channels"][0]["sharedProjectsCount"], 1)

    async def test_refresh_all_isolates_broken_channel_error(self) -> None:
        proj = project_repo.create_project("Isolation Proj")

        def _add_handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/channels"):
                target_id = request.url.params.get("id", "UC_OK_000000000000001")
                return httpx.Response(
                    200,
                    json={
                        "items": [
                            {
                                "id": target_id,
                                "snippet": {"title": f"Channel {target_id[-3:]}"},
                                "contentDetails": {"relatedPlaylists": {"uploads": f"UU_{target_id[-3:]}"}},
                                "statistics": {"subscriberCount": "1000", "videoCount": "10"},
                            }
                        ]
                    },
                )
            if request.url.path.endswith("/playlistItems"):
                return httpx.Response(200, json={"items": [{"contentDetails": {"videoId": "vid_ok_1"}}]})
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "id": "vid_ok_1",
                            "snippet": {"title": "OK Video", "channelId": "UC_OK_000000000000001"},
                            "contentDetails": {"duration": "PT6M"},
                            "statistics": {"viewCount": "500"},
                        }
                    ]
                },
            )

        await competitor_service.add_competitor_to_project(
            proj["id"],
            "UC_OK_00000000000000001",
            transport=httpx.MockTransport(_add_handler),
            retry_backoff_sec=0.0,
        )
        await competitor_service.add_competitor_to_project(
            proj["id"],
            "UC_FAIL_000000000000002",
            transport=httpx.MockTransport(_add_handler),
            retry_backoff_sec=0.0,
        )

        def _refresh_handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/channels") and "FAIL" in request.url.params.get("id", ""):
                return httpx.Response(200, json={"items": []})
            return _add_handler(request)

        summary = await competitor_service.refresh_project_competitors(
            proj["id"],
            transport=httpx.MockTransport(_refresh_handler),
            retry_backoff_sec=0.0,
        )
        self.assertEqual(summary["okCount"], 1)
        self.assertEqual(summary["errorCount"], 1)
        by_id = {ch["channelId"]: ch for ch in summary["channels"]}
        self.assertEqual(by_id["UC_OK_00000000000000001"]["status"], "active")
        self.assertEqual(by_id["UC_FAIL_000000000000002"]["status"], "error")
