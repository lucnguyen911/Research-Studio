from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.db.connection import run_db_sync
from app.repositories import rss_repo
from app.services import rss_service

router = APIRouter(prefix="/api/v1/rss", tags=["rss"])


class CreateFeedRequest(BaseModel):
    name: str = Field(default="", max_length=160)
    url: str = Field(min_length=8, max_length=1000)
    groupTag: str = Field(default="", max_length=80)


class UpdateFeedRequest(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    groupTag: str | None = Field(default=None, max_length=80)
    enabled: bool | None = None


class UpdateArticleRequest(BaseModel):
    bookmarked: bool | None = None
    userNotes: str | None = Field(default=None, max_length=4000)


@router.get("/feeds")
async def get_feeds() -> dict[str, object]:
    items = await run_db_sync(rss_repo.list_feeds)
    return {"items": items}


@router.post("/feeds", status_code=201)
async def add_feed(payload: CreateFeedRequest) -> dict[str, object]:
    feed = await rss_service.add_rss_feed(name=payload.name, url=payload.url, group_tag=payload.groupTag)
    return {"feed": feed}


@router.put("/feeds/{feed_id}")
async def update_feed_detail(feed_id: str, payload: UpdateFeedRequest) -> dict[str, object]:
    patch = payload.model_dump(exclude_none=True)
    feed = await run_db_sync(rss_repo.update_feed, feed_id, patch)
    return {"feed": feed}


@router.delete("/feeds/{feed_id}")
async def delete_feed_item(feed_id: str) -> dict[str, object]:
    return await run_db_sync(rss_repo.delete_feed, feed_id)


@router.post("/feeds/{feed_id}/refresh")
async def refresh_one_feed(feed_id: str) -> dict[str, object]:
    return await rss_service.refresh_single_feed(feed_id)


@router.post("/refresh")
async def refresh_enabled_feeds() -> dict[str, object]:
    return await rss_service.refresh_all_enabled_feeds()


@router.get("/articles")
async def get_articles(
    feedId: str | None = Query(default=None, max_length=64),
    projectId: str | None = Query(default=None, max_length=64),
    onlyBookmarked: bool = False,
    search: str = Query(default="", max_length=200),
    limit: int = Query(default=100, ge=1, le=200),
) -> dict[str, object]:
    items = await run_db_sync(
        rss_repo.list_articles,
        feed_id=feedId,
        project_id=projectId,
        only_bookmarked=onlyBookmarked,
        search=search,
        limit=limit,
    )
    return {"items": items, "sourceLabel": "Nguồn: RSS (Dữ liệu ngoài YouTube)"}


@router.get("/articles/{article_id}")
async def get_article_detail(article_id: str) -> dict[str, object]:
    article = await run_db_sync(rss_repo.get_article, article_id)
    return {"article": article}


@router.put("/articles/{article_id}")
async def update_article_detail(article_id: str, payload: UpdateArticleRequest) -> dict[str, object]:
    patch = payload.model_dump(exclude_none=True)
    article = await run_db_sync(rss_repo.update_article, article_id, patch)
    return {"article": article}


@router.get("/phrases")
async def get_rss_phrases(
    projectId: str | None = Query(default=None, max_length=64),
    days: int = Query(default=7, ge=1, le=90),
    limit: int = Query(default=10, ge=1, le=30),
) -> dict[str, object]:
    return await run_db_sync(
        rss_service.compute_rss_phrases,
        project_id=projectId,
        days=days,
        limit=limit,
    )
