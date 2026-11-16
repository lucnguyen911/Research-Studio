-- 001_initial_schema.sql
-- 3-Tier Schema: Global Canonical Entities (nullable API Data), Project Links (project_id NOT NULL), Project-Owned Data

CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    encrypted_youtube_api_key BLOB,
    legal_consent_accepted INTEGER NOT NULL DEFAULT 0,
    legal_consent_accepted_at TEXT,
    theme_mode TEXT NOT NULL DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark')),
    default_region_code TEXT NOT NULL DEFAULT 'VN',
    default_relevance_language TEXT NOT NULL DEFAULT 'vi',
    auto_refresh_enabled INTEGER NOT NULL DEFAULT 1,
    auto_refresh_channel_interval_hours INTEGER NOT NULL DEFAULT 12,
    auto_refresh_rss_interval_hours INTEGER NOT NULL DEFAULT 4,
    auto_refresh_max_api_units_per_batch INTEGER NOT NULL DEFAULT 15,
    auto_refresh_daily_quota_cap INTEGER NOT NULL DEFAULT 3000,
    quota_warning_ratio REAL NOT NULL DEFAULT 0.80,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quota_daily_ledger (
    pt_date TEXT PRIMARY KEY,
    search_queries_used INTEGER NOT NULL DEFAULT 0,
    general_data_used INTEGER NOT NULL DEFAULT 0,
    search_exhausted_until_utc TEXT,
    general_exhausted_until_utc TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quota_call_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pt_date TEXT NOT NULL,
    bucket TEXT NOT NULL CHECK (bucket IN ('search_queries', 'general_data')),
    endpoint TEXT NOT NULL,
    units_cost INTEGER NOT NULL DEFAULT 1,
    status_code INTEGER,
    outcome TEXT NOT NULL,
    created_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT NOT NULL DEFAULT '',
    region_code TEXT NOT NULL DEFAULT 'VN',
    relevance_language TEXT NOT NULL DEFAULT 'vi',
    target_format TEXT NOT NULL DEFAULT 'all' CHECK (target_format IN ('all', 'long_form', 'shorts')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS youtube_channels (
    channel_id TEXT PRIMARY KEY,
    title TEXT,
    handle TEXT,
    description TEXT,
    country TEXT,
    thumbnail_url TEXT,
    uploads_playlist_id TEXT,
    subscriber_count INTEGER,
    video_count INTEGER,
    published_at TEXT,
    api_fetched_at TEXT,
    api_expires_at TEXT,
    api_purged_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS youtube_videos (
    video_id TEXT PRIMARY KEY,
    channel_id TEXT REFERENCES youtube_channels(channel_id) ON DELETE RESTRICT,
    title TEXT,
    description TEXT,
    channel_title TEXT,
    published_at TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    tags_json TEXT,
    view_count INTEGER,
    like_count INTEGER,
    comment_count INTEGER,
    is_live_streaming INTEGER,
    source_format_status TEXT NOT NULL DEFAULT 'unknown' CHECK (source_format_status IN ('long_form', 'shorts', 'unknown')),
    format_hint TEXT,
    format_hint_confidence TEXT,
    format_hint_basis TEXT,
    api_fetched_at TEXT,
    api_expires_at TEXT,
    api_purged_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS youtube_video_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL REFERENCES youtube_videos(video_id) ON DELETE CASCADE,
    captured_at TEXT NOT NULL,
    view_count INTEGER,
    like_count INTEGER,
    comment_count INTEGER,
    api_expires_at TEXT NOT NULL,
    UNIQUE(video_id, captured_at)
);

CREATE TABLE IF NOT EXISTS user_video_format_labels (
    video_id TEXT PRIMARY KEY REFERENCES youtube_videos(video_id) ON DELETE RESTRICT,
    manual_format TEXT NOT NULL CHECK (manual_format IN ('long_form', 'shorts')),
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS search_sessions (
    id TEXT PRIMARY KEY,
    query_text TEXT NOT NULL,
    object_type TEXT NOT NULL DEFAULT 'video' CHECK (object_type IN ('video', 'channel')),
    region_code TEXT NOT NULL DEFAULT 'VN',
    relevance_language TEXT NOT NULL DEFAULT 'vi',
    published_after TEXT,
    order_by TEXT NOT NULL DEFAULT 'relevance',
    result_count INTEGER NOT NULL DEFAULT 0,
    api_fetched_at TEXT NOT NULL,
    api_expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS search_session_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES search_sessions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    video_id TEXT REFERENCES youtube_videos(video_id) ON DELETE CASCADE,
    channel_id TEXT REFERENCES youtube_channels(channel_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rss_feeds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    group_tag TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_fetched_at TEXT,
    last_status TEXT NOT NULL DEFAULT 'never' CHECK (last_status IN ('never', 'ok', 'error')),
    last_error_code TEXT,
    last_error_message TEXT,
    last_error_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rss_articles (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
    dedup_key TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    title TEXT NOT NULL,
    summary_text TEXT NOT NULL DEFAULT '',
    published_at TEXT,
    fetched_at TEXT NOT NULL,
    bookmarked INTEGER NOT NULL DEFAULT 0,
    user_notes TEXT NOT NULL DEFAULT '',
    UNIQUE(feed_id, dedup_key)
);

CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'youtube_video', 'rss_article', 'keyword')),
    source_ref_id TEXT,
    source_title_snapshot TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    linked_video_id TEXT REFERENCES youtube_videos(video_id) ON DELETE RESTRICT,
    linked_channel_id TEXT REFERENCES youtube_channels(channel_id) ON DELETE RESTRICT,
    linked_article_id TEXT REFERENCES rss_articles(id) ON DELETE SET NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    in_global_vault INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_channels (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL REFERENCES youtube_channels(channel_id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
    notes TEXT NOT NULL DEFAULT '',
    added_at TEXT NOT NULL,
    UNIQUE(project_id, channel_id)
);

CREATE TABLE IF NOT EXISTS project_videos (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    video_id TEXT NOT NULL REFERENCES youtube_videos(video_id) ON DELETE RESTRICT,
    is_user_breakout INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    marked_at TEXT,
    UNIQUE(project_id, video_id)
);

CREATE TABLE IF NOT EXISTS project_rss_feeds (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    feed_id TEXT NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
    linked_at TEXT NOT NULL,
    UNIQUE(project_id, feed_id)
);

CREATE TABLE IF NOT EXISTS project_keywords (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    notes TEXT NOT NULL DEFAULT '',
    last_scanned_at TEXT,
    last_session_id TEXT REFERENCES search_sessions(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    UNIQUE(project_id, keyword COLLATE NOCASE)
);

CREATE TABLE IF NOT EXISTS project_ideas (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'researching', 'approved', 'produced', 'skipped')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    project_angle TEXT NOT NULL DEFAULT '',
    project_notes TEXT NOT NULL DEFAULT '',
    published_video_url TEXT NOT NULL DEFAULT '',
    status_updated_at TEXT NOT NULL,
    UNIQUE(project_id, idea_id)
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel_pub ON youtube_videos(channel_id, published_at);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_expires ON youtube_videos(api_expires_at, api_purged_at);
CREATE INDEX IF NOT EXISTS idx_youtube_snapshots_video ON youtube_video_snapshots(video_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_rss_articles_feed_pub ON rss_articles(feed_id, published_at);
CREATE INDEX IF NOT EXISTS idx_project_channels_pid ON project_channels(project_id);
CREATE INDEX IF NOT EXISTS idx_project_videos_pid ON project_videos(project_id, is_user_breakout);
CREATE INDEX IF NOT EXISTS idx_project_ideas_pid_status ON project_ideas(project_id, status);
