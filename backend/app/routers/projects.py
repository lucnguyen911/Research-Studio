from __future__ import annotations

import json
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.db.connection import run_db_sync
from app.repositories import project_repo

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
