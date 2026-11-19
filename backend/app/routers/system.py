from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.db.connection import run_db_sync
from app.repositories import settings_repo
from app.services import quota_service, retention_service, scheduler_service, storage_service

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
    apiKey: str = Field(min_length=1, max_length=256)


class UpdateBackupConfigRequest(BaseModel):
    autoBackupEnabled: bool | None = None
    externalBackupDir: str | None = Field(default=None, max_length=512)


class MigrateDataDirRequest(BaseModel):
    targetDir: str | None = Field(default=None, max_length=512)
    ifExists: Literal["error", "use_existing", "copy_overwrite"] = "error"
    resetToDefault: bool = False


class RestoreBackupRequest(BaseModel):
    backupPath: str = Field(min_length=1, max_length=600)


class OpenStorageFolderRequest(BaseModel):
    target: Literal["data_root", "user_backups", "external_backup"] = "data_root"


class PickStoragePathRequest(BaseModel):
    initialDir: str | None = Field(default=None, max_length=512)


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


@router.get("/quota")
async def read_quota_status() -> dict[str, object]:
    return await run_db_sync(quota_service.get_quota_status)


@router.post("/purge-youtube-cache")
async def purge_youtube_cache() -> dict[str, object]:
    return await run_db_sync(retention_service.purge_all_youtube_api_data_by_user_request)


@router.get("/scheduler-status")
async def read_scheduler_status() -> dict[str, object]:
    return scheduler_service.scheduler.get_status()


@router.get("/storage")
async def read_storage_status() -> dict[str, object]:
    return await run_db_sync(storage_service.get_storage_status)


@router.put("/storage/backup-config")
async def update_storage_backup_config(payload: UpdateBackupConfigRequest) -> dict[str, object]:
    return await run_db_sync(
        storage_service.update_backup_config,
        auto_backup_enabled=payload.autoBackupEnabled,
        external_backup_dir=payload.externalBackupDir,
    )


@router.post("/storage/migrate-data-dir")
async def migrate_storage_data_dir(payload: MigrateDataDirRequest) -> dict[str, object]:
    was_running = scheduler_service.scheduler._running
    if was_running:
        await scheduler_service.scheduler.stop()
    try:
        return await run_db_sync(
            storage_service.migrate_active_data_dir,
            payload.targetDir,
            if_exists=payload.ifExists,
            reset_to_default=payload.resetToDefault,
        )
    finally:
        if was_running:
            await scheduler_service.scheduler.start()


@router.post("/storage/backups/create")
async def create_manual_storage_backup() -> dict[str, object]:
    return await run_db_sync(storage_service.create_user_backup, trigger="manual")


@router.post("/storage/backups/restore")
async def restore_storage_backup(payload: RestoreBackupRequest) -> dict[str, object]:
    was_running = scheduler_service.scheduler._running
    if was_running:
        await scheduler_service.scheduler.stop()
    try:
        return await run_db_sync(storage_service.restore_user_backup, payload.backupPath)
    finally:
        if was_running:
            await scheduler_service.scheduler.start()


@router.post("/storage/open-folder")
async def open_storage_folder(payload: OpenStorageFolderRequest) -> dict[str, str]:
    return await run_db_sync(storage_service.open_configured_folder, payload.target)


@router.post("/storage/pick-folder")
async def pick_storage_folder(payload: PickStoragePathRequest | None = None) -> dict[str, str | None]:
    return await run_db_sync(
        storage_service.pick_folder_dialog,
        payload.initialDir if payload is not None else None,
    )


@router.post("/storage/pick-backup-file")
async def pick_storage_backup_file(payload: PickStoragePathRequest | None = None) -> dict[str, str | None]:
    return await run_db_sync(
        storage_service.pick_backup_file_dialog,
        payload.initialDir if payload is not None else None,
    )
