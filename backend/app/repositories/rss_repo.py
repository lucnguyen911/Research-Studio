from __future__ import annotations

from datetime import datetime, timezone
import sqlite3
from typing import Any
import uuid

from app.core.errors import AppError
from app.db.connection import read_db, write_db


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _row_to_feed(row: sqlite3.Row, article_count: int = 0) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "url": row["url"],
        "groupTag": row["group_tag"],
        "enabled": bool(row["enabled"]),
        "lastFetchedAt": row["last_fetched_at"],
        "lastStatus": row["last_status"],
        "lastErrorCode": row["last_error_code"],
        "lastErrorMessage": row["last_error_message"],
        "lastErrorAt": row["last_error_at"],
        "createdAt": row["created_at"],
        "articleCount": article_count,
    }


def list_feeds() -> list[dict[str, Any]]:
    with read_db() as conn:
        rows = conn.execute(
            """
            SELECT f.*, COUNT(a.id) AS article_count
            FROM rss_feeds f
            LEFT JOIN rss_articles a ON a.feed_id = f.id
            GROUP BY f.id
            ORDER BY f.created_at DESC, f.name ASC
            """
        ).fetchall()
    return [_row_to_feed(r, int(r["article_count"])) for r in rows]


def get_feed(feed_id: str) -> dict[str, Any]:
    with read_db() as conn:
        row = conn.execute(
            """
            SELECT f.*, COUNT(a.id) AS article_count
            FROM rss_feeds f
            LEFT JOIN rss_articles a ON a.feed_id = f.id
            WHERE f.id = ?
            GROUP BY f.id
            """,
            (feed_id,),
        ).fetchone()
    if row is None:
        raise AppError("RSS_FEED_NOT_FOUND", "Không tìm thấy nguồn RSS yêu cầu.", status_code=404)
    return _row_to_feed(row, int(row["article_count"]))


def create_feed(*, name: str, url: str, group_tag: str = "") -> dict[str, Any]:
    clean_url = url.strip()
    clean_name = name.strip() or clean_url
    feed_id = f"feed-{uuid.uuid4().hex[:10]}"
    now = _utc_now_iso()
    with write_db() as conn:
        dup = conn.execute("SELECT id FROM rss_feeds WHERE url = ?", (clean_url,)).fetchone()
        if dup is not None:
            raise AppError("RSS_FEED_DUPLICATE", "URL nguồn RSS này đã tồn tại.", status_code=409)
        conn.execute(
            """
            INSERT INTO rss_feeds (
                id, name, url, group_tag, enabled, last_fetched_at, last_status,
                last_error_code, last_error_message, last_error_at, created_at
            ) VALUES (?, ?, ?, ?, 1, NULL, 'never', NULL, NULL, NULL, ?)
            """,
            (feed_id, clean_name, clean_url, group_tag.strip(), now),
        )
        row = conn.execute("SELECT * FROM rss_feeds WHERE id = ?", (feed_id,)).fetchone()
        assert row is not None
    return _row_to_feed(row, 0)


def update_feed(feed_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    with write_db() as conn:
        current = conn.execute("SELECT * FROM rss_feeds WHERE id = ?", (feed_id,)).fetchone()
        if current is None:
            raise AppError("RSS_FEED_NOT_FOUND", "Không tìm thấy nguồn RSS để cập nhật.", status_code=404)
        next_name = str(patch.get("name", current["name"])).strip() or current["name"]
        next_tag = str(patch.get("groupTag", current["group_tag"])).strip()
        next_enabled = 1 if patch.get("enabled", bool(current["enabled"])) else 0
        conn.execute(
            """
            UPDATE rss_feeds
            SET name = ?, group_tag = ?, enabled = ?
            WHERE id = ?
            """,
            (next_name, next_tag, next_enabled, feed_id),
        )
        row = conn.execute(
            """
            SELECT f.*, COUNT(a.id) AS article_count
            FROM rss_feeds f
            LEFT JOIN rss_articles a ON a.feed_id = f.id
            WHERE f.id = ?
            GROUP BY f.id
            """,
            (feed_id,),
        ).fetchone()
        assert row is not None
    return _row_to_feed(row, int(row["article_count"]))


def delete_feed(feed_id: str) -> dict[str, str]:
    with write_db() as conn:
        row = conn.execute("SELECT id FROM rss_feeds WHERE id = ?", (feed_id,)).fetchone()
        if row is None:
            raise AppError("RSS_FEED_NOT_FOUND", "Không tìm thấy nguồn RSS để xóa.", status_code=404)
        conn.execute("DELETE FROM rss_feeds WHERE id = ?", (feed_id,))
    return {"deletedFeedId": feed_id}


def record_feed_fetch_success(feed_id: str, articles: list[dict[str, Any]]) -> dict[str, Any]:
    now = _utc_now_iso()
    inserted = 0
    with write_db() as conn:
        row = conn.execute("SELECT id FROM rss_feeds WHERE id = ?", (feed_id,)).fetchone()
        if row is None:
            raise AppError("RSS_FEED_NOT_FOUND", "Không tìm thấy nguồn RSS.", status_code=404)
        for art in articles:
            cur = conn.execute(
                """
                INSERT OR IGNORE INTO rss_articles (
                    id, feed_id, dedup_key, canonical_url, title, summary_text,
                    published_at, fetched_at, bookmarked, user_notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, '')
                """,
                (
                    f"art-{uuid.uuid4().hex[:12]}",
                    feed_id,
                    art["dedup_key"],
                    art["canonical_url"],
                    art["title"],
                    art["summary_text"],
                    art["published_at"],
                    now,
                ),
            )
            if cur.rowcount > 0:
                inserted += 1
        conn.execute(
            """
            UPDATE rss_feeds
            SET last_fetched_at = ?,
                last_status = 'ok',
                last_error_code = NULL,
                last_error_message = NULL,
                last_error_at = NULL
            WHERE id = ?
            """,
            (now, feed_id),
        )
    return {"feedId": feed_id, "status": "ok", "insertedCount": inserted, "totalParsed": len(articles)}


def record_feed_fetch_error(feed_id: str, *, error_code: str, error_message: str) -> dict[str, Any]:
    now = _utc_now_iso()
    with write_db() as conn:
        conn.execute(
            """
            UPDATE rss_feeds
            SET last_status = 'error',
                last_error_code = ?,
                last_error_message = ?,
                last_error_at = ?
            WHERE id = ?
            """,
            (error_code, error_message[:400], now, feed_id),
        )
    return {"feedId": feed_id, "status": "error", "errorCode": error_code, "errorMessage": error_message}


def _row_to_article(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "feedId": row["feed_id"],
        "feedName": row["feed_name"],
        "canonicalUrl": row["canonical_url"],
        "title": row["title"],
        "summaryText": row["summary_text"],
        "publishedAt": row["published_at"],
        "fetchedAt": row["fetched_at"],
        "bookmarked": bool(row["bookmarked"]),
        "userNotes": row["user_notes"],
        "sourceLabel": "Nguồn: RSS (Dữ liệu ngoài YouTube)",
    }


def list_articles(
    *,
    feed_id: str | None = None,
    project_id: str | None = None,
    only_bookmarked: bool = False,
    search: str = "",
    limit: int = 100,
) -> list[dict[str, Any]]:
    clauses: list[str] = ["1 = 1"]
    params: list[Any] = []
    if feed_id and feed_id != "all":
        clauses.append("a.feed_id = ?")
        params.append(feed_id)
    if project_id:
        clauses.append("a.feed_id IN (SELECT feed_id FROM project_rss_feeds WHERE project_id = ?)")
        params.append(project_id)
    if only_bookmarked:
        clauses.append("a.bookmarked = 1")
    if search.strip():
        like = f"%{_escape_like(search.strip())}%"
        clauses.append("(a.title LIKE ? ESCAPE '\\' OR a.summary_text LIKE ? ESCAPE '\\')")
        params.extend([like, like])

    where_sql = " AND ".join(clauses)
    params.append(max(1, min(200, int(limit))))
    with read_db() as conn:
        rows = conn.execute(
            f"""
            SELECT a.*, f.name AS feed_name
            FROM rss_articles a
            JOIN rss_feeds f ON f.id = a.feed_id
            WHERE {where_sql}
            ORDER BY COALESCE(a.published_at, a.fetched_at) DESC, a.fetched_at DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
    return [_row_to_article(r) for r in rows]


def get_article(article_id: str) -> dict[str, Any]:
    with read_db() as conn:
        row = conn.execute(
            """
            SELECT a.*, f.name AS feed_name
            FROM rss_articles a
            JOIN rss_feeds f ON f.id = a.feed_id
            WHERE a.id = ?
            """,
            (article_id,),
        ).fetchone()
    if row is None:
        raise AppError("RSS_ARTICLE_NOT_FOUND", "Không tìm thấy bài báo RSS yêu cầu.", status_code=404)
    return _row_to_article(row)


def update_article(article_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    with write_db() as conn:
        current = conn.execute("SELECT * FROM rss_articles WHERE id = ?", (article_id,)).fetchone()
        if current is None:
            raise AppError("RSS_ARTICLE_NOT_FOUND", "Không tìm thấy bài báo RSS để cập nhật.", status_code=404)
        bookmarked = 1 if patch.get("bookmarked", bool(current["bookmarked"])) else 0
        user_notes = str(patch.get("userNotes", current["user_notes"]))
        conn.execute(
            "UPDATE rss_articles SET bookmarked = ?, user_notes = ? WHERE id = ?",
            (bookmarked, user_notes, article_id),
        )
    return get_article(article_id)


def list_recent_articles_for_phrases(
    *,
    project_id: str | None = None,
    since_iso: str,
) -> list[dict[str, Any]]:
    with read_db() as conn:
        if project_id:
            rows = conn.execute(
                """
                SELECT a.title, a.summary_text, COALESCE(a.published_at, a.fetched_at) AS effective_at
                FROM rss_articles a
                JOIN project_rss_feeds prf ON prf.feed_id = a.feed_id
                WHERE prf.project_id = ?
                  AND COALESCE(a.published_at, a.fetched_at) >= ?
                """,
                (project_id, since_iso),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT title, summary_text, COALESCE(published_at, fetched_at) AS effective_at
                FROM rss_articles
                WHERE COALESCE(published_at, fetched_at) >= ?
                """,
                (since_iso,),
            ).fetchall()
    return [dict(r) for r in rows]
