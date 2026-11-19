from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.config import (
    BOOTSTRAP_DIR_ENV_VAR,
    DATA_DIR_ENV_VAR,
    REPO_ROOT,
    USER_BACKUP_KEEP_COUNT,
    ensure_runtime_dirs,
    get_data_dir,
)
from app.core.logging_setup import close_logging_handlers
from app.core.security import CSRF_HEADER_NAME, CSRF_HEADER_VALUE
from app.db.migrator import run_migrations
from app.main import create_app
from app.repositories import idea_repo, project_repo, rss_repo, settings_repo, youtube_repo
from app.services import retention_service, storage_service


class StorageAndBackupTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_data_dir = os.environ.pop(DATA_DIR_ENV_VAR, None)
        self._old_bootstrap = os.environ.get(BOOTSTRAP_DIR_ENV_VAR)
        self._root_tmp = tempfile.TemporaryDirectory()
        self._bootstrap_dir = (Path(self._root_tmp.name) / "bootstrap").resolve()
        self._bootstrap_dir.mkdir(parents=True, exist_ok=True)
        os.environ[BOOTSTRAP_DIR_ENV_VAR] = str(self._bootstrap_dir)
        run_migrations()

    def tearDown(self) -> None:
        close_logging_handlers()
        os.environ.pop(DATA_DIR_ENV_VAR, None)
        if self._old_data_dir is not None:
            os.environ[DATA_DIR_ENV_VAR] = self._old_data_dir
        if self._old_bootstrap is None:
            os.environ.pop(BOOTSTRAP_DIR_ENV_VAR, None)
        else:
            os.environ[BOOTSTRAP_DIR_ENV_VAR] = self._old_bootstrap
        self._root_tmp.cleanup()

    def test_rejects_unsafe_paths_for_migration_and_external_backup(self) -> None:
        headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}
        invalid_paths = [
            "relative/folder",
            r"\\127.0.0.1\share\rsbackup",
            "//server/share/rsbackup",
            "C:\\",
            r"C:\Temp\CON",
            r"C:\Temp\NUL\Data",
            r"C:\Windows\Temp\ResearchStudioTest",
            str(REPO_ROOT / "bad_data_dir"),
        ]
        with TestClient(create_app()) as client:
            for bad_path in invalid_paths:
                with self.subTest(bad_path=bad_path):
                    mig = client.post(
                        "/api/v1/system/storage/migrate-data-dir",
                        headers=headers,
                        json={"targetDir": bad_path},
                    )
                    self.assertEqual(mig.status_code, 400)
                    self.assertIn(mig.json()["error"]["code"], {"STORAGE_PATH_INVALID", "STORAGE_PATH_FORBIDDEN"})

                    ext = client.put(
                        "/api/v1/system/storage/backup-config",
                        headers=headers,
                        json={"externalBackupDir": bad_path},
                    )
                    self.assertEqual(ext.status_code, 400)
                    self.assertIn(ext.json()["error"]["code"], {"STORAGE_PATH_INVALID", "STORAGE_PATH_FORBIDDEN"})

    def test_sanitized_backup_copies_to_external_survives_cache_purge_and_prunes_to_seven(self) -> None:
        now = datetime(2026, 11, 18, 10, 0, tzinfo=timezone.utc)
        yt_marker = "YT_EPHEMERAL_CACHE_MARKER_889911"
        raw_api_key = "AIzaSyOption3TestKey123456"

        settings_repo.set_legal_consent(True)
        settings_repo.save_youtube_api_key(raw_api_key)
        proj = project_repo.create_project("Option 3 Backup Project")
        youtube_repo.upsert_channel(
            channel_id="UC1234567890123456789012",
            title=f"Chan {yt_marker}",
            uploads_playlist_id="UU1234567890123456789012",
            now_utc=now,
        )
        youtube_repo.upsert_video_and_snapshot(
            video_id="vid_bak_1",
            channel_id="UC1234567890123456789012",
            title=f"Title {yt_marker}",
            description=f"Desc {yt_marker}",
            duration_seconds=320,
            view_count=12345,
            now_utc=now,
        )
        youtube_repo.set_manual_video_format("vid_bak_1", "long_form", now_utc=now)
        idea = idea_repo.create_idea(
            title="Evergreen Backup Idea",
            notes="Must stay inside sanitized backup",
            source_type="youtube_video",
            source_ref_id="vid_bak_1",
            source_title_snapshot=f"Snap {yt_marker}",
            source_url="https://www.youtube.com/watch?v=vid_bak_1",
            tags=["backup"],
            in_global_vault=True,
            target_project_ids=[proj["id"]],
            project_angle="Core angle",
        )
        feed = rss_repo.create_feed(name="Trusted Blog", url="https://example.org/feed.xml")
        rss_repo.record_feed_fetch_success(
            feed["id"],
            [
                {
                    "dedup_key": "r1",
                    "canonical_url": "https://example.org/post-1",
                    "title": "Preserved RSS Article",
                    "summary_text": "Clean text summary",
                    "published_at": now.isoformat(),
                }
            ],
        )

        ext_dir = (Path(self._root_tmp.name) / "cloud_drive_backups").resolve()
        headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}

        with TestClient(create_app()) as client:
            cfg_res = client.put(
                "/api/v1/system/storage/backup-config",
                headers=headers,
                json={"externalBackupDir": str(ext_dir), "autoBackupEnabled": True},
            )
            self.assertEqual(cfg_res.status_code, 200)
            self.assertEqual(cfg_res.json()["externalBackupDir"], str(ext_dir))

            create_res = client.post("/api/v1/system/storage/backups/create", headers=headers)
            self.assertEqual(create_res.status_code, 200)
            body = create_res.json()
            self.assertIsNone(body["externalWarning"])
            local_bak = Path(body["localPath"])
            ext_bak = Path(body["externalPath"])
            self.assertTrue(local_bak.is_file())
            self.assertTrue(ext_bak.is_file())

        raw_bak_bytes = ext_bak.read_bytes()
        self.assertNotIn(yt_marker.encode("utf-8"), raw_bak_bytes)
        self.assertNotIn(raw_api_key.encode("utf-8"), raw_bak_bytes)

        chk_conn = sqlite3.connect(str(ext_bak))
        try:
            key_row = chk_conn.execute("SELECT encrypted_youtube_api_key FROM system_settings WHERE id = 1").fetchone()
            self.assertIsNone(key_row[0])
            self.assertEqual(chk_conn.execute("SELECT name FROM projects WHERE id = ?", (proj["id"],)).fetchone()[0], "Option 3 Backup Project")
            self.assertEqual(chk_conn.execute("SELECT title FROM ideas WHERE id = ?", (idea["id"],)).fetchone()[0], "Evergreen Backup Idea")
            self.assertEqual(chk_conn.execute("SELECT manual_format FROM user_video_format_labels WHERE video_id = 'vid_bak_1'").fetchone()[0], "long_form")
            self.assertEqual(chk_conn.execute("SELECT COUNT(*) FROM rss_articles").fetchone()[0], 1)
        finally:
            chk_conn.close()

        # Clearing temporary YouTube API cache removes internal `backups/` `.db`, NOT user backups!
        retention_service.purge_all_youtube_api_data_by_user_request(now_utc=now)
        self.assertTrue(local_bak.is_file())
        self.assertTrue(ext_bak.is_file())

        # Create extra manual backups to verify retention cap of 7
        for step in range(1, 10):
            storage_service.create_user_backup(
                trigger="manual",
                now_utc=now + timedelta(minutes=step),
            )
        dirs = ensure_runtime_dirs()
        self.assertEqual(len(list(dirs["user_backups"].glob("rs_backup_manual_*.db"))), USER_BACKUP_KEEP_COUNT)
        self.assertEqual(len(list(ext_dir.glob("rs_backup_manual_*.db"))), USER_BACKUP_KEEP_COUNT)

    def test_auto_backup_deduplicates_empty_and_recent_runs(self) -> None:
        t0 = datetime(2026, 11, 18, 9, 0, tzinfo=timezone.utc)
        empty_res = storage_service.run_auto_backup_if_due(now_utc=t0)
        self.assertFalse(empty_res["executed"])
        self.assertEqual(empty_res["reason"], "empty_workspace")

        project_repo.create_project("Auto Backup Trigger Project")
        first_res = storage_service.run_auto_backup_if_due(now_utc=t0)
        self.assertTrue(first_res["executed"])
        self.assertTrue(str(first_res["backupFilename"]).startswith("rs_backup_auto_"))

        too_soon = storage_service.run_auto_backup_if_due(now_utc=t0 + timedelta(hours=3))
        self.assertFalse(too_soon["executed"])
        self.assertEqual(too_soon["reason"], "recent_backup_exists")

        storage_service.update_backup_config(auto_backup_enabled=False)
        disabled_res = storage_service.run_auto_backup_if_due(now_utc=t0 + timedelta(hours=30))
        self.assertFalse(disabled_res["executed"])
        self.assertEqual(disabled_res["reason"], "disabled")

    def test_safe_data_dir_migration_conflict_handling_and_reset(self) -> None:
        raw_api_key = "AIzaSyMigrateKey123456789"
        settings_repo.set_legal_consent(True)
        settings_repo.save_youtube_api_key(raw_api_key)
        proj_a = project_repo.create_project("Workspace A Project")
        headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}

        dir_b = (Path(self._root_tmp.name) / "drive_f" / "ResearchStudioData").resolve()
        dir_c = (Path(self._root_tmp.name) / "drive_d" / "ExistingResearch").resolve()

        # Prepare dir_c independently with an existing DB containing another project (without API key)
        os.environ[DATA_DIR_ENV_VAR] = str(dir_c)
        run_migrations()
        project_repo.create_project("Workspace C Preexisting")
        os.environ.pop(DATA_DIR_ENV_VAR, None)

        with TestClient(create_app()) as client:
            mig_b = client.post(
                "/api/v1/system/storage/migrate-data-dir",
                headers=headers,
                json={"targetDir": str(dir_b)},
            )
            self.assertEqual(mig_b.status_code, 200)
            self.assertEqual(get_data_dir(), dir_b)
            self.assertFalse(mig_b.json()["status"]["isDefaultDataDir"])
            self.assertTrue((self._bootstrap_dir / "data" / "research_studio.db").is_file())
            self.assertEqual(project_repo.get_project(proj_a["id"])["name"], "Workspace A Project")
            self.assertEqual(settings_repo.get_decrypted_youtube_api_key(), raw_api_key)

            conflict = client.post(
                "/api/v1/system/storage/migrate-data-dir",
                headers=headers,
                json={"targetDir": str(dir_c), "ifExists": "error"},
            )
            self.assertEqual(conflict.status_code, 409)
            self.assertEqual(conflict.json()["error"]["code"], "TARGET_DB_ALREADY_EXISTS")
            self.assertEqual(conflict.json()["error"]["details"]["projectsCount"], 1)

            use_c = client.post(
                "/api/v1/system/storage/migrate-data-dir",
                headers=headers,
                json={"targetDir": str(dir_c), "ifExists": "use_existing"},
            )
            self.assertEqual(use_c.status_code, 200)
            self.assertEqual(get_data_dir(), dir_c)
            names_in_c = [p["name"] for p in project_repo.list_projects()]
            self.assertEqual(names_in_c, ["Workspace C Preexisting"])
            self.assertEqual(settings_repo.get_decrypted_youtube_api_key(), raw_api_key)

            reset_res = client.post(
                "/api/v1/system/storage/migrate-data-dir",
                headers=headers,
                json={"resetToDefault": True, "ifExists": "use_existing"},
            )
            self.assertEqual(reset_res.status_code, 200)
            self.assertEqual(get_data_dir(), self._bootstrap_dir)
            self.assertTrue(reset_res.json()["status"]["isDefaultDataDir"])

    def test_verified_restore_rejects_corrupt_files_and_preserves_pre_restore_and_api_key(self) -> None:
        raw_api_key = "AIzaSyRestorePreserve999999"
        settings_repo.set_legal_consent(True)
        settings_repo.save_youtube_api_key(raw_api_key)
        original_proj = project_repo.create_project("Original Channel Before Backup")
        original_idea = idea_repo.create_idea(
            title="Idea To Recover",
            notes="Recover this safely",
            source_type="manual",
            source_ref_id="manual-1",
            source_title_snapshot="",
            source_url="",
            tags=["restore"],
            in_global_vault=True,
            target_project_ids=[original_proj["id"]],
            project_angle="Original angle",
        )
        headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}

        corrupt_file = (Path(self._root_tmp.name) / "not_a_db.db").resolve()
        corrupt_file.write_bytes(b"THIS IS NOT A VALID SQLITE DATABASE FILE" * 200)

        with TestClient(create_app()) as client:
            bad_restore = client.post(
                "/api/v1/system/storage/backups/restore",
                headers=headers,
                json={"backupPath": str(corrupt_file)},
            )
            self.assertEqual(bad_restore.status_code, 400)
            self.assertEqual(bad_restore.json()["error"]["code"], "INVALID_BACKUP_FILE")

            bak_res = client.post("/api/v1/system/storage/backups/create", headers=headers)
            self.assertEqual(bak_res.status_code, 200)
            backup_path = bak_res.json()["localPath"]

            # Mutate workspace heavily after snapshot
            project_repo.delete_project_safely(original_proj["id"], "Original Channel Before Backup")
            idea_repo.delete_idea(original_idea["id"])
            mutated_proj = project_repo.create_project("Ephemeral Post-Backup Project")
            self.assertEqual([p["name"] for p in project_repo.list_projects()], ["Ephemeral Post-Backup Project"])

            restore_res = client.post(
                "/api/v1/system/storage/backups/restore",
                headers=headers,
                json={"backupPath": backup_path},
            )
            self.assertEqual(restore_res.status_code, 200)
            pre_bak_name = restore_res.json()["preRestoreBackupFilename"]
            self.assertTrue(pre_bak_name.startswith("rs_backup_pre_restore_"))

        # Restored state + pre-restore safety net + current PC API Key all verified
        restored_names = [p["name"] for p in project_repo.list_projects()]
        self.assertEqual(restored_names, ["Original Channel Before Backup"])
        self.assertEqual(idea_repo.get_idea(original_idea["id"])["title"], "Idea To Recover")
        self.assertEqual(settings_repo.get_decrypted_youtube_api_key(), raw_api_key)

        dirs = ensure_runtime_dirs()
        pre_bak_file = dirs["user_backups"] / pre_bak_name
        self.assertTrue(pre_bak_file.is_file())
        pre_conn = sqlite3.connect(str(pre_bak_file))
        try:
            self.assertEqual(
                pre_conn.execute("SELECT name FROM projects WHERE id = ?", (mutated_proj["id"],)).fetchone()[0],
                "Ephemeral Post-Backup Project",
            )
        finally:
            pre_conn.close()

    def test_open_folder_validates_target_and_uses_safe_server_path(self) -> None:
        headers = {CSRF_HEADER_NAME: CSRF_HEADER_VALUE}
        with TestClient(create_app()) as client, patch("app.services.storage_service.subprocess.Popen") as popen_mock:
            ok_data = client.post(
                "/api/v1/system/storage/open-folder",
                headers=headers,
                json={"target": "data_root"},
            )
            self.assertEqual(ok_data.status_code, 200)
            self.assertEqual(ok_data.json()["openedPath"], str(self._bootstrap_dir))
            if os.name == "nt":
                popen_mock.assert_called_once_with(["explorer.exe", str(self._bootstrap_dir)])

            unset_ext = client.post(
                "/api/v1/system/storage/open-folder",
                headers=headers,
                json={"target": "external_backup"},
            )
            self.assertEqual(unset_ext.status_code, 400)
            self.assertEqual(unset_ext.json()["error"]["code"], "STORAGE_FOLDER_NOT_SET")

            invalid_target = client.post(
                "/api/v1/system/storage/open-folder",
                headers=headers,
                json={"target": "C:\\Windows"},
            )
            self.assertEqual(invalid_target.status_code, 422)


if __name__ == "__main__":
    unittest.main()
