from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
import tempfile
import unittest

from fastapi.testclient import TestClient
import httpx

from app.clients import youtube_client
from app.core.errors import AppError
from app.core.security import CSRF_HEADER_NAME, CSRF_HEADER_VALUE
from app.db.migrator import run_migrations
from app.main import create_app
from app.repositories import settings_repo
from app.services import discovery_service, quota_service


class YoutubeClientAndGlobalTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._prev_dir = os.environ.get("RESEARCH_STUDIO_DATA_DIR")
        os.environ["RESEARCH_STUDIO_DATA_DIR"] = self._tmp.name
        run_migrations()
        settings_repo.set_legal_consent(True)
        settings_repo.save_youtube_api_key("AIzaSyTestGlobalMockKey12345")

    def tearDown(self) -> None:
        if self._prev_dir is None:
            os.environ.pop("RESEARCH_STUDIO_DATA_DIR", None)
        else:
            os.environ["RESEARCH_STUDIO_DATA_DIR"] = self._prev_dir
        self._tmp.cleanup()

    async def test_search_list_has_zero_auto_retries_while_general_data_retries_on_503(self) -> None:
        search_calls = 0

        def _search_handler(_request: httpx.Request) -> httpx.Response:
            nonlocal search_calls
            search_calls += 1
            return httpx.Response(503, json={"error": {"message": "Temporary unavailable"}})

        with self.assertRaises(AppError) as ctx:
            await youtube_client.search_youtube(
                query="ai local windows",
                transport=httpx.MockTransport(_search_handler),
            )
        self.assertEqual(ctx.exception.code, "YOUTUBE_UPSTREAM_ERROR")
        self.assertEqual(search_calls, 1)
        self.assertEqual(quota_service.get_quota_status()["searchQueries"]["used"], 1)

        video_calls = 0

        def _videos_handler(_request: httpx.Request) -> httpx.Response:
            nonlocal video_calls
            video_calls += 1
            if video_calls < 3:
                return httpx.Response(503, json={"error": {"message": "Retryable backend error"}})
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "id": "vid_retry_ok",
                            "snippet": {
                                "title": "Local LLM Benchmark",
                                "channelId": "UC_R1",
                                "channelTitle": "Local Tech",
                                "publishedAt": "2026-11-10T12:00:00Z",
                            },
                            "contentDetails": {"duration": "PT5M10S"},
                            "statistics": {"viewCount": "1234", "likeCount": "100", "commentCount": "10"},
                        }
                    ]
                },
            )

        items = await youtube_client.fetch_videos_by_ids(
            ["vid_retry_ok"],
            transport=httpx.MockTransport(_videos_handler),
            retry_backoff_sec=0.0,
        )
        self.assertEqual(video_calls, 3)
        self.assertEqual(len(items), 1)
        self.assertEqual(quota_service.get_quota_status()["generalData"]["used"], 3)

    async def test_connect_error_refunds_quota_while_403_quota_exceeded_locks_bucket(self) -> None:
        def _connect_fail(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("No network route", request=request)

        with self.assertRaises(AppError) as net_ctx:
            await youtube_client.fetch_most_popular_videos(transport=httpx.MockTransport(_connect_fail))
        self.assertEqual(net_ctx.exception.code, "YOUTUBE_NETWORK_UNREACHABLE")
        self.assertEqual(quota_service.get_quota_status()["generalData"]["used"], 0)

        def _quota_403(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                403,
                json={
                    "error": {
                        "message": "Quota exceeded",
                        "errors": [{"reason": "quotaExceeded"}],
                    }
                },
            )

        with self.assertRaises(AppError) as q_ctx:
            await youtube_client.search_youtube(
                query="quota lock",
                transport=httpx.MockTransport(_quota_403),
            )
        self.assertEqual(q_ctx.exception.code, "QUOTA_SEARCH_EXHAUSTED")
        status = quota_service.get_quota_status()
        self.assertTrue(status["searchQueries"]["exhausted"])
        self.assertEqual(status["generalData"]["used"], 0)

    async def test_discovery_trends_search_sessions_manual_format_and_30d_read_filter(self) -> None:
        def _mock_youtube(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/search"):
                return httpx.Response(
                    200,
                    json={
                        "items": [
                            {"id": {"videoId": "VID_LONG"}},
                            {"id": {"videoId": "VID_UNKNOWN_45S"}},
                        ]
                    },
                )
            if request.url.path.endswith("/videos"):
                return httpx.Response(
                    200,
                    json={
                        "items": [
                            {
                                "id": "VID_LONG",
                                "snippet": {
                                    "title": "Deep Dive FastAPI + SQLite",
                                    "channelId": "UC_CHAN1",
                                    "channelTitle": "Code Studio",
                                    "publishedAt": "2026-11-12T08:00:00Z",
                                    "tags": ["fastapi", "sqlite"],
                                },
                                "contentDetails": {"duration": "PT12M05S"},
                                "statistics": {"viewCount": "25000", "likeCount": "1400", "commentCount": "95"},
                            },
                            {
                                "id": "VID_UNKNOWN_45S",
                                "snippet": {
                                    "title": "Quick Tip #shorts",
                                    "channelId": "UC_CHAN1",
                                    "channelTitle": "Code Studio",
                                    "publishedAt": "2026-11-14T08:00:00Z",
                                    "tags": ["#shorts"],
                                },
                                "contentDetails": {"duration": "PT45S"},
                                "statistics": {"viewCount": "8000", "likeCount": "310", "commentCount": "12"},
                            },
                        ]
                    },
                )
            raise AssertionError(f"Unexpected path {request.url.path}")

        transport = httpx.MockTransport(_mock_youtube)
        base_time = datetime(2026, 11, 16, 10, 0, 0, tzinfo=timezone.utc)

        search_res = await discovery_service.run_free_search(
            query="fastapi sqlite",
            region_code="VN",
            relevance_language="vi",
            transport=transport,
            retry_backoff_sec=0.0,
            now_utc=base_time,
        )
        session_id = search_res["session"]["id"]
        self.assertEqual(len(search_res["videos"]), 2)

        v_long = search_res["videos"][0]
        v_short_unverified = search_res["videos"][1]
        self.assertEqual(v_long["sourceFormatStatus"], "long_form")
        self.assertEqual(v_short_unverified["sourceFormatStatus"], "unknown")
        self.assertEqual(v_short_unverified["formatHint"], "likely_shorts")
        for forbidden in ("outlierMultiplier", "viewsPerDay", "engagementRate", "channelMedian", "searchVolume"):
            self.assertNotIn(forbidden, v_long)

        # Reopening saved search session spends 0 quota
        reopened = discovery_service.get_search_session_detail(session_id, now_utc=base_time)
        self.assertEqual(len(reopened["videos"]), 2)

        # HTTP router checks (manual format label & channel/video detail)
        app = create_app()
        with TestClient(app) as client:
            headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}
            mf_resp = client.put(
                "/api/v1/youtube/videos/VID_UNKNOWN_45S/manual-format",
                headers=headers,
                json={"manualFormat": "shorts"},
            )
            self.assertEqual(mf_resp.status_code, 200)

            vid_resp = client.get("/api/v1/youtube/videos/VID_UNKNOWN_45S")
            self.assertEqual(vid_resp.status_code, 200)
            self.assertEqual(vid_resp.json()["video"]["sourceFormatStatus"], "unknown")
            self.assertEqual(vid_resp.json()["video"]["manualFormat"], "shorts")

            sess_list = client.get("/api/v1/global/search/sessions")
            self.assertEqual(sess_list.status_code, 200)
            self.assertEqual(len(sess_list.json()["items"]), 1)

        # Read-time filter hides API Data after 31 days even before purge executes
        day_31 = base_time + timedelta(days=31)
        with self.assertRaises(AppError) as expired_ctx:
            discovery_service.get_search_session_detail(session_id, now_utc=day_31)
        self.assertEqual(expired_ctx.exception.code, "SEARCH_SESSION_NOT_FOUND_OR_EXPIRED")

        expired_vid = discovery_service.get_video_detail("VID_UNKNOWN_45S", now_utc=day_31)
        self.assertFalse(expired_vid["video"]["hasValidApiData"])
        self.assertIsNone(expired_vid["video"]["title"])
        self.assertEqual(expired_vid["video"]["manualFormat"], "shorts")
