export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface ApiErrorEnvelope {
  error: ApiErrorDetail;
}

export type ApiKeyStatus = 'missing' | 'configured' | 'unreadable';

export interface SystemSettingsDto {
  apiKeyStatus: ApiKeyStatus;
  maskedApiKey: string | null;
  legalConsentAccepted: boolean;
  legalConsentAcceptedAt: string | null;
  themeMode: 'light' | 'dark';
  defaultRegionCode: string;
  defaultRelevanceLanguage: string;
  autoRefreshEnabled: boolean;
  autoRefreshChannelIntervalHours: number;
  autoRefreshRssIntervalHours: number;
  autoRefreshMaxApiUnitsPerBatch: number;
  autoRefreshDailyQuotaCap: number;
  quotaWarningRatio: number;
  quotaLimits: {
    searchQueriesDailyLimit: number;
    generalDataDailyLimit: number;
  };
  legalLinks: {
    youtubeTosUrl: string;
    googlePrivacyUrl: string;
    youtubeBrandingUrl: string;
  };
  updatedAt: string | null;
}

export interface UpdateSystemSettingsPayload {
  themeMode?: 'light' | 'dark';
  defaultRegionCode?: string;
  defaultRelevanceLanguage?: string;
  autoRefreshEnabled?: boolean;
  autoRefreshChannelIntervalHours?: number;
  autoRefreshRssIntervalHours?: number;
  autoRefreshMaxApiUnitsPerBatch?: number;
  autoRefreshDailyQuotaCap?: number;
  quotaWarningRatio?: number;
}

export interface QuotaBucketStatusDto {
  used: number;
  limit: number;
  remaining: number;
  warning: boolean;
  exhausted: boolean;
  exhaustedUntilUtc: string | null;
}

export interface QuotaStatusDto {
  ptDate: string;
  resetAtUtc: string;
  warningRatio: number;
  autoRefreshDailyQuotaCap: number;
  searchQueries: QuotaBucketStatusDto;
  generalData: QuotaBucketStatusDto;
}

export interface PurgeCacheResultDto {
  snapshotsDeleted: number;
  searchSessionsDeleted: number;
  videosDeleted: number;
  videosTombstoned: number;
  channelsDeleted: number;
  channelsTombstoned: number;
  dbBackupsDeleted: number;
  purgedAtUtc: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  description: string;
  regionCode: string;
  relevanceLanguage: string;
  targetFormat: 'all' | 'long_form' | 'shorts';
  linkedFeedIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  regionCode: string;
  relevanceLanguage: string;
  targetFormat: 'all' | 'long_form' | 'shorts';
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  regionCode?: string;
  relevanceLanguage?: string;
  targetFormat?: 'all' | 'long_form' | 'shorts';
}

export interface DeleteProjectResultDto {
  deletedProjectId: string;
  deletedProjectName: string;
  recoveryBackupFilename: string;
  sharedEntitiesPreserved: boolean;
}
