from __future__ import annotations

from datetime import datetime, timezone
import sqlite3
from typing import Any

from app.core.config import (
    AUTO_REFRESH_CHANNEL_INTERVAL_HOURS,
    AUTO_REFRESH_DAILY_QUOTA_CAP,
    AUTO_REFRESH_MAX_API_UNITS_PER_BATCH,
    AUTO_REFRESH_RSS_INTERVAL_HOURS,
    GOOGLE_PRIVACY_POLICY_URL,
    QUOTA_GENERAL_DAILY_LIMIT,
    QUOTA_SEARCH_DAILY_LIMIT,
    QUOTA_WARNING_RATIO,
    YOUTUBE_BRANDING_URL,
    YOUTUBE_TOS_URL,
)
from app.core.errors import AppError
from app.core.security import (
    DpapiUnreadableError,
    dpapi_protect,
    dpapi_unprotect,
    mask_api_key,
)
from app.db.connection import read_db, write_db


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_settings_row(conn: sqlite3.Connection) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM system_settings WHERE id = 1").fetchone()
    if row is not None:
        return row
    now = _utc_now_iso()
    conn.execute(
        """
        INSERT INTO system_settings (
            id, encrypted_youtube_api_key, legal_consent_accepted, legal_consent_accepted_at,
            theme_mode, default_region_code, default_relevance_language,
            auto_refresh_enabled, auto_refresh_channel_interval_hours,
            auto_refresh_rss_interval_hours, auto_refresh_max_api_units_per_batch,
            auto_refresh_daily_quota_cap, quota_warning_ratio, updated_at
        ) VALUES (?, NULL, 0, NULL, 'light', 'VN', 'vi', 1, ?, ?, ?, ?, ?, ?)
        """,
        (
            1,
            AUTO_REFRESH_CHANNEL_INTERVAL_HOURS,
            AUTO_REFRESH_RSS_INTERVAL_HOURS,
            AUTO_REFRESH_MAX_API_UNITS_PER_BATCH,
            AUTO_REFRESH_DAILY_QUOTA_CAP,
            QUOTA_WARNING_RATIO,
            now,
        ),
    )
    created = conn.execute("SELECT * FROM system_settings WHERE id = 1").fetchone()
    assert created is not None
    return created


def _inspect_key_status(encrypted_blob: bytes | None) -> tuple[str, str | None]:
    if not encrypted_blob:
        return "missing", None
    try:
        raw = dpapi_unprotect(bytes(encrypted_blob)).decode("utf-8").strip()
        if not raw:
            return "unreadable", None
        return "configured", mask_api_key(raw)
    except (DpapiUnreadableError, UnicodeDecodeError):
        return "unreadable", None


def _row_to_public_settings(row: sqlite3.Row | None) -> dict[str, Any]:
    if row is None:
        return {
            "apiKeyStatus": "missing",
            "maskedApiKey": None,
            "legalConsentAccepted": False,
            "legalConsentAcceptedAt": None,
            "themeMode": "light",
            "defaultRegionCode": "VN",
            "defaultRelevanceLanguage": "vi",
            "autoRefreshEnabled": True,
            "autoRefreshChannelIntervalHours": AUTO_REFRESH_CHANNEL_INTERVAL_HOURS,
            "autoRefreshRssIntervalHours": AUTO_REFRESH_RSS_INTERVAL_HOURS,
            "autoRefreshMaxApiUnitsPerBatch": AUTO_REFRESH_MAX_API_UNITS_PER_BATCH,
            "autoRefreshDailyQuotaCap": AUTO_REFRESH_DAILY_QUOTA_CAP,
            "quotaWarningRatio": QUOTA_WARNING_RATIO,
            "quotaLimits": {
                "searchQueriesDailyLimit": QUOTA_SEARCH_DAILY_LIMIT,
                "generalDataDailyLimit": QUOTA_GENERAL_DAILY_LIMIT,
            },
            "legalLinks": {
                "youtubeTosUrl": YOUTUBE_TOS_URL,
                "googlePrivacyUrl": GOOGLE_PRIVACY_POLICY_URL,
                "youtubeBrandingUrl": YOUTUBE_BRANDING_URL,
            },
            "updatedAt": None,
        }

    key_status, masked = _inspect_key_status(row["encrypted_youtube_api_key"])
    return {
        "apiKeyStatus": key_status,
        "maskedApiKey": masked,
        "legalConsentAccepted": bool(row["legal_consent_accepted"]),
        "legalConsentAcceptedAt": row["legal_consent_accepted_at"],
        "themeMode": row["theme_mode"],
        "defaultRegionCode": row["default_region_code"],
        "defaultRelevanceLanguage": row["default_relevance_language"],
        "autoRefreshEnabled": bool(row["auto_refresh_enabled"]),
        "autoRefreshChannelIntervalHours": int(row["auto_refresh_channel_interval_hours"]),
        "autoRefreshRssIntervalHours": int(row["auto_refresh_rss_interval_hours"]),
        "autoRefreshMaxApiUnitsPerBatch": int(row["auto_refresh_max_api_units_per_batch"]),
        "autoRefreshDailyQuotaCap": int(row["auto_refresh_daily_quota_cap"]),
        "quotaWarningRatio": float(row["quota_warning_ratio"]),
        "quotaLimits": {
            "searchQueriesDailyLimit": QUOTA_SEARCH_DAILY_LIMIT,
            "generalDataDailyLimit": QUOTA_GENERAL_DAILY_LIMIT,
        },
        "legalLinks": {
            "youtubeTosUrl": YOUTUBE_TOS_URL,
            "googlePrivacyUrl": GOOGLE_PRIVACY_POLICY_URL,
            "youtubeBrandingUrl": YOUTUBE_BRANDING_URL,
        },
        "updatedAt": row["updated_at"],
    }


def get_public_settings() -> dict[str, Any]:
    """Read system settings safely without ever returning plaintext API keys or crashing on DPAPI errors."""
    with read_db() as conn:
        row = conn.execute("SELECT * FROM system_settings WHERE id = 1").fetchone()
    return _row_to_public_settings(row)


def update_public_settings(patch: dict[str, Any]) -> dict[str, Any]:
    """Update non-secret user preferences and TUNING REQUIRED parameters cleanly."""
    with write_db() as conn:
        current = _ensure_settings_row(conn)
        theme_mode = patch.get("themeMode", current["theme_mode"])
        if theme_mode not in ("light", "dark"):
            raise AppError("INVALID_THEME", "Chủ đề chỉ hỗ trợ 'light' hoặc 'dark'.", status_code=400)

        region_code = str(patch.get("defaultRegionCode", current["default_region_code"])).strip().upper()[:8] or "VN"
        language = str(patch.get("defaultRelevanceLanguage", current["default_relevance_language"])).strip().lower()[:16] or "vi"
        auto_refresh = 1 if patch.get("autoRefreshEnabled", bool(current["auto_refresh_enabled"])) else 0
        channel_hours = max(1, min(168, int(patch.get("autoRefreshChannelIntervalHours", current["auto_refresh_channel_interval_hours"]))))
        rss_hours = max(1, min(168, int(patch.get("autoRefreshRssIntervalHours", current["auto_refresh_rss_interval_hours"]))))
        batch_cap = max(1, min(200, int(patch.get("autoRefreshMaxApiUnitsPerBatch", current["auto_refresh_max_api_units_per_batch"]))))
        daily_cap = max(10, min(QUOTA_GENERAL_DAILY_LIMIT, int(patch.get("autoRefreshDailyQuotaCap", current["auto_refresh_daily_quota_cap"]))))
        warn_ratio = float(patch.get("quotaWarningRatio", current["quota_warning_ratio"]))
        if not (0.1 <= warn_ratio <= 0.99):
            raise AppError("INVALID_QUOTA_RATIO", "Ngưỡng cảnh báo quota phải nằm trong 0.10 – 0.99.", status_code=400)

        conn.execute(
            """
            UPDATE system_settings
            SET theme_mode = ?, default_region_code = ?, default_relevance_language = ?,
                auto_refresh_enabled = ?, auto_refresh_channel_interval_hours = ?,
                auto_refresh_rss_interval_hours = ?, auto_refresh_max_api_units_per_batch = ?,
                auto_refresh_daily_quota_cap = ?, quota_warning_ratio = ?, updated_at = ?
            WHERE id = 1
            """,
            (
                theme_mode,
                region_code,
                language,
                auto_refresh,
                channel_hours,
                rss_hours,
                batch_cap,
                daily_cap,
                warn_ratio,
                _utc_now_iso(),
            ),
        )
        updated = conn.execute("SELECT * FROM system_settings WHERE id = 1").fetchone()
    return _row_to_public_settings(updated)


def set_legal_consent(accepted: bool) -> dict[str, Any]:
    """Record explicit user consent to YouTube Terms of Service & Google Privacy Policy disclosure."""
    now = _utc_now_iso()
    with write_db() as conn:
        _ensure_settings_row(conn)
        conn.execute(
            """
            UPDATE system_settings
            SET legal_consent_accepted = ?,
                legal_consent_accepted_at = ?,
                updated_at = ?
            WHERE id = 1
            """,
            (1 if accepted else 0, now if accepted else None, now),
        )
        updated = conn.execute("SELECT * FROM system_settings WHERE id = 1").fetchone()
    return _row_to_public_settings(updated)


def save_youtube_api_key(raw_key: str) -> dict[str, Any]:
    """Encrypt and store user's YouTube API Key with Windows DPAPI after checking legal consent."""
    cleaned = raw_key.strip()
    if len(cleaned) < 10 or any(ch.isspace() for ch in cleaned):
        raise AppError(
            code="YOUTUBE_API_KEY_INVALID_FORMAT",
            message="API Key không hợp lệ (quá ngắn hoặc chứa khoảng trắng).",
            status_code=400,
        )

    with write_db() as conn:
        row = _ensure_settings_row(conn)
        if not row["legal_consent_accepted"]:
            raise AppError(
                code="LEGAL_CONSENT_REQUIRED",
                message="Vui lòng đọc và xác nhận Chính sách Quyền riêng tư & Điều khoản YouTube trước khi lưu API Key.",
                status_code=400,
            )
        encrypted = dpapi_protect(cleaned.encode("utf-8"))
        conn.execute(
            "UPDATE system_settings SET encrypted_youtube_api_key = ?, updated_at = ? WHERE id = 1",
            (sqlite3.Binary(encrypted), _utc_now_iso()),
        )
        updated = conn.execute("SELECT * FROM system_settings WHERE id = 1").fetchone()
    return _row_to_public_settings(updated)


def delete_youtube_api_key() -> dict[str, Any]:
    """Remove stored DPAPI YouTube API key immediately without deleting user research data."""
    with write_db() as conn:
        _ensure_settings_row(conn)
        conn.execute(
            "UPDATE system_settings SET encrypted_youtube_api_key = NULL, updated_at = ? WHERE id = 1",
            (_utc_now_iso(),),
        )
        updated = conn.execute("SELECT * FROM system_settings WHERE id = 1").fetchone()
    return _row_to_public_settings(updated)


def get_decrypted_youtube_api_key() -> str:
    """Decrypt stored YouTube API Key for backend outbound calls, raising structured domain errors."""
    with read_db() as conn:
        row = conn.execute(
            "SELECT encrypted_youtube_api_key, legal_consent_accepted FROM system_settings WHERE id = 1"
        ).fetchone()
    if row is None or not row["legal_consent_accepted"]:
        raise AppError(
            code="LEGAL_CONSENT_REQUIRED",
            message="Cần xác nhận Chính sách Quyền riêng tư & Điều khoản YouTube trước khi gọi YouTube API.",
            status_code=400,
        )
    encrypted = row["encrypted_youtube_api_key"]
    if not encrypted:
        raise AppError(
            code="YOUTUBE_API_KEY_MISSING",
            message="Chưa cấu hình YouTube Data API v3 Key trong Cài đặt hệ thống.",
            status_code=400,
        )
    try:
        decrypted = dpapi_unprotect(bytes(encrypted)).decode("utf-8").strip()
    except (DpapiUnreadableError, UnicodeDecodeError) as exc:
        raise AppError(
            code="YOUTUBE_API_KEY_UNREADABLE",
            message="Không thể giải mã API Key cũ (do chuyển máy hoặc khóa DPAPI hỏng). Vui lòng nhập lại API Key mới trong Cài đặt.",
            status_code=400,
        ) from exc
    if not decrypted:
        raise AppError(
            code="YOUTUBE_API_KEY_MISSING",
            message="Chưa cấu hình YouTube Data API v3 Key trong Cài đặt hệ thống.",
            status_code=400,
        )
    return decrypted
