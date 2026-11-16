from __future__ import annotations

from datetime import datetime, timezone
import sqlite3

from app.core.config import ensure_runtime_dirs
from app.db.connection import read_db, write_db


def _normalize_utc(now_utc: datetime | None) -> str:
    if now_utc is None:
        return datetime.now(timezone.utc).isoformat()
    if now_utc.tzinfo is None:
        return now_utc.replace(tzinfo=timezone.utc).isoformat()
    return now_utc.astimezone(timezone.utc).isoformat()


def _tombstone_expired_youtube_data_in_tx(
    conn: sqlite3.Connection,
    *,
    now_iso: str,
    purge_all: bool,
) -> dict[str, int]:
    if purge_all:
        cur_snap = conn.execute("DELETE FROM youtube_video_snapshots")
        cur_sess = conn.execute("DELETE FROM search_sessions")
    else:
        cur_snap = conn.execute(
            "DELETE FROM youtube_video_snapshots WHERE api_expires_at <= ?",
            (now_iso,),
        )
        cur_sess = conn.execute(
            "DELETE FROM search_sessions WHERE api_expires_at <= ?",
            (now_iso,),
        )

    video_expiry_predicate = (
        "1 = 1"
        if purge_all
        else "(api_purged_at IS NULL AND api_expires_at IS NOT NULL AND api_expires_at <= :now_iso)"
    )

    cur_vid_del = conn.execute(
        f"""
        DELETE FROM youtube_videos
        WHERE {video_expiry_predicate}
          AND video_id NOT IN (SELECT video_id FROM project_videos)
          AND video_id NOT IN (SELECT video_id FROM user_video_format_labels)
          AND video_id NOT IN (
              SELECT linked_video_id FROM ideas WHERE linked_video_id IS NOT NULL
          )
        """,
        {"now_iso": now_iso},
    )

    cur_vid_tomb = conn.execute(
        f"""
        UPDATE youtube_videos
        SET title = NULL,
            description = NULL,
            channel_title = NULL,
            published_at = NULL,
            thumbnail_url = NULL,
            duration_seconds = NULL,
            tags_json = NULL,
            view_count = NULL,
            like_count = NULL,
            comment_count = NULL,
            is_live_streaming = NULL,
            source_format_status = 'unknown',
            format_hint = NULL,
            format_hint_confidence = NULL,
            format_hint_basis = NULL,
            api_fetched_at = NULL,
            api_expires_at = NULL,
            api_purged_at = :now_iso,
            channel_id = CASE
                WHEN channel_id IS NOT NULL
                     AND channel_id NOT IN (SELECT channel_id FROM project_channels)
                     AND channel_id NOT IN (
                         SELECT linked_channel_id FROM ideas WHERE linked_channel_id IS NOT NULL
                     )
                THEN NULL
                ELSE channel_id
            END
        WHERE {video_expiry_predicate}
        """,
        {"now_iso": now_iso},
    )

    channel_expiry_predicate = (
        "1 = 1"
        if purge_all
        else "(api_purged_at IS NULL AND api_expires_at IS NOT NULL AND api_expires_at <= :now_iso)"
    )

    cur_ch_del = conn.execute(
        f"""
        DELETE FROM youtube_channels
        WHERE (
            {channel_expiry_predicate}
            OR (api_fetched_at IS NULL AND api_expires_at IS NULL)
        )
          AND channel_id NOT IN (SELECT channel_id FROM project_channels)
          AND channel_id NOT IN (
              SELECT linked_channel_id FROM ideas WHERE linked_channel_id IS NOT NULL
          )
          AND channel_id NOT IN (
              SELECT channel_id FROM youtube_videos WHERE channel_id IS NOT NULL
          )
        """,
        {"now_iso": now_iso},
    )

    cur_ch_tomb = conn.execute(
        f"""
        UPDATE youtube_channels
        SET title = NULL,
            handle = NULL,
            description = NULL,
            country = NULL,
            thumbnail_url = NULL,
            uploads_playlist_id = NULL,
            subscriber_count = NULL,
            video_count = NULL,
            published_at = NULL,
            api_fetched_at = NULL,
            api_expires_at = NULL,
            api_purged_at = :now_iso
        WHERE {channel_expiry_predicate}
        """,
        {"now_iso": now_iso},
    )

    conn.execute(
        """
        UPDATE ideas
        SET source_title_snapshot = ''
        WHERE source_type = 'youtube_video'
          AND linked_video_id IS NOT NULL
          AND linked_video_id IN (
              SELECT video_id FROM youtube_videos WHERE api_purged_at = :now_iso
          )
        """,
        {"now_iso": now_iso},
    )

    return {
        "snapshotsDeleted": max(0, cur_snap.rowcount),
        "searchSessionsDeleted": max(0, cur_sess.rowcount),
        "videosDeleted": max(0, cur_vid_del.rowcount),
        "videosTombstoned": max(0, cur_vid_tomb.rowcount),
        "channelsDeleted": max(0, cur_ch_del.rowcount),
        "channelsTombstoned": max(0, cur_ch_tomb.rowcount),
    }


def purge_expired_api_data(*, now_utc: datetime | None = None) -> dict[str, int]:
    """
    Purge all YouTube API Data older than 30 calendar days unconditionally.

    Preserves 100% of user-created Projects, Ideas, Notes, Manual Format Labels, and RSS data.
    """
    now_iso = _normalize_utc(now_utc)
    with write_db() as conn:
        counts = _tombstone_expired_youtube_data_in_tx(conn, now_iso=now_iso, purge_all=False)
    return counts


def purge_all_youtube_api_data_by_user_request(*, now_utc: datetime | None = None) -> dict[str, int | str]:
    """
    Immediately purge all cached YouTube API Data and `.db` backups containing API cache.

    Preserves 100% of user-created Projects, Ideas, Notes, Manual Format Labels, RSS Feeds/Articles,
    DPAPI API key, Legal Consent, and `project_recovery_*.json` snapshots.
    """
    now_iso = _normalize_utc(now_utc)
    with write_db() as conn:
        counts = _tombstone_expired_youtube_data_in_tx(conn, now_iso=now_iso, purge_all=True)

    with read_db() as checkpoint_conn:
        checkpoint_conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")

    dirs = ensure_runtime_dirs()
    backups_removed = 0
    for pattern in ("*.db", "*.db-wal", "*.db-shm"):
        for backup_file in dirs["backups"].glob(pattern):
            if backup_file.is_file():
                backup_file.unlink()
                backups_removed += 1

    return {
        **counts,
        "dbBackupsDeleted": backups_removed,
        "purgedAtUtc": now_iso,
    }
