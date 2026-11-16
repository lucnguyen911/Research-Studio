from __future__ import annotations

import os
import socket
import tempfile
import unittest

import httpx

from app.db.migrator import run_migrations
from app.repositories import keyword_repo, project_repo, rss_repo, settings_repo
from app.services import keyword_service, quota_service, rss_service


def _public_dns(host: str, port: int) -> list[tuple[object, ...]]:
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port))]


class KeywordsAndRssCrossrefTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._prev_dir = os.environ.get("RESEARCH_STUDIO_DATA_DIR")
        os.environ["RESEARCH_STUDIO_DATA_DIR"] = self._tmp.name
        run_migrations()
        settings_repo.set_legal_consent(True)
        settings_repo.save_youtube_api_key("AIzaSyTestKeywordMock12345")

    def tearDown(self) -> None:
        if self._prev_dir is None:
            os.environ.pop("RESEARCH_STUDIO_DATA_DIR", None)
        else:
            os.environ["RESEARCH_STUDIO_DATA_DIR"] = self._prev_dir
        self._tmp.cleanup()

    async def test_keyword_isolation_rss_project_scoping_and_zero_quota_reopen(self) -> None:
        proj_a = project_repo.create_project("KW Project A", region_code="US", relevance_language="en")
        proj_b = project_repo.create_project("KW Project B", region_code="VN", relevance_language="vi")

        feed_linked = rss_repo.create_feed(name="Linked AI Feed", url="https://example.com/linked.xml")
        feed_unlinked = rss_repo.create_feed(name="Other Unlinked Feed", url="https://example.com/other.xml")
        project_repo.set_project_rss_feeds(proj_a["id"], [feed_linked["id"]])

        rss_xml_linked = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Linked AI</title>
  <item><title>Local SQLite Vector Benchmark 2026</title><link>https://example.com/a1</link><description>Local sqlite speed test</description></item>
</channel></rss>"""
        rss_xml_other = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Unlinked</title>
  <item><title>Local SQLite Other Article Should Not Leak To Project A</title><link>https://example.com/b1</link><description>local sqlite unlinked</description></item>
</channel></rss>"""

        await rss_service.refresh_single_feed(
            feed_linked["id"],
            transport=httpx.MockTransport(lambda _r: httpx.Response(200, content=rss_xml_linked)),
            resolver=_public_dns,
        )
        await rss_service.refresh_single_feed(
            feed_unlinked["id"],
            transport=httpx.MockTransport(lambda _r: httpx.Response(200, content=rss_xml_other)),
            resolver=_public_dns,
        )

        kw_a = keyword_repo.create_project_keyword(proj_a["id"], keyword="local sqlite", priority="high")
        kw_b = keyword_repo.create_project_keyword(proj_b["id"], keyword="other kw", priority="low")

        # Strict per-project isolation
        overview_a = keyword_service.list_keywords_with_project_rss_overview(proj_a["id"])
        overview_b = keyword_service.list_keywords_with_project_rss_overview(proj_b["id"])
        self.assertEqual([item["id"] for item in overview_a["items"]], [kw_a["id"]])
        self.assertEqual([item["id"] for item in overview_b["items"]], [kw_b["id"]])
        # Project A only sees 1 RSS match (from feed_linked, NOT feed_unlinked!)
        self.assertEqual(overview_a["items"][0]["rssMatchCount"], 1)
        self.assertEqual(overview_a["rssSignals"]["sourceLabel"], "Nguồn: RSS (Dữ liệu ngoài YouTube)")

        captured_params: dict[str, str] = {}

        def _yt_handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/search"):
                captured_params["regionCode"] = request.url.params.get("regionCode", "")
                captured_params["relevanceLanguage"] = request.url.params.get("relevanceLanguage", "")
                return httpx.Response(200, json={"items": [{"id": {"videoId": "vid_kw_1"}}]})
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "id": "vid_kw_1",
                            "snippet": {
                                "title": "Local SQLite Guide",
                                "channelId": "UC_KW_1",
                                "channelTitle": "DB Channel",
                                "tags": ["sqlite", "local-first"],
                            },
                            "contentDetails": {"duration": "PT10M"},
                            "statistics": {"viewCount": "22000", "likeCount": "800", "commentCount": "30"},
                        }
                    ]
                },
            )

        scan_res = await keyword_service.scan_project_keywords(
            proj_a["id"],
            [kw_a["id"]],
            transport=httpx.MockTransport(_yt_handler),
            retry_backoff_sec=0.0,
        )
        self.assertEqual(scan_res["scannedCount"], 1)
        self.assertEqual(captured_params["regionCode"], "US")
        self.assertEqual(captured_params["relevanceLanguage"], "en")
        self.assertEqual(quota_service.get_quota_status()["searchQueries"]["used"], 1)
        self.assertEqual(quota_service.get_quota_status()["generalData"]["used"], 1)

        # Reopening cached keyword detail costs 0 quota and respects Project RSS boundary
        detail = keyword_service.get_keyword_cached_results(proj_a["id"], kw_a["id"])
        self.assertEqual(len(detail["videos"]), 1)
        self.assertEqual(detail["videos"][0]["tags"], ["sqlite", "local-first"])
        self.assertEqual(len(detail["matchedRssArticles"]), 1)
        self.assertEqual(detail["matchedRssArticles"][0]["feedId"], feed_linked["id"])
        self.assertEqual(quota_service.get_quota_status()["searchQueries"]["used"], 1)
