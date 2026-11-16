from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime, timezone
import gzip
import os
import socket
import tempfile
import unittest
from unittest.mock import patch
import zlib

from fastapi.testclient import TestClient
import httpx

from app.clients import rss_client, youtube_client
from app.core.config import (
    DATA_DIR_ENV_VAR,
    ensure_runtime_dirs,
    validate_loopback_bind_host,
)
from app.core.errors import AppError
from app.core.logging_setup import close_logging_handlers, configure_logging, redact_sensitive_text
from app.core.security import CSRF_HEADER_NAME, CSRF_HEADER_VALUE
from app.db.connection import read_db
from app.db.migrator import create_sqlite_backup, run_migrations
from app.main import create_app
from app.repositories import (
    idea_repo,
    project_repo,
    rss_repo,
    settings_repo,
    youtube_repo,
)
from app.services import quota_service, retention_service


class Phase10SecurityReviewTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._prev_dir = os.environ.get(DATA_DIR_ENV_VAR)
        os.environ[DATA_DIR_ENV_VAR] = self._tmp.name
        run_migrations()
        settings_repo.set_legal_consent(True)
        settings_repo.save_youtube_api_key("AIzaSyPhase10DefaultKey123456")

    def tearDown(self) -> None:
        close_logging_handlers()
        if self._prev_dir is None:
            os.environ.pop(DATA_DIR_ENV_VAR, None)
        else:
            os.environ[DATA_DIR_ENV_VAR] = self._prev_dir
        self._tmp.cleanup()

    def test_sec01_dns_rebinding_host_cross_site_fetch_and_tauri_origin_compatibility(self) -> None:
        with self.assertRaises(ValueError):
            validate_loopback_bind_host("0.0.0.0")
        with self.assertRaises(ValueError):
            validate_loopback_bind_host("::")
        self.assertEqual(validate_loopback_bind_host("127.0.0.1"), "127.0.0.1")

        proj = project_repo.create_project("Security Boundary Proj")
        headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}
        with TestClient(create_app()) as client:
            # DNS rebinding Host attacks across GET, export, docs, and POST
            for method, path in (
                ("GET", "/api/v1/projects"),
                ("GET", f"/api/v1/projects/{proj['id']}/export"),
                ("GET", "/api/docs"),
                ("POST", "/api/v1/projects"),
            ):
                rebound = client.request(
                    method,
                    path,
                    headers={"Host": "evil-rebind.example:8000", **headers},
                    json={"name": "Pwned"} if method == "POST" else None,
                )
                self.assertEqual(rebound.status_code, 403)
                self.assertEqual(rebound.json()["error"]["code"], "HOST_NOT_ALLOWED")

            # Cross-site GET read with external Origin or Sec-Fetch-Site: cross-site (e.g. <img> / fetch)
            evil_get_origin = client.get(
                "/api/v1/ideas",
                headers={"Host": "127.0.0.1:8000", "Origin": "https://evil.example"},
            )
            self.assertEqual(evil_get_origin.status_code, 403)
            self.assertEqual(evil_get_origin.json()["error"]["code"], "CSRF_ORIGIN_FORBIDDEN")

            cross_site_img = client.get(
                "/api/v1/ideas",
                headers={"Host": "127.0.0.1:8000", "Sec-Fetch-Site": "cross-site"},
            )
            self.assertEqual(cross_site_img.status_code, 403)
            self.assertEqual(cross_site_img.json()["error"]["code"], "CSRF_CROSS_SITE_BLOCKED")

            # Drive-by quota drain via GET /api/v1/global/categories?refresh=true without client header
            with patch("app.clients.youtube_client.fetch_video_categories") as mock_cats:
                cat_blocked = client.get(
                    "/api/v1/global/categories?refresh=true",
                    headers={"Host": "127.0.0.1:8000"},
                )
                self.assertEqual(cat_blocked.status_code, 403)
                self.assertEqual(cat_blocked.json()["error"]["code"], "CSRF_HEADER_MISSING")
                mock_cats.assert_not_called()
            self.assertEqual(quota_service.get_quota_status()["generalData"]["used"], 0)

            # Tauri WebView2 future origin compatibility + security headers verification
            tauri_ok = client.get(
                "/api/v1/projects",
                headers={
                    "Host": "127.0.0.1:8000",
                    "Origin": "http://tauri.localhost",
                    "Sec-Fetch-Site": "cross-site",
                    **headers,
                },
            )
            self.assertEqual(tauri_ok.status_code, 200)
            self.assertEqual(tauri_ok.headers.get("x-content-type-options"), "nosniff")
            self.assertEqual(tauri_ok.headers.get("x-frame-options"), "DENY")
            self.assertEqual(tauri_ok.headers.get("cache-control"), "no-store")
            self.assertEqual(tauri_ok.headers.get("referrer-policy"), "no-referrer")

    async def test_sec02_rss_gzip_decompression_bomb_and_valid_gzip_deflate_feeds(self) -> None:
        bomb_plain = b"A" * (12 * 1024 * 1024)  # 12 MB decompressed > 5 MB cap
        bomb_gzip = gzip.compress(bomb_plain)
        self.assertLess(len(bomb_gzip), 100 * 1024)

        valid_rss = (
            b'<?xml version="1.0" encoding="utf-8"?>'
            b"<rss version=\"2.0\"><channel><title>Compressed Feed</title>"
            b"<item><title>Gzip Item</title><link>https://example.com/1</link></item>"
            b"</channel></rss>"
        )
        valid_gzip = gzip.compress(valid_rss)
        valid_deflate = zlib.compress(valid_rss)

        class _RawAsyncStream(httpx.AsyncByteStream):
            def __init__(self, payload: bytes) -> None:
                self._payload = payload

            async def __aiter__(self) -> AsyncIterator[bytes]:
                yield self._payload

        def _transport_handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/bomb.xml":
                return httpx.Response(
                    200,
                    headers={"Content-Encoding": "gzip"},
                    stream=_RawAsyncStream(bomb_gzip),
                )
            if request.url.path == "/valid-gzip.xml":
                return httpx.Response(
                    200,
                    headers={"Content-Encoding": "gzip"},
                    stream=_RawAsyncStream(valid_gzip),
                )
            if request.url.path == "/valid-deflate.xml":
                return httpx.Response(
                    200,
                    headers={"Content-Encoding": "deflate"},
                    stream=_RawAsyncStream(valid_deflate),
                )
            return httpx.Response(404)

        def _public_dns(_h: str, port: int) -> list[tuple[object, ...]]:
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port))]

        transport = httpx.MockTransport(_transport_handler)
        resolver = _public_dns

        with self.assertRaises(AppError) as ctx:
            await rss_client.fetch_and_parse_feed(
                "https://feeds.example.com/bomb.xml",
                transport=transport,
                resolver=resolver,
            )
        self.assertEqual(ctx.exception.code, "RSS_PAYLOAD_TOO_LARGE")
        self.assertEqual(ctx.exception.status_code, 413)

        parsed_gzip = await rss_client.fetch_and_parse_feed(
            "https://feeds.example.com/valid-gzip.xml",
            transport=transport,
            resolver=resolver,
        )
        self.assertEqual(len(parsed_gzip), 1)
        self.assertEqual(parsed_gzip[0]["title"], "Gzip Item")

        parsed_deflate = await rss_client.fetch_and_parse_feed(
            "https://feeds.example.com/valid-deflate.xml",
            transport=transport,
            resolver=resolver,
        )
        self.assertEqual(len(parsed_deflate), 1)
        self.assertEqual(parsed_deflate[0]["title"], "Gzip Item")

    def test_sec02_rss_isatap_siit_zone_id_trailing_dot_and_obfuscated_ip_blocked(self) -> None:
        dns_called = False

        def _spy_dns(_host: str, _port: int) -> list[tuple[object, ...]]:
            nonlocal dns_called
            dns_called = True
            return []

        blocked_urls = [
            "http://[2606:4700::5efe:127.0.0.1]/feed.xml",
            "http://[2606:4700::200:5efe:169.254.169.254]/feed.xml",
            "http://[::ffff:0:127.0.0.1]/feed.xml",
            "http://[2606:4700:4700::1111%251]/feed.xml",
            "http://sub.localhost./feed.xml",
            "http://metadata.google.internal./feed.xml",
            "http://0x7f000001/feed.xml",
            "http://0177.0.0.1/feed.xml",
            "http://2130706433/feed.xml",
            "http://127.1/feed.xml",
        ]
        for url in blocked_urls:
            with self.subTest(url=url):
                with self.assertRaises(AppError) as ctx:
                    rss_client.validate_public_feed_url(url, resolver=_spy_dns)
                self.assertEqual(ctx.exception.code, "RSS_SSRF_BLOCKED")
        self.assertFalse(dns_called)

    def test_sec03_validation_422_never_echoes_api_key_and_urlencoded_log_redaction(self) -> None:
        configure_logging()
        headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}
        with TestClient(create_app()) as client:
            type_err = client.put(
                "/api/v1/system/youtube-api-key",
                headers=headers,
                json={"apiKey": ["AIzaSyEchoLeakSecret999"]},
            )
            self.assertEqual(type_err.status_code, 422)
            self.assertEqual(type_err.json()["error"]["code"], "VALIDATION_ERROR")
            self.assertNotIn("AIzaSyEchoLeakSecret999", type_err.text)

            oversized = "AIzaSy" + ("Z" * 300)
            len_err = client.put(
                "/api/v1/system/youtube-api-key",
                headers=headers,
                json={"apiKey": oversized},
            )
            self.assertEqual(len_err.status_code, 422)
            self.assertNotIn(oversized, len_err.text)

        self.assertEqual(
            redact_sensitive_text("GET /videos?key%3DAIzaSyEncodedSecret999&id=v1"),
            "GET /videos?key%3D[REDACTED]&id=v1",
        )
        self.assertEqual(
            redact_sensitive_text('{"rawApiKey":"AIzaSyJsonSecret777"}'),
            '{"rawApiKey":"[REDACTED]"}',
        )

    def test_sec03_sqlite_purge_all_wipes_residual_api_bytes_from_db_file_while_preserving_user_data(self) -> None:
        now = datetime(2026, 11, 16, 14, 0, tzinfo=timezone.utc)
        marker = "UNIQUE_YT_CACHE_RESIDUAL_MARKER_8844"
        proj = project_repo.create_project("Purge Forensic Project")
        youtube_repo.upsert_channel(
            channel_id="UC1234567890123456789012",
            title=f"Chan {marker}",
            uploads_playlist_id="UU1234567890123456789012",
            now_utc=now,
        )
        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_forensic_1",
            channel_id="UC1234567890123456789012",
            title=f"Video {marker}",
            description=f"Description {marker}",
            duration_seconds=300,
            view_count=5000,
            now_utc=now,
        )
        youtube_repo.set_manual_video_format("vid_forensic_1", "long_form", now_utc=now)
        idea = idea_repo.create_idea(
            title="Preserved Idea Forever",
            notes="Must survive VACUUM purge",
            source_type="youtube_video",
            source_ref_id="vid_forensic_1",
            source_title_snapshot=f"Snap {marker}",
            source_url="https://www.youtube.com/watch?v=vid_forensic_1",
            tags=[],
            in_global_vault=True,
            target_project_ids=[proj["id"]],
            project_angle="Angle preserved",
        )
        feed = rss_repo.create_feed(name="Safe RSS", url="https://example.org/rss.xml")
        rss_repo.record_feed_fetch_success(
            feed["id"],
            [
                {
                    "dedup_key": "art-1",
                    "canonical_url": "https://example.org/1",
                    "title": "Preserved RSS Story",
                    "summary_text": "Safe summary",
                    "published_at": now.isoformat(),
                }
            ],
        )

        dirs = ensure_runtime_dirs()
        create_sqlite_backup(dirs["db_path"], dirs["backups"])

        with read_db() as conn:
            self.assertEqual(conn.execute("PRAGMA secure_delete;").fetchone()[0], 1)

        purge_res = retention_service.purge_all_youtube_api_data_by_user_request(now_utc=now)
        self.assertGreaterEqual(int(purge_res["dbBackupsDeleted"]), 1)

        raw_db_bytes = dirs["db_path"].read_bytes()
        self.assertNotIn(marker.encode("utf-8"), raw_db_bytes)
        self.assertEqual(list(dirs["backups"].glob("*.db")), [])

        self.assertEqual(project_repo.get_project(proj["id"])["name"], "Purge Forensic Project")
        self.assertEqual(idea_repo.get_idea(idea["id"])["notes"], "Must survive VACUUM purge")
        self.assertEqual(youtube_repo.get_video_record("vid_forensic_1")["manualFormat"], "long_form")
        self.assertEqual(len(rss_repo.list_articles(feed_id=feed["id"])), 1)
        self.assertEqual(settings_repo.get_decrypted_youtube_api_key(), "AIzaSyPhase10DefaultKey123456")

    def test_sec04_and_sec05_unsafe_thumbnail_schemes_sql_like_wildcards_and_query_bounds(self) -> None:
        for bad_url in (
            "file:////attacker-smb/share/thumb.png",
            "http://127.0.0.1:8000/thumb.png",
            "http://i.ytimg.com/vi/abc/hqdefault.jpg",
            "javascript:alert(1)",
            "data:image/svg+xml,<svg/>",
            "https://user:pass@i.ytimg.com/vi/abc/hqdefault.jpg",
            "https://[fe80::1]/thumb.jpg",
        ):
            parsed = youtube_client.parse_youtube_video_item(
                {
                    "id": "v1",
                    "snippet": {"thumbnails": {"high": {"url": bad_url}}},
                }
            )
            self.assertIsNone(parsed["thumbnail_url"], msg=f"Must reject {bad_url}")

        good = youtube_client.parse_youtube_video_item(
            {
                "id": "v2",
                "snippet": {"thumbnails": {"high": {"url": "https://i.ytimg.com/vi/abc/hqdefault.jpg"}}},
            }
        )
        self.assertEqual(good["thumbnail_url"], "https://i.ytimg.com/vi/abc/hqdefault.jpg")

        # SQL LIKE wildcard escaping for % and _
        feed = rss_repo.create_feed(name="Like Escape Feed", url="https://example.net/feed.xml")
        rss_repo.record_feed_fetch_success(
            feed["id"],
            [
                {
                    "dedup_key": "k1",
                    "canonical_url": "https://example.net/1",
                    "title": "Gain 100% SQLite Speed",
                    "summary_text": "",
                    "published_at": None,
                },
                {
                    "dedup_key": "k2",
                    "canonical_url": "https://example.net/2",
                    "title": "Gain 1000 SQLite Speed",
                    "summary_text": "",
                    "published_at": None,
                },
            ],
        )
        matched_rss = rss_repo.list_articles(search="100%")
        self.assertEqual([a["title"] for a in matched_rss], ["Gain 100% SQLite Speed"])

        idea_repo.create_idea(
            title="Check 100_test literal",
            notes="",
            source_type="manual",
            source_ref_id="m1",
            source_title_snapshot="",
            source_url="",
            tags=[],
            in_global_vault=True,
            target_project_ids=[],
            project_angle="",
        )
        idea_repo.create_idea(
            title="Check 100Xtest unrelated",
            notes="",
            source_type="manual",
            source_ref_id="m2",
            source_title_snapshot="",
            source_url="",
            tags=[],
            in_global_vault=True,
            target_project_ids=[],
            project_angle="",
        )
        matched_ideas = idea_repo.list_ideas(search="100_test")
        self.assertEqual([i["title"] for i in matched_ideas], ["Check 100_test literal"])

        with TestClient(create_app()) as client:
            over_limit = client.get("/api/v1/rss/articles?limit=5000")
            self.assertEqual(over_limit.status_code, 422)
