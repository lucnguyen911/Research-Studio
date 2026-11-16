import type {
  ApiErrorEnvelope,
  BreakoutVideosResponseDto,
  ChannelDetailResponseDto,
  CompetitorRefreshResponseDto,
  CreateIdeaPayload,
  CreateProjectPayload,
  DeleteProjectResultDto,
  FreeSearchResponseDto,
  GlobalOverviewDto,
  IdeaDto,
  KeywordDetailResponseDto,
  ProjectCompetitorsResponseDto,
  ProjectDto,
  ProjectKeywordDto,
  ProjectKeywordsResponseDto,
  ProjectOverviewDto,
  ProjectRefreshResponseDto,
  PurgeCacheResultDto,
  QuotaStatusDto,
  RssArticleDto,
  RssFeedDto,
  RssPhrasesResponseDto,
  RssRefreshAllResultDto,
  RssSingleRefreshResultDto,
  ScanKeywordsResponseDto,
  SchedulerStatusDto,
  SearchSessionDetailDto,
  SearchSessionDto,
  SystemSettingsDto,
  TrendsResponseDto,
  UpdateIdeaCorePayload,
  UpdateProjectPayload,
  UpdateSystemSettingsPayload,
  UpsertProjectIdeaLinkPayload,
  VideoDetailResponseDto,
  YoutubeCategoryDto,
} from './types';

export const CSRF_HEADER_NAME = 'X-Research-Studio-Client';
export const CSRF_HEADER_VALUE = 'local-web';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | null;

  constructor(
    code: string,
    message: string,
    status: number,
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function buildHeaders(method: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (MUTATING_METHODS.has(method.toUpperCase())) {
    headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
  }
  return headers;
}

async function parseErrorResponse(response: Response): Promise<ApiClientError> {
  try {
    const data = (await response.json()) as Partial<ApiErrorEnvelope>;
    if (data && data.error && typeof data.error.message === 'string') {
      return new ApiClientError(
        data.error.code || `HTTP_${response.status}`,
        data.error.message,
        response.status,
        data.error.details ?? null,
      );
    }
  } catch {
    // Non-JSON error body (e.g. Vite proxy error when local backend is stopped)
  }
  if (response.status === 502 || response.status === 504) {
    return new ApiClientError(
      'NETWORK_UNREACHABLE',
      'Không kết nối được tới dịch vụ Backend cục bộ (127.0.0.1:8000).',
      response.status,
    );
  }
  return new ApiClientError(
    `HTTP_${response.status}`,
    `Yêu cầu máy chủ thất bại (HTTP ${response.status}).`,
    response.status,
  );
}

export async function apiRequest<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
  },
): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const headers = buildHeaders(method);
  let bodyInit: BodyInit | undefined;
  if (options?.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    bodyInit = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: bodyInit,
      signal: options?.signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw err;
    }
    throw new ApiClientError(
      'NETWORK_UNREACHABLE',
      'Không thể kết nối tới Backend cục bộ hoặc mất mạng.',
      0,
    );
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return (await response.json()) as T;
}

export async function apiDownloadFile(
  path: string,
  fallbackFilename: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'GET',
      headers: buildHeaders('GET'),
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiClientError('NETWORK_UNREACHABLE', 'Không thể tải tệp từ Backend cục bộ.', 0);
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] || fallbackFilename;
  const blob = await response.blob();
  return { blob, filename };
}

export async function fetchSystemSettings(signal?: AbortSignal): Promise<SystemSettingsDto> {
  return apiRequest<SystemSettingsDto>('/api/v1/system/settings', { signal });
}

export async function updateSystemSettingsApi(
  patch: UpdateSystemSettingsPayload,
  signal?: AbortSignal,
): Promise<SystemSettingsDto> {
  return apiRequest<SystemSettingsDto>('/api/v1/system/settings', {
    method: 'PUT',
    body: patch,
    signal,
  });
}

export async function setLegalConsentApi(
  accepted: boolean,
  signal?: AbortSignal,
): Promise<SystemSettingsDto> {
  return apiRequest<SystemSettingsDto>('/api/v1/system/legal-consent', {
    method: 'POST',
    body: { accepted },
    signal,
  });
}

export async function saveYoutubeApiKeyApi(
  apiKey: string,
  signal?: AbortSignal,
): Promise<SystemSettingsDto> {
  return apiRequest<SystemSettingsDto>('/api/v1/system/youtube-api-key', {
    method: 'PUT',
    body: { apiKey },
    signal,
  });
}

export async function deleteYoutubeApiKeyApi(signal?: AbortSignal): Promise<SystemSettingsDto> {
  return apiRequest<SystemSettingsDto>('/api/v1/system/youtube-api-key', {
    method: 'DELETE',
    signal,
  });
}

export async function fetchQuotaStatus(signal?: AbortSignal): Promise<QuotaStatusDto> {
  return apiRequest<QuotaStatusDto>('/api/v1/system/quota', { signal });
}

export async function purgeYoutubeCacheApi(signal?: AbortSignal): Promise<PurgeCacheResultDto> {
  return apiRequest<PurgeCacheResultDto>('/api/v1/system/purge-youtube-cache', {
    method: 'POST',
    signal,
  });
}

export async function fetchProjectsApi(signal?: AbortSignal): Promise<ProjectDto[]> {
  const res = await apiRequest<{ items: ProjectDto[] }>('/api/v1/projects', { signal });
  return res.items;
}

export async function createProjectApi(
  payload: CreateProjectPayload,
  signal?: AbortSignal,
): Promise<ProjectDto> {
  const res = await apiRequest<{ project: ProjectDto }>('/api/v1/projects', {
    method: 'POST',
    body: payload,
    signal,
  });
  return res.project;
}

export async function updateProjectApi(
  projectId: string,
  patch: UpdateProjectPayload,
  signal?: AbortSignal,
): Promise<ProjectDto> {
  const res = await apiRequest<{ project: ProjectDto }>(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
    method: 'PUT',
    body: patch,
    signal,
  });
  return res.project;
}

export async function exportProjectJsonApi(
  projectId: string,
  fallbackSlug: string,
  signal?: AbortSignal,
): Promise<string> {
  const { blob, filename } = await apiDownloadFile(
    `/api/v1/projects/${encodeURIComponent(projectId)}/export`,
    `research-studio-${fallbackSlug}.json`,
    signal,
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
}

export async function deleteProjectApi(
  projectId: string,
  confirmName: string,
  signal?: AbortSignal,
): Promise<DeleteProjectResultDto> {
  return apiRequest<DeleteProjectResultDto>(`/api/v1/projects/${encodeURIComponent(projectId)}/delete`, {
    method: 'POST',
    body: { confirmName },
    signal,
  });
}

export async function updateProjectRssFeedsApi(
  projectId: string,
  feedIds: string[],
  signal?: AbortSignal,
): Promise<ProjectDto> {
  const res = await apiRequest<{ project: ProjectDto }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/rss-feeds`,
    {
      method: 'PUT',
      body: { feedIds },
      signal,
    },
  );
  return res.project;
}

export async function fetchGlobalCategoriesApi(
  options?: { refresh?: boolean; regionCode?: string; language?: string; signal?: AbortSignal },
): Promise<{ items: YoutubeCategoryDto[]; source: string }> {
  const qs = new URLSearchParams();
  if (options?.refresh) qs.set('refresh', 'true');
  if (options?.regionCode) qs.set('regionCode', options.regionCode);
  if (options?.language) qs.set('language', options.language);
  const queryStr = qs.toString();
  return apiRequest<{ items: YoutubeCategoryDto[]; source: string }>(
    `/api/v1/global/categories${queryStr ? `?${queryStr}` : ''}`,
    { signal: options?.signal },
  );
}

export async function fetchCachedTrendsApi(
  regionCode = 'VN',
  categoryId = 'all',
  signal?: AbortSignal,
): Promise<TrendsResponseDto> {
  const qs = new URLSearchParams({ regionCode, categoryId });
  return apiRequest<TrendsResponseDto>(`/api/v1/global/trends?${qs.toString()}`, { signal });
}

export async function refreshGlobalTrendsApi(
  payload: { regionCode: string; categoryId: string; maxResults?: number },
  signal?: AbortSignal,
): Promise<TrendsResponseDto> {
  return apiRequest<TrendsResponseDto>('/api/v1/global/trends/refresh', {
    method: 'POST',
    body: payload,
    signal,
  });
}

export async function fetchSearchSessionsApi(signal?: AbortSignal): Promise<SearchSessionDto[]> {
  const res = await apiRequest<{ items: SearchSessionDto[] }>('/api/v1/global/search/sessions', { signal });
  return res.items;
}

export async function fetchSearchSessionDetailApi(
  sessionId: string,
  signal?: AbortSignal,
): Promise<SearchSessionDetailDto> {
  return apiRequest<SearchSessionDetailDto>(
    `/api/v1/global/search/sessions/${encodeURIComponent(sessionId)}`,
    { signal },
  );
}

export async function runFreeSearchApi(
  payload: {
    query: string;
    objectType?: 'video' | 'channel';
    regionCode: string;
    relevanceLanguage: string;
    publishedAfter?: string | null;
    orderBy: 'relevance' | 'date' | 'viewCount' | 'rating';
    maxResults?: number;
    pageToken?: string | null;
    appendSessionId?: string | null;
  },
  signal?: AbortSignal,
): Promise<FreeSearchResponseDto> {
  return apiRequest<FreeSearchResponseDto>('/api/v1/global/search', {
    method: 'POST',
    body: payload,
    signal,
  });
}

export async function fetchVideoDetailApi(
  videoId: string,
  projectId?: string | null,
  signal?: AbortSignal,
): Promise<VideoDetailResponseDto> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiRequest<VideoDetailResponseDto>(
    `/api/v1/youtube/videos/${encodeURIComponent(videoId)}${qs}`,
    { signal },
  );
}

export async function setManualVideoFormatApi(
  videoId: string,
  manualFormat: 'long_form' | 'shorts' | null,
  signal?: AbortSignal,
): Promise<{ videoId: string; manualFormat: 'long_form' | 'shorts' | null; updatedAt: string }> {
  return apiRequest(`/api/v1/youtube/videos/${encodeURIComponent(videoId)}/manual-format`, {
    method: 'PUT',
    body: { manualFormat },
    signal,
  });
}

export async function fetchChannelDetailApi(
  channelId: string,
  signal?: AbortSignal,
): Promise<ChannelDetailResponseDto> {
  return apiRequest<ChannelDetailResponseDto>(
    `/api/v1/youtube/channels/${encodeURIComponent(channelId)}`,
    { signal },
  );
}

export async function fetchRssFeedsApi(signal?: AbortSignal): Promise<RssFeedDto[]> {
  const res = await apiRequest<{ items: RssFeedDto[] }>('/api/v1/rss/feeds', { signal });
  return res.items;
}

export async function createRssFeedApi(
  payload: { name: string; url: string; groupTag?: string },
  signal?: AbortSignal,
): Promise<RssFeedDto> {
  const res = await apiRequest<{ feed: RssFeedDto }>('/api/v1/rss/feeds', {
    method: 'POST',
    body: payload,
    signal,
  });
  return res.feed;
}

export async function updateRssFeedApi(
  feedId: string,
  patch: { name?: string; groupTag?: string; enabled?: boolean },
  signal?: AbortSignal,
): Promise<RssFeedDto> {
  const res = await apiRequest<{ feed: RssFeedDto }>(`/api/v1/rss/feeds/${encodeURIComponent(feedId)}`, {
    method: 'PUT',
    body: patch,
    signal,
  });
  return res.feed;
}

export async function deleteRssFeedApi(feedId: string, signal?: AbortSignal): Promise<void> {
  await apiRequest<{ deletedFeedId: string }>(`/api/v1/rss/feeds/${encodeURIComponent(feedId)}`, {
    method: 'DELETE',
    signal,
  });
}

export async function refreshSingleRssFeedApi(
  feedId: string,
  signal?: AbortSignal,
): Promise<RssSingleRefreshResultDto> {
  return apiRequest<RssSingleRefreshResultDto>(
    `/api/v1/rss/feeds/${encodeURIComponent(feedId)}/refresh`,
    { method: 'POST', signal },
  );
}

export async function refreshAllRssFeedsApi(signal?: AbortSignal): Promise<RssRefreshAllResultDto> {
  return apiRequest<RssRefreshAllResultDto>('/api/v1/rss/refresh', {
    method: 'POST',
    signal,
  });
}

export async function fetchRssArticlesApi(
  options?: {
    feedId?: string;
    projectId?: string;
    onlyBookmarked?: boolean;
    search?: string;
    limit?: number;
  },
  signal?: AbortSignal,
): Promise<{ items: RssArticleDto[]; sourceLabel: string }> {
  const qs = new URLSearchParams();
  if (options?.feedId && options.feedId !== 'all') qs.set('feedId', options.feedId);
  if (options?.projectId) qs.set('projectId', options.projectId);
  if (options?.onlyBookmarked) qs.set('onlyBookmarked', 'true');
  if (options?.search?.trim()) qs.set('search', options.search.trim());
  if (options?.limit) qs.set('limit', String(options.limit));
  const query = qs.toString();
  return apiRequest(`/api/v1/rss/articles${query ? `?${query}` : ''}`, { signal });
}

export async function fetchRssArticleDetailApi(
  articleId: string,
  signal?: AbortSignal,
): Promise<RssArticleDto> {
  const res = await apiRequest<{ article: RssArticleDto }>(
    `/api/v1/rss/articles/${encodeURIComponent(articleId)}`,
    { signal },
  );
  return res.article;
}

export async function updateRssArticleApi(
  articleId: string,
  patch: { bookmarked?: boolean; userNotes?: string },
  signal?: AbortSignal,
): Promise<RssArticleDto> {
  const res = await apiRequest<{ article: RssArticleDto }>(
    `/api/v1/rss/articles/${encodeURIComponent(articleId)}`,
    {
      method: 'PUT',
      body: patch,
      signal,
    },
  );
  return res.article;
}

export async function fetchRssPhrasesApi(
  options?: { projectId?: string; days?: number; limit?: number },
  signal?: AbortSignal,
): Promise<RssPhrasesResponseDto> {
  const qs = new URLSearchParams();
  if (options?.projectId) qs.set('projectId', options.projectId);
  if (options?.days) qs.set('days', String(options.days));
  if (options?.limit) qs.set('limit', String(options.limit));
  const query = qs.toString();
  return apiRequest<RssPhrasesResponseDto>(`/api/v1/rss/phrases${query ? `?${query}` : ''}`, { signal });
}

export async function fetchIdeasApi(
  options?: {
    projectId?: string;
    onlyGlobalVault?: boolean;
    status?: string;
    priority?: string;
    sourceType?: string;
    linkState?: string;
    search?: string;
  },
  signal?: AbortSignal,
): Promise<IdeaDto[]> {
  const qs = new URLSearchParams();
  if (options?.projectId) qs.set('projectId', options.projectId);
  if (options?.onlyGlobalVault) qs.set('onlyGlobalVault', 'true');
  if (options?.status && options.status !== 'all') qs.set('status', options.status);
  if (options?.priority && options.priority !== 'all') qs.set('priority', options.priority);
  if (options?.sourceType && options.sourceType !== 'all') qs.set('sourceType', options.sourceType);
  if (options?.linkState && options.linkState !== 'all') qs.set('linkState', options.linkState);
  if (options?.search?.trim()) qs.set('search', options.search.trim());
  const query = qs.toString();
  const res = await apiRequest<{ items: IdeaDto[] }>(`/api/v1/ideas${query ? `?${query}` : ''}`, { signal });
  return res.items;
}

export async function createIdeaApi(payload: CreateIdeaPayload, signal?: AbortSignal): Promise<IdeaDto> {
  const res = await apiRequest<{ idea: IdeaDto }>('/api/v1/ideas', {
    method: 'POST',
    body: payload,
    signal,
  });
  return res.idea;
}

export async function fetchIdeaDetailApi(ideaId: string, signal?: AbortSignal): Promise<IdeaDto> {
  const res = await apiRequest<{ idea: IdeaDto }>(`/api/v1/ideas/${encodeURIComponent(ideaId)}`, { signal });
  return res.idea;
}

export async function updateIdeaCoreApi(
  ideaId: string,
  patch: UpdateIdeaCorePayload,
  signal?: AbortSignal,
): Promise<IdeaDto> {
  const res = await apiRequest<{ idea: IdeaDto }>(`/api/v1/ideas/${encodeURIComponent(ideaId)}`, {
    method: 'PUT',
    body: patch,
    signal,
  });
  return res.idea;
}

export async function deleteIdeaApi(ideaId: string, signal?: AbortSignal): Promise<void> {
  await apiRequest<{ deletedIdeaId: string }>(`/api/v1/ideas/${encodeURIComponent(ideaId)}`, {
    method: 'DELETE',
    signal,
  });
}

export async function upsertProjectIdeaLinkApi(
  ideaId: string,
  projectId: string,
  patch: UpsertProjectIdeaLinkPayload,
  signal?: AbortSignal,
): Promise<IdeaDto> {
  const res = await apiRequest<{ idea: IdeaDto }>(
    `/api/v1/ideas/${encodeURIComponent(ideaId)}/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PUT',
      body: patch,
      signal,
    },
  );
  return res.idea;
}

export async function detachIdeaFromProjectApi(
  ideaId: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<IdeaDto> {
  const res = await apiRequest<{ idea: IdeaDto }>(
    `/api/v1/ideas/${encodeURIComponent(ideaId)}/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'DELETE',
      signal,
    },
  );
  return res.idea;
}

export async function fetchProjectCompetitorsApi(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectCompetitorsResponseDto> {
  return apiRequest<ProjectCompetitorsResponseDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/competitors`,
    { signal },
  );
}

export async function addProjectCompetitorApi(
  projectId: string,
  identifier: string,
  notes = '',
  signal?: AbortSignal,
): Promise<ProjectCompetitorsResponseDto> {
  return apiRequest<ProjectCompetitorsResponseDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/competitors`,
    {
      method: 'POST',
      body: { identifier, notes },
      signal,
    },
  );
}

export async function updateProjectCompetitorApi(
  projectId: string,
  channelId: string,
  patch: { status?: 'active' | 'paused' | 'error'; notes?: string },
  signal?: AbortSignal,
): Promise<ProjectCompetitorsResponseDto> {
  return apiRequest<ProjectCompetitorsResponseDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/competitors/${encodeURIComponent(channelId)}`,
    {
      method: 'PATCH',
      body: patch,
      signal,
    },
  );
}

export async function refreshAllProjectCompetitorsApi(
  projectId: string,
  signal?: AbortSignal,
): Promise<CompetitorRefreshResponseDto> {
  return apiRequest<CompetitorRefreshResponseDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/competitors/refresh-all`,
    {
      method: 'POST',
      signal,
    },
  );
}

export async function refreshSingleProjectCompetitorApi(
  projectId: string,
  channelId: string,
  signal?: AbortSignal,
): Promise<CompetitorRefreshResponseDto> {
  return apiRequest<CompetitorRefreshResponseDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/competitors/${encodeURIComponent(channelId)}/refresh`,
    {
      method: 'POST',
      signal,
    },
  );
}

export async function deleteProjectCompetitorApi(
  projectId: string,
  channelId: string,
  signal?: AbortSignal,
): Promise<ProjectCompetitorsResponseDto> {
  return apiRequest<ProjectCompetitorsResponseDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/competitors/${encodeURIComponent(channelId)}`,
    {
      method: 'DELETE',
      signal,
    },
  );
}

export async function fetchProjectBreakoutVideosApi(
  projectId: string,
  options?: {
    daysWindow?: number | null;
    sourceFormat?: 'all' | 'long_form' | 'shorts' | 'unknown';
    includeManual?: boolean;
    minViews?: number | null;
    onlyFlagged?: boolean;
    sortBy?: 'viewCount' | 'likeCount' | 'commentCount' | 'publishedAt' | 'durationSeconds';
    sortDir?: 'desc' | 'asc';
  },
  signal?: AbortSignal,
): Promise<BreakoutVideosResponseDto> {
  const qs = new URLSearchParams();
  if (options?.daysWindow && options.daysWindow > 0) qs.set('daysWindow', String(options.daysWindow));
  if (options?.sourceFormat) qs.set('sourceFormat', options.sourceFormat);
  if (options?.includeManual) qs.set('includeManual', 'true');
  if (options?.minViews && options.minViews > 0) qs.set('minViews', String(options.minViews));
  if (options?.onlyFlagged) qs.set('onlyFlagged', 'true');
  if (options?.sortBy) qs.set('sortBy', options.sortBy);
  if (options?.sortDir) qs.set('sortDir', options.sortDir);
  const query = qs.toString();
  return apiRequest<BreakoutVideosResponseDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/breakout-videos${query ? `?${query}` : ''}`,
    { signal },
  );
}

export async function updateVideoBreakoutApi(
  projectId: string,
  videoId: string,
  patch: { flagged?: boolean; notes?: string },
  signal?: AbortSignal,
): Promise<{ projectId: string; videoId: string; flagged: boolean; notes: string; markedAt: string | null }> {
  return apiRequest<{ projectId: string; videoId: string; flagged: boolean; notes: string; markedAt: string | null }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/videos/${encodeURIComponent(videoId)}/breakout`,
    {
      method: 'PUT',
      body: patch,
      signal,
    },
  );
}

export async function fetchProjectKeywordsApi(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectKeywordsResponseDto> {
  return apiRequest<ProjectKeywordsResponseDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/keywords`,
    { signal },
  );
}

export async function createProjectKeywordApi(
  projectId: string,
  payload: { keyword: string; priority: 'high' | 'medium' | 'low'; notes?: string },
  signal?: AbortSignal,
): Promise<ProjectKeywordDto> {
  const res = await apiRequest<{ item: ProjectKeywordDto }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/keywords`,
    {
      method: 'POST',
      body: payload,
      signal,
    },
  );
  return res.item;
}

export async function updateProjectKeywordApi(
  projectId: string,
  keywordId: string,
  patch: { priority?: 'high' | 'medium' | 'low'; notes?: string },
  signal?: AbortSignal,
): Promise<ProjectKeywordDto> {
  const res = await apiRequest<{ item: ProjectKeywordDto }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/keywords/${encodeURIComponent(keywordId)}`,
    {
      method: 'PATCH',
      body: patch,
      signal,
    },
  );
  return res.item;
}

export async function deleteProjectKeywordApi(
  projectId: string,
  keywordId: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiRequest<{ deleted: boolean; keywordId: string }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/keywords/${encodeURIComponent(keywordId)}`,
    {
      method: 'DELETE',
      signal,
    },
  );
}

export async function fetchKeywordDetailApi(
  projectId: string,
  keywordId: string,
  signal?: AbortSignal,
): Promise<KeywordDetailResponseDto> {
  return apiRequest<KeywordDetailResponseDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/keywords/${encodeURIComponent(keywordId)}`,
    { signal },
  );
}

export async function scanProjectKeywordsApi(
  projectId: string,
  keywordIds: string[],
  maxResults = 25,
  signal?: AbortSignal,
): Promise<ScanKeywordsResponseDto> {
  return apiRequest<ScanKeywordsResponseDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/keywords/scan`,
    {
      method: 'POST',
      body: { keywordIds, maxResults },
      signal,
    },
  );
}

export async function fetchGlobalOverviewApi(signal?: AbortSignal): Promise<GlobalOverviewDto> {
  return apiRequest<GlobalOverviewDto>('/api/v1/global/overview', { signal });
}

export async function fetchProjectOverviewApi(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectOverviewDto> {
  return apiRequest<ProjectOverviewDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/overview`,
    { signal },
  );
}

export async function refreshProjectWorkspaceApi(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectRefreshResponseDto> {
  return apiRequest<ProjectRefreshResponseDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/refresh`,
    {
      method: 'POST',
      signal,
    },
  );
}

export async function fetchSchedulerStatusApi(signal?: AbortSignal): Promise<SchedulerStatusDto> {
  return apiRequest<SchedulerStatusDto>('/api/v1/system/scheduler-status', { signal });
}


