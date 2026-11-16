from __future__ import annotations

import os
import tempfile
import unittest

from fastapi.testclient import TestClient

from app.core.config import DATA_DIR_ENV_VAR
from app.core.errors import AppError
from app.core.logging_setup import close_logging_handlers
from app.core.security import CSRF_HEADER_NAME, CSRF_HEADER_VALUE
from app.db.connection import read_db, write_db
from app.db.migrator import run_migrations
from app.main import app
from app.repositories.settings_repo import get_decrypted_youtube_api_key

CSRF_HEADERS = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}


class DpapiAndSettingsTests(unittest.TestCase):
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

    def test_legal_consent_gate_dpapi_encryption_and_masking(self) -> None:
        secret = "AIzaSyFakeUnitTestKey_1234567890"
        with TestClient(app) as client:
            initial = client.get("/api/v1/system/settings")
            self.assertEqual(initial.status_code, 200)
            self.assertEqual(initial.json()["apiKeyStatus"], "missing")
            self.assertFalse(initial.json()["legalConsentAccepted"])

            blocked = client.put(
                "/api/v1/system/youtube-api-key",
                headers=CSRF_HEADERS,
                json={"apiKey": secret},
            )
            self.assertEqual(blocked.status_code, 400)
            self.assertEqual(blocked.json()["error"]["code"], "LEGAL_CONSENT_REQUIRED")

            consent = client.post(
                "/api/v1/system/legal-consent",
                headers=CSRF_HEADERS,
                json={"accepted": True},
            )
            self.assertEqual(consent.status_code, 200)
            self.assertTrue(consent.json()["legalConsentAccepted"])

            saved = client.put(
                "/api/v1/system/youtube-api-key",
                headers=CSRF_HEADERS,
                json={"apiKey": secret},
            )
            self.assertEqual(saved.status_code, 200)
            body = saved.json()
            self.assertEqual(body["apiKeyStatus"], "configured")
            self.assertEqual(body["maskedApiKey"], "AIza...7890")
            self.assertNotIn(secret, str(body))

            with read_db() as conn:
                raw_blob = bytes(
                    conn.execute("SELECT encrypted_youtube_api_key FROM system_settings WHERE id = 1").fetchone()[0]
                )
            self.assertNotIn(secret.encode("utf-8"), raw_blob)
            self.assertEqual(get_decrypted_youtube_api_key(), secret)

    def test_corrupted_dpapi_blob_recovers_cleanly_without_500(self) -> None:
        run_migrations()
        with TestClient(app) as client:
            client.post("/api/v1/system/legal-consent", headers=CSRF_HEADERS, json={"accepted": True})
            with write_db() as conn:
                conn.execute(
                    "UPDATE system_settings SET encrypted_youtube_api_key = ? WHERE id = 1",
                    (b"corrupted-not-valid-dpapi-blob",),
                )

            read_resp = client.get("/api/v1/system/settings")
            self.assertEqual(read_resp.status_code, 200)
            self.assertEqual(read_resp.json()["apiKeyStatus"], "unreadable")
            self.assertIsNone(read_resp.json()["maskedApiKey"])

            with self.assertRaises(AppError) as ctx:
                get_decrypted_youtube_api_key()
            self.assertEqual(ctx.exception.code, "YOUTUBE_API_KEY_UNREADABLE")

            overwrite = client.put(
                "/api/v1/system/youtube-api-key",
                headers=CSRF_HEADERS,
                json={"apiKey": "AIzaSyReplacementKey_ABCD"},
            )
            self.assertEqual(overwrite.status_code, 200)
            self.assertEqual(overwrite.json()["apiKeyStatus"], "configured")
            self.assertEqual(overwrite.json()["maskedApiKey"], "AIza...ABCD")

            deleted = client.delete("/api/v1/system/youtube-api-key", headers=CSRF_HEADERS)
            self.assertEqual(deleted.status_code, 200)
            self.assertEqual(deleted.json()["apiKeyStatus"], "missing")

    def test_update_tuning_and_theme_settings(self) -> None:
        with TestClient(app) as client:
            res = client.put(
                "/api/v1/system/settings",
                headers=CSRF_HEADERS,
                json={
                    "themeMode": "dark",
                    "defaultRegionCode": "us",
                    "defaultRelevanceLanguage": "en",
                    "autoRefreshEnabled": False,
                    "quotaWarningRatio": 0.75,
                },
            )
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["themeMode"], "dark")
            self.assertEqual(data["defaultRegionCode"], "US")
            self.assertEqual(data["defaultRelevanceLanguage"], "en")
            self.assertFalse(data["autoRefreshEnabled"])
            self.assertEqual(data["quotaWarningRatio"], 0.75)


if __name__ == "__main__":
    unittest.main()
