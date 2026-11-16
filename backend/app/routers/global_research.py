from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.clients import youtube_client
from app.core.config import SEARCH_MAX_RESULTS_PER_CALL
from app.db.connection import run_db_sync
from app.repositories import rss_repo, settings_repo, youtube_repo
from app.services import discovery_service, quota_service, scheduler_service

router = APIRouter(prefix="/api/v1", tags=["global-research"])


class RefreshTrendsRequest(BaseModel):
    regionCode: str = Field(default="VN", max_length=8)
    categoryId: str = Field(default="all", max_length=32)
    maxResults: int = Field(default=SEARCH_MAX_RESULTS_PER_CALL, ge=1, le=50)


class FreeSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    objectType: Literal["video", "channel"] = "video"
    regionCode: str = Field(default="VN", max_length=8)
    relevanceLanguage: str = Field(default="vi", max_length=16)
    publishedAfter: str | None = None
    orderBy: Literal["relevance", "date", "viewCount", "rating"] = "relevance"
    maxResults: int = Field(default=SEARCH_MAX_RESULTS_PER_CALL, ge=1, le=50)


class ManualFormatRequest(BaseModel):
    manualFormat: Literal["long_form", "shorts"] | None = None


@router.get("/global/categories")
async def get_video_categories(
    refresh: bool = False,
    regionCode: str = "VN",
    language: str = "vi",
) -> dict[str, object]:
    if refresh:
        items = await youtube_client.fetch_video_categories(region_code=regionCode, language=language)
        return {"items": [{"id": "all", "title": "Tất cả danh mục"}, *items], "source": "youtube_api"}
    return {"items": discovery_service.DEFAULT_YOUTUBE_CATEGORIES, "source": "static_defaults"}


@router.get("/global/trends")
async def read_cached_trends(regionCode: str = "VN", categoryId: str = "all") -> dict[str, object]:
    return await run_db_sync(
        discovery_service.get_cached_trends,
        region_code=regionCode,
        category_id=categoryId,
    )


@router.post("/global/trends/refresh")
async def refresh_global_trends(payload: RefreshTrendsRequest) -> dict[str, object]:
    return await discovery_service.refresh_trends(
        region_code=payload.regionCode,
        category_id=payload.categoryId,
        max_results=payload.maxResults,
    )


@router.get("/global/search/sessions")
async def list_search_sessions() -> dict[str, object]:
    items = await run_db_sync(discovery_service.list_valid_search_sessions)
    return {"items": items}


@router.get("/global/search/sessions/{session_id}")
async def read_search_session(session_id: str) -> dict[str, object]:
    return await run_db_sync(discovery_service.get_search_session_detail, session_id)


@router.post("/global/search")
async def execute_free_search(payload: FreeSearchRequest) -> dict[str, object]:
    return await discovery_service.run_free_search(
        query=payload.query,
        object_type=payload.objectType,
        region_code=payload.regionCode,
        relevance_language=payload.relevanceLanguage,
        published_after=payload.publishedAfter,
        order_by=payload.orderBy,
        max_results=payload.maxResults,
    )


@router.get("/youtube/videos/{video_id}")
async def read_youtube_video_detail(video_id: str, projectId: str | None = None) -> dict[str, object]:
    return await run_db_sync(discovery_service.get_video_detail, video_id, project_id=projectId)


@router.put("/youtube/videos/{video_id}/manual-format")
async def update_manual_video_format(video_id: str, payload: ManualFormatRequest) -> dict[str, object]:
    return await run_db_sync(youtube_repo.set_manual_video_format, video_id, payload.manualFormat)


@router.get("/youtube/channels/{channel_id}")
async def read_youtube_channel_detail(channel_id: str) -> dict[str, object]:
    return await run_db_sync(discovery_service.get_channel_detail, channel_id)


@router.get("/global/overview")
async def read_global_overview() -> dict[str, object]:
    def _load() -> dict[str, object]:
        summary = youtube_repo.get_global_overview_summary()
        latest_articles = rss_repo.list_articles(limit=5)
        quota = quota_service.get_quota_status()
        settings = settings_repo.get_public_settings()
        return {
            **summary,
            "latestRssArticles": latest_articles,
            "quota": quota,
            "settings": settings,
            "scheduler": scheduler_service.scheduler.get_status(),
        }

    return await run_db_sync(_load)
