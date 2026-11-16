from __future__ import annotations

from datetime import datetime, timezone
import os
import tempfile
import unittest

from fastapi.testclient import TestClient

from app.core.security import CSRF_HEADER_NAME, CSRF_HEADER_VALUE
from app.db.connection import read_db
from app.db.migrator import run_migrations
from app.main import create_app
from app.repositories import project_repo, youtube_repo
from app.services import retention_service


class IdeasMultiProjectTests(unittest.TestCase):
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

    def test_single_canonical_idea_independent_multiproject_states_and_30d_purge_survival(self) -> None:
        proj_a = project_repo.create_project("Kênh AI Thực Chiến")
        proj_b = project_repo.create_project("Kênh Dev Tổng Hợp")

        t_fetch = datetime(2026, 11, 16, 10, 0, 0, tzinfo=timezone.utc)
        youtube_repo.upsert_video_and_snapshot(
            video_id="VID_IDEA_01",
            channel_id="UC_IDEA_CH",
            title="YouTube Source Video Title",
            duration_seconds=540,
            view_count=42000,
            now_utc=t_fetch,
        )

        app = create_app()
        headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}
        with TestClient(app) as client:
            # 1) Create one canonical idea linked simultaneously to Project A and Project B
            create_resp = client.post(
                "/api/v1/ideas",
                headers=headers,
                json={
                    "title": "Xây app Local AI với FastAPI + SQLite",
                    "notes": "Ý tưởng gốc dùng chung cho cả 2 kênh.",
                    "sourceType": "youtube_video",
                    "sourceRefId": "VID_IDEA_01",
                    "sourceTitleSnapshot": "YouTube Source Video Title",
                    "sourceUrl": "https://www.youtube.com/watch?v=VID_IDEA_01",
                    "tags": ["fastapi", "local-ai"],
                    "inGlobalVault": True,
                    "targetProjectIds": [proj_a["id"], proj_b["id"]],
                    "projectAngle": "Góc nhìn chung ban đầu",
                    "priority": "high",
                },
            )
            self.assertEqual(create_resp.status_code, 201)
            idea = create_resp.json()["idea"]
            idea_id = idea["id"]

            # Verify strictly 1 row in `ideas` and 2 rows in `project_ideas`
            with read_db() as conn:
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM ideas").fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM project_ideas").fetchone()[0], 2)

            # 2) Reject javascript: URL in publishedVideoUrl
            bad_url_resp = client.put(
                f"/api/v1/ideas/{idea_id}/projects/{proj_a['id']}",
                headers=headers,
                json={"publishedVideoUrl": "javascript:alert(1)"},
            )
            self.assertEqual(bad_url_resp.status_code, 400)

            # 3) Update status/angle/publishedVideoUrl in Project A -> Project B remains completely untouched
            upd_a_resp = client.put(
                f"/api/v1/ideas/{idea_id}/projects/{proj_a['id']}",
                headers=headers,
                json={
                    "status": "produced",
                    "priority": "high",
                    "projectAngle": "Góc phân tích chuyên sâu cho Kênh AI",
                    "projectNotes": "Đã quay xong bản demo trên RTX.",
                    "publishedVideoUrl": "https://www.youtube.com/watch?v=DONE_123",
                },
            )
            self.assertEqual(upd_a_resp.status_code, 200)
            links = upd_a_resp.json()["idea"]["projectLinks"]
            self.assertEqual(links[proj_a["id"]]["status"], "produced")
            self.assertEqual(links[proj_a["id"]]["publishedVideoUrl"], "https://www.youtube.com/watch?v=DONE_123")
            self.assertEqual(links[proj_b["id"]]["status"], "new")
            self.assertEqual(links[proj_b["id"]]["projectAngle"], "Góc nhìn chung ban đầu")

            # Filter Project A only for 'produced', Project B only for 'new'
            list_a = client.get(f"/api/v1/ideas?projectId={proj_a['id']}&status=produced").json()["items"]
            list_b = client.get(f"/api/v1/ideas?projectId={proj_b['id']}&status=new").json()["items"]
            self.assertEqual(len(list_a), 1)
            self.assertEqual(len(list_b), 1)

            # 4) User purges ALL cached YouTube API data -> idea survives via LEFT JOIN with apiPurged=True
            purge_resp = client.post("/api/v1/system/purge-youtube-cache", headers=headers)
            self.assertEqual(purge_resp.status_code, 200)

            vault_after = client.get("/api/v1/ideas").json()["items"]
            self.assertEqual(len(vault_after), 1)
            survived = vault_after[0]
            self.assertTrue(survived["apiPurged"])
            self.assertEqual(survived["title"], "Xây app Local AI với FastAPI + SQLite")
            self.assertEqual(survived["sourceUrl"], "https://www.youtube.com/watch?v=VID_IDEA_01")
            self.assertNotIn("YouTube Source Video Title", survived["sourceTitleSnapshot"])

            # 5) Deleting Project A preserves canonical idea and Project B link
            del_proj_a = client.post(
                f"/api/v1/projects/{proj_a['id']}/delete",
                headers=headers,
                json={"confirmName": proj_a["name"]},
            )
            self.assertEqual(del_proj_a.status_code, 200)
            after_del = client.get(f"/api/v1/ideas/{idea_id}").json()["idea"]
            self.assertEqual(list(after_del["projectLinks"].keys()), [proj_b["id"]])

            # 6) Detaching last Project keeps canonical idea alive in Global Vault
            detach_b = client.delete(f"/api/v1/ideas/{idea_id}/projects/{proj_b['id']}", headers=headers)
            self.assertEqual(detach_b.status_code, 200)
            detached = detach_b.json()["idea"]
            self.assertEqual(detached["projectLinks"], {})
            self.assertTrue(detached["inGlobalVault"])

            # Verify purge_expired_api_data helper doesn't crash on tombstoned video either
            retention_service.purge_expired_api_data(now_utc=t_fetch)
