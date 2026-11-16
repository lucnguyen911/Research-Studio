from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest

from app.core.config import DATA_DIR_ENV_VAR
from app.db.connection import read_db, write_db
from app.db.migrator import run_migrations


class DbMigrationsAndConcurrencyTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_data_dir = os.environ.get(DATA_DIR_ENV_VAR)
        self._tmp = tempfile.TemporaryDirectory()
        os.environ[DATA_DIR_ENV_VAR] = self._tmp.name

    def tearDown(self) -> None:
        if self._old_data_dir is None:
            os.environ.pop(DATA_DIR_ENV_VAR, None)
        else:
            os.environ[DATA_DIR_ENV_VAR] = self._old_data_dir
        self._tmp.cleanup()

    def test_initial_schema_wal_and_zero_project_canonical_insert(self) -> None:
        applied = run_migrations()
        self.assertIn("001_initial_schema.sql", applied)

        with read_db() as conn:
            mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
            fk = conn.execute("PRAGMA foreign_keys;").fetchone()[0]
            self.assertEqual(str(mode).lower(), "wal")
            self.assertEqual(fk, 1)

        with write_db() as conn:
            conn.execute(
                "INSERT INTO youtube_channels (channel_id, created_at) VALUES (?, ?)",
                ("UC_GLOBAL_1", "2026-11-16T00:00:00Z"),
            )
            conn.execute(
                "INSERT INTO youtube_videos (video_id, channel_id, created_at) VALUES (?, ?, ?)",
                ("vid_global_1", "UC_GLOBAL_1", "2026-11-16T00:00:00Z"),
            )
            conn.execute(
                """
                INSERT INTO ideas (id, title, source_type, linked_video_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                ("idea_1", "Global idea with 0 projects", "youtube_video", "vid_global_1", "2026-11-16T00:00:00Z", "2026-11-16T00:00:00Z"),
            )

        with read_db() as conn:
            cnt = conn.execute("SELECT COUNT(*) FROM ideas").fetchone()[0]
            self.assertEqual(cnt, 1)

    def test_nullable_tombstone_vs_on_delete_restrict(self) -> None:
        run_migrations()
        with write_db() as conn:
            conn.execute(
                "INSERT INTO youtube_channels (channel_id, title, created_at) VALUES (?, ?, ?)",
                ("UC_1", "Channel Name", "2026-11-16T00:00:00Z"),
            )
            conn.execute(
                "INSERT INTO youtube_videos (video_id, channel_id, title, view_count, created_at) VALUES (?, ?, ?, ?, ?)",
                ("vid_1", "UC_1", "Temp Title", 1500, "2026-11-16T00:00:00Z"),
            )
            conn.execute(
                "INSERT INTO user_video_format_labels (video_id, manual_format, updated_at) VALUES (?, ?, ?)",
                ("vid_1", "long_form", "2026-11-16T00:00:00Z"),
            )

        with self.assertRaises(sqlite3.IntegrityError):
            with write_db() as conn:
                conn.execute("DELETE FROM youtube_videos WHERE video_id = ?", ("vid_1",))

        with write_db() as conn:
            conn.execute(
                """
                UPDATE youtube_videos
                SET title = NULL, description = NULL, view_count = NULL,
                    source_format_status = 'unknown', api_purged_at = ?
                WHERE video_id = ?
                """,
                ("2026-12-17T00:00:00Z", "vid_1"),
            )

        with read_db() as conn:
            row = conn.execute("SELECT title, view_count, source_format_status FROM youtube_videos WHERE video_id = ?", ("vid_1",)).fetchone()
            lbl = conn.execute("SELECT manual_format FROM user_video_format_labels WHERE video_id = ?", ("vid_1",)).fetchone()
            self.assertIsNone(row["title"])
            self.assertIsNone(row["view_count"])
            self.assertEqual(row["source_format_status"], "unknown")
            self.assertEqual(lbl["manual_format"], "long_form")

    def test_pre_migration_backup_and_atomic_rollback(self) -> None:
        mig_dir = Path(self._tmp.name) / "test_migrations"
        mig_dir.mkdir(parents=True, exist_ok=True)
        real_001 = (Path(__file__).resolve().parents[1] / "app" / "db" / "migrations" / "001_initial_schema.sql").read_text(encoding="utf-8")
        (mig_dir / "001_initial_schema.sql").write_text(real_001, encoding="utf-8")

        run_migrations(migrations_dir=mig_dir)
        with write_db() as conn:
            conn.execute(
                "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
                ("p1", "Safe Project", "2026-11-16T00:00:00Z", "2026-11-16T00:00:00Z"),
            )

        (mig_dir / "002_broken.sql").write_text(
            "ALTER TABLE projects ADD COLUMN extra_note TEXT DEFAULT '';\nINVALID SQL SYNTAX HERE;",
            encoding="utf-8",
        )
        with self.assertRaises(sqlite3.OperationalError):
            run_migrations(migrations_dir=mig_dir)

        backups = list((Path(self._tmp.name) / "backups").glob("pre_migration_*.db"))
        self.assertGreaterEqual(len(backups), 1)

        with read_db() as conn:
            applied = [r["version"] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()]
            self.assertNotIn("002_broken.sql", applied)
            cols = [r["name"] for r in conn.execute("PRAGMA table_info(projects)").fetchall()]
            self.assertNotIn("extra_note", cols)
            proj = conn.execute("SELECT name FROM projects WHERE id = 'p1'").fetchone()
            self.assertEqual(proj["name"], "Safe Project")

    def test_concurrent_begin_immediate_writes(self) -> None:
        run_migrations()

        def worker(worker_idx: int) -> None:
            for item_idx in range(25):
                pid = f"p_{worker_idx}_{item_idx}"
                with write_db() as conn:
                    conn.execute(
                        "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
                        (pid, f"Project {pid}", "2026-11-16T00:00:00Z", "2026-11-16T00:00:00Z"),
                    )

        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(worker, idx) for idx in range(8)]
            for fut in futures:
                fut.result()

        with read_db() as conn:
            total = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
            self.assertEqual(total, 200)


if __name__ == "__main__":
    unittest.main()
