import React, { useEffect, useState } from 'react';
import {
  ApiClientError,
  fetchChannelDetailApi,
  fetchRssArticleDetailApi,
  fetchVideoDetailApi,
  isAbortError,
  updateRssArticleApi,
} from '../api/client';
import { formatDateTimeVi, mapYoutubeVideoDtoToItem } from '../api/mappers';
import type {
  ChannelDetailResponseDto,
  RssArticleDto,
  VideoDetailResponseDto,
} from '../api/types';
import { IDEA_STATUS_LABELS, formatInt, formatSnapshotDeltaLabel } from '../prototype/demoData';
import type { IdeaItem, IdeaPriority, IdeaStatus } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace } from '../state/workspaceContext';
import { FormatBadgeGroup } from '../components/FormatBadgeGroup';
import { ConfirmDeleteModal } from '../components/Modals';
import { SparklineCell } from '../components/SparklineCell';
import { EmptyStateCard, GlobalModeBanners, LoadingSkeletonCard } from '../components/StatusViews';
import { VideoResearchTable } from '../components/VideoResearchTable';

export const ChannelDetailScreen: React.FC = () => {
  const { currentEntry, goBack, navigate } = useAppNavigation();
  const { projects, addChannelToProject, registerVideosInMemory } = usePrototypeWorkspace();
  const channelId = currentEntry.params.channelId ?? '';
  const activeProject = projects.find((p) => p.id === currentEntry.projectId) ?? projects[0] ?? null;

  const [state, setState] = useState<{
    key: string;
    detail: ChannelDetailResponseDto | null;
    error: string | null;
  }>({ key: '', detail: null, error: null });

  useEffect(() => {
    if (!channelId) return undefined;
    const controller = new AbortController();
    fetchChannelDetailApi(channelId, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        registerVideosInMemory(res.videos.map(mapYoutubeVideoDtoToItem));
        setState({ key: channelId, detail: res, error: null });
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setState({
          key: channelId,
          detail: null,
          error: err instanceof ApiClientError ? err.message : 'Không tải được Chi tiết kênh từ SQLite.',
        });
      });
    return () => {
      controller.abort();
    };
  }, [channelId, registerVideosInMemory]);

  if (!channelId) {
    return (
      <div className="rs-container">
        <EmptyStateCard
          title="Thiếu mã kênh YouTube"
          description="Vui lòng chọn một kênh từ Khám phá xu hướng, Tìm kiếm hoặc Theo dõi đối thủ."
          actionLabel="Quay lại"
          onAction={goBack}
        />
      </div>
    );
  }

  if (state.key !== channelId && state.error === null) {
    return (
      <div className="rs-container">
        <LoadingSkeletonCard label="Đang tải Chi tiết kênh từ SQLite..." />
      </div>
    );
  }

  if (state.error || !state.detail) {
    return (
      <div className="rs-container">
        <EmptyStateCard
          title="Không đọc được thông tin kênh"
          description={state.error ?? 'Kênh không tồn tại hoặc đã bị xóa khỏi bộ nhớ đệm.'}
          actionLabel="← Quay lại"
          onAction={goBack}
        />
      </div>
    );
  }

  const { channel, videos, linkedProjects } = state.detail;
  const videoItems = videos.map(mapYoutubeVideoDtoToItem);
  const rawHandle = channel.handle ? (channel.handle.startsWith('@') ? channel.handle : `@${channel.handle}`) : '';
  const channelExternalUrl = rawHandle
    ? `https://www.youtube.com/${encodeURIComponent(rawHandle).replace(/^%40/, '@')}`
    : `https://www.youtube.com/channel/${encodeURIComponent(channel.channelId)}`;

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">
              Chi tiết kênh: {channel.title ?? channel.channelId}
            </h1>
            {channel.handle && <span className="rs-badge">{channel.handle}</span>}
            <span className={`rs-badge ${channel.hasValidApiData ? 'rs-badge-success' : 'rs-badge-warning'}`}>
              {channel.hasValidApiData ? 'Hạn cache <= 30 ngày' : 'Metadata API đã hết hạn 30 ngày'}
            </span>
          </div>
          <p className="rs-page-subtitle">
            Cập nhật gần nhất: {formatDateTimeVi(channel.apiFetchedAt)} · Dữ liệu gốc YouTube Data API
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={goBack}>
            ← Quay lại
          </button>
          {activeProject && !linkedProjects.some((lp) => lp.projectId === activeProject.id) && (
            <button
              type="button"
              className="rs-btn rs-btn-primary"
              onClick={() => {
                void addChannelToProject(activeProject.id, channel.channelId);
              }}
            >
              + Theo dõi đối thủ trong {activeProject.name}
            </button>
          )}
          <a className="rs-btn rs-btn-tinted" href={channelExternalUrl} target="_blank" rel="noopener noreferrer">
            Mở kênh trên YouTube ↗
          </a>
        </div>
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      <div className="rs-grid-3">
        <div className="rs-card">
          <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>Subscriber (YouTube API gốc)</div>
          <div className="rs-tabular" style={{ fontSize: '20px', fontWeight: 700, marginTop: 4 }}>
            {formatInt(channel.subscriberCount)}
          </div>
        </div>
        <div className="rs-card">
          <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>Tổng số video công khai</div>
          <div className="rs-tabular" style={{ fontSize: '20px', fontWeight: 700, marginTop: 4 }}>
            {formatInt(channel.videoCount)}
          </div>
        </div>
        <div className="rs-card">
          <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>Project đang theo dõi kênh này</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {linkedProjects.length === 0 ? (
              <span style={{ fontSize: '13px', color: 'var(--rs-text-muted)' }}>Chưa gắn vào Project đối thủ nào</span>
            ) : (
              linkedProjects.map((lp) => (
                <button
                  key={lp.projectId}
                  type="button"
                  className="rs-badge"
                  onClick={() => navigate('project-overview', { projectId: lp.projectId })}
                >
                  {lp.projectName}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <h2 style={{ margin: '4px 0 0', fontSize: '16px' }}>
        Video còn hạn cache &lt;= 30 ngày của kênh ({videoItems.length} video)
      </h2>

      <VideoResearchTable
        videos={videoItems}
        fromScreen="channel-detail"
        fromChannelId={channel.channelId}
        pageSize={6}
        showChannelFilter={false}
        showSnapshotsColumn
        projectIdForBreakout={currentEntry.projectId ?? undefined}
      />
    </div>
  );
};

export const VideoDetailScreen: React.FC = () => {
  const { currentEntry, goBack, navigate } = useAppNavigation();
  const {
    projects,
    breakoutByProject,
    toggleBreakoutFlag,
    setBreakoutNote,
    openSaveIdeaModal,
    registerVideosInMemory,
  } = usePrototypeWorkspace();

  const videoId = currentEntry.params.videoId ?? '';
  const activeProject = projects.find((p) => p.id === currentEntry.projectId) ?? projects[0] ?? null;
  const reqKey = `${videoId}:${activeProject?.id ?? ''}`;

  const [state, setState] = useState<{
    key: string;
    detail: VideoDetailResponseDto | null;
    error: string | null;
  }>({ key: '', detail: null, error: null });

  useEffect(() => {
    if (!videoId) return undefined;
    const controller = new AbortController();
    fetchVideoDetailApi(videoId, activeProject?.id ?? null, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        registerVideosInMemory([mapYoutubeVideoDtoToItem(res.video)]);
        setState({ key: reqKey, detail: res, error: null });
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setState({
          key: reqKey,
          detail: null,
          error: err instanceof ApiClientError ? err.message : 'Không tải được Chi tiết video từ SQLite.',
        });
      });
    return () => {
      controller.abort();
    };
  }, [videoId, activeProject?.id, reqKey, registerVideosInMemory]);

  if (!videoId) {
    return (
      <div className="rs-container">
        <EmptyStateCard
          title="Thiếu mã Video YouTube"
          description="Vui lòng chọn một video từ danh sách nghiên cứu để mở Chi tiết Video."
          actionLabel="Quay lại"
          onAction={goBack}
        />
      </div>
    );
  }

  if (state.key !== reqKey && state.error === null) {
    return (
      <div className="rs-container">
        <LoadingSkeletonCard label="Đang tải Chi tiết Video từ SQLite..." />
      </div>
    );
  }

  if (state.error || !state.detail) {
    return (
      <div className="rs-container">
        <EmptyStateCard
          title="Không tìm thấy video yêu cầu"
          description={state.error ?? 'Video chưa được lưu trên SQLite hoặc đã bị xóa cache.'}
          actionLabel="← Quay lại"
          onAction={goBack}
        />
      </div>
    );
  }

  const { video: dto, linkedIdeas } = state.detail;
  const video = mapYoutubeVideoDtoToItem(dto);
  const snapshots = video.snapshots30d;

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Chi tiết Video (Standard Mode)</h1>
            <span className="rs-badge">Lấy từ API: {video.apiFetchedAt}</span>
            <span className={`rs-badge ${dto.hasValidApiData ? 'rs-badge-success' : 'rs-badge-warning'}`}>
              {dto.hasValidApiData ? `Hết hạn 30 ngày: ${video.apiExpiresAt}` : 'Metadata API đã hết hạn 30 ngày'}
            </span>
          </div>
          <p className="rs-page-subtitle">
            {dto.channelId ? (
              <>
                Kênh:{' '}
                <button
                  type="button"
                  className="rs-crumb-btn"
                  style={{ fontWeight: 700, padding: 0 }}
                  onClick={() => navigate('channel-detail', { params: { channelId: dto.channelId! } })}
                >
                  {video.channelTitle}
                </button>{' '}
                ·{' '}
              </>
            ) : null}
            Xuất bản: {video.publishedAt} · Thời lượng: {video.durationDisplay}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={goBack}>
            ← Quay lại (Giữ state trước)
          </button>
          <a
            className="rs-btn rs-btn-primary"
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Mở video trên YouTube ↗
          </a>
        </div>
      </div>

      {!dto.hasValidApiData && (
        <div className="rs-banner rs-banner-warn" role="status">
          <div>
            <strong>Dữ liệu YouTube API của video này đã quá hạn 30 ngày và được xóa sạch theo chính sách:</strong> Nhãn
            định dạng thủ công, Ghi chú và Ý tưởng liên kết của bạn vẫn được giữ nguyên 100%.
          </div>
        </div>
      )}

      <div className="rs-detail-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: '17px', lineHeight: 1.35 }}>{video.title}</h2>
            <div className="rs-grid-4">
              <div className="rs-card-subtle">
                <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>Lượt xem (viewCount)</div>
                <div className="rs-tabular" style={{ fontSize: '18px', fontWeight: 700 }}>
                  {formatInt(video.viewCount)}
                </div>
              </div>
              <div className="rs-card-subtle">
                <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>Lượt thích (likeCount)</div>
                <div className="rs-tabular" style={{ fontSize: '18px', fontWeight: 700 }}>
                  {formatInt(video.likeCount)}
                </div>
              </div>
              <div className="rs-card-subtle">
                <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>Bình luận (commentCount)</div>
                <div className="rs-tabular" style={{ fontSize: '18px', fontWeight: 700 }}>
                  {formatInt(video.commentCount)}
                </div>
              </div>
              <div className="rs-card-subtle">
                <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>Thời lượng</div>
                <div className="rs-tabular" style={{ fontSize: '18px', fontWeight: 700 }}>
                  {video.durationDisplay}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
              Chỉ hiển thị số liệu YouTube API nguyên bản. Không tính Outlier Multiplier hay tỷ lệ Engagement.
            </div>
          </section>

          <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: '15.5px' }}>Phân loại định dạng 3 lớp (Lưu SQLite tách biệt nguồn)</h2>
            <FormatBadgeGroup video={video} />
          </section>

          <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: '15.5px' }}>
                Các mốc viewCount thô &lt;= 30 ngày (Kèm đúng timestamp thu thập)
              </h2>
              <SparklineCell
                points={snapshots.map((s) => s.viewCount)}
                labels={snapshots.map((s) => s.capturedAt)}
                badgeLabel={`${snapshots.length} mốc trong cache`}
                directionLabel={formatSnapshotDeltaLabel(snapshots)}
                tooltipTitle="Chuỗi mốc thô <= 30 ngày"
                tooltipDetail="Không lưu quá 30 ngày lịch và không tính vận tốc Views/ngày."
                insufficientText="Chưa đủ mốc thu thập"
              />
            </div>

            {snapshots.length > 0 && (
              <div className="rs-table-wrap">
                <table className="rs-table">
                  <thead>
                    <tr>
                      <th>Thời điểm thu thập</th>
                      <th className="rs-num-cell">viewCount gốc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((pt) => (
                      <tr key={pt.capturedAt}>
                        <td className="rs-mono">{pt.capturedAt}</td>
                        <td className="rs-num-cell" style={{ fontWeight: 700 }}>
                          {formatInt(pt.viewCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, marginBottom: 6 }}>
                Thẻ <code>snippet.tags</code> gốc từ YouTube API:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {video.tags.length === 0 ? (
                  <span style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>Không có thẻ tags khả dụng.</span>
                ) : (
                  video.tags.map((tag) => (
                    <span key={tag} className="rs-badge">
                      #{tag}
                    </span>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {activeProject && (
            <VideoBreakoutEditor
              key={`${activeProject.id}:${video.id}:${state.detail.breakout?.notes ?? ''}:${String(state.detail.breakout?.flagged ?? false)}`}
              projectName={activeProject.name}
              initialFlagged={breakoutByProject[activeProject.id]?.[video.id]?.flagged ?? state.detail.breakout?.flagged ?? false}
              initialNote={breakoutByProject[activeProject.id]?.[video.id]?.note ?? state.detail.breakout?.notes ?? ''}
              onToggleFlag={() => toggleBreakoutFlag(activeProject.id, video.id)}
              onSaveNote={(note, flagged) => setBreakoutNote(activeProject.id, video.id, note, flagged)}
            />
          )}

          <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '15.5px' }}>Ý tưởng gắn từ video này ({linkedIdeas.length})</h2>
              <button
                type="button"
                className="rs-btn rs-btn-sm rs-btn-primary"
                onClick={() =>
                  openSaveIdeaModal({
                    title: video.title,
                    sourceType: 'youtube_video',
                    sourceRefId: video.id,
                    sourceTitleSnapshot: video.title,
                    sourceUrl: `https://www.youtube.com/watch?v=${video.id}`,
                    tags: video.tags,
                  })
                }
              >
                + Lưu Ý tưởng
              </button>
            </div>
            {linkedIdeas.length === 0 ? (
              <span style={{ fontSize: '13px', color: 'var(--rs-text-muted)' }}>
                Chưa có ý tưởng nào lưu từ video này. Bấm "+ Lưu Ý tưởng" để lưu vào Kho chung hoặc Project.
              </span>
            ) : (
              linkedIdeas.map((idea) => (
                <div key={idea.id} className="rs-card-subtle">
                  <button
                    type="button"
                    className="rs-title-link"
                    onClick={() => navigate('idea-detail', { params: { ideaId: idea.id } })}
                  >
                    {idea.title}
                  </button>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

const VideoBreakoutEditor: React.FC<{
  projectName: string;
  initialFlagged: boolean;
  initialNote: string;
  onToggleFlag: () => Promise<boolean>;
  onSaveNote: (note: string, flagged: boolean) => Promise<boolean>;
}> = ({ projectName, initialFlagged, initialNote, onToggleFlag, onSaveNote }) => {
  const [flagged, setFlagged] = useState(initialFlagged);
  const [noteDraft, setNoteDraft] = useState(initialNote);
  const [saving, setSaving] = useState(false);

  return (
    <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: '15.5px' }}>Đánh dấu Bứt phá &amp; Ghi chú ({projectName})</h2>
      <button
        type="button"
        className={`rs-btn ${flagged ? 'rs-btn-primary' : 'rs-btn-secondary'}`}
        disabled={saving}
        onClick={() => {
          setSaving(true);
          void onToggleFlag().then((ok) => {
            if (ok) setFlagged((f) => !f);
            setSaving(false);
          });
        }}
      >
        {flagged ? '★ Đang gắn cờ Video Bứt phá' : '☆ Đánh dấu là Video Bứt phá'}
      </button>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Ghi chú phân tích riêng (User-Created Data · SQLite)</span>
        <textarea
          className="rs-textarea"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="Ghi lại cấu trúc hook, thumbnail, hoặc lý do video thu hút..."
        />
      </label>
      <button
        type="button"
        className="rs-btn rs-btn-secondary"
        disabled={saving}
        onClick={() => {
          setSaving(true);
          void onSaveNote(noteDraft, flagged).finally(() => setSaving(false));
        }}
      >
        {saving ? 'Đang lưu...' : 'Lưu ghi chú phân tích'}
      </button>
    </section>
  );
};

const ArticleDetailBody: React.FC<{
  initialArticle: RssArticleDto;
  onUpdated: (next: RssArticleDto) => void;
}> = ({ initialArticle, onUpdated }) => {
  const { goBack } = useAppNavigation();
  const { openSaveIdeaModal, pushToast } = usePrototypeWorkspace();
  const [article, setArticle] = useState(initialArticle);
  const [notesDraft, setNotesDraft] = useState(initialArticle.userNotes);
  const [saving, setSaving] = useState(false);

  const safeExternalUrl =
    article.canonicalUrl.startsWith('https://') || article.canonicalUrl.startsWith('http://')
      ? article.canonicalUrl
      : '';

  const handleSaveNotesOrBookmark = (patch: { bookmarked?: boolean; userNotes?: string }) => {
    setSaving(true);
    void updateRssArticleApi(article.id, patch)
      .then((updated) => {
        setArticle(updated);
        setNotesDraft(updated.userNotes);
        onUpdated(updated);
        pushToast('success', 'Đã lưu thông tin bài báo RSS vào SQLite (lưu bền vững ngoại tuyến).');
      })
      .catch((err) => {
        pushToast('error', err instanceof ApiClientError ? err.message : 'Không lưu được bài báo RSS.');
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Chi tiết bài báo RSS</h1>
            <span className="rs-badge rs-badge-success">{article.sourceLabel}</span>
          </div>
          <p className="rs-page-subtitle">
            {article.feedName} · Xuất bản: {formatDateTimeVi(article.publishedAt ?? article.fetchedAt)} · Văn bản thuần an toàn chống XSS
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={goBack}>
            ← Quay lại
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-secondary"
            disabled={saving}
            onClick={() => handleSaveNotesOrBookmark({ bookmarked: !article.bookmarked })}
          >
            {article.bookmarked ? '★ Đã đánh dấu' : '☆ Đánh dấu bài'}
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            onClick={() =>
              openSaveIdeaModal({
                title: article.title,
                sourceType: 'rss_article',
                sourceRefId: article.id,
                sourceTitleSnapshot: article.title,
                sourceUrl: safeExternalUrl,
                tags: [article.feedName],
              })
            }
          >
            + Tạo Ý tưởng từ bài báo này
          </button>
        </div>
      </div>

      <article className="rs-card" style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: '19px', lineHeight: 1.35 }}>{article.title}</h2>
        <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.65, color: 'var(--rs-text-secondary)' }}>
          {article.summaryText || 'Bài viết không có nội dung tóm tắt kèm theo trong RSS feed.'}
        </p>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6 }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Ghi chú cá nhân của bạn cho bài viết này (SQLite Local)</span>
          <textarea
            className="rs-textarea"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Ghi lại ý chính hoặc câu chuyện đáng chú ý để làm video..."
          />
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            disabled={saving}
            onClick={() => handleSaveNotesOrBookmark({ userNotes: notesDraft })}
          >
            {saving ? 'Đang lưu...' : 'Lưu ghi chú bài báo'}
          </button>
          {safeExternalUrl && (
            <a className="rs-btn rs-btn-secondary" href={safeExternalUrl} target="_blank" rel="noopener noreferrer">
              Mở bài viết gốc ngoài trình duyệt (https://) ↗
            </a>
          )}
        </div>
      </article>
    </div>
  );
};

export const ArticleDetailScreen: React.FC = () => {
  const { currentEntry, goBack } = useAppNavigation();
  const articleId = currentEntry.params.articleId ?? '';
  const [state, setState] = useState<{
    key: string;
    article: RssArticleDto | null;
    error: string | null;
  }>({ key: '', article: null, error: null });

  useEffect(() => {
    if (!articleId) return undefined;
    const controller = new AbortController();
    fetchRssArticleDetailApi(articleId, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setState({ key: articleId, article: res, error: null });
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setState({
          key: articleId,
          article: null,
          error: err instanceof ApiClientError ? err.message : 'Không tải được Chi tiết bài báo RSS.',
        });
      });
    return () => {
      controller.abort();
    };
  }, [articleId]);

  if (!articleId) {
    return (
      <div className="rs-container">
        <EmptyStateCard
          title="Chưa chọn bài báo RSS"
          description="Hãy mở một bài viết từ G4 Tin tức & thảo luận."
          actionLabel="← Quay lại"
          onAction={goBack}
        />
      </div>
    );
  }

  if (state.key !== articleId && state.error === null) {
    return (
      <div className="rs-container">
        <LoadingSkeletonCard label="Đang tải Chi tiết bài báo RSS từ SQLite..." />
      </div>
    );
  }

  if (state.error || !state.article) {
    return (
      <div className="rs-container">
        <EmptyStateCard
          title="Không tìm thấy bài báo RSS"
          description={state.error ?? 'Bài báo không tồn tại trong cơ sở dữ liệu.'}
          actionLabel="← Quay lại"
          onAction={goBack}
        />
      </div>
    );
  }

  return (
    <ArticleDetailBody
      key={state.article.id}
      initialArticle={state.article}
      onUpdated={(next) => setState({ key: articleId, article: next, error: null })}
    />
  );
};

export const IdeaDetailScreen: React.FC = () => {
  const { currentEntry, goBack, navigate } = useAppNavigation();
  const {
    isBootstrapping,
    ideas,
    projects,
    updateIdeaCore,
    updateProjectIdeaStatus,
    updateProjectIdeaAngle,
    attachIdeaToProject,
    detachIdeaFromProject,
    deleteIdea,
  } = usePrototypeWorkspace();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const requestedId = currentEntry.params.ideaId;
  const idea = requestedId ? ideas.find((i) => i.id === requestedId) : undefined;

  if (isBootstrapping && !idea) {
    return (
      <div className="rs-container">
        <LoadingSkeletonCard label="Đang tải Chi tiết Ý tưởng từ SQLite..." />
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="rs-container">
        <EmptyStateCard
          title="Không tìm thấy Ý tưởng"
          description="Ý tưởng không tồn tại hoặc đã bị xóa."
          actionLabel="Mở Kho ý tưởng chung"
          onAction={() => navigate('global-ideas')}
        />
      </div>
    );
  }

  const unattached = projects.filter((p) => !idea.projectLinks[p.id]);

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <h1 className="rs-page-title">Chi tiết Ý tưởng</h1>
          <p className="rs-page-subtitle">1 bản ý tưởng gốc — triển khai độc lập sang nhiều Project với 5 trạng thái riêng</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={goBack}>
            ← Quay lại
          </button>
          <button type="button" className="rs-btn rs-btn-danger" onClick={() => setConfirmDeleteOpen(true)}>
            Xóa Ý tưởng gốc
          </button>
        </div>
      </div>

      <IdeaCoreEditor
        key={idea.id}
        idea={idea}
        onSave={(patch) => updateIdeaCore(idea.id, patch)}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: '16px' }}>
          Liên kết triển khai theo từng Project ({Object.keys(idea.projectLinks).length})
        </h2>
        {unattached.length > 0 && (
          <select
            aria-label="Gắn ý tưởng sang Project khác"
            className="rs-select rs-select-compact"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                void attachIdeaToProject(idea.id, e.target.value, idea.title);
              }
            }}
          >
            <option value="">+ Gắn sang thêm Project...</option>
            {unattached.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {Object.keys(idea.projectLinks).length === 0 ? (
        <EmptyStateCard
          title="Ý tưởng này chưa gắn vào Project nào"
          description="Chọn một Project ở danh sách phía trên để bắt đầu phân bổ góc khai thác và trạng thái sản xuất."
        />
      ) : (
        <div className="rs-grid-2">
          {Object.entries(idea.projectLinks).map(([pid, link]) => {
            const proj = projects.find((p) => p.id === pid);
            return (
              <ProjectLinkEditorCard
                key={`${idea.id}-${pid}`}
                projectName={proj?.name ?? pid}
                initialStatus={link.status}
                initialPriority={link.priority}
                initialAngle={link.projectAngle}
                initialNotes={link.projectNotes}
                initialUrl={link.publishedVideoUrl}
                onStatusChange={(st) => updateProjectIdeaStatus(idea.id, pid, st)}
                onSaveDetails={(a, n, u, p) => updateProjectIdeaAngle(idea.id, pid, a, n, u, p)}
                onDetach={() => detachIdeaFromProject(idea.id, pid)}
              />
            );
          })}
        </div>
      )}

      <ConfirmDeleteModal
        open={confirmDeleteOpen}
        title="Xác nhận xóa Ý tưởng gốc?"
        warningText={`Ý tưởng "${idea.title}" đang liên kết với ${Object.keys(idea.projectLinks).length} Project. Xóa ý tưởng gốc sẽ xóa luôn các liên kết theo Project.`}
        confirmLabel="Xác nhận xóa vĩnh viễn"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          void deleteIdea(idea.id).then((ok) => {
            if (ok) navigate('global-ideas');
          });
        }}
      />
    </div>
  );
};

const IdeaCoreEditor: React.FC<{
  idea: IdeaItem;
  onSave: (patch: { title: string; notes: string; inGlobalVault: boolean; tags: string[] }) => Promise<boolean>;
}> = ({ idea, onSave }) => {
  const [title, setTitle] = useState(idea.title);
  const [notes, setNotes] = useState(idea.notes);
  const [inGlobalVault, setInGlobalVault] = useState(idea.inGlobalVault);
  const [tagsText, setTagsText] = useState(idea.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const hasLinkedProjects = Object.keys(idea.projectLinks).length > 0;
  const effectiveInGlobalVault = hasLinkedProjects ? inGlobalVault : true;

  const safeSourceUrl =
    idea.sourceUrl.startsWith('https://') || idea.sourceUrl.startsWith('http://') ? idea.sourceUrl : '';

  return (
    <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="rs-badge">Nguồn: {idea.sourceTitleSnapshot || 'Tạo thủ công'}</span>
          {safeSourceUrl && (
            <a href={safeSourceUrl} target="_blank" rel="noopener noreferrer" className="rs-badge">
              Liên kết nguồn gốc ↗
            </a>
          )}
          {idea.apiPurged && (
            <span className="rs-badge rs-badge-warning">
              Dữ liệu API hết hạn 30 ngày đã xóa sạch — Ý tưởng &amp; URL tham chiếu giữ nguyên
            </span>
          )}
        </div>
        <span style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
          Cập nhật: {formatDateTimeVi(idea.updatedAt)}
        </span>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Tiêu đề Ý tưởng gốc *</span>
        <input type="text" className="rs-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Ghi chú gốc (User-Created Data)</span>
        <textarea className="rs-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="rs-grid-2">
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Thẻ phân loại (cách nhau dấu phẩy)</span>
          <input type="text" className="rs-input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </label>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: hasLinkedProjects ? 'pointer' : 'not-allowed', alignSelf: 'end', paddingBottom: 8 }}
          title={!hasLinkedProjects ? 'Ý tưởng chưa gắn vào Project nào phải giữ trong Kho ý tưởng chung (G5)' : undefined}
        >
          <input
            type="checkbox"
            checked={effectiveInGlobalVault}
            disabled={!hasLinkedProjects}
            onChange={(e) => setInGlobalVault(e.target.checked)}
          />
          <span>Hiển thị trong Kho ý tưởng chung (G5)</span>
        </label>
      </div>

      <div>
        <button
          type="button"
          className="rs-btn rs-btn-primary rs-btn-sm"
          disabled={!title.trim() || saving}
          onClick={() => {
            setSaving(true);
            const tags = tagsText
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
            void onSave({ title: title.trim(), notes: notes.trim(), inGlobalVault: effectiveInGlobalVault, tags }).finally(() => {
              setSaving(false);
            });
          }}
        >
          {saving ? 'Đang lưu...' : 'Lưu Ý tưởng gốc'}
        </button>
      </div>
    </section>
  );
};

const ProjectLinkEditorCard: React.FC<{
  projectName: string;
  initialStatus: IdeaStatus;
  initialPriority: IdeaPriority;
  initialAngle: string;
  initialNotes: string;
  initialUrl: string;
  onStatusChange: (s: IdeaStatus) => Promise<boolean>;
  onSaveDetails: (angle: string, notes: string, url: string, priority: IdeaPriority) => Promise<boolean>;
  onDetach: () => Promise<boolean>;
}> = ({
  projectName,
  initialStatus,
  initialPriority,
  initialAngle,
  initialNotes,
  initialUrl,
  onStatusChange,
  onSaveDetails,
  onDetach,
}) => {
  const [angle, setAngle] = useState(initialAngle);
  const [notes, setNotes] = useState(initialNotes);
  const [url, setUrl] = useState(initialUrl);
  const [priority, setPriority] = useState<IdeaPriority>(initialPriority);
  const [saving, setSaving] = useState(false);

  const safePublishedUrl = url.startsWith('https://') || url.startsWith('http://') ? url : '';

  return (
    <div className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong>{projectName}</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select
            aria-label={`Ưu tiên trong ${projectName}`}
            className="rs-select rs-select-compact"
            value={priority}
            onChange={(e) => setPriority(e.target.value as IdeaPriority)}
          >
            <option value="high">Ưu tiên: Cao</option>
            <option value="medium">Ưu tiên: Trung bình</option>
            <option value="low">Ưu tiên: Thấp</option>
          </select>
          <select
            aria-label={`Trạng thái trong ${projectName}`}
            className="rs-select rs-select-compact"
            value={initialStatus}
            onChange={(e) => {
              void onStatusChange(e.target.value as IdeaStatus);
            }}
          >
            {(Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[]).map((st) => (
              <option key={st} value={st}>
                {IDEA_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Góc khai thác riêng của Project</span>
        <input type="text" className="rs-input" value={angle} onChange={(e) => setAngle(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Ghi chú riêng</span>
        <textarea className="rs-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '12.5px', fontWeight: 600 }}>URL Video đã xuất bản (<code>published_video_url</code>)</span>
        <input
          type="url"
          className="rs-input"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      {safePublishedUrl && (
        <div style={{ fontSize: '12.5px' }}>
          <a href={safePublishedUrl} target="_blank" rel="noopener noreferrer">
            Mở video đã xuất bản ↗
          </a>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="rs-btn rs-btn-secondary rs-btn-sm"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            void onSaveDetails(angle, notes, url, priority).finally(() => setSaving(false));
          }}
        >
          {saving ? 'Đang lưu...' : 'Lưu thay đổi cho Project này'}
        </button>
        <button
          type="button"
          className="rs-btn rs-btn-ghost rs-btn-sm"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            void onDetach().finally(() => setSaving(false));
          }}
        >
          Gỡ khỏi Project
        </button>
      </div>
    </div>
  );
};

const SystemSettingsForm: React.FC = () => {
  const {
    theme,
    setTheme,
    systemSettings,
    saveApiKey,
    removeApiKey,
    updateSystemPreferences,
    purgeYoutubeCache,
    setLegalModalOpen,
  } = usePrototypeWorkspace();

  const [rawKeyInput, setRawKeyInput] = useState('');
  const [regionCode, setRegionCode] = useState(systemSettings.defaultRegionCode);
  const [relevanceLanguage, setRelevanceLanguage] = useState(systemSettings.defaultRelevanceLanguage);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(systemSettings.autoRefreshEnabled);
  const [channelHours, setChannelHours] = useState(String(systemSettings.autoRefreshChannelIntervalHours));
  const [rssHours, setRssHours] = useState(String(systemSettings.autoRefreshRssIntervalHours));
  const [batchCap, setBatchCap] = useState(String(systemSettings.autoRefreshMaxApiUnitsPerBatch));
  const [dailyCap, setDailyCap] = useState(String(systemSettings.autoRefreshDailyQuotaCap));
  const [warnPct, setWarnPct] = useState(String(Math.round(systemSettings.quotaWarningRatio * 100)));
  const [savingKey, setSavingKey] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const keyStatusBadge =
    systemSettings.apiKeyStatus === 'configured'
      ? { label: `Đã mã hóa DPAPI (${systemSettings.maskedApiKey ?? 'ẩn'})`, cls: 'rs-badge rs-badge-success' }
      : systemSettings.apiKeyStatus === 'unreadable'
        ? { label: 'Không giải mã được khóa cũ (DPAPI)', cls: 'rs-badge rs-badge-danger' }
        : { label: 'Chưa cấu hình API Key', cls: 'rs-badge rs-badge-warning' };

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Cài đặt hệ thống chung &amp; Pháp lý</h1>
            <span className="rs-badge rs-badge-success">Dữ liệu thật SQLite + Windows DPAPI</span>
          </div>
          <p className="rs-page-subtitle">
            Cấu hình YouTube API Key (mã hóa Windows DPAPI), tham số làm mới tự động, giao diện Light/Dark và công bố pháp lý
          </p>
        </div>
      </div>

      <GlobalModeBanners />

      <div className="rs-grid-2">
        <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '15.5px' }}>YouTube Data API v3 Key (Windows DPAPI)</h2>
            <span className={keyStatusBadge.cls}>{keyStatusBadge.label}</span>
          </div>

          {!systemSettings.legalConsentAccepted && (
            <div className="rs-card-subtle" style={{ fontSize: '13px' }}>
              Cần bấm <strong>Xác nhận Chính sách Quyền riêng tư &amp; Điều khoản YouTube</strong> ở khung phía dưới
              trước khi hệ thống cho phép lưu API Key.
            </div>
          )}

          {systemSettings.apiKeyStatus === 'unreadable' && (
            <div className="rs-banner rs-banner-danger" role="alert">
              <div>
                Khóa API mã hóa DPAPI trước đây không thể giải mã trên tài khoản Windows hiện tại. Hãy dán lại khóa mới
                hoặc bấm Xóa khóa lỗi bên dưới.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="password"
              className="rs-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="Dán YouTube Data API v3 Key mới..."
              value={rawKeyInput}
              onChange={(e) => setRawKeyInput(e.target.value)}
            />
            <button
              type="button"
              className="rs-btn rs-btn-primary"
              disabled={!rawKeyInput.trim() || !systemSettings.legalConsentAccepted || savingKey}
              onClick={() => {
                void (async () => {
                  setSavingKey(true);
                  try {
                    const ok = await saveApiKey(rawKeyInput);
                    if (ok) {
                      setRawKeyInput('');
                    }
                  } finally {
                    setSavingKey(false);
                  }
                })();
              }}
            >
              {savingKey ? 'Đang mã hóa...' : 'Lưu API Key (DPAPI)'}
            </button>
            {systemSettings.apiKeyStatus !== 'missing' && (
              <button
                type="button"
                className="rs-btn rs-btn-danger"
                disabled={savingKey}
                onClick={() => {
                  void (async () => {
                    setSavingKey(true);
                    try {
                      await removeApiKey();
                    } finally {
                      setSavingKey(false);
                    }
                  })();
                }}
              >
                Xóa Key
              </button>
            )}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
            Backend mã hóa bằng Win32 DPAPI (`CryptProtectData`), chỉ trả chuỗi đã che và không bao giờ đưa khóa thô lên trình duyệt.
          </div>

          <div style={{ display: 'flex', gap: 8, paddingTop: 4, flexWrap: 'wrap' }}>
            <button type="button" className="rs-btn rs-btn-secondary rs-btn-sm" onClick={() => setTheme('light')}>
              ☀ Giao diện Light Mode (Mặc định) {theme === 'light' ? '✓' : ''}
            </button>
            <button type="button" className="rs-btn rs-btn-secondary rs-btn-sm" onClick={() => setTheme('dark')}>
              ☾ Giao diện Dark Mode {theme === 'dark' ? '✓' : ''}
            </button>
          </div>
        </section>

        <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: '15.5px' }}>Tự động làm mới &amp; Giới hạn Quota (PT)</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
            />
            <span>Cho phép Tự động làm mới có kiểm soát khi ứng dụng đang mở (0 lượt Search Queries)</span>
          </label>

          <div className="rs-grid-3">
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Quốc gia mặc định</span>
              <select className="rs-select" value={regionCode} onChange={(e) => setRegionCode(e.target.value)}>
                <option value="VN">VN</option>
                <option value="US">US</option>
                <option value="JP">JP</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Ngôn ngữ mặc định</span>
              <select className="rs-select" value={relevanceLanguage} onChange={(e) => setRelevanceLanguage(e.target.value)}>
                <option value="vi">vi</option>
                <option value="en">en</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Ngưỡng cảnh báo (%)</span>
              <input
                type="number"
                min={10}
                max={99}
                className="rs-input"
                value={warnPct}
                onChange={(e) => setWarnPct(e.target.value)}
              />
            </label>
          </div>

          <div className="rs-grid-2">
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Chu kỳ kênh đối thủ (giờ)</span>
              <input
                type="number"
                min={1}
                max={168}
                className="rs-input"
                value={channelHours}
                onChange={(e) => setChannelHours(e.target.value)}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Chu kỳ nguồn RSS (giờ)</span>
              <input
                type="number"
                min={1}
                max={168}
                className="rs-input"
                value={rssHours}
                onChange={(e) => setRssHours(e.target.value)}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Trần units / đợt chạy nền</span>
              <input
                type="number"
                min={1}
                max={200}
                className="rs-input"
                value={batchCap}
                onChange={(e) => setBatchCap(e.target.value)}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Trần units tự động / ngày</span>
              <input
                type="number"
                min={10}
                max={10000}
                className="rs-input"
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
              />
            </label>
          </div>

          <div>
            <button
              type="button"
              className="rs-btn rs-btn-secondary"
              disabled={savingPrefs}
              onClick={() => {
                void (async () => {
                  setSavingPrefs(true);
                  try {
                    const parsedRatio = Math.min(0.99, Math.max(0.1, (Number(warnPct) || 80) / 100));
                    await updateSystemPreferences({
                      defaultRegionCode: regionCode,
                      defaultRelevanceLanguage: relevanceLanguage,
                      autoRefreshEnabled,
                      autoRefreshChannelIntervalHours: Math.max(1, Number(channelHours) || 12),
                      autoRefreshRssIntervalHours: Math.max(1, Number(rssHours) || 4),
                      autoRefreshMaxApiUnitsPerBatch: Math.max(1, Number(batchCap) || 15),
                      autoRefreshDailyQuotaCap: Math.max(10, Number(dailyCap) || 3000),
                      quotaWarningRatio: parsedRatio,
                    });
                  } finally {
                    setSavingPrefs(false);
                  }
                })();
              }}
            >
              {savingPrefs ? 'Đang lưu...' : 'Lưu tham số cấu hình xuống SQLite'}
            </button>
          </div>
        </section>
      </div>

      <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: '16px' }}>Điều khoản sử dụng, Chính sách Quyền riêng tư &amp; Xóa cache YouTube API</h2>
          <span className={`rs-badge ${systemSettings.legalConsentAccepted ? 'rs-badge-success' : 'rs-badge-warning'}`}>
            {systemSettings.legalConsentAccepted
              ? `Đã xác nhận (${systemSettings.legalConsentAcceptedAt ?? ''})`
              : 'Chưa xác nhận'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--rs-text-secondary)' }}>
          Research Studio sử dụng <strong>YouTube API Services</strong> cục bộ (0% Telemetry). Sử dụng tính năng YouTube
          đồng nghĩa tuân theo{' '}
          <a href={systemSettings.legalLinks.youtubeTosUrl} target="_blank" rel="noopener noreferrer">
            YouTube Terms of Service
          </a>{' '}
          và{' '}
          <a href={systemSettings.legalLinks.googlePrivacyUrl} target="_blank" rel="noopener noreferrer">
            Google Privacy Policy
          </a>
          . Dữ liệu từ YouTube API lưu tối đa 30 ngày lịch.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={() => setLegalModalOpen(true)}>
            Mở hộp thoại xác nhận Chính sách Quyền riêng tư
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-danger"
            disabled={purging}
            onClick={() => setPurgeConfirmOpen(true)}
          >
            {purging ? 'Đang xóa cache...' : 'Xóa toàn bộ cache YouTube API Data ngay lập tức'}
          </button>
        </div>
      </section>

      <ConfirmDeleteModal
        open={purgeConfirmOpen}
        title="Xóa toàn bộ dữ liệu đệm YouTube API ngay lập tức?"
        warningText="Thao tác sẽ xóa sạch toàn bộ metadata/thống kê video & kênh từ YouTube API (bao gồm các bản sao lưu .db cũ chứa cache). Toàn bộ Project, Ý tưởng, Từ khóa, Nhãn thủ công và RSS do bạn tạo được bảo toàn 100%."
        confirmLabel="Xóa sạch cache YouTube API"
        onCancel={() => setPurgeConfirmOpen(false)}
        onConfirm={() => {
          void (async () => {
            setPurgeConfirmOpen(false);
            setPurging(true);
            try {
              await purgeYoutubeCache();
            } finally {
              setPurging(false);
            }
          })();
        }}
      />
    </div>
  );
};

export const SystemSettingsScreen: React.FC = () => {
  const { isBootstrapping, systemSettings } = usePrototypeWorkspace();
  if (isBootstrapping) {
    return (
      <div className="rs-container">
        <LoadingSkeletonCard label="Đang nạp Cài đặt hệ thống & Pháp lý..." />
      </div>
    );
  }
  return <SystemSettingsForm key={systemSettings.updatedAt ?? 'default-settings'} />;
};
