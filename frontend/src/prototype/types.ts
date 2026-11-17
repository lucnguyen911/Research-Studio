export type ThemeMode = 'light' | 'dark';
export type UiLanguage = 'vi' | 'en';

export type GlobalScreenId =
  | 'global-overview'
  | 'global-trends'
  | 'global-search'
  | 'global-featured-stage2'
  | 'global-news'
  | 'global-ideas';

export type ProjectScreenId =
  | 'project-overview'
  | 'project-hot-topics-stage2'
  | 'project-keywords'
  | 'project-breakout'
  | 'project-competitors'
  | 'project-evergreen-stage2'
  | 'project-opportunities-stage2'
  | 'project-ai-stage2'
  | 'project-ideas'
  | 'project-settings';

export type DetailAndSystemScreenId =
  | 'channel-detail'
  | 'video-detail'
  | 'article-detail'
  | 'idea-detail'
  | 'system-settings';

export type ScreenId = GlobalScreenId | ProjectScreenId | DetailAndSystemScreenId;

export type UiSimulatorMode =
  | 'normal'
  | 'loading'
  | 'empty'
  | 'no_api_key'
  | 'offline'
  | 'quota_search_exhausted'
  | 'quota_general_exhausted'
  | 'rss_error'
  | 'insufficient_data'
  | 'refreshing';

export type SourceFormatStatus = 'long_form' | 'shorts' | 'unknown';
export type ManualFormatLabel = 'none' | 'long_form' | 'shorts';
export type IdeaStatus = 'new' | 'researching' | 'approved' | 'produced' | 'skipped';
export type IdeaPriority = 'high' | 'medium' | 'low';
export type IdeaSourceType = 'manual' | 'youtube_video' | 'rss_article' | 'keyword';

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  regionCode: string;
  relevanceLanguage: string;
  targetFormat: 'all' | 'long_form' | 'shorts';
  linkedFeedIds: string[];
  updatedAt: string;
}

export interface ChannelItem {
  id: string;
  title: string;
  handle: string;
  subscriberCount: number;
  videoCount: number;
  country: string;
  projectIds: string[];
  projectNotes: Record<string, string>;
  lastFetchedAt: string;
  statusByProject: Record<string, 'active' | 'paused' | 'error'>;
  errorNote?: string;
}

export interface VideoSnapshotPoint {
  capturedAt: string;
  shortLabel: string;
  viewCount: number;
}

export interface VideoItem {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  thumbnailUrl?: string | null;
  hasValidApiData?: boolean;
  publishedAt: string;
  daysAgo: number;
  durationSeconds: number;
  durationDisplay: string;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  sourceFormatStatus: SourceFormatStatus;
  formatHint: string | null;
  formatHintConfidence: string | null;
  formatHintBasis: string | null;
  defaultManualFormat: ManualFormatLabel;
  tags: string[];
  snapshots30d: VideoSnapshotPoint[];
  isTrendDemo?: boolean;
  trendRank?: number;
  regionCode?: string;
  categoryName?: string;
  projectIds: string[];
  isUserBreakout?: boolean;
  breakoutNotes?: string;
  apiFetchedAt: string;
  apiExpiresAt: string;
}

export interface RssFeedItem {
  id: string;
  name: string;
  url: string;
  groupTag: string;
  enabled: boolean;
  status: 'ok' | 'error';
  lastFetchedAt: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface RssArticleItem {
  id: string;
  feedId: string;
  feedName: string;
  title: string;
  publishedAt: string;
  url: string;
  summaryText: string;
  bookmarked: boolean;
  tags: string[];
}

export interface RssTopicFrequency {
  phrase: string;
  articleCount: number;
  points7d: number[];
  direction: 'up' | 'flat';
}

export interface KeywordItem {
  id: string;
  projectId: string;
  keyword: string;
  priority: IdeaPriority;
  notes: string;
  lastScannedAt: string | null;
  matchedVideoIds: string[];
  rssMatchCount: number;
}

export interface ProjectIdeaLink {
  status: IdeaStatus;
  priority: IdeaPriority;
  projectAngle: string;
  projectNotes: string;
  publishedVideoUrl: string;
  statusUpdatedAt: string;
}

export interface IdeaItem {
  id: string;
  title: string;
  notes: string;
  sourceType: IdeaSourceType;
  sourceRefId: string;
  sourceTitleSnapshot: string;
  sourceUrl: string;
  apiPurged?: boolean;
  inGlobalVault: boolean;
  tags: string[];
  updatedAt: string;
  projectLinks: Record<string, ProjectIdeaLink>;
}

export interface RouteParams {
  channelId?: string;
  videoId?: string;
  articleId?: string;
  ideaId?: string;
  fromScreen?: ScreenId;
  fromChannelId?: string;
}

export interface ViewFilterState {
  search: string;
  formatFilter: 'all' | SourceFormatStatus;
  includeManualInFormat: boolean;
  manualFilter: 'all' | 'long_form' | 'shorts' | 'unlabeled';
  channelFilter: string;
  statusFilter: 'all' | IdeaStatus;
  priorityFilter: 'all' | IdeaPriority;
  originFilter: 'all' | IdeaSourceType;
  linkStateFilter: 'all' | 'unlinked' | 'linked';
  dateWindow: '3' | '7' | '14' | '30' | 'all';
  minViews: string;
  onlyBreakout: boolean;
  onlyBookmarked: boolean;
  selectedFeedId: string;
  selectedKeywordId: string;
  sortBy: 'viewCount' | 'likeCount' | 'commentCount' | 'publishedAt' | 'durationSeconds' | 'updatedAt';
  sortDir: 'desc' | 'asc';
  tab: string;
  page: number;
  scrollTop: number;
  regionCodeFilter?: string;
  categoryFilter?: string;
}

export interface NavHistoryEntry {
  entryId: string;
  screenId: ScreenId;
  projectId: string | null;
  params: RouteParams;
  viewState: ViewFilterState;
}
