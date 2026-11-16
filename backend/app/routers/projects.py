from __future__ import annotations

import json
import logging
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.errors import AppError
from app.core.logging_setup import LOGGER_NAME
from app.db.connection import run_db_sync
from app.repositories import project_repo, rss_repo, settings_repo, youtube_repo
from app.services import competitor_service, quota_service, rss_service

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)
    regionCode: str = Field(default="VN", max_length=8)
    relevanceLanguage: str = Field(default="vi", max_length=16)
    targetFormat: Literal["all", "long_form", "shorts"] = "all"


class UpdateProjectRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    regionCode: str | None = Field(default=None, max_length=8)
    relevanceLanguage: str | None = Field(default=None, max_length=16)
    targetFormat: Literal["all", "long_form", "shorts"] | None = None


class DeleteProjectRequest(BaseModel):
    confirmName: str


class UpdateProjectRssFeedsRequest(BaseModel):
    feedIds: list[str] = Field(default_factory=list)


@router.get("")
async def get_projects() -> dict[str, object]:
    items = await run_db_sync(project_repo.list_projects)
    return {"items": items}


@router.post("", status_code=201)
async def create_new_project(payload: CreateProjectRequest) -> dict[str, object]:
    created = await run_db_sync(
        project_repo.create_project,
        payload.name,
        payload.description,
        payload.regionCode,
        payload.relevanceLanguage,
        payload.targetFormat,
    )
    return {"project": created}


@router.get("/{project_id}")
async def get_project_detail(project_id: str) -> dict[str, object]:
    project = await run_db_sync(project_repo.get_project, project_id)
    return {"project": project}


@router.put("/{project_id}")
async def update_project_detail(project_id: str, payload: UpdateProjectRequest) -> dict[str, object]:
    patch = payload.model_dump(exclude_none=True)
    project = await run_db_sync(project_repo.update_project, project_id, patch)
    return {"project": project}


@router.get("/{project_id}/export")
async def export_project_json(project_id: str) -> Response:
    payload = await run_db_sync(project_repo.build_project_export_payload, project_id)
    slug = project_repo.safe_project_slug(payload["project"]["name"], project_id)
    filename = f"research-studio-{slug}.json"
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    return Response(
        content=body,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{project_id}/delete")
async def delete_project_confirmed(project_id: str, payload: DeleteProjectRequest) -> dict[str, object]:
    return await run_db_sync(project_repo.delete_project_safely, project_id, payload.confirmName)


@router.put("/{project_id}/rss-feeds")
async def update_project_rss_links(project_id: str, payload: UpdateProjectRssFeedsRequest) -> dict[str, object]:
    project = await run_db_sync(project_repo.set_project_rss_feeds, project_id, payload.feedIds)
    return {"project": project}


@router.get("/{project_id}/overview")
async def read_project_overview(project_id: str) -> dict[str, object]:
    def _load() -> dict[str, object]:
        project = project_repo.get_project(project_id)
        summary = youtube_repo.get_project_overview_summary(project_id)
        latest_articles = rss_repo.list_articles(project_id=project_id, limit=4) if project["linkedFeedIds"] else []
        return {
            **summary,
            "latestRssArticles": latest_articles,
        }

    return await run_db_sync(_load)


@router.post("/{project_id}/refresh")
async def refresh_project_workspace(project_id: str) -> dict[str, object]:
    """Refresh linked enabled RSS feeds and active competitor channels (if API key & legal ready)."""
    project = await run_db_sync(project_repo.get_project, project_id)
    rss_results: list[dict[str, object]] = []
    for fid in project["linkedFeedIds"]:
        try:
            feed = await run_db_sync(rss_repo.get_feed, fid)
            if feed.get("enabled"):
                rss_results.append(await rss_service.refresh_single_feed(fid))
        except AppError as exc:
            logging.getLogger(LOGGER_NAME).warning(
                "Project refresh skipped RSS feed %s (%s): %s",
                fid,
                exc.code,
                exc.message,
            )

    settings = await run_db_sync(settings_repo.get_public_settings)
    competitor_result: dict[str, object] | None = None
    competitors_skipped_reason: str | None = None
    if settings["apiKeyStatus"] == "configured" and settings["legalConsentAccepted"]:
        competitor_result = await competitor_service.refresh_project_competitors(project_id)
    else:
        competitors_skipped_reason = "api_key_or_legal_not_ready"

    def _finish() -> dict[str, object]:
        summary = youtube_repo.get_project_overview_summary(project_id)
        latest_articles = rss_repo.list_articles(project_id=project_id, limit=4) if project["linkedFeedIds"] else []
        rss_ok = sum(1 for r in rss_results if r.get("status") == "ok")
        rss_err = sum(1 for r in rss_results if r.get("status") == "error")
        return {
            "overview": {**summary, "latestRssArticles": latest_articles},
            "rssRefreshedCount": len(rss_results),
            "rssOkCount": rss_ok,
            "rssErrorCount": rss_err,
            "competitorSummary": competitor_result,
            "competitorsSkippedReason": competitors_skipped_reason,
            "quota": quota_service.get_quota_status(),
        }

    return await run_db_sync(_finish)
