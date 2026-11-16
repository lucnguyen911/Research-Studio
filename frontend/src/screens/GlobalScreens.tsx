import React, { useEffect, useRef, useState } from 'react';
import {
  ApiClientError,
  fetchCachedTrendsApi,
  fetchGlobalCategoriesApi,
  fetchGlobalOverviewApi,
  fetchRssArticlesApi,
  fetchRssPhrasesApi,
  fetchSearchSessionDetailApi,
  fetchSearchSessionsApi,
  isAbortError,
  refreshGlobalTrendsApi,
  runFreeSearchApi,
  updateRssArticleApi,
} from '../api/client';
import { formatDateTimeVi, mapYoutubeVideoDtoToItem } from '../api/mappers';
import type {
  GlobalOverviewDto,
  RssArticleDto,
  RssPhrasesResponseDto,
  SearchSessionDto,
  TrendsResponseDto,
  YoutubeCategoryDto,
  YoutubeChannelDto,
} from '../api/types';
import { IDEA_STATUS_LABELS, formatInt } from '../prototype/demoData';
import type { IdeaSourceType, VideoItem } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace } from '../state/workspaceContext';
import { SparklineCell } from '../components/SparklineCell';
import { EmptyStateCard, GlobalModeBanners, LoadingSkeletonCard } from '../components/StatusViews';
import { VideoResearchTable } from '../components/VideoResearchTable';
import { ConfirmDeleteModal } from '../components/Modals';

const overviewIconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const OverviewShortcutIcon: React.FC<{ kind: 'trends' | 'search' | 'news' | 'ideas' }> = ({ kind }) => {
  switch (kind) {
    case 'trends':
      return (
        <svg {...overviewIconProps}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      );
    case 'search':
      return (
        <svg {...overviewIconProps}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case 'news':
      return (
        <svg {...overviewIconProps}>
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'ideas':
      return (
        <svg {...overviewIconProps}>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </svg>
      );
  }
};

export const GlobalOverviewScreen: React.FC = () => {
  const { currentEntry, navigate } = useAppNavigation();
  const {
    isBootstrapping,
    backendOnline,
    systemSettings,
    quotaStatus,
    projects,
    ideas,
    refreshWorkspaceStatus,
    setCreateProjectModalOpen,
  } = usePrototypeWorkspace();
  const [refreshing, setRefreshing] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [overviewState, setOverviewState] = useState<{
    key: string;
    data: GlobalOverviewDto | null;
    error: string | null;
  }>({ key: '', data: null, error: null });

  const overviewKey = `${reloadNonce}:${projects.length}:${ideas.length}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchGlobalOverviewApi(controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setOverviewState({ key: overviewKey, data: res, error: null });
        }
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setOverviewState({
          key: overviewKey,
          data: null,
          error: err instanceof ApiClientError ? err.message : 'Không tải được số liệu tổng quan.',
        });
      });
    return () => {
      controller.abort();
    };
  }, [overviewKey]);

  const ov = overviewState.data;
  const overviewError = overviewState.key === overviewKey ? overviewState.error : null;
  const activeQuota = ov?.quota ?? quotaStatus;
  const activeProject = projects.find((p) => p.id === currentEntry.projectId) ?? projects[0] ?? null;

  const recentIdeas = [...ideas]
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 4);
  const latestArticles = ov?.latestRssArticles.slice(0, 4) ?? [];

  const handleRefresh = () => {
    void (async () => {
      setRefreshing(true);
      try {
        await refreshWorkspaceStatus();
        setReloadNonce((n) => n + 1);
      } finally {
        setRefreshing(false);
      }
    })();
  };

  const quotaExhausted = activeQuota.searchQueries.exhausted || activeQuota.generalData.exhausted;

  const contextualBanner =
    !isBootstrapping && !backendOnline
      ? {
          danger: true,
          message: 'Không thể kết nối dịch vụ dữ liệu cục bộ.',
          actionLabel: 'Thử lại',
          onAction: handleRefresh,
        }
      : overviewError
        ? {
            danger: true,
            message: overviewError,
            actionLabel: 'Thử lại',
            onAction: handleRefresh,
          }
        : systemSettings.apiKeyStatus === 'unreadable'
          ? {
              danger: true,
              message: 'Không đọc được YouTube API Key đã lưu.',
              actionLabel: 'Cập nhật khóa',
              onAction: () => navigate('system-settings'),
            }
          : quotaExhausted
            ? {
                danger: false,
                message: 'Hạn mức YouTube API hôm nay đã hết (làm mới lúc 00:00 PT). Dữ liệu đã lưu và RSS vẫn hoạt động.',
                actionLabel: 'Xem cài đặt',
                onAction: () => navigate('system-settings'),
              }
            : null;

  const shortcuts: Array<{
    id: 'global-trends' | 'global-search' | 'global-news' | 'global-ideas';
    icon: 'trends' | 'search' | 'news' | 'ideas';
    title: string;
    desc: string;
  }> = [
    {
      id: 'global-trends',
      icon: 'trends',
      title: 'Xu hướng',
      desc: 'Video thịnh hành theo quốc gia',
    },
    {
      id: 'global-search',
      icon: 'search',
      title: 'Nghiên cứu',
      desc: 'Tìm kiếm video và kênh',
    },
    {
      id: 'global-news',
      icon: 'news',
      title: 'Tin tức',
      desc: 'Theo dõi nguồn tin RSS',
    },
    {
      id: 'global-ideas',
      icon: 'ideas',
      title: 'Ý tưởng',
      desc: 'Kho lưu trữ chủ đề nội dung',
    },
  ];

  return (
    <div className="rs-container">
      <div className="rs-page-header" style={{ alignItems: 'center' }}>
        <h1 className="rs-page-title">Tổng quan</h1>
        <div className="rs-overview-actions">
          <button
            type="button"
            className="rs-btn rs-btn-secondary"
            disabled={refreshing}
            onClick={handleRefresh}
          >
            <svg {...overviewIconProps} width={14} height={14}>
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
            {refreshing ? 'Đang tải...' : 'Làm mới'}
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            onClick={() => setCreateProjectModalOpen(true)}
          >
            + Tạo Project
          </button>
        </div>
      </div>

      {contextualBanner && (
        <div
          className={`rs-banner ${contextualBanner.danger ? 'rs-banner-danger' : 'rs-banner-warn'}`}
          role="alert"
        >
          <div style={{ fontSize: '13.5px' }}>{contextualBanner.message}</div>
          <button
            type="button"
            className="rs-btn rs-btn-sm rs-btn-secondary"
            onClick={contextualBanner.onAction}
          >
            {contextualBanner.actionLabel}
          </button>
        </div>
      )}

      {isBootstrapping ? (
        <LoadingSkeletonCard />
      ) : (
        <>
          <div className="rs-grid-3">
            <section className="rs-card rs-stat-card">
              <div className="rs-stat-top">
                <span className="rs-stat-label">Project</span>
                {activeProject && (
                  <button
                    type="button"
                    className="rs-link-quiet"
                    onClick={() => navigate('project-overview')}
                  >
                    Mở →
                  </button>
                )}
              </div>
              <div className="rs-stat-value">{projects.length}</div>
              <div className="rs-stat-meta" title={activeProject?.name ?? undefined}>
                {projects.length === 0
                  ? 'Chưa có dự án nào'
                  : activeProject
                    ? `Đang chọn: ${activeProject.name}`
                    : `${projects.length} dự án`}
              </div>
            </section>

            <section className="rs-card rs-stat-card">
              <div className="rs-stat-top">
                <span className="rs-stat-label">Ý tưởng</span>
                <button
                  type="button"
                  className="rs-link-quiet"
                  onClick={() => navigate('global-ideas')}
                >
                  Mở kho →
                </button>
              </div>
              <div className="rs-stat-value">{ov?.ideasTotalCount ?? ideas.length}</div>
              <div className="rs-stat-meta">
                {(ov?.ideasUnlinkedCount ?? 0) > 0
                  ? `${ov?.ideasUnlinkedCount} chưa gắn Project`
                  : 'Trong kho ý tưởng'}
              </div>
            </section>

            <section className="rs-card rs-stat-card">
              <div className="rs-stat-top">
                <span className="rs-stat-label">Tin tức mới</span>
                <button
                  type="button"
                  className="rs-link-quiet"
                  onClick={() => navigate('global-news')}
                >
                  Xem tin →
                </button>
              </div>
              <div className="rs-stat-value">{ov?.rssSummary.articlesCount ?? 0}</div>
              <div className="rs-stat-meta">
                {(ov?.rssSummary.errorCount ?? 0) > 0
                  ? `${ov?.rssSummary.enabled ?? 0} nguồn đang bật · ${ov?.rssSummary.errorCount} nguồn lỗi`
                  : `${ov?.rssSummary.enabled ?? 0} nguồn đang theo dõi`}
              </div>
            </section>
          </div>

          <div className="rs-grid-2">
            <section className="rs-card rs-section-card">
              <div className="rs-section-header">
                <h2 className="rs-section-heading">Ý tưởng gần đây</h2>
                <button
                  type="button"
                  className="rs-link-quiet"
                  onClick={() => navigate('global-ideas')}
                >
                  Xem tất cả
                </button>
              </div>

              {recentIdeas.length === 0 ? (
                <div className="rs-clean-empty">
                  <span>Chưa có ý tưởng nào được lưu.</span>
                  <button
                    type="button"
                    className="rs-btn rs-btn-sm rs-btn-secondary"
                    onClick={() => navigate('global-ideas')}
                  >
                    Thêm ý tưởng
                  </button>
                </div>
              ) : (
                <div className="rs-clean-list">
                  {recentIdeas.map((idea) => {
                    const linkedCount = Object.keys(idea.projectLinks).length;
                    return (
                      <div key={idea.id} className="rs-clean-row">
                        <button
                          type="button"
                          className="rs-title-link"
                          style={{ fontSize: '13.5px' }}
                          onClick={() => navigate('idea-detail', { params: { ideaId: idea.id } })}
                        >
                          {idea.title}
                        </button>
                        <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
                          {formatDateTimeVi(idea.updatedAt)} ·{' '}
                          {linkedCount > 0 ? `${linkedCount} Project` : 'Kho chung'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rs-card rs-section-card">
              <div className="rs-section-header">
                <h2 className="rs-section-heading">Tin tức mới nhất</h2>
                <button
                  type="button"
                  className="rs-link-quiet"
                  onClick={() => navigate('global-news')}
                >
                  Xem tất cả
                </button>
              </div>

              {latestArticles.length === 0 ? (
                <div className="rs-clean-empty">
                  <span>Chưa có bài viết mới từ các nguồn RSS.</span>
                  <button
                    type="button"
                    className="rs-btn rs-btn-sm rs-btn-secondary"
                    onClick={() => navigate('global-news')}
                  >
                    Thêm nguồn tin
                  </button>
                </div>
              ) : (
                <div className="rs-clean-list">
                  {latestArticles.map((art) => (
                    <div key={art.id} className="rs-clean-row">
                      <button
                        type="button"
                        className="rs-title-link"
                        style={{ fontSize: '13.5px' }}
                        onClick={() => navigate('article-detail', { params: { articleId: art.id } })}
                      >
                        {art.title}
                      </button>
                      <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
                        Nguồn: RSS · {art.feedName} · {formatDateTimeVi(art.publishedAt ?? art.fetchedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="rs-shortcut-section-label">Lối tắt</div>
          <div className="rs-grid-4">
            {shortcuts.map((sc) => (
              <button
                key={sc.id}
                type="button"
                className="rs-shortcut-tile"
                onClick={() => navigate(sc.id)}
              >
                <span className="rs-shortcut-icon">
                  <OverviewShortcutIcon kind={sc.icon} />
                </span>
                <div>
                  <div className="rs-shortcut-title">{sc.title}</div>
                  <div className="rs-shortcut-desc">{sc.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const TrendDiscoveryScreen: React.FC = () => {
  const { currentEntry, updateViewState, navigate } = useAppNavigation();
  const {
    backendOnline,
    systemSettings,
    quotaStatus,
    registerVideosInMemory,
    syncQuotaStatus,
    pushToast,
  } = usePrototypeWorkspace();

  const vs = currentEntry.viewState;
  const region = vs.regionCodeFilter ?? systemSettings.defaultRegionCode ?? 'VN';
  const category = vs.categoryFilter ?? 'all';
  const cacheKey = `${region}:${category}`;

  const [categories, setCategories] = useState<YoutubeCategoryDto[]>([
    { id: 'all', title: 'Tất cả danh mục' },
  ]);
  const [trendsState, setTrendsState] = useState<{
    key: string;
    data: TrendsResponseDto | null;
    videos: VideoItem[];
    error: string | null;
  }>({ key: '', data: null, videos: [], error: null });
  const [refreshing, setRefreshing] = useState(false);
  const refreshAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchGlobalCategoriesApi({ regionCode: region, language: systemSettings.defaultRelevanceLanguage, signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) {
          setCategories(res.items);
        }
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
    };
  }, [region, systemSettings.defaultRelevanceLanguage]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCachedTrendsApi(region, category, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const mapped = res.videos.map(mapYoutubeVideoDtoToItem);
        registerVideosInMemory(mapped);
        setTrendsState({ key: cacheKey, data: res, videos: mapped, error: null });
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        const msg = err instanceof ApiClientError ? err.message : 'Không tải được cache Xu hướng từ SQLite.';
        setTrendsState({ key: cacheKey, data: null, videos: [], error: msg });
      });
    return () => {
      controller.abort();
      refreshAbortRef.current?.abort();
    };
  }, [region, category, cacheKey, registerVideosInMemory]);

  const isLoading = trendsState.key !== cacheKey && trendsState.error === null;
  const trendVideos = trendsState.key === cacheKey ? trendsState.videos : [];
  const fetchedAtDisplay = trendsState.key === cacheKey ? formatDateTimeVi(trendsState.data?.fetchedAt) : '—';

  const blocked =
    !backendOnline ||
    !systemSettings.legalConsentAccepted ||
    systemSettings.apiKeyStatus !== 'configured' ||
    quotaStatus.generalData.exhausted ||
    refreshing;

  const handleRefreshTrends = () => {
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    setRefreshing(true);
    void refreshGlobalTrendsApi({ regionCode: region, categoryId: category, maxResults: 25 }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const mapped = res.videos.map(mapYoutubeVideoDtoToItem);
        registerVideosInMemory(mapped);
        setTrendsState({ key: cacheKey, data: res, videos: mapped, error: null });
        void syncQuotaStatus();
        pushToast('success', `Đã nạp ${mapped.length} video xu hướng ${region} (-1 unit General Data API).`);
      })
      .catch((err) => {
        if (isAbortError(err)) {
          pushToast('success', 'Đã hủy tác vụ làm mới Khám phá xu hướng.');
          return;
        }
        void syncQuotaStatus();
        pushToast('error', err instanceof ApiClientError ? err.message : 'Không thể làm mới Khám phá xu hướng.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRefreshing(false);
        }
      });
  };

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Khám phá xu hướng (G2)</h1>
            <span className="rs-badge">Nguồn: YouTube Data API (mostPopular)</span>
          </div>
          <p className="rs-page-subtitle">
            Cập nhật gần nhất: {fetchedAtDisplay} · Lưu đệm tối đa 30 ngày lịch · 0 lượt Search Queries
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {refreshing ? (
            <button
              type="button"
              className="rs-btn rs-btn-danger"
              onClick={() => {
                refreshAbortRef.current?.abort();
                setRefreshing(false);
              }}
            >
              Hủy (Cancel)
            </button>
          ) : (
            <button
              type="button"
              className="rs-btn rs-btn-primary"
              disabled={blocked}
              onClick={handleRefreshTrends}
            >
              Làm mới xu hướng (1 unit API)
            </button>
          )}
        </div>
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      <div className="rs-toolbar">
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Quốc gia:</span>
          <select
            className="rs-select rs-select-compact"
            value={region}
            onChange={(e) => updateViewState({ regionCodeFilter: e.target.value, page: 1 })}
          >
            <option value="VN">VN — Việt Nam</option>
            <option value="US">US — Hoa Kỳ</option>
            <option value="JP">JP — Nhật Bản</option>
          </select>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Danh mục:</span>
          <select
            className="rs-select rs-select-compact"
            value={category}
            onChange={(e) => updateViewState({ categoryFilter: e.target.value, page: 1 })}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.title}
              </option>
            ))}
          </select>
        </label>
        <a
          href="https://www.youtube.com/feed/trending"
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginLeft: 'auto', fontSize: '12.5px', fontWeight: 600, color: 'var(--rs-accent-text)' }}
        >
          Dữ liệu thuộc YouTube ↗
        </a>
      </div>

      {isLoading ? (
        <LoadingSkeletonCard label="Đang đọc dữ liệu Xu hướng lưu đệm <= 30 ngày..." />
      ) : (
        <VideoResearchTable
          videos={trendVideos}
          fromScreen="global-trends"
          emptyTitle="Chưa có dữ liệu Xu hướng còn hạn cho bộ lọc này"
          emptyDescription={
            systemSettings.apiKeyStatus !== 'configured' || !systemSettings.legalConsentAccepted
              ? 'Vui lòng xác nhận Pháp lý và lưu YouTube API Key trong Cài đặt hệ thống để tải Xu hướng.'
              : 'Bấm "Làm mới xu hướng (1 unit API)" ở góc phải để lấy danh sách video nổi bật từ YouTube.'
          }
        />
      )}

      {!isLoading && trendVideos.length === 0 && systemSettings.apiKeyStatus !== 'configured' && (
        <div>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={() => navigate('system-settings')}>
            Đi tới Cài đặt API Key &amp; Pháp lý →
          </button>
        </div>
      )}
    </div>
  );
};

export const FreeResearchScreen: React.FC = () => {
  const { currentEntry, navigate } = useAppNavigation();
  const {
    backendOnline,
    systemSettings,
    quotaStatus,
    projects,
    addKeyword,
    addChannelToProject,
    registerVideosInMemory,
    syncQuotaStatus,
    pushToast,
  } = usePrototypeWorkspace();

  const [queryInput, setQueryInput] = useState('');
  const [objectType, setObjectType] = useState<'video' | 'channel'>('video');
  const [publishedWindow, setPublishedWindow] = useState<'any' | '24h' | '7d' | '30d'>('any');
  const [regionCode, setRegionCode] = useState(systemSettings.defaultRegionCode || 'VN');
  const [relevanceLanguage, setRelevanceLanguage] = useState(systemSettings.defaultRelevanceLanguage || 'vi');
  const [orderBy, setOrderBy] = useState<'relevance' | 'date' | 'viewCount' | 'rating'>('relevance');
  const [sessions, setSessions] = useState<SearchSessionDto[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [activeSession, setActiveSession] = useState<SearchSessionDto | null>(null);
  const [resultVideos, setResultVideos] = useState<VideoItem[]>([]);
  const [resultChannels, setResultChannels] = useState<YoutubeChannelDto[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeProject = projects.find((p) => p.id === currentEntry.projectId) ?? projects[0] ?? null;

  const computePublishedAfter = (win: 'any' | '24h' | '7d' | '30d'): string | null => {
    if (win === 'any') return null;
    const days = win === '24h' ? 1 : win === '7d' ? 7 : 30;
    return new Date(Date.now() - days * 86_400_000).toISOString();
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchSearchSessionsApi(controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setSessions(list);
        setSessionsLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSessionsLoaded(true);
        }
      });
    return () => {
      controller.abort();
      abortRef.current?.abort();
    };
  }, []);

  const openSavedSession = (sessionId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingSession(true);
    setNextPageToken(null);
    void fetchSearchSessionDetailApi(sessionId, controller.signal)
      .then((detail) => {
        if (controller.signal.aborted) return;
        const mapped = detail.videos.map(mapYoutubeVideoDtoToItem);
        registerVideosInMemory(mapped);
        setActiveSession(detail.session);
        setObjectType(detail.session.objectType);
        setQueryInput(detail.session.query);
        setResultVideos(mapped);
        setResultChannels(detail.channels ?? []);
        pushToast('success', `Đã mở lại phiên "${detail.session.query}" từ SQLite (0 quota YouTube).`);
      })
      .catch((err) => {
        if (!isAbortError(err)) {
          pushToast('error', err instanceof ApiClientError ? err.message : 'Không mở được phiên tìm kiếm cũ.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingSession(false);
        }
      });
  };

  const handleRunSearch = () => {
    if (!queryInput.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setNextPageToken(null);
    const publishedAfter = computePublishedAfter(publishedWindow);
    void runFreeSearchApi(
      {
        query: queryInput.trim(),
        objectType,
        regionCode,
        relevanceLanguage,
        publishedAfter,
        orderBy,
        maxResults: 25,
      },
      controller.signal,
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        const mapped = res.videos.map(mapYoutubeVideoDtoToItem);
        registerVideosInMemory(mapped);
        setActiveSession(res.session);
        setResultVideos(mapped);
        setResultChannels(res.channels ?? []);
        setNextPageToken(res.nextPageToken ?? null);
        setSessions((prev) => [res.session, ...prev.filter((s) => s.id !== res.session.id)]);
        void syncQuotaStatus();
        const count = res.session.objectType === 'channel' ? (res.channels?.length ?? 0) : mapped.length;
        const unitLabel = res.session.objectType === 'channel' ? 'kênh' : 'video';
        pushToast(
          'success',
          `Đã tìm "${res.session.query}" (${count} ${unitLabel}) — 1 lượt Search Queries + General Data API.`,
        );
      })
      .catch((err) => {
        if (isAbortError(err)) {
          pushToast('success', 'Đã hủy lệnh tìm kiếm.');
          return;
        }
        void syncQuotaStatus();
        pushToast('error', err instanceof ApiClientError ? err.message : 'Tìm kiếm YouTube thất bại.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      });
  };

  const handleLoadNextPage = () => {
    if (!activeSession || !nextPageToken) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingMore(true);
    const sessionOrder =
      activeSession.orderBy === 'date' || activeSession.orderBy === 'viewCount' || activeSession.orderBy === 'rating'
        ? activeSession.orderBy
        : 'relevance';
    void runFreeSearchApi(
      {
        query: activeSession.query,
        objectType: activeSession.objectType,
        regionCode: activeSession.regionCode,
        relevanceLanguage: activeSession.relevanceLanguage,
        publishedAfter: activeSession.publishedAfter,
        orderBy: sessionOrder,
        maxResults: 25,
        pageToken: nextPageToken,
        appendSessionId: activeSession.id,
      },
      controller.signal,
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        const mapped = res.videos.map(mapYoutubeVideoDtoToItem);
        registerVideosInMemory(mapped);
        if (res.session.objectType === 'channel') {
          setResultChannels(res.channels ?? []);
        } else {
          setResultVideos(mapped);
        }
        setActiveSession(res.session);
        setNextPageToken(res.nextPageToken ?? null);
        setSessions((prev) => [res.session, ...prev.filter((s) => s.id !== res.session.id)]);
        void syncQuotaStatus();
        const totalCount = res.session.objectType === 'channel' ? (res.channels?.length ?? 0) : mapped.length;
        pushToast('success', `Đã tải thêm trang kế tiếp (tổng ${totalCount} kết quả · 1 Search + 1 General API).`);
      })
      .catch((err) => {
        if (isAbortError(err)) {
          pushToast('success', 'Đã hủy tải trang kế tiếp.');
          return;
        }
        void syncQuotaStatus();
        pushToast('error', err instanceof ApiClientError ? err.message : 'Tải trang kế tiếp thất bại.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingMore(false);
        }
      });
  };

  const quotaOrConnectionBlocked =
    !backendOnline ||
    !systemSettings.legalConsentAccepted ||
    systemSettings.apiKeyStatus !== 'configured' ||
    quotaStatus.searchQueries.exhausted ||
    quotaStatus.generalData.exhausted;

  const searchBlocked = !queryInput.trim() || quotaOrConnectionBlocked || searching || loadingMore;
  const displayObjectType = activeSession?.objectType ?? objectType;

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Nghiên cứu tự do (G3)</h1>
            <span className="rs-badge">Chi phí tìm mới: 1 lượt Search Queries + 1 unit General Data API</span>
          </div>
          <p className="rs-page-subtitle">
            Hỗ trợ tìm Video &amp; Kênh YouTube chỉ khi bạn bấm Tìm (0 auto-retry trên search.list); mở lại phiên cũ &lt;= 30 ngày tốn 0 quota
          </p>
        </div>
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      <div className="rs-toolbar">
        <input
          type="text"
          aria-label="Nhập từ khóa tìm kiếm YouTube"
          className="rs-input"
          style={{ flex: '1 1 220px' }}
          placeholder="Nhập từ khóa muốn khảo sát trên YouTube..."
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !searchBlocked) {
              handleRunSearch();
            }
          }}
        />
        <select
          aria-label="Loại kết quả tìm kiếm"
          className="rs-select rs-select-compact"
          value={objectType}
          onChange={(e) => setObjectType(e.target.value as 'video' | 'channel')}
        >
          <option value="video">Tìm Video</option>
          <option value="channel">Tìm Kênh</option>
        </select>
        <select
          aria-label="Khoảng thời gian đăng"
          className="rs-select rs-select-compact"
          value={publishedWindow}
          onChange={(e) => setPublishedWindow(e.target.value as 'any' | '24h' | '7d' | '30d')}
        >
          <option value="any">Mọi thời điểm</option>
          <option value="24h">24 giờ qua</option>
          <option value="7d">7 ngày qua</option>
          <option value="30d">30 ngày qua</option>
        </select>
        <select
          aria-label="Quốc gia tìm kiếm"
          className="rs-select rs-select-compact"
          value={regionCode}
          onChange={(e) => setRegionCode(e.target.value)}
        >
          <option value="VN">VN</option>
          <option value="US">US</option>
          <option value="JP">JP</option>
        </select>
        <select
          aria-label="Ngôn ngữ tìm kiếm"
          className="rs-select rs-select-compact"
          value={relevanceLanguage}
          onChange={(e) => setRelevanceLanguage(e.target.value)}
        >
          <option value="vi">vi</option>
          <option value="en">en</option>
        </select>
        <select
          aria-label="Thứ tự trả kết quả từ YouTube"
          className="rs-select rs-select-compact"
          value={orderBy}
          onChange={(e) => setOrderBy(e.target.value as 'relevance' | 'date' | 'viewCount' | 'rating')}
        >
          <option value="relevance">Liên quan nhất</option>
          <option value="date">Mới nhất (date)</option>
          <option value="viewCount">Nhiều lượt xem (viewCount)</option>
        </select>

        {searching || loadingMore ? (
          <button
            type="button"
            className="rs-btn rs-btn-danger"
            onClick={() => {
              abortRef.current?.abort();
              setSearching(false);
              setLoadingMore(false);
            }}
          >
            Hủy (Cancel)
          </button>
        ) : (
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            disabled={searchBlocked}
            onClick={handleRunSearch}
          >
            Tìm trên YouTube (1 Search + 1 API)
          </button>
        )}

        {activeProject && queryInput.trim() && (
          <button
            type="button"
            className="rs-btn rs-btn-secondary"
            onClick={() => {
              void addKeyword(activeProject.id, queryInput.trim(), 'medium');
            }}
          >
            + Lưu từ khóa vào {activeProject.name}
          </button>
        )}
      </div>

      <div className="rs-card-subtle" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <strong style={{ fontSize: '13px' }}>Phiên tìm đã lưu (&lt;= 30 ngày · Mở lại 0 quota):</strong>
        {!sessionsLoaded ? (
          <span style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>Đang tải lịch sử phiên...</span>
        ) : sessions.length === 0 ? (
          <span style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
            Chưa có phiên tìm kiếm nào còn hạn lưu đệm trên SQLite.
          </span>
        ) : (
          sessions.map((sess) => (
            <button
              key={sess.id}
              type="button"
              className={`rs-pill-tab ${activeSession?.id === sess.id ? 'is-active' : ''}`}
              onClick={() => openSavedSession(sess.id)}
            >
              “{sess.query}” [{sess.objectType === 'channel' ? 'Kênh' : 'Video'} · {sess.regionCode}] · {sess.resultCount} kq
            </button>
          ))
        )}
      </div>

      {searching || loadingSession ? (
        <LoadingSkeletonCard label="Đang tải kết quả tìm kiếm..." />
      ) : displayObjectType === 'channel' && resultChannels.length > 0 ? (
        <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: '15.5px' }}>
              Kết quả Kênh YouTube ({resultChannels.length})
            </h2>
            {nextPageToken && (
              <button
                type="button"
                className="rs-btn rs-btn-secondary rs-btn-sm"
                disabled={quotaOrConnectionBlocked || loadingMore}
                onClick={handleLoadNextPage}
              >
                {loadingMore ? 'Đang tải trang kế tiếp...' : 'Tải trang kế tiếp (1 Search + 1 API)'}
              </button>
            )}
          </div>
          <div className="rs-grid-2">
            {resultChannels.map((ch) => (
              <div
                key={ch.channelId}
                className="rs-card-subtle"
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <strong style={{ fontSize: '14.5px' }}>{ch.title || ch.channelId}</strong>
                    <div style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
                      {ch.handle || ch.channelId} {ch.country ? `· ${ch.country}` : ''}
                    </div>
                  </div>
                  <span className="rs-badge rs-tabular">
                    {formatInt(ch.subscriberCount)} sub · {formatInt(ch.videoCount)} video
                  </span>
                </div>
                {ch.description && (
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--rs-text-secondary)' }}>
                    {ch.description.length > 160 ? `${ch.description.slice(0, 159)}…` : ch.description}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="rs-btn rs-btn-secondary rs-btn-sm"
                    onClick={() => navigate('channel-detail', { params: { channelId: ch.channelId } })}
                  >
                    Chi tiết kênh
                  </button>
                  {activeProject && (
                    <button
                      type="button"
                      className="rs-btn rs-btn-primary rs-btn-sm"
                      onClick={() => {
                        void addChannelToProject(activeProject.id, ch.channelId);
                      }}
                    >
                      + Đối thủ vào {activeProject.name}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          <VideoResearchTable
            videos={resultVideos}
            fromScreen="global-search"
            emptyTitle="Chưa chọn hoặc chưa có kết quả tìm kiếm"
            emptyDescription={
              systemSettings.apiKeyStatus !== 'configured' || !systemSettings.legalConsentAccepted
                ? 'Vui lòng xác nhận Pháp lý & lưu API Key trong Cài đặt hệ thống, hoặc chọn một phiên tìm kiếm cũ phía trên.'
                : 'Nhập từ khóa và bấm "Tìm trên YouTube" (tiêu tốn 1 lượt Search Queries) hoặc mở lại phiên đã lưu (0 quota).'
            }
          />
          {nextPageToken && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="rs-btn rs-btn-secondary"
                disabled={quotaOrConnectionBlocked || loadingMore}
                onClick={handleLoadNextPage}
              >
                {loadingMore ? 'Đang tải trang kế tiếp...' : 'Tải trang kế tiếp (1 Search + 1 API)'}
              </button>
            </div>
          )}
          {resultVideos.length === 0 && systemSettings.apiKeyStatus !== 'configured' && (
            <div>
              <button type="button" className="rs-btn rs-btn-secondary" onClick={() => navigate('system-settings')}>
                Đi tới Cài đặt API Key &amp; Pháp lý →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const RssNewsScreen: React.FC = () => {
  const { currentEntry, navigate, updateViewState } = useAppNavigation();
  const {
    rssFeedDtos,
    addRssFeed,
    toggleRssFeedEnabled,
    retryRssFeed,
    deleteRssFeed,
    refreshAllRssFeeds,
    openSaveIdeaModal,
    pushToast,
  } = usePrototypeWorkspace();

  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [addingFeed, setAddingFeed] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [busyFeedId, setBusyFeedId] = useState<string | null>(null);
  const [confirmDeleteFeedId, setConfirmDeleteFeedId] = useState<string | null>(null);

  const [articlesState, setArticlesState] = useState<{
    queryKey: string;
    items: RssArticleDto[];
    phrases: RssPhrasesResponseDto | null;
    error: string | null;
  }>({ queryKey: '', items: [], phrases: null, error: null });
  const [reloadNonce, setReloadNonce] = useState(0);
  const refreshAbortRef = useRef<AbortController | null>(null);

  const vs = currentEntry.viewState;
  const queryKey = `${vs.selectedFeedId}|${vs.onlyBookmarked}|${vs.search}|${reloadNonce}`;

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchRssArticlesApi(
        {
          feedId: vs.selectedFeedId,
          onlyBookmarked: vs.onlyBookmarked,
          search: vs.search,
          limit: 120,
        },
        controller.signal,
      ),
      fetchRssPhrasesApi({ days: 7, limit: 10 }, controller.signal),
    ])
      .then(([articlesRes, phrasesRes]) => {
        if (controller.signal.aborted) return;
        setArticlesState({
          queryKey,
          items: articlesRes.items,
          phrases: phrasesRes,
          error: null,
        });
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setArticlesState({
          queryKey,
          items: [],
          phrases: null,
          error: err instanceof ApiClientError ? err.message : 'Không tải được dữ liệu RSS từ SQLite.',
        });
      });

    return () => {
      controller.abort();
      refreshAbortRef.current?.abort();
    };
  }, [vs.selectedFeedId, vs.onlyBookmarked, vs.search, queryKey]);

  const isLoading = articlesState.queryKey !== queryKey && articlesState.error === null;
  const articles = articlesState.queryKey === queryKey ? articlesState.items : [];
  const phrases = articlesState.queryKey === queryKey ? articlesState.phrases : null;
  const feedToDelete = rssFeedDtos.find((f) => f.id === confirmDeleteFeedId) ?? null;

  const handleToggleArticleBookmark = (art: RssArticleDto) => {
    void updateRssArticleApi(art.id, { bookmarked: !art.bookmarked })
      .then((updated) => {
        setArticlesState((prev) => ({
          ...prev,
          items: prev.items.map((item) => (item.id === art.id ? updated : item)),
        }));
        pushToast('success', updated.bookmarked ? 'Đã đánh dấu bài viết RSS.' : 'Đã bỏ đánh dấu bài viết.');
      })
      .catch((err) => {
        pushToast('error', err instanceof ApiClientError ? err.message : 'Không cập nhật được trạng thái bài viết.');
      });
  };

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Tin tức &amp; thảo luận (G4)</h1>
            <span className="rs-badge rs-badge-success">Nguồn: RSS / Atom (Dữ liệu ngoài YouTube · 0 quota)</span>
          </div>
          <p className="rs-page-subtitle">
            Kiểm tra SSRF &amp; làm sạch HTML an toàn · Cô lập nguồn lỗi theo từng feed · Đọc đầy đủ từ SQLite khi offline
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {refreshingAll ? (
            <button
              type="button"
              className="rs-btn rs-btn-danger"
              onClick={() => {
                refreshAbortRef.current?.abort();
                setRefreshingAll(false);
                pushToast('success', 'Đã hủy tác vụ làm mới RSS đang chạy.');
              }}
            >
              Hủy làm mới (Cancel)
            </button>
          ) : (
            <button
              type="button"
              className="rs-btn rs-btn-primary"
              disabled={rssFeedDtos.length === 0}
              onClick={() => {
                refreshAbortRef.current?.abort();
                const controller = new AbortController();
                refreshAbortRef.current = controller;
                setRefreshingAll(true);
                void refreshAllRssFeeds(controller.signal).finally(() => {
                  if (!controller.signal.aborted) {
                    setRefreshingAll(false);
                    setReloadNonce((n) => n + 1);
                  }
                });
              }}
            >
              Làm mới tất cả RSS đang bật (0 quota)
            </button>
          )}
        </div>
      </div>

      <GlobalModeBanners />

      <div className="rs-toolbar">
        <input
          type="url"
          aria-label="URL nguồn RSS hoặc Atom"
          className="rs-input"
          style={{ flex: '1 1 250px' }}
          placeholder="https://example.com/feed.xml (chỉ URL công khai)"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
        />
        <input
          type="text"
          aria-label="Tên hiển thị nguồn RSS"
          className="rs-input"
          style={{ width: 220 }}
          placeholder="Tên hiển thị nguồn..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="button"
          className="rs-btn rs-btn-secondary"
          disabled={!newUrl.trim() || addingFeed}
          onClick={() => {
            void (async () => {
              setAddingFeed(true);
              try {
                const created = await addRssFeed(newUrl, newName);
                if (created) {
                  setNewUrl('');
                  setNewName('');
                  await retryRssFeed(created.id);
                  setReloadNonce((n) => n + 1);
                }
              } finally {
                setAddingFeed(false);
              }
            })();
          }}
        >
          {addingFeed ? 'Đang kiểm tra SSRF...' : '+ Thêm & Tải nguồn RSS'}
        </button>
      </div>

      <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong style={{ fontSize: '14px' }}>
          Trạng thái nguồn RSS đã cấu hình ({rssFeedDtos.length}) — Cô lập lỗi theo từng feed:
        </strong>
        {rssFeedDtos.length === 0 ? (
          <span style={{ fontSize: '13px', color: 'var(--rs-text-muted)' }}>
            Chưa có nguồn RSS nào. Hãy dán URL nguồn RSS/Atom công khai phía trên để thu thập tin tức (0 quota YouTube).
          </span>
        ) : (
          <div className="rs-grid-2">
            {rssFeedDtos.map((feed) => {
              const hasError = feed.lastStatus === 'error';
              const isBusy = busyFeedId === feed.id;
              return (
                <div
                  key={feed.id}
                  className="rs-card-subtle"
                  style={{
                    borderColor: hasError ? 'var(--rs-danger-border)' : 'var(--rs-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong>{feed.name}</strong>
                    <span className={`rs-badge ${hasError ? 'rs-badge-danger' : 'rs-badge-success'}`}>
                      {hasError ? feed.lastErrorCode ?? 'Lỗi tải RSS' : `${feed.articleCount} bài · Hoạt động`}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)', wordBreak: 'break-all' }}>
                    {feed.url} · Lần kiểm tra cuối: {formatDateTimeVi(feed.lastFetchedAt)}
                  </div>
                  {hasError && feed.lastErrorMessage && (
                    <div style={{ fontSize: '12.5px', color: 'var(--rs-danger-text)' }}>
                      {feed.lastErrorMessage}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="rs-btn rs-btn-sm rs-btn-secondary"
                      disabled={isBusy}
                      onClick={() => {
                        void (async () => {
                          setBusyFeedId(feed.id);
                          try {
                            await toggleRssFeedEnabled(feed.id, !feed.enabled);
                          } finally {
                            setBusyFeedId(null);
                          }
                        })();
                      }}
                    >
                      {feed.enabled ? 'Tạm tắt' : 'Bật lại'}
                    </button>
                    <button
                      type="button"
                      className="rs-btn rs-btn-sm rs-btn-tinted"
                      disabled={isBusy}
                      onClick={() => {
                        void (async () => {
                          setBusyFeedId(feed.id);
                          try {
                            await retryRssFeed(feed.id);
                            setReloadNonce((n) => n + 1);
                          } finally {
                            setBusyFeedId(null);
                          }
                        })();
                      }}
                    >
                      {isBusy ? 'Đang tải...' : hasError ? 'Thử lại nguồn này' : 'Làm mới feed'}
                    </button>
                    <button
                      type="button"
                      className="rs-btn rs-btn-sm rs-btn-danger"
                      disabled={isBusy}
                      onClick={() => setConfirmDeleteFeedId(feed.id)}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isLoading ? (
        <LoadingSkeletonCard label="Đang tải danh sách bài báo RSS từ SQLite..." />
      ) : (
        <div className="rs-detail-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="rs-toolbar">
              <input
                type="search"
                className="rs-input"
                style={{ flex: '1 1 200px' }}
                placeholder="Lọc bài viết RSS đã lưu..."
                value={vs.search}
                onChange={(e) => updateViewState({ search: e.target.value })}
              />
              <select
                aria-label="Chọn nguồn RSS"
                className="rs-select rs-select-compact"
                value={vs.selectedFeedId}
                onChange={(e) => updateViewState({ selectedFeedId: e.target.value })}
              >
                <option value="all">Tất cả nguồn RSS ({rssFeedDtos.length})</option>
                {rssFeedDtos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={vs.onlyBookmarked}
                  onChange={(e) => updateViewState({ onlyBookmarked: e.target.checked })}
                />
                <span>Chỉ bài đã đánh dấu</span>
              </label>
            </div>

            {articles.length === 0 ? (
              <EmptyStateCard
                title="Chưa có bài viết RSS nào khớp bộ lọc"
                description="Thêm nguồn RSS công khai, bấm Làm mới tất cả RSS hoặc xóa bộ lọc hiện tại."
                actionLabel="Xóa bộ lọc"
                onAction={() => updateViewState({ search: '', selectedFeedId: 'all', onlyBookmarked: false })}
              />
            ) : (
              articles.map((art) => {
                const safeExternalUrl =
                  art.canonicalUrl.startsWith('https://') || art.canonicalUrl.startsWith('http://')
                    ? art.canonicalUrl
                    : '';
                return (
                  <article key={art.id} className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <button
                        type="button"
                        className="rs-title-link"
                        style={{ fontSize: '15px' }}
                        onClick={() => navigate('article-detail', { params: { articleId: art.id } })}
                      >
                        {art.title}
                      </button>
                      {art.bookmarked && <span className="rs-badge rs-badge-success">★ Đã đánh dấu</span>}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
                      {art.feedName} · {formatDateTimeVi(art.publishedAt ?? art.fetchedAt)} · {art.sourceLabel}
                    </div>
                    <p style={{ margin: 0, color: 'var(--rs-text-secondary)', fontSize: '13.5px' }}>{art.summaryText}</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="rs-btn rs-btn-sm rs-btn-tinted"
                        onClick={() =>
                          openSaveIdeaModal({
                            title: art.title,
                            sourceType: 'rss_article',
                            sourceRefId: art.id,
                            sourceTitleSnapshot: art.title,
                            sourceUrl: safeExternalUrl,
                            tags: [art.feedName],
                          })
                        }
                      >
                        + Tạo Ý tưởng
                      </button>
                      <button
                        type="button"
                        className="rs-btn rs-btn-sm rs-btn-secondary"
                        onClick={() => handleToggleArticleBookmark(art)}
                      >
                        {art.bookmarked ? 'Bỏ đánh dấu' : '☆ Đánh dấu'}
                      </button>
                      {safeExternalUrl && (
                        <a className="rs-btn rs-btn-sm rs-btn-secondary" href={safeExternalUrl} target="_blank" rel="noopener noreferrer">
                          Mở bài gốc ↗
                        </a>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '15px' }}>Cụm từ nổi bật trên RSS</h2>
              <span className="rs-badge rs-badge-success">Nguồn: RSS (Dữ liệu ngoài YouTube)</span>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
              Tính bằng Python tất định trên {phrases?.articleSampleSize ?? 0} bài báo RSS đã lưu (0 quota YouTube, đọc được offline).
            </p>
            {!phrases || phrases.items.length === 0 ? (
              <span style={{ fontSize: '13px', color: 'var(--rs-text-muted)' }}>
                Chưa đủ dữ liệu bài viết RSS trong 7 ngày qua để thống kê cụm từ.
              </span>
            ) : (
              <table className="rs-table">
                <thead>
                  <tr>
                    <th>Cụm từ RSS</th>
                    <th>Xu hướng 7 ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {phrases.items.map((topic) => (
                    <tr key={topic.phrase}>
                      <td style={{ fontWeight: 600 }}>{topic.phrase}</td>
                      <td>
                        <SparklineCell
                          points={topic.points7d}
                          badgeLabel={`${topic.articleCount} bài RSS`}
                          directionLabel={topic.direction === 'up' ? '↗ Tăng' : '→ Ổn định'}
                          tooltipTitle={`Tần suất "${topic.phrase}" trên RSS`}
                          tooltipDetail="Số bài RSS nhắc tới cụm từ trong 7 ngày gần nhất (Nguồn: RSS — Dữ liệu ngoài YouTube)."
                          insufficientText="Chưa đủ mốc ngày"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      <ConfirmDeleteModal
        open={Boolean(feedToDelete)}
        title="Xóa nguồn RSS?"
        warningText={`Bạn sắp xóa nguồn "${feedToDelete?.name ?? ''}" cùng các bài viết đệm chưa lưu thành Ý tưởng. Các Ý tưởng đã lưu vẫn giữ nguyên 100%.`}
        confirmLabel="Xác nhận xóa nguồn RSS"
        onCancel={() => setConfirmDeleteFeedId(null)}
        onConfirm={() => {
          if (feedToDelete) {
            void deleteRssFeed(feedToDelete.id).then(() => {
              setConfirmDeleteFeedId(null);
              setReloadNonce((n) => n + 1);
            });
          } else {
            setConfirmDeleteFeedId(null);
          }
        }}
      />
    </div>
  );
};

export const GlobalIdeaVaultScreen: React.FC = () => {
  const { currentEntry, navigate, updateViewState } = useAppNavigation();
  const { isBootstrapping, ideas, projects, openSaveIdeaModal, attachIdeaToProject, deleteIdea } =
    usePrototypeWorkspace();
  const [confirmIdeaId, setConfirmIdeaId] = useState<string | null>(null);
  const vs = currentEntry.viewState;

  const vaultIdeas = ideas.filter((idea) => idea.inGlobalVault);

  const filtered = vaultIdeas.filter((idea) => {
    if (vs.originFilter !== 'all' && idea.sourceType !== vs.originFilter) return false;
    const linkCount = Object.keys(idea.projectLinks).length;
    if (vs.linkStateFilter === 'unlinked' && linkCount > 0) return false;
    if (vs.linkStateFilter === 'linked' && linkCount === 0) return false;
    if (vs.search.trim()) {
      const q = vs.search.trim().toLowerCase();
      return (
        idea.title.toLowerCase().includes(q) ||
        idea.notes.toLowerCase().includes(q) ||
        idea.sourceTitleSnapshot.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const targetDeleteIdea = ideas.find((i) => i.id === confirmIdeaId) ?? null;

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <h1 className="rs-page-title">Kho ý tưởng chung (G5 — Global Idea Vault)</h1>
          <p className="rs-page-subtitle">
            Lưu vĩnh viễn trên máy · Gắn 1 bản ý tưởng gốc vào nhiều Project mà không lưu trùng
          </p>
        </div>
        <button
          type="button"
          className="rs-btn rs-btn-primary"
          onClick={() =>
            openSaveIdeaModal({
              title: '',
              sourceType: 'manual',
              sourceRefId: `manual-${Date.now()}`,
              sourceTitleSnapshot: 'Tạo viết tay trong Kho chung',
              sourceUrl: '',
              tags: [],
            })
          }
        >
          + Tạo Ý tưởng mới
        </button>
      </div>

      <GlobalModeBanners />

      <div className="rs-toolbar">
        <input
          type="search"
          className="rs-input"
          style={{ flex: '1 1 220px' }}
          placeholder="Tìm tiêu đề, ghi chú ý tưởng..."
          value={vs.search}
          onChange={(e) => updateViewState({ search: e.target.value })}
        />
        <select
          aria-label="Lọc theo nguồn gốc"
          className="rs-select rs-select-compact"
          value={vs.originFilter}
          onChange={(e) => updateViewState({ originFilter: e.target.value as 'all' | IdeaSourceType })}
        >
          <option value="all">Tất cả nguồn gốc</option>
          <option value="manual">Viết tay</option>
          <option value="youtube_video">Từ Video YouTube</option>
          <option value="rss_article">Từ Bài báo RSS</option>
          <option value="keyword">Từ Từ khóa</option>
        </select>
        <select
          aria-label="Lọc trạng thái gắn Project"
          className="rs-select rs-select-compact"
          value={vs.linkStateFilter}
          onChange={(e) => updateViewState({ linkStateFilter: e.target.value as 'all' | 'unlinked' | 'linked' })}
        >
          <option value="all">Tất cả liên kết Project</option>
          <option value="unlinked">Chưa gắn Project</option>
          <option value="linked">Đã gắn ít nhất 1 Project</option>
        </select>
      </div>

      {isBootstrapping && ideas.length === 0 ? (
        <LoadingSkeletonCard label="Đang tải Kho ý tưởng chung từ SQLite..." />
      ) : filtered.length === 0 ? (
        <EmptyStateCard
          title="Chưa có ý tưởng nào khớp bộ lọc"
          description="Tạo ý tưởng viết tay mới hoặc lưu ý tưởng từ Khám phá xu hướng / Tìm kiếm / Tin tức RSS."
          actionLabel="+ Tạo Ý tưởng mới"
          onAction={() =>
            openSaveIdeaModal({
              title: '',
              sourceType: 'manual',
              sourceRefId: `manual-${Date.now()}`,
              sourceTitleSnapshot: 'Tạo viết tay trong Kho chung',
              sourceUrl: '',
              tags: [],
            })
          }
        />
      ) : (
        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th>Ý tưởng gốc &amp; Nguồn tham chiếu</th>
                <th>Project đang gắn &amp; Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((idea) => {
                const unattachedProjects = projects.filter((p) => !idea.projectLinks[p.id]);
                const safeSourceUrl =
                  idea.sourceUrl.startsWith('https://') || idea.sourceUrl.startsWith('http://') ? idea.sourceUrl : '';
                return (
                  <tr key={idea.id}>
                    <td style={{ minWidth: 340 }}>
                      <button
                        type="button"
                        className="rs-title-link"
                        onClick={() => navigate('idea-detail', { params: { ideaId: idea.id } })}
                      >
                        {idea.title}
                      </button>
                      {idea.notes && (
                        <p style={{ margin: '4px 0', fontSize: '13px', color: 'var(--rs-text-secondary)' }}>
                          {idea.notes}
                        </p>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 4 }}>
                        <span className="rs-badge">
                          Nguồn: {idea.sourceTitleSnapshot || 'Tạo thủ công'}
                        </span>
                        {safeSourceUrl && (
                          <a href={safeSourceUrl} target="_blank" rel="noopener noreferrer" className="rs-badge">
                            Mở liên kết nguồn ↗
                          </a>
                        )}
                        {idea.apiPurged && (
                          <span className="rs-badge rs-badge-warning">
                            Metadata YouTube API đã hết hạn 30 ngày — Đã bảo toàn Ý tưởng
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ minWidth: 250 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {Object.keys(idea.projectLinks).length === 0 ? (
                          <span className="rs-badge">Chưa gắn Project</span>
                        ) : (
                          Object.entries(idea.projectLinks).map(([pid, link]) => {
                            const proj = projects.find((p) => p.id === pid);
                            return (
                              <span key={pid} className="rs-badge">
                                {proj?.name ?? pid}: {IDEA_STATUS_LABELS[link.status]}
                              </span>
                            );
                          })
                        )}
                        {unattachedProjects.length > 0 && (
                          <select
                            aria-label={`Gắn "${idea.title}" vào Project`}
                            className="rs-select rs-select-compact"
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                void attachIdeaToProject(idea.id, e.target.value, idea.title);
                              }
                            }}
                          >
                            <option value="">+ Gắn nhanh sang Project...</option>
                            {unattachedProjects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td style={{ minWidth: 150 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-secondary"
                          onClick={() => navigate('idea-detail', { params: { ideaId: idea.id } })}
                        >
                          Chi tiết
                        </button>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-danger"
                          onClick={() => setConfirmIdeaId(idea.id)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDeleteModal
        open={Boolean(targetDeleteIdea)}
        title="Xác nhận xóa Ý tưởng gốc?"
        warningText={`Ý tưởng "${targetDeleteIdea?.title ?? ''}" hiện đang liên kết với ${
          targetDeleteIdea ? Object.keys(targetDeleteIdea.projectLinks).length : 0
        } Project. Thao tác này sẽ xóa ý tưởng và các góc khai thác gắn kèm.`}
        confirmLabel="Xác nhận xóa Ý tưởng"
        onCancel={() => setConfirmIdeaId(null)}
        onConfirm={() => {
          if (targetDeleteIdea) {
            void deleteIdea(targetDeleteIdea.id);
          }
          setConfirmIdeaId(null);
        }}
      />
    </div>
  );
};
