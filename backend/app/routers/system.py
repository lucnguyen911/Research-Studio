from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.db.connection import run_db_sync
from app.repositories import settings_repo

router = APIRouter(prefix="/api/v1/system", tags=["system"])


class UpdateSettingsRequest(BaseModel):
    themeMode: Literal["light", "dark"] | None = None
    defaultRegionCode: str | None = Field(default=None, max_length=8)
    defaultRelevanceLanguage: str | None = Field(default=None, max_length=16)
    autoRefreshEnabled: bool | None = None
    autoRefreshChannelIntervalHours: int | None = None
    autoRefreshRssIntervalHours: int | None = None
    autoRefreshMaxApiUnitsPerBatch: int | None = None
    autoRefreshDailyQuotaCap: int | None = None
    quotaWarningRatio: float | None = None


class LegalConsentRequest(BaseModel):
    accepted: bool


class SaveApiKeyRequest(BaseModel):
    apiKey: str


@router.get("/settings")
async def read_system_settings() -> dict[str, object]:
    return await run_db_sync(settings_repo.get_public_settings)


@router.put("/settings")
async def update_system_settings(payload: UpdateSettingsRequest) -> dict[str, object]:
    patch = payload.model_dump(exclude_none=True)
    return await run_db_sync(settings_repo.update_public_settings, patch)


@router.post("/legal-consent")
async def record_legal_consent(payload: LegalConsentRequest) -> dict[str, object]:
    return await run_db_sync(settings_repo.set_legal_consent, payload.accepted)


@router.put("/youtube-api-key")
async def put_youtube_api_key(payload: SaveApiKeyRequest) -> dict[str, object]:
    return await run_db_sync(settings_repo.save_youtube_api_key, payload.apiKey)


@router.delete("/youtube-api-key")
async def remove_youtube_api_key() -> dict[str, object]:
    return await run_db_sync(settings_repo.delete_youtube_api_key)
