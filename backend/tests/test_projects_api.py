from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
import unittest

from fastapi.testclient import TestClient

from app.core.config import DATA_DIR_ENV_VAR
from app.core.errors import AppError
from app.core.logging_setup import close_logging_handlers
from app.core.security import CSRF_HEADER_NAME, CSRF_HEADER_VALUE
from app.db.connection import read_db, write_db
from app.main import app
from app.repositories.project_repo import resolve_safe_child_path, safe_project_slug

CSRF_HEADERS = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}


class ProjectsApiIsolationTests(unittest.TestCase):
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

    def test_project_crud_and_safe_slug_export(self) -> None:
        with TestClient(app) as client:
            client.post("/api/v1/system/legal-consent", headers=CSRF_HEADERS, json={"accepted": True})
            client.put(
                "/api/v1/system/youtube-api-key",
                headers=CSRF_HEADERS,
                json={"apiKey": "AIzaSySecretKey_ShouldNeverAppearInExport"},
            )

            created_a = client.post(
                "/api/v1/projects",
                headers=CSRF_HEADERS,
                json={"name": "../../CON", "description": "Kênh thử slug nguy hiểm", "regionCode": "VN"},
            )
            self.assertEqual(created_a.status_code, 201)
            pid_a = created_a.json()["project"]["id"]

            created_b = client.post(
                "/api/v1/projects",
                headers=CSRF_HEADERS,
                json={"name": "Tài chính Cá nhân VN", "regionCode": "VN"},
            )
            self.assertEqual(created_b.status_code, 201)
            pid_b = created_b.json()["project"]["id"]

            export_resp = client.get(f"/api/v1/projects/{pid_a}/export")
            self.assertEqual(export_resp.status_code, 200)
            disposition = export_resp.headers["content-disposition"]
            self.assertIn("project-con.json", disposition)
            self.assertNotIn("..", disposition)

            exported = json.loads(export_resp.text)
            self.assertFalse(exported["containsApiKeys"])
            self.assertNotIn("AIzaSySecretKey_ShouldNeverAppearInExport", export_resp.text)
            self.assertNotIn(pid_b, export_resp.text)

    def test_windows_device_names_and_traversal_blocked(self) -> None:
        self.assertEqual(safe_project_slug("NUL", "p1"), "project-nul")
        self.assertEqual(safe_project_slug("Kênh Công Nghệ Việt", "p2"), "kenh-cong-nghe-viet")
        base = Path(self._tmp.name) / "backups"
        base.mkdir(parents=True, exist_ok=True)
        for bad in ("../escape.json", "CON.json", "sub/file.json"):
            with self.assertRaises(AppError):
                resolve_safe_child_path(base, bad)

    def test_confirmed_delete_preserves_shared_entities_and_creates_recovery_backup(self) -> None:
        with TestClient(app) as client:
            pa = client.post("/api/v1/projects", headers=CSRF_HEADERS, json={"name": "Project A"}).json()["project"]
            pb = client.post("/api/v1/projects", headers=CSRF_HEADERS, json={"name": "Project B"}).json()["project"]

            with write_db() as conn:
                now = "2026-11-16T00:00:00Z"
                conn.execute(
                    "INSERT INTO youtube_channels (channel_id, title, created_at) VALUES (?, ?, ?)",
                    ("UC_SHARED_1", "Shared Channel", now),
                )
                conn.execute(
                    "INSERT INTO project_channels (id, project_id, channel_id, notes, added_at) VALUES (?, ?, ?, ?, ?)",
                    ("pc_a", pa["id"], "UC_SHARED_1", "Note A", now),
                )
                conn.execute(
                    "INSERT INTO project_channels (id, project_id, channel_id, notes, added_at) VALUES (?, ?, ?, ?, ?)",
                    ("pc_b", pb["id"], "UC_SHARED_1", "Note B", now),
                )
                conn.execute(
                    "INSERT INTO ideas (id, title, source_type, in_global_vault, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                    ("idea_global", "Shared Vault Idea", "manual", 1, now, now),
                )
                conn.execute(
                    "INSERT INTO ideas (id, title, source_type, in_global_vault, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                    ("idea_private_a", "Private A Only Idea", "manual", 0, now, now),
                )
                for link_id, pid, iid in [("pi1", pa["id"], "idea_global"), ("pi2", pb["id"], "idea_global"), ("pi3", pa["id"], "idea_private_a")]:
                    conn.execute(
                        "INSERT INTO project_ideas (id, project_id, idea_id, status_updated_at) VALUES (?, ?, ?, ?)",
                        (link_id, pid, iid, now),
                    )
                conn.execute(
                    "INSERT INTO project_keywords (id, project_id, keyword, created_at) VALUES (?, ?, ?, ?)",
                    ("kw_a", pa["id"], "only_a", now),
                )

            wrong_del = client.post(
                f"/api/v1/projects/{pa['id']}/delete",
                headers=CSRF_HEADERS,
                json={"confirmName": "Wrong Name"},
            )
            self.assertEqual(wrong_del.status_code, 400)
            self.assertEqual(wrong_del.json()["error"]["code"], "DELETE_CONFIRM_MISMATCH")

            ok_del = client.post(
                f"/api/v1/projects/{pa['id']}/delete",
                headers=CSRF_HEADERS,
                json={"confirmName": "Project A"},
            )
            self.assertEqual(ok_del.status_code, 200)
            backup_name = ok_del.json()["recoveryBackupFilename"]
            backup_file = Path(self._tmp.name) / "backups" / backup_name
            self.assertTrue(backup_file.is_file())

            with read_db() as conn:
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM projects WHERE id = ?", (pa["id"],)).fetchone()[0], 0)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM projects WHERE id = ?", (pb["id"],)).fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM youtube_channels WHERE channel_id = 'UC_SHARED_1'").fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM project_channels WHERE project_id = ?", (pb["id"],)).fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM ideas WHERE id = 'idea_global'").fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM ideas WHERE id = 'idea_private_a'").fetchone()[0], 0)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM project_keywords WHERE id = 'kw_a'").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
