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

export interface YoutubeCategoryDto {
  id: string;
  title: string;
}

export interface YoutubeSnapshotDto {
  capturedAt: string;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
}

export interface YoutubeVideoDto {
  videoId: string;
  channelId: string | null;
  hasValidApiData: boolean;
  apiPurged: boolean;
  title: string | null;
  description: string | null;
  channelTitle: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  tags: string[];
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  isLiveStreaming: boolean;
  sourceFormatStatus: 'long_form' | 'shorts' | 'unknown';
  formatHint: string | null;
  formatHintConfidence: string | null;
  formatHintBasis: string | null;
  manualFormat: 'long_form' | 'shorts' | null;
  apiFetchedAt: string | null;
  apiExpiresAt: string | null;
  snapshots30d: YoutubeSnapshotDto[];
}

export interface YoutubeChannelDto {
  channelId: string;
  hasValidApiData: boolean;
  apiPurged: boolean;
  title: string | null;
  handle: string | null;
  description: string | null;
  country: string | null;
  thumbnailUrl: string | null;
  uploadsPlaylistId: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  publishedAt: string | null;
  apiFetchedAt: string | null;
  apiExpiresAt: string | null;
}

export interface TrendsResponseDto {
  regionCode: string;
  categoryId: string;
  fetchedAt: string | null;
  expiresAt: string | null;
  videos: YoutubeVideoDto[];
  quota?: QuotaStatusDto;
}

export interface SearchSessionDto {
  id: string;
  query: string;
  objectType: 'video' | 'channel';
  regionCode: string;
  relevanceLanguage: string;
  publishedAfter: string | null;
  orderBy: string;
  resultCount: number;
  apiFetchedAt: string;
  apiExpiresAt: string;
}

export interface SearchSessionDetailDto {
  session: SearchSessionDto;
  videos: YoutubeVideoDto[];
  channels: YoutubeChannelDto[];
}

export interface FreeSearchResponseDto extends SearchSessionDetailDto {
  quota: QuotaStatusDto;
}

export interface VideoDetailResponseDto {
  video: YoutubeVideoDto;
  channel: YoutubeChannelDto | null;
  breakout: {
    flagged: boolean;
    notes: string;
    markedAt: string | null;
  } | null;
  linkedIdeas: Array<{ id: string; title: string; updatedAt: string }>;
}

export interface ChannelDetailResponseDto {
  channel: YoutubeChannelDto;
  videos: YoutubeVideoDto[];
  linkedProjects: Array<{
    projectId: string;
    projectName: string;
    status: string;
    notes: string;
  }>;
}

export interface RssFeedDto {
  id: string;
  name: string;
  url: string;
  groupTag: string;
  enabled: boolean;
  lastFetchedAt: string | null;
  lastStatus: 'never' | 'ok' | 'error';
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
  createdAt: string;
  articleCount: number;
}

export interface RssArticleDto {
  id: string;
  feedId: string;
  feedName: string;
  canonicalUrl: string;
  title: string;
  summaryText: string;
  publishedAt: string | null;
  fetchedAt: string;
  bookmarked: boolean;
  userNotes: string;
  sourceLabel: string;
}

export interface RssPhraseItemDto {
  phrase: string;
  articleCount: number;
  points7d: number[];
  activeDays: number;
  direction: 'up' | 'flat';
}

export interface RssPhrasesResponseDto {
  sourceLabel: string;
  articleSampleSize: number;
  days: number;
  items: RssPhraseItemDto[];
}

export interface RssSingleRefreshResultDto {
  feedId: string;
  status: 'ok' | 'error';
  insertedCount?: number;
  totalParsed?: number;
  errorCode?: string;
  errorMessage?: string;
  feed: RssFeedDto;
}

export interface RssRefreshAllResultDto {
  refreshedCount: number;
  okCount: number;
  errorCount: number;
  results: RssSingleRefreshResultDto[];
}

