from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.db.connection import run_db_sync
from app.repositories import idea_repo
from app.services import idea_service

router = APIRouter(prefix="/api/v1/ideas", tags=["ideas"])


class CreateIdeaRequest(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    notes: str = Field(default="", max_length=8000)
    sourceType: Literal["manual", "youtube_video", "rss_article", "keyword"] = "manual"
    sourceRefId: str = Field(default="", max_length=160)
    sourceTitleSnapshot: str = Field(default="", max_length=300)
    sourceUrl: str = Field(default="", max_length=1000)
    tags: list[str] = Field(default_factory=list)
    inGlobalVault: bool = True
    targetProjectIds: list[str] = Field(default_factory=list)
    projectAngle: str = Field(default="", max_length=300)
    priority: Literal["high", "medium", "low"] = "medium"


class UpdateIdeaCoreRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    notes: str | None = Field(default=None, max_length=8000)
    inGlobalVault: bool | None = None
    tags: list[str] | None = None


class UpsertProjectIdeaLinkRequest(BaseModel):
    status: Literal["new", "researching", "approved", "produced", "skipped"] | None = None
    priority: Literal["high", "medium", "low"] | None = None
    projectAngle: str | None = Field(default=None, max_length=300)
    projectNotes: str | None = Field(default=None, max_length=8000)
    publishedVideoUrl: str | None = Field(default=None, max_length=1000)


@router.get("")
async def get_ideas(
    projectId: str | None = None,
    onlyGlobalVault: bool = False,
    status: str | None = None,
    priority: str | None = None,
    sourceType: str | None = None,
    linkState: str | None = None,
    search: str = "",
) -> dict[str, object]:
    items = await run_db_sync(
        idea_repo.list_ideas,
        project_id=projectId,
        only_global_vault=onlyGlobalVault,
        status=status,
        priority=priority,
        source_type=sourceType,
        link_state=linkState,
        search=search,
    )
    return {"items": items}


@router.post("", status_code=201)
async def create_new_idea(payload: CreateIdeaRequest) -> dict[str, object]:
    idea = await run_db_sync(idea_service.create_idea_service, payload.model_dump())
    return {"idea": idea}


@router.get("/{idea_id}")
async def get_idea_detail(idea_id: str) -> dict[str, object]:
    idea = await run_db_sync(idea_repo.get_idea, idea_id)
    return {"idea": idea}


@router.put("/{idea_id}")
async def update_idea_core_detail(idea_id: str, payload: UpdateIdeaCoreRequest) -> dict[str, object]:
    idea = await run_db_sync(idea_service.update_idea_core_service, idea_id, payload.model_dump(exclude_none=True))
    return {"idea": idea}


@router.delete("/{idea_id}")
async def remove_idea(idea_id: str) -> dict[str, str]:
    return await run_db_sync(idea_repo.delete_idea, idea_id)


@router.put("/{idea_id}/projects/{project_id}")
async def upsert_project_idea(
    idea_id: str,
    project_id: str,
    payload: UpsertProjectIdeaLinkRequest,
) -> dict[str, object]:
    idea = await run_db_sync(
        idea_service.upsert_project_idea_service,
        idea_id,
        project_id,
        payload.model_dump(exclude_none=True),
    )
    return {"idea": idea}


@router.delete("/{idea_id}/projects/{project_id}")
async def detach_project_idea(idea_id: str, project_id: str) -> dict[str, object]:
    idea = await run_db_sync(idea_repo.remove_project_idea_link, idea_id, project_id)
    return {"idea": idea}
