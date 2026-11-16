from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from zoneinfo import ZoneInfo

from app.core.config import QUOTA_GENERAL_DAILY_LIMIT, QUOTA_SEARCH_DAILY_LIMIT
from app.core.errors import AppError
from app.db.connection import read_db, write_db
from app.repositories import quota_repo

PT_TZ = ZoneInfo("America/Los_Angeles")
QuotaBucket = Literal["search_queries", "general_data"]


def _normalize_utc(now_utc: datetime | None) -> datetime:
    if now_utc is None:
        return datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        return now_utc.replace(tzinfo=timezone.utc)
    return now_utc.astimezone(timezone.utc)


def compute_pt_window(now_utc: datetime | None = None) -> tuple[str, datetime, datetime]:
    """Compute (pt_date YYYY-MM-DD, now_utc, next_pt_midnight_utc) respecting Pacific DST."""
    utc_now = _normalize_utc(now_utc)
    now_pt = utc_now.astimezone(PT_TZ)
    pt_date = now_pt.strftime("%Y-%m-%d")
    next_day = now_pt.date() + timedelta(days=1)
    next_midnight_pt = datetime(next_day.year, next_day.month, next_day.day, 0, 0, 0, tzinfo=PT_TZ)
    reset_at_utc = next_midnight_pt.astimezone(timezone.utc)
    return pt_date, utc_now, reset_at_utc


def _is_future_iso(target_iso: str | None, utc_now: datetime) -> bool:
    if not target_iso:
        return False
    try:
        parsed = datetime.fromisoformat(target_iso)
    except ValueError:
        return False
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc) > utc_now


def reserve_quota_unit(
    bucket: QuotaBucket,
    endpoint: str,
    *,
    units: int = 1,
    is_auto_refresh: bool = False,
    now_utc: datetime | None = None,
) -> int:
    """Atomically validate and reserve quota units inside BEGIN IMMEDIATE, returning call_log_id."""
    if units <= 0:
        raise AppError("INVALID_QUOTA_UNITS", "Số unit đặt trước phải lớn hơn 0.", status_code=400)

    if is_auto_refresh and bucket == "search_queries":
        raise AppError(
            code="AUTO_REFRESH_SEARCH_FORBIDDEN",
            message="Tác vụ làm mới tự động tuyệt đối không được phép gọi search.list.",
            status_code=400,
        )

    pt_date, utc_now, reset_at_utc = compute_pt_window(now_utc)
    now_iso = utc_now.isoformat()

    with write_db() as conn:
        ledger = quota_repo.ensure_ledger_row(conn, pt_date, now_iso)
        warning_ratio, auto_daily_cap = quota_repo.read_quota_settings(conn)
        search_used = int(ledger["search_queries_used"])
        general_used = int(ledger["general_data_used"])

        if bucket == "search_queries":
            exhausted_until = ledger["search_exhausted_until_utc"]
            if _is_future_iso(exhausted_until, utc_now) or search_used + units > QUOTA_SEARCH_DAILY_LIMIT:
                raise AppError(
                    code="QUOTA_SEARCH_EXHAUSTED",
                    message=(
                        f"Bucket Search Queries đã chạm hạn mức ngày PT ({search_used}/{QUOTA_SEARCH_DAILY_LIMIT}). "
                        f"Chờ reset lúc {reset_at_utc.isoformat()}."
                    ),
                    status_code=429,
                    details={
                        "bucket": "search_queries",
                        "ptDate": pt_date,
                        "used": search_used,
                        "limit": QUOTA_SEARCH_DAILY_LIMIT,
                        "resetAtUtc": reset_at_utc.isoformat(),
                    },
                )
            search_used += units
        else:
            exhausted_until = ledger["general_exhausted_until_utc"]
            if _is_future_iso(exhausted_until, utc_now) or general_used + units > QUOTA_GENERAL_DAILY_LIMIT:
                raise AppError(
                    code="QUOTA_GENERAL_EXHAUSTED",
                    message=(
                        f"Bucket General Data API đã chạm hạn mức ngày PT ({general_used}/{QUOTA_GENERAL_DAILY_LIMIT}). "
                        f"Chờ reset lúc {reset_at_utc.isoformat()}."
                    ),
                    status_code=429,
                    details={
                        "bucket": "general_data",
                        "ptDate": pt_date,
                        "used": general_used,
                        "limit": QUOTA_GENERAL_DAILY_LIMIT,
                        "resetAtUtc": reset_at_utc.isoformat(),
                    },
                )
            if is_auto_refresh:
                effective_auto_cap = min(auto_daily_cap, int(QUOTA_GENERAL_DAILY_LIMIT * warning_ratio))
                if general_used + units > effective_auto_cap:
                    raise AppError(
                        code="AUTO_REFRESH_QUOTA_CAP_REACHED",
                        message="Làm mới tự động tạm dừng vì đã đạt ngưỡng bảo toàn quota hàng ngày.",
                        status_code=429,
                        details={
                            "bucket": "general_data",
                            "used": general_used,
                            "autoCap": effective_auto_cap,
                            "resetAtUtc": reset_at_utc.isoformat(),
                        },
                    )
            general_used += units

        quota_repo.update_ledger_usage(
            conn,
            pt_date,
            search_used=search_used,
            general_used=general_used,
            updated_at_utc=now_iso,
        )
        return quota_repo.insert_quota_call_log(
            conn,
            pt_date=pt_date,
            bucket=bucket,
            endpoint=endpoint,
            units_cost=units,
            outcome="reserved",
            created_at_utc=now_iso,
        )


def finalize_quota_call(call_log_id: int, *, status_code: int | None, outcome: str) -> None:
    """Update quota_call_log outcome after receiving a wire response or transport timeout."""
    with write_db() as conn:
        row = quota_repo.get_call_log_row(conn, call_log_id)
        if row is None:
            return
        if row["outcome"] == "refunded_connect_error":
            return
        quota_repo.update_call_log_outcome(conn, call_log_id, status_code=status_code, outcome=outcome)


def refund_quota_on_connect_error(call_log_id: int, *, now_utc: datetime | None = None) -> bool:
    """Refund reserved units once when httpx.ConnectError occurs before reaching YouTube servers."""
    utc_now = _normalize_utc(now_utc)
    now_iso = utc_now.isoformat()
    with write_db() as conn:
        row = quota_repo.get_call_log_row(conn, call_log_id)
        if row is None or row["outcome"] != "reserved":
            return False
        pt_date = row["pt_date"]
        bucket = row["bucket"]
        units_cost = int(row["units_cost"])
        ledger = quota_repo.ensure_ledger_row(conn, pt_date, now_iso)
        search_used = int(ledger["search_queries_used"])
        general_used = int(ledger["general_data_used"])
        if bucket == "search_queries":
            search_used = max(0, search_used - units_cost)
        else:
            general_used = max(0, general_used - units_cost)
        quota_repo.update_ledger_usage(
            conn,
            pt_date,
            search_used=search_used,
            general_used=general_used,
            updated_at_utc=now_iso,
        )
        quota_repo.update_call_log_outcome(conn, call_log_id, status_code=None, outcome="refunded_connect_error")
        return True


def mark_bucket_exhausted_403(
    bucket: QuotaBucket,
    *,
    call_log_id: int | None = None,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """Lock the corresponding quota bucket until 00:00 PT after YouTube 403 quotaExceeded."""
    pt_date, utc_now, reset_at_utc = compute_pt_window(now_utc)
    now_iso = utc_now.isoformat()
    reset_iso = reset_at_utc.isoformat()
    with write_db() as conn:
        quota_repo.ensure_ledger_row(conn, pt_date, now_iso)
        quota_repo.set_bucket_exhausted_until(conn, pt_date, bucket, reset_iso, now_iso)
        if call_log_id is not None:
            quota_repo.update_call_log_outcome(conn, call_log_id, status_code=403, outcome="quota_exceeded_403")
    return get_quota_status(now_utc=utc_now)


def get_quota_status(now_utc: datetime | None = None) -> dict[str, Any]:
    """Return dual-bucket PT daily quota usage, limits, warning state, and reset timestamp."""
    pt_date, utc_now, reset_at_utc = compute_pt_window(now_utc)
    with read_db() as conn:
        row = quota_repo.read_ledger_row(conn, pt_date)
        warning_ratio, auto_daily_cap = quota_repo.read_quota_settings(conn)

    ledger = quota_repo.ledger_to_dict(row, pt_date)
    search_used = ledger["search_queries_used"]
    general_used = ledger["general_data_used"]
    search_until = ledger["search_exhausted_until_utc"]
    general_until = ledger["general_exhausted_until_utc"]

    search_exhausted = _is_future_iso(search_until, utc_now) or search_used >= QUOTA_SEARCH_DAILY_LIMIT
    general_exhausted = _is_future_iso(general_until, utc_now) or general_used >= QUOTA_GENERAL_DAILY_LIMIT

    return {
        "ptDate": pt_date,
        "resetAtUtc": reset_at_utc.isoformat(),
        "warningRatio": warning_ratio,
        "autoRefreshDailyQuotaCap": auto_daily_cap,
        "searchQueries": {
            "used": search_used,
            "limit": QUOTA_SEARCH_DAILY_LIMIT,
            "remaining": max(0, QUOTA_SEARCH_DAILY_LIMIT - search_used),
            "warning": search_used >= int(QUOTA_SEARCH_DAILY_LIMIT * warning_ratio),
            "exhausted": search_exhausted,
            "exhaustedUntilUtc": search_until,
        },
        "generalData": {
            "used": general_used,
            "limit": QUOTA_GENERAL_DAILY_LIMIT,
            "remaining": max(0, QUOTA_GENERAL_DAILY_LIMIT - general_used),
            "warning": general_used >= int(QUOTA_GENERAL_DAILY_LIMIT * warning_ratio),
            "exhausted": general_exhausted,
            "exhaustedUntilUtc": general_until,
        },
    }
