from __future__ import annotations

from datetime import datetime
from typing import Any
from urllib.parse import urlsplit

from app.core.errors import AppError
from app.repositories import idea_repo

VALID_SOURCE_TYPES = frozenset({"manual", "youtube_video", "rss_article", "keyword"})
VALID_IDEA_STATUSES = frozenset({"new", "researching", "approved", "produced", "skipped"})
VALID_PRIORITIES = frozenset({"high", "medium", "low"})


def _validate_optional_http_url(raw_url: str | None, field_name: str) -> str:
    cleaned = str(raw_url or "").strip()
    if not cleaned:
        return ""
    parts = urlsplit(cleaned)
    if parts.scheme.lower() not in ("http", "https") or not parts.netloc:
        raise AppError(
            code="INVALID_URL",
            message=f"{field_name} chỉ chấp nhận địa chỉ http:// hoặc https:// hợp lệ.",
            status_code=400,
        )
    return cleaned


def _clean_tags(raw_tags: list[str] | None) -> list[str]:
    seen: set[str] = set()
    cleaned: list[str] = []
    for raw in raw_tags or []:
        t = str(raw).strip()
        if t and t.lower() not in seen:
            seen.add(t.lower())
            cleaned.append(t[:48])
    return cleaned[:20]


def _dedup_ids(project_ids: list[str] | None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in project_ids or []:
        pid = str(raw).strip()
        if pid and pid not in seen:
            seen.add(pid)
            out.append(pid)
    return out


def create_idea_service(payload: dict[str, Any], *, now_utc: datetime | None = None) -> dict[str, Any]:
    title = str(payload.get("title") or "").strip()
    if not title:
        raise AppError("IDEA_TITLE_EMPTY", "Tiêu đề Ý tưởng không được để trống.", status_code=400)

    source_type = str(payload.get("sourceType") or "manual").strip()
    if source_type not in VALID_SOURCE_TYPES:
        raise AppError("INVALID_SOURCE_TYPE", "Loại nguồn ý tưởng không hợp lệ.", status_code=400)

    priority = str(payload.get("priority") or "medium").strip()
    if priority not in VALID_PRIORITIES:
        raise AppError("INVALID_PRIORITY", "Mức ưu tiên không hợp lệ.", status_code=400)

    source_url = _validate_optional_http_url(payload.get("sourceUrl"), "URL nguồn gốc")
    target_project_ids = _dedup_ids(payload.get("targetProjectIds"))
    tags = _clean_tags(payload.get("tags"))

    return idea_repo.create_idea(
        title=title[:240],
        notes=str(payload.get("notes") or "").strip(),
        source_type=source_type,
        source_ref_id=str(payload.get("sourceRefId") or "").strip()[:160],
        source_title_snapshot=str(payload.get("sourceTitleSnapshot") or "").strip()[:300],
        source_url=source_url,
        tags=tags,
        in_global_vault=bool(payload.get("inGlobalVault", True)),
        target_project_ids=target_project_ids,
        project_angle=str(payload.get("projectAngle") or "").strip()[:300],
        priority=priority,
        initial_status="new",
        now_utc=now_utc,
    )


def update_idea_core_service(
    idea_id: str,
    payload: dict[str, Any],
    *,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    patch: dict[str, Any] = {}
    if "title" in payload and payload["title"] is not None:
        title = str(payload["title"]).strip()
        if not title:
            raise AppError("IDEA_TITLE_EMPTY", "Tiêu đề Ý tưởng không được để trống.", status_code=400)
        patch["title"] = title[:240]
    if "notes" in payload and payload["notes"] is not None:
        patch["notes"] = str(payload["notes"]).strip()
    if "inGlobalVault" in payload and payload["inGlobalVault"] is not None:
        patch["inGlobalVault"] = bool(payload["inGlobalVault"])
    if "tags" in payload and payload["tags"] is not None:
        patch["tags"] = _clean_tags(payload["tags"])
    return idea_repo.update_idea_core(idea_id, patch, now_utc=now_utc)


def upsert_project_idea_service(
    idea_id: str,
    project_id: str,
    payload: dict[str, Any],
    *,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    patch: dict[str, Any] = {}
    if "status" in payload and payload["status"] is not None:
        status = str(payload["status"]).strip()
        if status not in VALID_IDEA_STATUSES:
            raise AppError("INVALID_IDEA_STATUS", "Trạng thái sản xuất ý tưởng không hợp lệ.", status_code=400)
        patch["status"] = status
    if "priority" in payload and payload["priority"] is not None:
        priority = str(payload["priority"]).strip()
        if priority not in VALID_PRIORITIES:
            raise AppError("INVALID_PRIORITY", "Mức ưu tiên không hợp lệ.", status_code=400)
        patch["priority"] = priority
    if "projectAngle" in payload and payload["projectAngle"] is not None:
        patch["projectAngle"] = str(payload["projectAngle"]).strip()[:300]
    if "projectNotes" in payload and payload["projectNotes"] is not None:
        patch["projectNotes"] = str(payload["projectNotes"]).strip()
    if "publishedVideoUrl" in payload and payload["publishedVideoUrl"] is not None:
        patch["publishedVideoUrl"] = _validate_optional_http_url(
            payload["publishedVideoUrl"],
            "URL video đã xuất bản",
        )
    return idea_repo.upsert_project_idea_link(idea_id, project_id, patch, now_utc=now_utc)
