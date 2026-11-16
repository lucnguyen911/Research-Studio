from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Literal

SourceFormatStatus = Literal["long_form", "shorts", "unknown"]

_ISO_DURATION_RE = re.compile(
    r"^P(?:(?P<days>\d+)D)?(?:T(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)S)?)?$"
)
_HASHTAG_SHORTS_RE = re.compile(r"(?:^|\s)#shorts?\b", re.IGNORECASE)
_SHORTS_EXPANSION_CUTOFF_UTC = datetime(2024, 10, 15, 0, 0, 0, tzinfo=timezone.utc)


def parse_iso8601_duration_seconds(raw_duration: str | None) -> int | None:
    """Parse YouTube ISO 8601 duration strings (e.g. PT4M13S, P0D, P1DT2H) into total seconds."""
    if not raw_duration:
        return None
    cleaned = raw_duration.strip()
    if not cleaned:
        return None
    match = _ISO_DURATION_RE.match(cleaned)
    if match is None:
        return None
    days = int(match.group("days") or 0)
    hours = int(match.group("hours") or 0)
    minutes = int(match.group("minutes") or 0)
    seconds = int(match.group("seconds") or 0)
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def _parse_published_utc(published_at: str | None) -> datetime | None:
    if not published_at:
        return None
    normalized = published_at.strip()
    if not normalized:
        return None
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _has_shorts_hashtag_signal(
    title: str | None,
    description: str | None,
    tags: list[str] | None,
) -> bool:
    if title and _HASHTAG_SHORTS_RE.search(title):
        return True
    if description and _HASHTAG_SHORTS_RE.search(description):
        return True
    if tags:
        for tag in tags:
            normalized = tag.strip().lower()
            if normalized in ("#shorts", "#short", "shorts"):
                return True
    return False


def classify_video_format(
    *,
    duration_seconds: int | None,
    published_at: str | None = None,
    title: str | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
    is_live_streaming: bool = False,
    official_is_shorts: bool | None = None,
) -> dict[str, str | None]:
    """
    Classify YouTube video format across Layer 1 (verified source state) & Layer 2 (heuristic hint).

    Policy rules (SPEC §9.1 / §10.2):
    - Never auto-label duration <= 60s as verified Shorts without official API aspect/Shorts metadata.
    - Duration > 180s (when not actively live) is definitively long_form.
    - Duration <= 180s without official Shorts verification stays 'unknown' with optional confidence hints.
    """
    if official_is_shorts is True:
        return {
            "source_format_status": "shorts",
            "format_hint": None,
            "format_hint_confidence": None,
            "format_hint_basis": None,
        }

    if is_live_streaming:
        return {
            "source_format_status": "unknown",
            "format_hint": None,
            "format_hint_confidence": None,
            "format_hint_basis": None,
        }

    if duration_seconds is not None and duration_seconds > 180:
        return {
            "source_format_status": "long_form",
            "format_hint": None,
            "format_hint_confidence": None,
            "format_hint_basis": None,
        }

    pub_dt = _parse_published_utc(published_at)
    if (
        pub_dt is not None
        and pub_dt < _SHORTS_EXPANSION_CUTOFF_UTC
        and duration_seconds is not None
        and 60 < duration_seconds <= 180
    ):
        return {
            "source_format_status": "unknown",
            "format_hint": "likely_long_form",
            "format_hint_confidence": "medium_high",
            "format_hint_basis": "Đăng trước 15/10/2024 với thời lượng 61–180 giây",
        }

    if _has_shorts_hashtag_signal(title, description, tags):
        return {
            "source_format_status": "unknown",
            "format_hint": "likely_shorts",
            "format_hint_confidence": "low_medium",
            "format_hint_basis": "Có thẻ #shorts trong tiêu đề/mô tả/tags (chưa đủ xác nhận tỷ lệ khung hình)",
        }

    return {
        "source_format_status": "unknown",
        "format_hint": None,
        "format_hint_confidence": None,
        "format_hint_basis": None,
    }
