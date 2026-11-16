from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import SEARCH_MAX_RESULTS_PER_CALL
from app.db.connection import run_db_sync
from app.repositories import keyword_repo, project_repo
from app.services import keyword_service

router = APIRouter(prefix="/api/v1/projects/{project_id}/keywords", tags=["project-keywords"])


class CreateKeywordRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=200)
    priority: Literal["high", "medium", "low"] = "medium"
    notes: str = Field(default="", max_length=1000)


class UpdateKeywordRequest(BaseModel):
    priority: Literal["high", "medium", "low"] | None = None
    notes: str | None = Field(default=None, max_length=1000)


class ScanKeywordsRequest(BaseModel):
    keywordIds: list[str] = Field(min_length=1, max_length=50)
    maxResults: int = Field(default=SEARCH_MAX_RESULTS_PER_CALL, ge=1, le=50)


@router.get("")
async def list_project_keywords(project_id: str) -> dict[str, object]:
    return await run_db_sync(keyword_service.list_keywords_with_project_rss_overview, project_id)


@router.post("", status_code=201)
async def add_project_keyword(project_id: str, payload: CreateKeywordRequest) -> dict[str, object]:
    def _create() -> dict[str, object]:
        project_repo.get_project(project_id)
        item = keyword_repo.create_project_keyword(
            project_id,
            keyword=payload.keyword,
            priority=payload.priority,
            notes=payload.notes,
        )
        return {"item": item}

    return await run_db_sync(_create)


@router.get("/{keyword_id}")
async def get_keyword_detail(project_id: str, keyword_id: str) -> dict[str, object]:
    return await run_db_sync(keyword_service.get_keyword_cached_results, project_id, keyword_id)


@router.patch("/{keyword_id}")
async def update_keyword(
    project_id: str,
    keyword_id: str,
    payload: UpdateKeywordRequest,
) -> dict[str, object]:
    def _update() -> dict[str, object]:
        project_repo.get_project(project_id)
        item = keyword_repo.update_project_keyword(
            project_id,
            keyword_id,
            priority=payload.priority,
            notes=payload.notes,
        )
        return {"item": item}

    return await run_db_sync(_update)


@router.delete("/{keyword_id}")
async def delete_keyword(project_id: str, keyword_id: str) -> dict[str, object]:
    def _delete() -> dict[str, object]:
        project_repo.get_project(project_id)
        keyword_repo.delete_project_keyword(project_id, keyword_id)
        return {"deleted": True, "keywordId": keyword_id}

    return await run_db_sync(_delete)


@router.post("/scan")
async def scan_keywords(project_id: str, payload: ScanKeywordsRequest) -> dict[str, object]:
    return await keyword_service.scan_project_keywords(
        project_id,
        payload.keywordIds,
        max_results=payload.maxResults,
    )
