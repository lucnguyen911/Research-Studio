from __future__ import annotations

import os
from pathlib import Path
import tempfile
import unittest

from fastapi.testclient import TestClient

from app.core.config import DATA_DIR_ENV_VAR, ensure_runtime_dirs
from app.core.errors import AppError
from app.core.logging_setup import close_logging_handlers, configure_logging
from app.main import create_app

test_app = create_app()


@test_app.post("/api/v1/_test-echo")
async def _test_echo() -> dict[str, str]:
    return {"status": "ok"}


@test_app.get("/api/v1/_test-boom")
async def _test_boom() -> None:
    raise RuntimeError("secret_internal_boom_value")


@test_app.get("/api/v1/_test-app-error")
async def _test_app_error() -> None:
    raise AppError(code="TEST_DOMAIN_ERR", message="Thông báo lỗi an toàn", status_code=409, details={"item": 1})


class CoreConfigSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_data_dir = os.environ.get(DATA_DIR_ENV_VAR)
        self._tmp = tempfile.TemporaryDirectory()
        os.environ[DATA_DIR_ENV_VAR] = self._tmp.name

    def tearDown(self) -> None:
        close_logging_handlers()
        if self._old_data_dir is None:
            os.environ.pop(DATA_DIR_ENV_VAR, None)
        else:
            os.environ[DATA_DIR_ENV_VAR] = self._old_data_dir
        self._tmp.cleanup()

    def test_runtime_dirs_created_under_override(self) -> None:
        dirs = ensure_runtime_dirs()
        root = Path(self._tmp.name).resolve()
        self.assertEqual(dirs["root"], root)
        for sub in ("data", "backups", "logs", "config"):
            self.assertTrue(dirs[sub].is_dir())
        self.assertEqual(dirs["db_path"], root / "data" / "research_studio.db")

    def test_log_redaction_scrubs_api_keys_and_bearer_tokens(self) -> None:
        logger = configure_logging()
        raw_yt_url = "https://www.googleapis.com/youtube/v3/videos?part=snippet&key=AIzaSySecretKey99887766&id=abc"
        logger.info("Calling YouTube URL: %s header=%s", raw_yt_url, "Bearer top_secret_jwt_123")
        close_logging_handlers()

        log_file = Path(self._tmp.name) / "logs" / "research_studio.log"
        content = log_file.read_text(encoding="utf-8")
        self.assertNotIn("AIzaSySecretKey99887766", content)
        self.assertNotIn("top_secret_jwt_123", content)
        self.assertIn("key=[REDACTED]", content)
        self.assertIn("Bearer [REDACTED]", content)

    def test_csrf_header_and_origin_enforcement(self) -> None:
        with TestClient(test_app, raise_server_exceptions=False) as client:
            missing_hdr = client.post("/api/v1/_test-echo")
            self.assertEqual(missing_hdr.status_code, 403)
            self.assertEqual(missing_hdr.json()["error"]["code"], "CSRF_HEADER_MISSING")

            evil_origin = client.post(
                "/api/v1/_test-echo",
                headers={
                    "X-Research-Studio-Client": "local-web",
                    "Origin": "https://evil.example.com",
                },
            )
            self.assertEqual(evil_origin.status_code, 403)
            self.assertEqual(evil_origin.json()["error"]["code"], "CSRF_ORIGIN_FORBIDDEN")

            ok_resp = client.post(
                "/api/v1/_test-echo",
                headers={
                    "X-Research-Studio-Client": "local-web",
                    "Origin": "http://127.0.0.1:5173",
                },
            )
            self.assertEqual(ok_resp.status_code, 200)
            self.assertEqual(ok_resp.json(), {"status": "ok"})

    def test_error_handlers_never_leak_tracebacks(self) -> None:
        with TestClient(test_app, raise_server_exceptions=False) as client:
            app_err = client.get("/api/v1/_test-app-error")
            self.assertEqual(app_err.status_code, 409)
            self.assertEqual(app_err.json()["error"]["code"], "TEST_DOMAIN_ERR")
            self.assertEqual(app_err.json()["error"]["details"], {"item": 1})

            boom = client.get("/api/v1/_test-boom")
            self.assertEqual(boom.status_code, 500)
            payload = boom.json()
            self.assertEqual(payload["error"]["code"], "INTERNAL_ERROR")
            self.assertNotIn("secret_internal_boom_value", str(payload))
            self.assertNotIn("Traceback", str(payload))


if __name__ == "__main__":
    unittest.main()
