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
  isUserBreakout?: boolean;
  breakoutNotes?: string;
  breakoutMarkedAt?: string | null;
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
  nextPageToken?: string | null;
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

export interface IdeaProjectLinkDto {
  status: 'new' | 'researching' | 'approved' | 'produced' | 'skipped';
  priority: 'high' | 'medium' | 'low';
  projectAngle: string;
  projectNotes: string;
  publishedVideoUrl: string;
  statusUpdatedAt: string;
}

export interface IdeaDto {
  id: string;
  title: string;
  notes: string;
  sourceType: 'manual' | 'youtube_video' | 'rss_article' | 'keyword';
  sourceRefId: string;
  sourceTitleSnapshot: string;
  sourceUrl: string;
  linkedVideoId: string | null;
  linkedChannelId: string | null;
  linkedArticleId: string | null;
  apiPurged: boolean;
  inGlobalVault: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  projectLinks: Record<string, IdeaProjectLinkDto>;
}

export interface CreateIdeaPayload {
  title: string;
  notes: string;
  sourceType: 'manual' | 'youtube_video' | 'rss_article' | 'keyword';
  sourceRefId: string;
  sourceTitleSnapshot: string;
  sourceUrl: string;
  tags: string[];
  inGlobalVault: boolean;
  targetProjectIds: string[];
  projectAngle: string;
  priority: 'high' | 'medium' | 'low';
}

export interface UpdateIdeaCorePayload {
  title?: string;
  notes?: string;
  inGlobalVault?: boolean;
  tags?: string[];
}

export interface UpsertProjectIdeaLinkPayload {
  status?: 'new' | 'researching' | 'approved' | 'produced' | 'skipped';
  priority?: 'high' | 'medium' | 'low';
  projectAngle?: string;
  projectNotes?: string;
  publishedVideoUrl?: string;
}

export interface CompetitorChannelDto {
  channelId: string;
  projectId: string;
  status: 'active' | 'paused' | 'error';
  notes: string;
  addedAt: string;
  sharedProjectsCount: number;
  cachedVideoCount: number;
  hasValidApiData: boolean;
  apiPurged: boolean;
  title: string | null;
  handle: string | null;
  country: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  apiFetchedAt: string | null;
  apiExpiresAt: string | null;
}

export interface ProjectCompetitorsResponseDto {
  projectId: string;
  channels: CompetitorChannelDto[];
  videos: YoutubeVideoDto[];
  addedChannelId?: string;
  reusedCache?: boolean;
  quota?: QuotaStatusDto;
}

export interface CompetitorRefreshResponseDto extends ProjectCompetitorsResponseDto {
  refreshedCount: number;
  okCount: number;
  errorCount: number;
  results: Array<{
    channelId: string;
    status: 'ok' | 'error';
    videosFetched?: number;
    errorCode?: string;
    errorMessage?: string;
  }>;
  quota: QuotaStatusDto;
}

export interface BreakoutVideosResponseDto {
  projectId: string;
  mode: 'standard_mode';
  formatCounts: {
    longForm: number;
    shorts: number;
    unknown: number;
  };
  totalCount: number;
  items: YoutubeVideoDto[];
}

export interface ProjectKeywordDto {
  id: string;
  projectId: string;
  keyword: string;
  priority: 'high' | 'medium' | 'low';
  notes: string;
  lastScannedAt: string | null;
  lastSessionId: string | null;
  sessionExpiresAt: string | null;
  cachedResultCount: number;
  rssMatchCount?: number;
  createdAt: string;
}

export interface ProjectKeywordsResponseDto {
  projectId: string;
  regionCode: string;
  relevanceLanguage: string;
  linkedFeedCount: number;
  items: ProjectKeywordDto[];
  rssSignals: RssPhrasesResponseDto;
}

export interface KeywordDetailResponseDto {
  keyword: ProjectKeywordDto;
  session: SearchSessionDto | null;
  videos: YoutubeVideoDto[];
  rssSourceLabel: string;
  linkedFeedCount: number;
  matchedRssArticles: RssArticleDto[];
}

export interface ScanKeywordsResponseDto {
  scannedCount: number;
  scanned: Array<{
    keywordId: string;
    keyword: string;
    session: SearchSessionDto;
    videos: YoutubeVideoDto[];
  }>;
  overview: ProjectKeywordsResponseDto;
  quota: QuotaStatusDto;
}

export interface SchedulerStatusDto {
  running: boolean;
  startupDelaySec: number;
  purgeTicks: number;
  lastPurgeAtUtc: string | null;
  lastPurgeCounts: Record<string, number> | null;
  autoRefreshTicks: number;
  lastAutoRefreshAtUtc: string | null;
  lastAutoRefreshSummary: Record<string, unknown> | null;
}

export interface GlobalOverviewDto {
  validVideosCount: number;
  expiringSoonVideosCount: number;
  validChannelsCount: number;
  validSearchSessionsCount: number;
  ideasTotalCount: number;
  ideasUnlinkedCount: number;
  projectsCount: number;
  rssSummary: {
    total: number;
    enabled: number;
    errorCount: number;
    articlesCount: number;
  };
  latestRssArticles: RssArticleDto[];
  quota: QuotaStatusDto;
  settings: SystemSettingsDto;
  scheduler: SchedulerStatusDto;
}

export interface ProjectOverviewDto {
  projectId: string;
  competitorChannels: {
    total: number;
    active: number;
    paused: number;
    error: number;
  };
  competitorVideos: {
    totalValid: number;
    longForm: number;
    shorts: number;
    unknown: number;
  };
  breakoutFlaggedCount: number;
  keywords: {
    total: number;
    scannedValid: number;
  };
  rss: {
    linkedFeeds: number;
    brokenFeeds: number;
    recentArticlesCount: number;
  };
  ideas: {
    total: number;
    byStatus: Record<'new' | 'researching' | 'approved' | 'produced' | 'skipped', number>;
    recent: Array<{
      id: string;
      title: string;
      status: 'new' | 'researching' | 'approved' | 'produced' | 'skipped';
      priority: 'high' | 'medium' | 'low';
      projectAngle: string;
      statusUpdatedAt: string;
    }>;
  };
  latestRssArticles: RssArticleDto[];
}

export interface ProjectRefreshResponseDto {
  overview: ProjectOverviewDto;
  rssRefreshedCount: number;
  rssOkCount?: number;
  rssErrorCount?: number;
  competitorSummary: CompetitorRefreshResponseDto | null;
  competitorsSkippedReason: string | null;
  quota: QuotaStatusDto;
}


