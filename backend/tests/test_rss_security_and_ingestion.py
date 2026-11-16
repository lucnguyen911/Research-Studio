from __future__ import annotations

import os
import socket
import tempfile
import unittest

from fastapi.testclient import TestClient
import httpx

from app.clients import rss_client
from app.core.errors import AppError
from app.core.security import CSRF_HEADER_NAME, CSRF_HEADER_VALUE
from app.db.migrator import run_migrations
from app.main import create_app
from app.repositories import project_repo, rss_repo
from app.services import rss_service


def _public_dns_resolver(host: str, port: int) -> list[tuple[object, ...]]:
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port))]


class RssSecurityAndIngestionTests(unittest.IsolatedAsyncioTestCase):
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

    async def test_ssrf_blocks_local_private_metadata_and_redirect_to_localhost(self) -> None:
        blocked_urls = [
            "http://127.0.0.1:8000/api/v1/system/settings",
            "http://[::1]:8000/rss.xml",
            "http://localhost:5173/feed.xml",
            "http://192.168.1.10/feed.xml",
            "http://10.0.0.5/internal.xml",
            "http://169.254.169.254/latest/meta-data/",
            "file:///C:/Windows/win.ini",
        ]
        for url in blocked_urls:
            with self.assertRaises(AppError) as ctx:
                rss_client.validate_public_feed_url(url)
            self.assertIn(ctx.exception.code, ("RSS_SSRF_BLOCKED", "RSS_INVALID_URL"), f"Failed for {url}")

        # Redirect from public host -> internal localhost must be intercepted before fetching target
        called_urls: list[str] = []

        def _redirect_handler(request: httpx.Request) -> httpx.Response:
            called_urls.append(str(request.url))
            return httpx.Response(
                302,
                headers={"Location": "http://127.0.0.1:8000/api/v1/system/settings"},
            )

        with self.assertRaises(AppError) as redir_ctx:
            await rss_client.fetch_and_parse_feed(
                "https://news.example.com/feed.xml",
                transport=httpx.MockTransport(_redirect_handler),
                resolver=_public_dns_resolver,
            )
        self.assertEqual(redir_ctx.exception.code, "RSS_SSRF_BLOCKED")
        self.assertEqual(called_urls, ["https://news.example.com/feed.xml"])

    async def test_xxe_oversize_payload_and_script_subtree_sanitization(self) -> None:
        xxe_payload = (
            b'<?xml version="1.0"?>'
            b'<!DOCTYPE foo [ <!ENTITY secret SYSTEM "file:///etc/passwd"> ]>'
            b"<rss><channel><item><title>&secret;</title></item></channel></rss>"
        )
        with self.assertRaises(AppError) as xxe_ctx:
            rss_client.parse_feed_xml(xxe_payload)
        self.assertEqual(xxe_ctx.exception.code, "RSS_INVALID_XML")

        oversize = b"a" * (5 * 1024 * 1024 + 64)

        def _big_handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=oversize)

        with self.assertRaises(AppError) as big_ctx:
            await rss_client.fetch_and_parse_feed(
                "https://news.example.com/huge.xml",
                transport=httpx.MockTransport(_big_handler),
                resolver=_public_dns_resolver,
            )
        self.assertEqual(big_ctx.exception.code, "RSS_PAYLOAD_TOO_LARGE")

        xss_rss = b"""<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel><title>Safe Tech</title>
          <item>
            <guid>art-xss-1</guid>
            <title>Local AI &amp; Tools</title>
            <link>javascript:alert(1)</link>
            <description><![CDATA[<p>Clean summary</p><script>window.steal='SECRET_LEAK'</script><style>.x{color:red}</style><p>End</p>]]></description>
            <pubDate>Mon, 16 Nov 2026 09:00:00 GMT</pubDate>
          </item>
        </channel></rss>"""
        parsed = rss_client.parse_feed_xml(xss_rss)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["canonical_url"], "")
        self.assertNotIn("SECRET_LEAK", parsed[0]["summary_text"])
        self.assertNotIn("color:red", parsed[0]["summary_text"])
        self.assertIn("Clean summary", parsed[0]["summary_text"])
        self.assertIn("End", parsed[0]["summary_text"])

    async def test_dedup_per_feed_error_isolation_project_rss_link_and_phrases(self) -> None:
        good_feed = await rss_service.add_rss_feed(
            name="Tech News",
            url="https://good.example.com/rss.xml",
            resolver=_public_dns_resolver,
        )
        broken_feed = await rss_service.add_rss_feed(
            name="Broken Blog",
            url="https://broken.example.com/rss.xml",
            resolver=_public_dns_resolver,
        )

        good_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel>
          <item>
            <guid>item-1</guid>
            <title>Local Windows AI workflow benchmark</title>
            <link>https://good.example.com/post-1</link>
            <description>FastAPI SQLite local workflow benchmark</description>
            <pubDate>Mon, 16 Nov 2026 08:00:00 GMT</pubDate>
          </item>
          <item>
            <guid>item-2</guid>
            <title>Local Windows creator productivity</title>
            <link>https://good.example.com/post-2</link>
            <description>Creator desk setup guide</description>
            <pubDate>Sun, 15 Nov 2026 08:00:00 GMT</pubDate>
          </item>
        </channel></rss>"""

        def _multi_feed_handler(request: httpx.Request) -> httpx.Response:
            if request.url.host == "good.example.com":
                return httpx.Response(200, content=good_xml)
            return httpx.Response(404, content=b"Not Found")

        transport = httpx.MockTransport(_multi_feed_handler)
        first_run = await rss_service.refresh_all_enabled_feeds(
            transport=transport,
            resolver=_public_dns_resolver,
        )
        self.assertEqual(first_run["okCount"], 1)
        self.assertEqual(first_run["errorCount"], 1)

        # Second refresh inserts 0 duplicate articles
        second_run = await rss_service.refresh_single_feed(
            good_feed["id"],
            transport=transport,
            resolver=_public_dns_resolver,
        )
        self.assertEqual(second_run["insertedCount"], 0)
        self.assertEqual(len(rss_repo.list_articles()), 2)

        # Verify broken feed isolated while good feed stayed 'ok'
        self.assertEqual(rss_repo.get_feed(good_feed["id"])["lastStatus"], "ok")
        broken_state = rss_repo.get_feed(broken_feed["id"])
        self.assertEqual(broken_state["lastStatus"], "error")
        self.assertEqual(broken_state["lastErrorCode"], "RSS_HTTP_ERROR")

        # Link feed to project and verify Project-scoped articles + RSS phrase counts
        proj = project_repo.create_project("AI Channel")
        app = create_app()
        with TestClient(app) as client:
            headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}
            link_resp = client.put(
                f"/api/v1/projects/{proj['id']}/rss-feeds",
                headers=headers,
                json={"feedIds": [good_feed["id"]]},
            )
            self.assertEqual(link_resp.status_code, 200)
            self.assertEqual(link_resp.json()["project"]["linkedFeedIds"], [good_feed["id"]])

            art_resp = client.get(f"/api/v1/rss/articles?projectId={proj['id']}")
            self.assertEqual(art_resp.status_code, 200)
            self.assertEqual(len(art_resp.json()["items"]), 2)

            phrases_resp = client.get(f"/api/v1/rss/phrases?projectId={proj['id']}")
            self.assertEqual(phrases_resp.status_code, 200)
            body = phrases_resp.json()
            self.assertEqual(body["sourceLabel"], "Nguồn: RSS (Dữ liệu ngoài YouTube)")
            self.assertTrue(any(p["phrase"] == "local windows" for p in body["items"]))
