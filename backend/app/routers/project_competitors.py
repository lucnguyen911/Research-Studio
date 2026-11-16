from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.db.connection import run_db_sync
from app.repositories import youtube_repo
from app.services import competitor_service

router = APIRouter(prefix="/api/v1/projects/{project_id}", tags=["project-competitors"])


class AddCompetitorRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=250)
    notes: str = Field(default="", max_length=1000)


class UpdateCompetitorRequest(BaseModel):
    status: Literal["active", "paused", "error"] | None = None
    notes: str | None = Field(default=None, max_length=1000)


class UpdateBreakoutRequest(BaseModel):
    flagged: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)


@router.get("/competitors")
async def get_project_competitors(project_id: str) -> dict[str, object]:
    return await run_db_sync(competitor_service.list_project_competitors, project_id)


@router.post("/competitors", status_code=201)
async def add_project_competitor(project_id: str, payload: AddCompetitorRequest) -> dict[str, object]:
    return await competitor_service.add_competitor_to_project(
        project_id,
        payload.identifier,
        notes=payload.notes,
    )


@router.patch("/competitors/{channel_id}")
async def patch_project_competitor(
    project_id: str,
    channel_id: str,
    payload: UpdateCompetitorRequest,
) -> dict[str, object]:
    return await run_db_sync(
        competitor_service.update_project_competitor,
        project_id,
        channel_id,
        status=payload.status,
        notes=payload.notes,
    )


@router.post("/competitors/refresh-all")
async def refresh_all_project_competitors(project_id: str) -> dict[str, object]:
    return await competitor_service.refresh_project_competitors(project_id)


@router.post("/competitors/{channel_id}/refresh")
async def refresh_single_project_competitor(project_id: str, channel_id: str) -> dict[str, object]:
    return await competitor_service.refresh_project_competitors(project_id, channel_id=channel_id)


@router.delete("/competitors/{channel_id}")
async def delete_project_competitor(project_id: str, channel_id: str) -> dict[str, object]:
    return await run_db_sync(competitor_service.remove_competitor_from_project, project_id, channel_id)


@router.get("/breakout-videos")
async def list_breakout_videos(
    project_id: str,
    daysWindow: int | None = None,
    sourceFormat: Literal["all", "long_form", "shorts", "unknown"] = "all",
    includeManual: bool = False,
    minViews: int | None = None,
    onlyFlagged: bool = False,
    sortBy: Literal["viewCount", "likeCount", "commentCount", "publishedAt", "durationSeconds"] = "viewCount",
    sortDir: Literal["desc", "asc"] = "desc",
) -> dict[str, object]:
    return await run_db_sync(
        youtube_repo.list_project_breakout_videos,
        project_id,
        days_window=daysWindow,
        source_format=sourceFormat,
        include_manual=includeManual,
        min_views=minViews,
        only_flagged=onlyFlagged,
        sort_by=sortBy,
        sort_dir=sortDir,
    )


@router.put("/videos/{video_id}/breakout")
async def update_video_breakout(
    project_id: str,
    video_id: str,
    payload: UpdateBreakoutRequest,
) -> dict[str, object]:
    return await run_db_sync(
        youtube_repo.upsert_project_video_breakout,
        project_id,
        video_id,
        is_user_breakout=payload.flagged,
        notes=payload.notes,
    )
