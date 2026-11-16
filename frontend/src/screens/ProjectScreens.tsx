import React, { useEffect, useRef, useState } from 'react';
import {
  ApiClientError,
  createProjectKeywordApi,
  deleteProjectCompetitorApi,
  deleteProjectKeywordApi,
  fetchKeywordDetailApi,
  fetchProjectBreakoutVideosApi,
  fetchProjectCompetitorsApi,
  fetchProjectKeywordsApi,
  fetchProjectOverviewApi,
  isAbortError,
  refreshAllProjectCompetitorsApi,
  refreshProjectWorkspaceApi,
  refreshSingleProjectCompetitorApi,
  scanProjectKeywordsApi,
  updateProjectCompetitorApi,
} from '../api/client';
import { formatDateTimeVi, mapYoutubeVideoDtoToItem } from '../api/mappers';
import type {
  BreakoutVideosResponseDto,
  CompetitorChannelDto,
  KeywordDetailResponseDto,
  ProjectKeywordsResponseDto,
  ProjectOverviewDto,
} from '../api/types';
import { IDEA_STATUS_LABELS, formatInt } from '../prototype/demoData';
import type { IdeaPriority, IdeaStatus, ProjectItem, VideoItem } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace } from '../state/workspaceContext';
import { SparklineCell } from '../components/SparklineCell';
import { EmptyStateCard, GlobalModeBanners, LoadingSkeletonCard } from '../components/StatusViews';
import { VideoResearchTable } from '../components/VideoResearchTable';
import { ConfirmDeleteModal } from '../components/Modals';

function useActiveProject(): ProjectItem | null {
  const { currentEntry } = useAppNavigation();
  const { projects } = usePrototypeWorkspace();
  if (projects.length === 0) return null;
  return projects.find((p) => p.id === currentEntry.projectId) ?? projects[0];
}

const NoProjectEmpty: React.FC = () => {
  const { setCreateProjectModalOpen } = usePrototypeWorkspace();
  const { navigate } = useAppNavigation();
  return (
    <div className="rs-container">
      <EmptyStateCard
        title="Chưa có Project nào được tạo"
        description="Phân khu Project Research dùng chung một bộ menu cho Project đang chọn. Hãy tạo Project đầu tiên hoặc tiếp tục dùng Global Research."
        actionLabel="+ Tạo Project đầu tiên"
        onAction={() => setCreateProjectModalOpen(true)}
        secondaryLabel="Về Global Research"
        onSecondary={() => navigate('global-overview')}
      />
    </div>
  );
};

export const ProjectOverviewScreen: React.FC = () => {
  const project = useActiveProject();
  const { navigate } = useAppNavigation();
  const { isBootstrapping, backendOnline, syncQuotaStatus, pushToast } = usePrototypeWorkspace();
  const [reloadNonce, setReloadNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [ovState, setOvState] = useState<{
    key: string;
    data: ProjectOverviewDto | null;
    error: string | null;
  }>({ key: '', data: null, error: null });
  const refreshAbortRef = useRef<AbortController | null>(null);

  const projectId = project?.id ?? '';
  const reqKey = `${projectId}:${reloadNonce}`;

  useEffect(() => {
    if (!projectId) return undefined;
    const controller = new AbortController();
    fetchProjectOverviewApi(projectId, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setOvState({ key: reqKey, data: res, error: null });
        }
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setOvState({
          key: reqKey,
          data: null,
          error: err instanceof ApiClientError ? err.message : 'Không tải được số liệu Tổng quan dự án.',
        });
      });
    return () => {
      controller.abort();
    };
  }, [projectId, reqKey]);

  useEffect(
    () => () => {
      refreshAbortRef.current?.abort();
    },
    [],
  );

  if (isBootstrapping) {
    return (
      <div className="rs-container">
        <LoadingSkeletonCard label="Đang tải thông tin Project từ SQLite..." />
      </div>
    );
  }

  if (!project) return <NoProjectEmpty />;

  const formatLabel =
    project.targetFormat === 'long_form'
      ? 'Video dài'
      : project.targetFormat === 'shorts'
        ? 'Shorts'
        : 'Tất cả định dạng';

  const loadingOv = ovState.key !== reqKey && ovState.error === null;
  const ov = ovState.key === reqKey ? ovState.data : null;

  const handleRefreshProject = () => {
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    setRefreshing(true);
    void refreshProjectWorkspaceApi(project.id, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setOvState({ key: reqKey, data: res.overview, error: null });
        void syncQuotaStatus();
        const rssOk = res.rssOkCount ?? res.rssRefreshedCount;
        const rssErr = res.rssErrorCount ?? 0;
        const comp = res.competitorSummary;
        const compErr = comp?.errorCount ?? 0;
        if (rssErr > 0 || compErr > 0) {
          pushToast(
            'error',
            `Đồng bộ Project hoàn tất với lỗi cô lập (RSS: ${rssOk}/${res.rssRefreshedCount} nguồn ok${
              comp ? `, Đối thủ: ${comp.okCount}/${comp.refreshedCount} kênh ok` : ''
            }).`,
          );
        } else {
          pushToast(
            'success',
            `Đã đồng bộ Project (RSS: ${rssOk} nguồn${
              comp ? `, Đối thủ: ${comp.okCount}/${comp.refreshedCount} kênh` : ''
            }).`,
          );
        }
      })
      .catch((err) => {
        if (isAbortError(err)) {
          pushToast('success', 'Đã hủy lệnh làm mới Project.');
          return;
        }
        void syncQuotaStatus();
        pushToast('error', err instanceof ApiClientError ? err.message : 'Không thể làm mới Project.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
  };

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Tổng quan dự án (P1) — {project.name}</h1>
            <span className="rs-badge rs-badge-success">Dữ liệu thật SQLite</span>
            <span className="rs-badge">
              {project.regionCode} · {project.relevanceLanguage} · {formatLabel}
            </span>
          </div>
          <p className="rs-page-subtitle">
            {project.description || 'Chưa có mô tả định hướng kênh. Có thể bổ sung trong Cài đặt dự án (P6).'}
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
              disabled={!backendOnline}
              onClick={handleRefreshProject}
            >
              Làm mới RSS &amp; Đối thủ Project
            </button>
          )}
          <button type="button" className="rs-btn rs-btn-secondary" onClick={() => navigate('project-settings')}>
            Cài đặt dự án (P6)
          </button>
        </div>
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      {ovState.error ? (
        <EmptyStateCard
          title="Không đọc được số liệu tổng quan Project"
          description={ovState.error}
          actionLabel="Thử lại"
          onAction={() => setReloadNonce((n) => n + 1)}
        />
      ) : loadingOv || !ov ? (
        <LoadingSkeletonCard label="Đang tổng hợp số liệu từ SQLite cho Project..." />
      ) : (
        <>
          <div className="rs-grid-3">
            <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '15px' }}>Đối thủ &amp; Video (Tách 3 định dạng)</h2>
                <button type="button" className="rs-btn rs-btn-sm rs-btn-secondary" onClick={() => navigate('project-competitors')}>
                  Mở P2
                </button>
              </div>
              <div className="rs-tabular" style={{ fontSize: '13.5px', color: 'var(--rs-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>
                  Kênh đối thủ: <strong>{ov.competitorChannels.total}</strong> ({ov.competitorChannels.active} bật ·{' '}
                  {ov.competitorChannels.paused} dừng · {ov.competitorChannels.error} lỗi)
                </div>
                <div>
                  Video &lt;=30d còn hạn: <strong>{ov.competitorVideos.totalValid}</strong> (Bứt phá thủ công:{' '}
                  <strong>{ov.breakoutFlaggedCount}</strong>)
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  <span className="rs-badge">Video dài: {ov.competitorVideos.longForm}</span>
                  <span className="rs-badge">Shorts: {ov.competitorVideos.shorts}</span>
                  <span className="rs-badge">Chưa xác định &lt;=180s: {ov.competitorVideos.unknown}</span>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--rs-text-muted)' }}>
                  Nhóm Chưa xác định tuyệt đối không bị gộp vào Video dài hoặc Shorts.
                </span>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <button type="button" className="rs-btn rs-btn-sm rs-btn-primary" onClick={() => navigate('project-breakout')}>
                  Sàng lọc Video bứt phá (P3) →
                </button>
              </div>
            </section>

            <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '15px' }}>Phễu Ý tưởng 5 trạng thái ({ov.ideas.total})</h2>
                <button type="button" className="rs-btn rs-btn-sm rs-btn-secondary" onClick={() => navigate('project-ideas')}>
                  Mở P5
                </button>
              </div>
              <div className="rs-tabular" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[]).map((st) => (
                  <span key={st} className="rs-badge">
                    {IDEA_STATUS_LABELS[st]}: {ov.ideas.byStatus[st]}
                  </span>
                ))}
              </div>
              {ov.ideas.recent.length === 0 ? (
                <span style={{ fontSize: '13px', color: 'var(--rs-text-muted)' }}>
                  Project chưa gắn ý tưởng nào. Hãy lưu ý tưởng từ P2, P3, P4 hoặc G5 Kho ý tưởng chung.
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ov.ideas.recent.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="rs-title-link"
                      style={{ fontSize: '13px', textAlign: 'left' }}
                      onClick={() => navigate('idea-detail', { params: { ideaId: item.id } })}
                    >
                      • {item.title} ({IDEA_STATUS_LABELS[item.status]})
                    </button>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 'auto' }}>
                <button type="button" className="rs-btn rs-btn-sm rs-btn-primary" onClick={() => navigate('project-ideas')}>
                  Quản lý Ý tưởng (P5) →
                </button>
              </div>
            </section>

            <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '15px' }}>Từ khóa &amp; RSS liên kết</h2>
                <button type="button" className="rs-btn rs-btn-sm rs-btn-secondary" onClick={() => navigate('project-keywords')}>
                  Mở P4
                </button>
              </div>
              <div className="rs-tabular" style={{ fontSize: '13.5px', color: 'var(--rs-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>
                  Từ khóa nghiên cứu: <strong>{ov.keywords.total}</strong> ({ov.keywords.scannedValid} đã quét còn hạn 30d)
                </div>
                <div>
                  Nguồn RSS gắn Project: <strong>{ov.rss.linkedFeeds}</strong> nguồn ({ov.rss.brokenFeeds} lỗi ·{' '}
                  <strong>{ov.rss.recentArticlesCount}</strong> bài 7d)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
                  Mã Project: <code className="rs-mono">{project.id}</code> · Cập nhật: {formatDateTimeVi(project.updatedAt)}
                </div>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="rs-btn rs-btn-sm rs-btn-primary" onClick={() => navigate('project-keywords')}>
                  Nghiên cứu từ khóa (P4)
                </button>
                <button type="button" className="rs-btn rs-btn-sm rs-btn-secondary" onClick={() => navigate('project-settings')}>
                  Gắn RSS ở P6
                </button>
              </div>
            </section>
          </div>

          {ov.latestRssArticles.length > 0 && (
            <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '15px' }}>Tin RSS mới thuộc nguồn của {project.name}</h2>
                <span className="rs-badge rs-badge-success">Nguồn: RSS (Dữ liệu ngoài YouTube)</span>
              </div>
              <div className="rs-grid-2">
                {ov.latestRssArticles.map((art) => (
                  <div key={art.id} className="rs-card-subtle">
                    <button
                      type="button"
                      className="rs-title-link"
                      style={{ fontSize: '13px' }}
                      onClick={() => navigate('article-detail', { params: { articleId: art.id } })}
                    >
                      {art.title}
                    </button>
                    <div style={{ fontSize: '11.5px', color: 'var(--rs-text-muted)', marginTop: 2 }}>
                      {art.feedName} · {formatDateTimeVi(art.publishedAt ?? art.fetchedAt)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export const CompetitorsScreen: React.FC = () => {
  const project = useActiveProject();
  const { currentEntry, navigate, updateViewState } = useAppNavigation();
  const {
    backendOnline,
    systemSettings,
    quotaStatus,
    addChannelToProject,
    registerVideosInMemory,
    registerProjectBreakoutStates,
    syncQuotaStatus,
    pushToast,
  } = usePrototypeWorkspace();

  const [channelInput, setChannelInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyChannelId, setBusyChannelId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesDraft, setEditingNotesDraft] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);

  const [state, setState] = useState<{
    key: string;
    channels: CompetitorChannelDto[];
    videos: VideoItem[];
    error: string | null;
  }>({ key: '', channels: [], videos: [], error: null });

  const abortRef = useRef<AbortController | null>(null);
  const projectId = project?.id ?? '';
  const reqKey = `${projectId}:${reloadNonce}`;

  useEffect(() => {
    if (!projectId) return undefined;
    const controller = new AbortController();
    fetchProjectCompetitorsApi(projectId, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const mapped = res.videos.map(mapYoutubeVideoDtoToItem);
        registerVideosInMemory(mapped);
        registerProjectBreakoutStates(projectId, mapped);
        setState({ key: reqKey, channels: res.channels, videos: mapped, error: null });
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setState({
          key: reqKey,
          channels: [],
          videos: [],
          error: err instanceof ApiClientError ? err.message : 'Không tải được danh sách kênh đối thủ.',
        });
      });
    return () => {
      controller.abort();
    };
  }, [projectId, reqKey, registerProjectBreakoutStates, registerVideosInMemory]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  if (!project) return <NoProjectEmpty />;

  const vs = currentEntry.viewState;
  const isLoading = state.key !== reqKey && state.error === null;
  const projectChannels = state.key === reqKey ? state.channels : [];
  const projectVideos = state.key === reqKey ? state.videos : [];

  const apiBlocked =
    !backendOnline ||
    !systemSettings.legalConsentAccepted ||
    systemSettings.apiKeyStatus !== 'configured' ||
    quotaStatus.generalData.exhausted;

  const handleAddCompetitor = () => {
    if (!channelInput.trim() || adding) return;
    setAdding(true);
    void addChannelToProject(project.id, channelInput, notesInput).then((ok) => {
      setAdding(false);
      if (ok) {
        setChannelInput('');
        setNotesInput('');
        setReloadNonce((n) => n + 1);
      }
    });
  };

  const handleRefreshAll = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRefreshing(true);
    void refreshAllProjectCompetitorsApi(project.id, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const mapped = res.videos.map(mapYoutubeVideoDtoToItem);
        registerVideosInMemory(mapped);
        registerProjectBreakoutStates(project.id, mapped);
        setState({ key: reqKey, channels: res.channels, videos: mapped, error: null });
        void syncQuotaStatus();
        if (res.errorCount > 0) {
          pushToast(
            'error',
            `Đã cập nhật ${res.okCount}/${res.refreshedCount} kênh đối thủ (${res.errorCount} kênh gặp lỗi cô lập).`,
          );
        } else {
          pushToast('success', `Đã làm mới ${res.okCount} kênh đối thủ (0 lượt Search Queries).`);
        }
      })
      .catch((err) => {
        if (isAbortError(err)) {
          pushToast('success', 'Đã hủy lệnh làm mới kênh đối thủ.');
          return;
        }
        void syncQuotaStatus();
        pushToast('error', err instanceof ApiClientError ? err.message : 'Không làm mới được kênh đối thủ.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
  };

  const handleRefreshSingle = (channelId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusyChannelId(channelId);
    void refreshSingleProjectCompetitorApi(project.id, channelId, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const mapped = res.videos.map(mapYoutubeVideoDtoToItem);
        registerVideosInMemory(mapped);
        registerProjectBreakoutStates(project.id, mapped);
        setState({ key: reqKey, channels: res.channels, videos: mapped, error: null });
        void syncQuotaStatus();
        pushToast('success', 'Đã cập nhật dữ liệu mới nhất cho kênh đối thủ (0 lượt Search Queries).');
      })
      .catch((err) => {
        if (isAbortError(err)) {
          pushToast('success', 'Đã hủy làm mới kênh đối thủ.');
          return;
        }
        void syncQuotaStatus();
        pushToast('error', err instanceof ApiClientError ? err.message : 'Kênh đối thủ cập nhật thất bại.');
        setReloadNonce((n) => n + 1);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusyChannelId(null);
      });
  };

  const handleTogglePause = (ch: CompetitorChannelDto) => {
    const nextStatus = ch.status === 'paused' ? 'active' : 'paused';
    setBusyChannelId(ch.channelId);
    void updateProjectCompetitorApi(project.id, ch.channelId, { status: nextStatus })
      .then((res) => {
        const mapped = res.videos.map(mapYoutubeVideoDtoToItem);
        setState({ key: reqKey, channels: res.channels, videos: mapped, error: null });
        pushToast(
          'success',
          nextStatus === 'paused' ? 'Đã tạm dừng làm mới tự động kênh này.' : 'Đã bật lại theo dõi kênh đối thủ.',
        );
      })
      .catch((err) => {
        pushToast('error', err instanceof ApiClientError ? err.message : 'Không cập nhật được trạng thái kênh.');
      })
      .finally(() => setBusyChannelId(null));
  };

  const handleSaveNotes = (channelId: string) => {
    setBusyChannelId(channelId);
    void updateProjectCompetitorApi(project.id, channelId, { notes: editingNotesDraft })
      .then((res) => {
        const mapped = res.videos.map(mapYoutubeVideoDtoToItem);
        setState({ key: reqKey, channels: res.channels, videos: mapped, error: null });
        setEditingNotesId(null);
        pushToast('success', 'Đã lưu ghi chú đối thủ riêng cho Project (User-Created Data).');
      })
      .catch((err) => {
        pushToast('error', err instanceof ApiClientError ? err.message : 'Không lưu được ghi chú kênh.');
      })
      .finally(() => setBusyChannelId(null));
  };

  const handleRemove = (ch: CompetitorChannelDto) => {
    setBusyChannelId(ch.channelId);
    void deleteProjectCompetitorApi(project.id, ch.channelId)
      .then((res) => {
        const mapped = res.videos.map(mapYoutubeVideoDtoToItem);
        setState({ key: reqKey, channels: res.channels, videos: mapped, error: null });
        pushToast(
          'success',
          `Đã gỡ kênh "${ch.title ?? ch.handle ?? ch.channelId}" khỏi Project (giữ nguyên cho Project khác nếu cùng theo dõi).`,
        );
      })
      .catch((err) => {
        pushToast('error', err instanceof ApiClientError ? err.message : 'Không gỡ được kênh đối thủ.');
      })
      .finally(() => setBusyChannelId(null));
  };

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Theo dõi đối thủ (P2) — {project.name}</h1>
            <span className="rs-badge">Phân giải @handle/UC...: 1 unit API · 0 Search Queries</span>
          </div>
          <p className="rs-page-subtitle">
            Bấm tên kênh để đi qua luồng 4 cấp: Theo dõi đối thủ → Chi tiết kênh → Danh sách video → Chi tiết video
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {refreshing ? (
            <button
              type="button"
              className="rs-btn rs-btn-danger"
              onClick={() => {
                abortRef.current?.abort();
                setRefreshing(false);
              }}
            >
              Hủy (Cancel)
            </button>
          ) : (
            <button
              type="button"
              className="rs-btn rs-btn-secondary"
              disabled={apiBlocked || projectChannels.length === 0}
              onClick={handleRefreshAll}
            >
              Làm mới toàn bộ đối thủ
            </button>
          )}
        </div>
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      <div className="rs-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flex: '1 1 460px', flexWrap: 'wrap' }}>
          <input
            type="text"
            aria-label="Dán URL, @handle hoặc channel_id đối thủ"
            className="rs-input"
            style={{ flex: '2 1 240px' }}
            placeholder="Dán URL (@handle hoặc /channel/UC...), @handle hoặc UC... (0 Search Queries)"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
          />
          <input
            type="text"
            aria-label="Ghi chú lý do theo dõi đối thủ"
            className="rs-input"
            style={{ flex: '1 1 160px' }}
            placeholder="Ghi chú riêng (tùy chọn)"
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
          />
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            disabled={!channelInput.trim() || adding}
            onClick={handleAddCompetitor}
          >
            {adding ? 'Đang phân giải...' : '+ Thêm đối thủ'}
          </button>
        </div>

        <div className="rs-pill-group">
          <button
            type="button"
            className={`rs-pill-tab ${vs.tab !== 'videos' ? 'is-active' : ''}`}
            onClick={() => updateViewState({ tab: 'channels', page: 1 })}
          >
            Kênh đối thủ ({projectChannels.length})
          </button>
          <button
            type="button"
            className={`rs-pill-tab ${vs.tab === 'videos' ? 'is-active' : ''}`}
            onClick={() => updateViewState({ tab: 'videos', page: 1 })}
          >
            Video từ đối thủ ({projectVideos.length})
          </button>
        </div>
      </div>

      {state.error ? (
        <EmptyStateCard
          title="Không đọc được danh sách đối thủ"
          description={state.error}
          actionLabel="Thử lại"
          onAction={() => setReloadNonce((n) => n + 1)}
        />
      ) : isLoading ? (
        <LoadingSkeletonCard label="Đang tải danh sách đối thủ & video <= 30 ngày từ SQLite..." />
      ) : vs.tab === 'videos' ? (
        <VideoResearchTable
          videos={projectVideos}
          fromScreen="project-competitors"
          projectIdForBreakout={project.id}
          showSnapshotsColumn
          emptyTitle="Chưa có video đối thủ còn hạn <= 30 ngày"
          emptyDescription="Thêm kênh đối thủ bằng @handle / UC... hoặc bấm Làm mới toàn bộ đối thủ để tải tối đa 40 video gần nhất."
        />
      ) : projectChannels.length === 0 ? (
        <EmptyStateCard
          title="Project chưa có kênh đối thủ nào"
          description="Dán URL kênh (@handle hoặc /channel/UC...), @handle hoặc mã UC... ở thanh phía trên để theo dõi (hoặc bấm + Đối thủ từ kết quả ở G2/G3)."
        />
      ) : (
        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th>Kênh đối thủ &amp; Ghi chú riêng của Project</th>
                <th className="rs-num-cell">Subscriber (API gốc)</th>
                <th className="rs-num-cell">Tổng Video / Cache</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {projectChannels.map((ch) => {
                const isEditing = editingNotesId === ch.channelId;
                const isBusy = busyChannelId === ch.channelId;
                return (
                  <tr key={ch.channelId}>
                    <td style={{ minWidth: 320 }}>
                      <button
                        type="button"
                        className="rs-title-link"
                        style={{ fontSize: '14.5px' }}
                        onClick={() => navigate('channel-detail', { params: { channelId: ch.channelId } })}
                      >
                        {ch.hasValidApiData ? (ch.title ?? ch.channelId) : `Kênh ${ch.channelId} (Cache hết hạn 30d)`}
                        {ch.handle ? ` (${ch.handle})` : ''}
                      </button>

                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            className="rs-input"
                            style={{ flex: 1, minWidth: 200 }}
                            value={editingNotesDraft}
                            onChange={(e) => setEditingNotesDraft(e.target.value)}
                          />
                          <button
                            type="button"
                            className="rs-btn rs-btn-sm rs-btn-primary"
                            disabled={isBusy}
                            onClick={() => handleSaveNotes(ch.channelId)}
                          >
                            Lưu
                          </button>
                          <button
                            type="button"
                            className="rs-btn rs-btn-sm rs-btn-ghost"
                            onClick={() => setEditingNotesId(null)}
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', color: 'var(--rs-text-secondary)' }}>
                            {ch.notes || 'Chưa có ghi chú riêng.'}
                          </span>
                          <button
                            type="button"
                            className="rs-btn rs-btn-ghost rs-btn-sm"
                            onClick={() => {
                              setEditingNotesId(ch.channelId);
                              setEditingNotesDraft(ch.notes);
                            }}
                          >
                            Sửa ghi chú
                          </button>
                        </div>
                      )}

                      {ch.sharedProjectsCount > 1 && (
                        <span className="rs-badge" style={{ marginTop: 4 }}>
                          Kênh dùng chung bởi {ch.sharedProjectsCount} Project (chỉ 1 bản ghi gốc)
                        </span>
                      )}
                    </td>
                    <td className="rs-num-cell">{formatInt(ch.subscriberCount)}</td>
                    <td className="rs-num-cell">
                      <div>{formatInt(ch.videoCount)}</div>
                      <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
                        {ch.cachedVideoCount} video &lt;=30d
                      </div>
                    </td>
                    <td>
                      <span
                        className={`rs-badge ${
                          ch.status === 'error'
                            ? 'rs-badge-danger'
                            : ch.status === 'paused'
                              ? 'rs-badge-warning'
                              : 'rs-badge-success'
                        }`}
                      >
                        {ch.status === 'error' ? 'Lỗi cô lập' : ch.status === 'paused' ? 'Tạm dừng' : 'Đang theo dõi'}
                      </span>
                      <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)', marginTop: 4 }}>
                        Cập nhật: {formatDateTimeVi(ch.apiFetchedAt)}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-primary"
                          onClick={() => navigate('channel-detail', { params: { channelId: ch.channelId } })}
                        >
                          Chi tiết →
                        </button>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-secondary"
                          disabled={apiBlocked || isBusy}
                          onClick={() => handleRefreshSingle(ch.channelId)}
                        >
                          {isBusy ? 'Đang tải...' : 'Làm mới'}
                        </button>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-secondary"
                          disabled={isBusy}
                          onClick={() => handleTogglePause(ch)}
                        >
                          {ch.status === 'paused' ? 'Bật lại' : 'Tạm dừng'}
                        </button>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-danger"
                          disabled={isBusy}
                          onClick={() => handleRemove(ch)}
                        >
                          Gỡ khỏi Project
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
    </div>
  );
};

export const BreakoutVideosScreen: React.FC = () => {
  const project = useActiveProject();
  const { navigate } = useAppNavigation();
  const { registerVideosInMemory, registerProjectBreakoutStates } = usePrototypeWorkspace();
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: BreakoutVideosResponseDto | null;
    videos: VideoItem[];
    error: string | null;
  }>({ key: '', data: null, videos: [], error: null });

  const projectId = project?.id ?? '';
  const reqKey = `${projectId}:${reloadNonce}`;

  useEffect(() => {
    if (!projectId) return undefined;
    const controller = new AbortController();
    fetchProjectBreakoutVideosApi(projectId, undefined, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const mapped = res.items.map(mapYoutubeVideoDtoToItem);
        registerVideosInMemory(mapped);
        registerProjectBreakoutStates(projectId, mapped);
        setState({ key: reqKey, data: res, videos: mapped, error: null });
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setState({
          key: reqKey,
          data: null,
          videos: [],
          error: err instanceof ApiClientError ? err.message : 'Không tải được Video bứt phá từ SQLite.',
        });
      });
    return () => {
      controller.abort();
    };
  }, [projectId, reqKey, registerProjectBreakoutStates, registerVideosInMemory]);

  if (!project) return <NoProjectEmpty />;

  const isLoading = state.key !== reqKey && state.error === null;
  const projectVideos = state.key === reqKey ? state.videos : [];
  const counts = state.key === reqKey && state.data ? state.data.formatCounts : { longForm: 0, shorts: 0, unknown: 0 };

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Video bứt phá — Standard Mode (P3)</h1>
            <span className="rs-badge">Dữ liệu YouTube API (Standard Mode)</span>
          </div>
          <p className="rs-page-subtitle">
            Sàng lọc video từ tệp đối thủ của <strong>{project.name}</strong> bằng số liệu API gốc và đánh dấu thủ công (0 quota)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="rs-btn rs-btn-secondary"
            onClick={() => setReloadNonce((n) => n + 1)}
          >
            Làm mới từ SQLite (0 quota)
          </button>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={() => navigate('project-competitors')}>
            Quản lý đối thủ
          </button>
        </div>
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <strong>CÔNG BỐ PHẠM VI STANDARD MODE (TUÂN THỦ YOUTUBE DEVELOPER POLICIES)</strong>
          <span className="rs-badge">Tách bạch 3 nhóm nguồn: {counts.longForm} Video dài · {counts.shorts} Shorts · {counts.unknown} Chưa xác định</span>
        </div>
        <div className="rs-grid-2">
          <div className="rs-card-subtle">
            <strong style={{ color: 'var(--rs-success-text)' }}>✓ Đang hoạt động ngay trong MVP V1</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '13px', color: 'var(--rs-text-secondary)' }}>
              <li>Lọc cửa sổ ngày đăng (3 / 7 / 14 / 30 ngày) &amp; ngưỡng <code>viewCount</code> gốc.</li>
              <li>Tách riêng 3 trạng thái định dạng nguồn (<code>Video dài</code> / <code>Shorts</code> / <code>Chưa xác định</code>).</li>
              <li>Xem các mốc <code>viewCount</code> thô đã thu thập trong vòng &lt;= 30 ngày kèm timestamp.</li>
              <li>Bật/tắt cờ <strong>Đánh dấu Bứt phá thủ công</strong> &amp; chuyển thành Ý tưởng Project.</li>
            </ul>
          </div>
          <div className="rs-card-subtle">
            <strong style={{ color: 'var(--rs-text-muted)' }}>○ Chưa khả dụng (Chờ phê duyệt YouTube Derived Metrics Policy)</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '13px', color: 'var(--rs-text-muted)' }}>
              <li>Chỉ số <code>Outlier Multiplier</code> (x lần trung vị) &amp; <code>Channel Median</code>.</li>
              <li>Chỉ số dẫn xuất <code>Views/ngày</code> &amp; <code>Engagement Rate (%)</code>.</li>
              <li>Xếp hạng gộp thống kê nhiều kênh &amp; biểu đồ lịch sử dài hạn &gt; 30 ngày.</li>
            </ul>
          </div>
        </div>
      </section>

      {state.error ? (
        <EmptyStateCard
          title="Không đọc được dữ liệu Video bứt phá"
          description={state.error}
          actionLabel="Thử lại"
          onAction={() => setReloadNonce((n) => n + 1)}
        />
      ) : isLoading ? (
        <LoadingSkeletonCard label="Đang đọc & sàng lọc video đối thủ từ SQLite..." />
      ) : (
        <VideoResearchTable
          videos={projectVideos}
          fromScreen="project-breakout"
          projectIdForBreakout={project.id}
          showSnapshotsColumn
          showDateWindowFilter
          showMinViewsFilter
          showBreakoutToggle
          emptyTitle="Chưa có video đối thủ để sàng lọc bứt phá"
          emptyDescription="Hãy thêm ít nhất một kênh đối thủ ở màn hình P2 Theo dõi đối thủ (hoặc làm mới cache video)."
        />
      )}
    </div>
  );
};

export const KeywordResearchScreen: React.FC = () => {
  const project = useActiveProject();
  const { currentEntry, updateViewState, navigate } = useAppNavigation();
  const {
    backendOnline,
    systemSettings,
    quotaStatus,
    openSaveIdeaModal,
    registerVideosInMemory,
    syncQuotaStatus,
    pushToast,
  } = usePrototypeWorkspace();

  const [newKw, setNewKw] = useState('');
  const [priority, setPriority] = useState<IdeaPriority>('medium');
  const [adding, setAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingBatchConfirmIds, setPendingBatchConfirmIds] = useState<string[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [overviewState, setOverviewState] = useState<{
    key: string;
    data: ProjectKeywordsResponseDto | null;
    error: string | null;
  }>({ key: '', data: null, error: null });

  const [detailState, setDetailState] = useState<{
    key: string;
    data: KeywordDetailResponseDto | null;
    videos: VideoItem[];
    error: string | null;
  }>({ key: '', data: null, videos: [], error: null });

  const scanAbortRef = useRef<AbortController | null>(null);
  const projectId = project?.id ?? '';
  const overviewKey = `${projectId}:${reloadNonce}`;

  useEffect(() => {
    if (!projectId) return undefined;
    const controller = new AbortController();
    fetchProjectKeywordsApi(projectId, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setOverviewState({ key: overviewKey, data: res, error: null });
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setOverviewState({
          key: overviewKey,
          data: null,
          error: err instanceof ApiClientError ? err.message : 'Không tải được danh sách từ khóa.',
        });
      });
    return () => {
      controller.abort();
    };
  }, [projectId, overviewKey]);

  const projectKeywords = overviewState.key === overviewKey && overviewState.data ? overviewState.data.items : [];
  const selectedKw =
    projectKeywords.find((k) => k.id === currentEntry.viewState.selectedKeywordId) ?? projectKeywords[0] ?? null;
  const detailKey = selectedKw && projectId ? `${projectId}:${selectedKw.id}:${reloadNonce}` : '';

  useEffect(() => {
    if (!projectId || !selectedKw) return undefined;
    const controller = new AbortController();
    fetchKeywordDetailApi(projectId, selectedKw.id, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const mapped = res.videos.map(mapYoutubeVideoDtoToItem);
        registerVideosInMemory(mapped);
        setDetailState({ key: detailKey, data: res, videos: mapped, error: null });
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setDetailState({
          key: detailKey,
          data: null,
          videos: [],
          error: err instanceof ApiClientError ? err.message : 'Không tải được chi tiết kết quả từ khóa.',
        });
      });
    return () => {
      controller.abort();
    };
  }, [projectId, selectedKw, detailKey, registerVideosInMemory]);

  useEffect(
    () => () => {
      scanAbortRef.current?.abort();
    },
    [],
  );

  if (!project) return <NoProjectEmpty />;

  const isLoading = overviewState.key !== overviewKey && overviewState.error === null;
  const linkedFeedCount = overviewState.key === overviewKey && overviewState.data ? overviewState.data.linkedFeedCount : project.linkedFeedIds.length;
  const rssSignals = overviewState.key === overviewKey && overviewState.data ? overviewState.data.rssSignals : null;
  const activeDetail = detailState.key === detailKey ? detailState.data : null;
  const matchedVideos = detailState.key === detailKey ? detailState.videos : [];
  const detailLoading = Boolean(selectedKw) && detailState.key !== detailKey && detailState.error === null;

  const scanBlocked =
    !backendOnline ||
    !systemSettings.legalConsentAccepted ||
    systemSettings.apiKeyStatus !== 'configured' ||
    quotaStatus.searchQueries.exhausted ||
    quotaStatus.generalData.exhausted ||
    scanning;

  const priorityLabels: Record<IdeaPriority, string> = {
    high: 'Cao',
    medium: 'Trung bình',
    low: 'Thấp',
  };

  const executeScan = (ids: string[]) => {
    if (ids.length === 0 || scanBlocked) return;
    scanAbortRef.current?.abort();
    const controller = new AbortController();
    scanAbortRef.current = controller;
    setPendingBatchConfirmIds(null);
    setScanning(true);
    void scanProjectKeywordsApi(project.id, ids, 25, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setOverviewState({ key: overviewKey, data: res.overview, error: null });
        setSelectedIds([]);
        setReloadNonce((n) => n + 1);
        void syncQuotaStatus();
        pushToast(
          'success',
          `Đã quét xong ${res.scannedCount} từ khóa (${res.scannedCount} Search Queries · 0 Search Volume giả).`,
        );
      })
      .catch((err) => {
        if (isAbortError(err)) {
          pushToast('success', 'Đã hủy tác vụ quét từ khóa.');
          return;
        }
        void syncQuotaStatus();
        setReloadNonce((n) => n + 1);
        pushToast('error', err instanceof ApiClientError ? err.message : 'Quét từ khóa YouTube thất bại.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setScanning(false);
      });
  };

  const handleAddKw = () => {
    if (!newKw.trim() || adding) return;
    setAdding(true);
    void createProjectKeywordApi(project.id, { keyword: newKw.trim(), priority })
      .then((created) => {
        setNewKw('');
        updateViewState({ selectedKeywordId: created.id });
        setReloadNonce((n) => n + 1);
        pushToast('success', `Đã thêm từ khóa "${created.keyword}" vào SQLite (0 quota).`);
      })
      .catch((err) => {
        pushToast('error', err instanceof ApiClientError ? err.message : 'Không thêm được từ khóa.');
      })
      .finally(() => setAdding(false));
  };

  const handleDeleteKw = (kwId: string) => {
    void deleteProjectKeywordApi(project.id, kwId)
      .then(() => {
        setSelectedIds((prev) => prev.filter((id) => id !== kwId));
        setReloadNonce((n) => n + 1);
        pushToast('success', 'Đã xóa từ khóa khỏi Project.');
      })
      .catch((err) => {
        pushToast('error', err instanceof ApiClientError ? err.message : 'Không xóa được từ khóa.');
      });
  };

  const toggleSelectKw = (kwId: string) => {
    setSelectedIds((prev) => (prev.includes(kwId) ? prev.filter((id) => id !== kwId) : [...prev, kwId]));
  };

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Nghiên cứu từ khóa (P4) — {project.name}</h1>
            <span className="rs-badge">Standard Mode · Không hiển thị Search Volume giả</span>
          </div>
          <p className="rs-page-subtitle">
            Áp dụng mặc định thị trường <strong>{project.regionCode}</strong> / ngôn ngữ <strong>{project.relevanceLanguage}</strong> · Chi phí mỗi từ khóa khi quét: 1 Search Queries + 1 unit API
          </p>
        </div>
        {scanning && (
          <button
            type="button"
            className="rs-btn rs-btn-danger"
            onClick={() => {
              scanAbortRef.current?.abort();
              setScanning(false);
            }}
          >
            Hủy quét đang chạy (Cancel)
          </button>
        )}
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      <div className="rs-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flex: '1 1 360px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="rs-input"
            style={{ flex: '1 1 220px' }}
            placeholder="Thêm từ khóa mới cho Project này..."
            value={newKw}
            onChange={(e) => setNewKw(e.target.value)}
          />
          <select
            aria-label="Mức ưu tiên từ khóa"
            className="rs-select rs-select-compact"
            value={priority}
            onChange={(e) => setPriority(e.target.value as IdeaPriority)}
          >
            <option value="high">Ưu tiên: Cao</option>
            <option value="medium">Ưu tiên: Trung bình</option>
            <option value="low">Ưu tiên: Thấp</option>
          </select>
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            disabled={!newKw.trim() || adding}
            onClick={handleAddKw}
          >
            {adding ? 'Đang lưu...' : '+ Thêm từ khóa'}
          </button>
        </div>

        {selectedIds.length > 0 && (
          <button
            type="button"
            className="rs-btn rs-btn-tinted"
            disabled={scanBlocked}
            onClick={() => {
              if (selectedIds.length === 1) {
                executeScan(selectedIds);
              } else {
                setPendingBatchConfirmIds(selectedIds);
              }
            }}
          >
            Quét {selectedIds.length} từ khóa đã chọn ({selectedIds.length} Search Queries)
          </button>
        )}
      </div>

      {pendingBatchConfirmIds && (
        <div className="rs-banner rs-banner-warn" role="alert">
          <div style={{ flex: 1 }}>
            <strong>Xác nhận dự toán quota trước khi quét hàng loạt:</strong> Sẽ quét{' '}
            <strong>{pendingBatchConfirmIds.length} từ khóa</strong> theo thị trường{' '}
            <strong>{project.regionCode}</strong> / ngôn ngữ <strong>{project.relevanceLanguage}</strong> — tiêu thụ{' '}
            <strong>{pendingBatchConfirmIds.length} lượt Search Queries</strong> và tối thiểu{' '}
            <strong>{pendingBatchConfirmIds.length} units General Data API</strong> (0 auto-retry trên search.list).
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="rs-btn rs-btn-primary rs-btn-sm" onClick={() => executeScan(pendingBatchConfirmIds)}>
              Xác nhận quét ngay
            </button>
            <button type="button" className="rs-btn rs-btn-secondary rs-btn-sm" onClick={() => setPendingBatchConfirmIds(null)}>
              Hủy
            </button>
          </div>
        </div>
      )}

      {overviewState.error ? (
        <EmptyStateCard
          title="Không đọc được từ khóa Project"
          description={overviewState.error}
          actionLabel="Thử lại"
          onAction={() => setReloadNonce((n) => n + 1)}
        />
      ) : isLoading ? (
        <LoadingSkeletonCard label="Đang tải danh sách từ khóa & tín hiệu RSS liên kết Project..." />
      ) : projectKeywords.length === 0 ? (
        <EmptyStateCard
          title="Chưa có từ khóa nghiên cứu nào trong Project"
          description="Thêm các cụm từ khóa chủ lực (hoặc bấm + Lưu từ khóa ở G3) để quét video thực tế và đối chiếu RSS."
        />
      ) : (
        <div className="rs-detail-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="rs-table-wrap">
              <table className="rs-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả từ khóa"
                        checked={projectKeywords.length > 0 && selectedIds.length === projectKeywords.length}
                        onChange={(e) => {
                          setSelectedIds(e.target.checked ? projectKeywords.map((k) => k.id) : []);
                        }}
                      />
                    </th>
                    <th>Từ khóa của Project</th>
                    <th>Lần quét YouTube cuối</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {projectKeywords.map((kw) => {
                    const selected = selectedKw?.id === kw.id;
                    return (
                      <tr key={kw.id} style={selected ? { background: 'var(--rs-bg-hover)' } : undefined}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Chọn từ khóa ${kw.keyword}`}
                            checked={selectedIds.includes(kw.id)}
                            onChange={() => toggleSelectKw(kw.id)}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="rs-title-link"
                            onClick={() => updateViewState({ selectedKeywordId: kw.id })}
                          >
                            {kw.keyword}
                          </button>
                          <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)', marginTop: 2 }}>
                            Ưu tiên: <strong>{priorityLabels[kw.priority]}</strong> · Khớp RSS Project: {kw.rssMatchCount ?? 0} bài · Cache YT: {kw.cachedResultCount} kq
                          </div>
                        </td>
                        <td style={{ fontSize: '12.5px' }}>
                          {kw.lastScannedAt && kw.lastSessionId ? (
                            <span className="rs-badge rs-badge-success">
                              {formatDateTimeVi(kw.lastScannedAt)} (Còn hạn 30d)
                            </span>
                          ) : (
                            <span className="rs-badge">Chưa có cache 30d</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="rs-btn rs-btn-sm rs-btn-primary"
                              disabled={scanBlocked}
                              onClick={() => executeScan([kw.id])}
                            >
                              Quét YT (1 Search)
                            </button>
                            <button
                              type="button"
                              className="rs-btn rs-btn-sm rs-btn-tinted"
                              onClick={() =>
                                openSaveIdeaModal({
                                  title: `Chủ đề từ khóa: ${kw.keyword}`,
                                  sourceType: 'keyword',
                                  sourceRefId: kw.id,
                                  sourceTitleSnapshot: `Từ khóa Project: ${kw.keyword}`,
                                  sourceUrl: '',
                                  tags: [kw.keyword],
                                })
                              }
                            >
                              + Ý tưởng
                            </button>
                            <button
                              type="button"
                              className="rs-btn rs-btn-sm rs-btn-danger"
                              onClick={() => handleDeleteKw(kw.id)}
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

            {selectedKw && (
              <>
                <h2 style={{ margin: '4px 0 0', fontSize: '16px' }}>
                  Kết quả YouTube lưu đệm (0 quota) cho: “{selectedKw.keyword}”
                </h2>
                {detailLoading ? (
                  <LoadingSkeletonCard label="Đang đọc kết quả từ khóa còn hạn <= 30 ngày..." />
                ) : (
                  <VideoResearchTable
                    videos={matchedVideos}
                    fromScreen="project-keywords"
                    emptyTitle="Từ khóa này chưa có kết quả video trong cache"
                    emptyDescription="Bấm Quét YT (1 lượt Search Queries + 1 unit General Data API) để lấy danh sách video thực tế từ YouTube."
                  />
                )}
              </>
            )}
          </div>

          <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <span className="rs-badge rs-badge-success" style={{ marginBottom: 6 }}>
                Nguồn: RSS (Dữ liệu ngoài YouTube)
              </span>
              <h2 style={{ margin: 0, fontSize: '15.5px' }}>Tín hiệu từ RSS liên kết Project</h2>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
                Chỉ truy vấn trên {linkedFeedCount} nguồn RSS đã gắn trong Cài đặt dự án P6 (0 quota YouTube).
              </p>
            </div>

            {linkedFeedCount === 0 ? (
              <div className="rs-card-subtle" style={{ fontSize: '13px', color: 'var(--rs-text-secondary)' }}>
                Project này chưa gắn nguồn RSS nào. Mở{' '}
                <button
                  type="button"
                  className="rs-crumb-btn"
                  style={{ fontWeight: 700, padding: 0 }}
                  onClick={() => navigate('project-settings')}
                >
                  Cài đặt dự án (P6)
                </button>{' '}
                để liên kết nguồn RSS.
              </div>
            ) : !rssSignals || rssSignals.items.length === 0 ? (
              <span style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
                Chưa đủ bài viết mới từ các nguồn RSS đã gắn trong 7 ngày qua để thống kê cụm từ.
              </span>
            ) : (
              rssSignals.items.slice(0, 5).map((t) => (
                <div
                  key={t.phrase}
                  className="rs-card-subtle"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                >
                  <div style={{ fontWeight: 600 }}>{t.phrase}</div>
                  <SparklineCell
                    points={t.points7d}
                    badgeLabel={`${t.articleCount} bài RSS`}
                    directionLabel={t.direction === 'up' ? '↗ Tăng' : '→ Ổn'}
                    tooltipTitle="Tần suất xuất hiện trên RSS Project"
                    tooltipDetail="Tính bằng Python tất định trên các bài báo RSS gắn vào Project này."
                    insufficientText="Chưa đủ mốc"
                  />
                </div>
              ))
            )}

            {selectedKw && activeDetail && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                <strong style={{ fontSize: '13.5px' }}>
                  Bài báo RSS Project khớp “{selectedKw.keyword}” ({activeDetail.matchedRssArticles.length})
                </strong>
                {activeDetail.matchedRssArticles.length === 0 ? (
                  <span style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
                    Không có bài viết nào trong các feed RSS của Project chứa từ khóa này.
                  </span>
                ) : (
                  activeDetail.matchedRssArticles.slice(0, 5).map((art) => (
                    <div key={art.id} className="rs-card-subtle">
                      <button
                        type="button"
                        className="rs-title-link"
                        style={{ fontSize: '13px' }}
                        onClick={() => navigate('article-detail', { params: { articleId: art.id } })}
                      >
                        {art.title}
                      </button>
                      <div style={{ fontSize: '11.5px', color: 'var(--rs-text-muted)', marginTop: 2 }}>
                        {art.feedName} · {formatDateTimeVi(art.publishedAt ?? art.fetchedAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export const ProjectIdeasScreen: React.FC = () => {
  const project = useActiveProject();
  const { currentEntry, navigate, updateViewState } = useAppNavigation();
  const { isBootstrapping, ideas, openSaveIdeaModal, updateProjectIdeaStatus, detachIdeaFromProject } =
    usePrototypeWorkspace();
  const vs = currentEntry.viewState;

  if (!project) return <NoProjectEmpty />;

  const priorityLabels: Record<IdeaPriority, string> = {
    high: 'Cao',
    medium: 'Trung bình',
    low: 'Thấp',
  };

  const projectIdeas = ideas.filter((idea) => {
    const link = idea.projectLinks[project.id];
    if (!link) return false;
    if (vs.statusFilter !== 'all' && link.status !== vs.statusFilter) return false;
    if (vs.priorityFilter !== 'all' && link.priority !== vs.priorityFilter) return false;
    if (vs.search.trim()) {
      const q = vs.search.trim().toLowerCase();
      return (
        idea.title.toLowerCase().includes(q) ||
        link.projectAngle.toLowerCase().includes(q) ||
        link.projectNotes.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <h1 className="rs-page-title">Quản lý ý tưởng (P5) — {project.name}</h1>
          <p className="rs-page-subtitle">
            Giao diện Danh sách / Bảng gọn nhẹ (MVP V1) · 5 trạng thái sản xuất độc lập cho Project này
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
              sourceTitleSnapshot: `Tạo trực tiếp trong ${project.name}`,
              sourceUrl: '',
              tags: [],
            })
          }
        >
          + Thêm Ý tưởng cho Project
        </button>
      </div>

      <GlobalModeBanners />

      <div className="rs-toolbar" style={{ justifyContent: 'space-between' }}>
        <div className="rs-pill-group" role="group" aria-label="Lọc theo 5 trạng thái sản xuất">
          <button
            type="button"
            className={`rs-pill-tab ${vs.statusFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => updateViewState({ statusFilter: 'all' })}
          >
            Tất cả
          </button>
          {(Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[]).map((st) => (
            <button
              key={st}
              type="button"
              className={`rs-pill-tab ${vs.statusFilter === st ? 'is-active' : ''}`}
              onClick={() => updateViewState({ statusFilter: st })}
            >
              {IDEA_STATUS_LABELS[st]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flex: '1 1 260px' }}>
          <input
            type="search"
            className="rs-input"
            style={{ flex: 1 }}
            placeholder="Tìm tiêu đề hoặc góc khai thác..."
            value={vs.search}
            onChange={(e) => updateViewState({ search: e.target.value })}
          />
          <select
            aria-label="Lọc theo mức ưu tiên"
            className="rs-select rs-select-compact"
            value={vs.priorityFilter}
            onChange={(e) => updateViewState({ priorityFilter: e.target.value as 'all' | IdeaPriority })}
          >
            <option value="all">Mọi ưu tiên</option>
            <option value="high">Cao</option>
            <option value="medium">Trung bình</option>
            <option value="low">Thấp</option>
          </select>
        </div>
      </div>

      {isBootstrapping && ideas.length === 0 ? (
        <LoadingSkeletonCard label="Đang tải danh sách Ý tưởng của Project từ SQLite..." />
      ) : projectIdeas.length === 0 ? (
        <EmptyStateCard
          title="Chưa có ý tưởng nào khớp trạng thái lọc"
          description="Lưu ý tưởng từ Video bứt phá / Nghiên cứu từ khóa / Tin tức RSS hoặc gắn từ Kho ý tưởng chung."
          actionLabel="Mở Kho ý tưởng chung"
          onAction={() => navigate('global-ideas')}
        />
      ) : (
        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th>Tiêu đề Ý tưởng &amp; Góc khai thác riêng</th>
                <th>Liên kết chéo</th>
                <th>Ưu tiên</th>
                <th>Trạng thái sản xuất (5 trạng thái)</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {projectIdeas.map((idea) => {
                const link = idea.projectLinks[project.id];
                const otherProjectsCount = Math.max(0, Object.keys(idea.projectLinks).length - 1);
                const safePublishedUrl =
                  link.publishedVideoUrl.startsWith('https://') || link.publishedVideoUrl.startsWith('http://')
                    ? link.publishedVideoUrl
                    : '';
                return (
                  <tr key={idea.id}>
                    <td style={{ minWidth: 320 }}>
                      <button
                        type="button"
                        className="rs-title-link"
                        onClick={() => navigate('idea-detail', { params: { ideaId: idea.id } })}
                      >
                        {idea.title}
                      </button>
                      <div style={{ fontSize: '13px', color: 'var(--rs-text-secondary)', marginTop: 4 }}>
                        <strong>Góc khai thác:</strong> {link.projectAngle || '(Chưa nhập)'}
                      </div>
                      {safePublishedUrl && (
                        <div style={{ fontSize: '12px', marginTop: 4 }}>
                          Video đã xuất bản:{' '}
                          <a href={safePublishedUrl} target="_blank" rel="noopener noreferrer">
                            {safePublishedUrl}
                          </a>
                        </div>
                      )}
                    </td>
                    <td>
                      {otherProjectsCount > 0 ? (
                        <span className="rs-badge">Dùng chung với {otherProjectsCount} Project khác</span>
                      ) : (
                        <span className="rs-badge">Chỉ Project này</span>
                      )}
                    </td>
                    <td>
                      <span className="rs-badge">{priorityLabels[link.priority]}</span>
                    </td>
                    <td>
                      <select
                        aria-label={`Trạng thái cho ${idea.title}`}
                        className="rs-select rs-select-compact"
                        value={link.status}
                        onChange={(e) => {
                          void updateProjectIdeaStatus(idea.id, project.id, e.target.value as IdeaStatus);
                        }}
                      >
                        {(Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[]).map((st) => (
                          <option key={st} value={st}>
                            {IDEA_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-secondary"
                          onClick={() => navigate('idea-detail', { params: { ideaId: idea.id } })}
                        >
                          Sửa góc &amp; Link
                        </button>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-ghost"
                          onClick={() => {
                            void detachIdeaFromProject(idea.id, project.id);
                          }}
                        >
                          Gỡ khỏi Project
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
    </div>
  );
};

const ProjectSettingsForm: React.FC<{ project: ProjectItem }> = ({ project }) => {
  const { updateProject, updateProjectRssFeeds, exportProjectJson, deleteProject, rssFeedDtos } =
    usePrototypeWorkspace();
  const { navigate } = useAppNavigation();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [regionCode, setRegionCode] = useState(project.regionCode);
  const [relevanceLanguage, setRelevanceLanguage] = useState(project.relevanceLanguage);
  const [targetFormat, setTargetFormat] = useState<ProjectItem['targetFormat']>(project.targetFormat);
  const [linkedFeedIds, setLinkedFeedIds] = useState<string[]>(project.linkedFeedIds);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const toggleFeed = (fid: string) => {
    setLinkedFeedIds((prev) => (prev.includes(fid) ? prev.filter((id) => id !== fid) : [...prev, fid]));
  };

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Cài đặt dự án (P6) — {project.name}</h1>
            <span className="rs-badge rs-badge-success">Dữ liệu thật SQLite</span>
          </div>
          <p className="rs-page-subtitle">
            Cấu hình thị trường/ngôn ngữ cô lập, liên kết nguồn RSS cho Project, tải JSON sạch và xóa an toàn
          </p>
        </div>
      </div>

      <GlobalModeBanners />

      <section className="rs-card" style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>Tên Project *</span>
          <input type="text" className="rs-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>Mô tả định hướng kênh</span>
          <textarea className="rs-textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <div className="rs-grid-3">
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Quốc gia (regionCode)</span>
            <select className="rs-select" value={regionCode} onChange={(e) => setRegionCode(e.target.value)}>
              <option value="VN">VN — Việt Nam</option>
              <option value="US">US — Hoa Kỳ</option>
              <option value="JP">JP — Nhật Bản</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Ngôn ngữ (relevanceLanguage)</span>
            <select className="rs-select" value={relevanceLanguage} onChange={(e) => setRelevanceLanguage(e.target.value)}>
              <option value="vi">vi — Tiếng Việt</option>
              <option value="en">en — English</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Định dạng trọng tâm</span>
            <select
              className="rs-select"
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value as ProjectItem['targetFormat'])}
            >
              <option value="all">Tất cả</option>
              <option value="long_form">Video dài</option>
              <option value="shorts">Shorts</option>
            </select>
          </label>
        </div>

        <div className="rs-card-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 600, fontSize: '13.5px' }}>
              Nguồn RSS toàn cục liên kết với Project này (<code>project_rss_feeds</code> · {linkedFeedIds.length} đã chọn):
            </div>
            <button type="button" className="rs-btn rs-btn-sm rs-btn-secondary" onClick={() => navigate('global-news')}>
              Quản lý thêm ở G4 RSS →
            </button>
          </div>
          {rssFeedDtos.length === 0 ? (
            <span style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
              Chưa có nguồn RSS nào trong hệ thống. Hãy sang màn hình G4 Tin tức &amp; thảo luận để thêm nguồn RSS trước.
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rssFeedDtos.map((f) => (
                <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={linkedFeedIds.includes(f.id)}
                    onChange={() => toggleFeed(f.id)}
                  />
                  <span>{f.name}</span>
                  <span className="rs-badge" style={{ fontSize: '11.5px' }}>
                    {f.articleCount} bài
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            disabled={!name.trim() || saving}
            onClick={() => {
              void (async () => {
                setSaving(true);
                try {
                  const okProj = await updateProject(project.id, {
                    name,
                    description,
                    regionCode,
                    relevanceLanguage,
                    targetFormat,
                  });
                  if (okProj) {
                    await updateProjectRssFeeds(project.id, linkedFeedIds);
                  }
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            {saving ? 'Đang lưu...' : 'Lưu cấu hình & Liên kết RSS Project'}
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-secondary"
            disabled={exporting}
            onClick={() => {
              void (async () => {
                setExporting(true);
                try {
                  await exportProjectJson(project.id, project.name);
                } finally {
                  setExporting(false);
                }
              })();
            }}
          >
            {exporting ? 'Đang xuất JSON...' : 'Tải xuống JSON Project đơn giản (0 API Key)'}
          </button>
        </div>
      </section>

      <section
        className="rs-card"
        style={{ maxWidth: 820, borderColor: 'var(--rs-danger-border)', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <h2 style={{ margin: 0, fontSize: '15.5px', color: 'var(--rs-danger-text)' }}>
          Khu vực nguy hiểm: Xóa Project an toàn
        </h2>
        <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--rs-text-secondary)' }}>
          Chỉ xóa Project này và các bảng liên kết/từ khóa riêng của Project. Backend tự động tạo tệp sao lưu{' '}
          <code>project_recovery_*.json</code> trong thư mục <code>backups/</code> và bảo toàn 100% thực thể kênh/video
          dùng chung cùng Kho ý tưởng chung.
        </p>
        <div>
          <button
            type="button"
            className="rs-btn rs-btn-danger"
            disabled={deleting}
            onClick={() => setDeleteOpen(true)}
          >
            Xóa Project này...
          </button>
        </div>
      </section>

      <ConfirmDeleteModal
        open={deleteOpen}
        title="Xác nhận xóa Project"
        warningText={`Bạn sắp xóa Project "${project.name}". Thao tác chỉ gỡ dữ liệu riêng của Project, tạo bản sao lưu khôi phục JSON và giữ 100% thực thể dùng chung.`}
        requireExactText={project.name}
        confirmLabel="Xóa vĩnh viễn Project"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          void (async () => {
            setDeleteOpen(false);
            setDeleting(true);
            try {
              await deleteProject(project.id, project.name);
            } finally {
              setDeleting(false);
            }
          })();
        }}
      />
    </div>
  );
};

export const ProjectSettingsScreen: React.FC = () => {
  const project = useActiveProject();
  const { isBootstrapping } = usePrototypeWorkspace();
  if (isBootstrapping) {
    return (
      <div className="rs-container">
        <LoadingSkeletonCard label="Đang tải Cài đặt dự án..." />
      </div>
    );
  }
  if (!project) return <NoProjectEmpty />;
  return <ProjectSettingsForm key={`${project.id}-${project.updatedAt}`} project={project} />;
};
