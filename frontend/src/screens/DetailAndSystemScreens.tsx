import React, { useState } from 'react';
import {
  DEMO_RSS_ARTICLES,
  DEMO_VIDEOS,
  IDEA_STATUS_LABELS,
  formatInt,
} from '../prototype/demoData';
import type { IdeaStatus } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace } from '../state/workspaceContext';
import { FormatBadgeGroup } from '../components/FormatBadgeGroup';
import { ConfirmDeleteModal } from '../components/Modals';
import { SparklineCell } from '../components/SparklineCell';
import { GlobalModeBanners, LoadingSkeletonCard } from '../components/StatusViews';
import { VideoResearchTable } from '../components/VideoResearchTable';

export const ChannelDetailScreen: React.FC = () => {
  const { currentEntry, goBack, navigate } = useAppNavigation();
  const { channels, projects, uiMode, apiCachePurged } = usePrototypeWorkspace();

  const channel = channels.find((c) => c.id === currentEntry.params.channelId) ?? channels[0];
  if (!channel) {
    return (
      <div className="rs-container">
        <button type="button" className="rs-btn rs-btn-secondary" onClick={goBack}>
          ← Quay lại
        </button>
      </div>
    );
  }

  const channelVideos =
    uiMode === 'empty' || apiCachePurged ? [] : DEMO_VIDEOS.filter((v) => v.channelId === channel.id);

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Chi tiết kênh: {channel.title}</h1>
            <span className="rs-badge">{channel.handle}</span>
            <span className="rs-badge">Hạn cache &lt;= 30 ngày</span>
          </div>
          <p className="rs-page-subtitle">
            Cập nhật gần nhất: {channel.lastFetchedAt} · Bấm tên video bên dưới để mở Chi tiết video (Cấp 4)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={() => navigate('project-competitors')}>
            ← Danh sách đối thủ
          </button>
          <a
            className="rs-btn rs-btn-tinted"
            href={`https://www.youtube.com/${channel.handle}`}
            target="_blank"
            rel="noreferrer"
          >
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
          <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>Project đang cùng theo dõi kênh này</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {channel.projectIds.map((pid) => {
              const p = projects.find((pr) => pr.id === pid);
              return (
                <span key={pid} className="rs-badge rs-badge-demo">
                  {p?.name ?? pid}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <h2 style={{ margin: '4px 0 0', fontSize: '16px' }}>
        Danh sách video đã thu thập của kênh ({channelVideos.length} video)
      </h2>

      <VideoResearchTable
        videos={channelVideos}
        fromScreen="channel-detail"
        fromChannelId={channel.id}
        pageSize={4}
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
    ideas,
    breakoutByProject,
    toggleBreakoutFlag,
    setBreakoutNote,
    openSaveIdeaModal,
    updateProjectIdeaStatus,
    uiMode,
  } = usePrototypeWorkspace();

  const video = DEMO_VIDEOS.find((v) => v.id === currentEntry.params.videoId) ?? DEMO_VIDEOS[0];
  const activeProject = projects.find((p) => p.id === currentEntry.projectId) ?? projects[0] ?? null;
  const breakoutEntry = activeProject ? breakoutByProject[activeProject.id]?.[video.id] : undefined;
  const [noteDraft, setNoteDraft] = useState(breakoutEntry?.note ?? '');

  const snapshotPoints = uiMode === 'insufficient_data' ? video.snapshots30d.slice(-1) : video.snapshots30d;
  const linkedIdeas = ideas.filter((i) => i.sourceRefId === video.id);

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Chi tiết Video (Standard Mode)</h1>
            <span className="rs-badge">Lấy từ API: {video.apiFetchedAt}</span>
            <span className="rs-badge">Hết hạn 30 ngày: {video.apiExpiresAt}</span>
          </div>
          <p className="rs-page-subtitle">
            Kênh:{' '}
            <button
              type="button"
              className="rs-crumb-btn"
              style={{ fontWeight: 700, padding: 0 }}
              onClick={() => navigate('channel-detail', { params: { channelId: video.channelId } })}
            >
              {video.channelTitle}
            </button>{' '}
            · Xuất bản: {video.publishedAt} · Thời lượng: {video.durationDisplay}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={goBack}>
            ← Quay lại (Giữ state trước)
          </button>
          <a
            className="rs-btn rs-btn-primary"
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Mở video trên YouTube ↗
          </a>
        </div>
      </div>

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
              Chỉ hiển thị số liệu YouTube API nguyên bản. Không hiển thị Outlier Multiplier hay tỷ lệ Engagement.
            </div>
          </section>

          <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: '15.5px' }}>Phân loại định dạng 3 lớp (Không gộp ngầm)</h2>
            <FormatBadgeGroup video={video} />
          </section>

          <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: '15.5px' }}>
                Các mốc viewCount thô &lt;= 30 ngày (Kèm đúng timestamp thu thập)
              </h2>
              <SparklineCell
                points={snapshotPoints.map((s) => s.viewCount)}
                labels={snapshotPoints.map((s) => s.capturedAt)}
                badgeLabel={`${snapshotPoints.length} mốc trong cache`}
                directionLabel={
                  snapshotPoints.length >= 2
                    ? `↗ +${formatInt(snapshotPoints[snapshotPoints.length - 1].viewCount - snapshotPoints[0].viewCount)}`
                    : '1 mốc'
                }
                tooltipTitle="Chuỗi mốc thô <= 30 ngày"
                tooltipDetail="Không lưu quá 30 ngày lịch và không tính vận tốc Views/ngày."
              />
            </div>

            <div className="rs-table-wrap">
              <table className="rs-table">
                <thead>
                  <tr>
                    <th>Thời điểm thu thập</th>
                    <th className="rs-num-cell">viewCount gốc</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshotPoints.map((pt) => (
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

            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, marginBottom: 6 }}>Thẻ <code>snippet.tags</code> gốc từ YouTube API:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {video.tags.map((tag) => (
                  <span key={tag} className="rs-badge">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {activeProject && (
            <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: '15.5px' }}>Đánh dấu Bứt phá &amp; Ghi chú ({activeProject.name})</h2>
              <button
                type="button"
                className={`rs-btn ${breakoutEntry?.flagged ? 'rs-btn-primary' : 'rs-btn-secondary'}`}
                onClick={() => toggleBreakoutFlag(activeProject.id, video.id)}
              >
                {breakoutEntry?.flagged ? '★ Đang gắn cờ Video Bứt phá' : '☆ Đánh dấu là Video Bứt phá'}
              </button>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Ghi chú phân tích riêng của Project (lưu vĩnh viễn)</span>
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
                onClick={() => setBreakoutNote(activeProject.id, video.id, noteDraft)}
              >
                Lưu ghi chú Project
              </button>
            </section>
          )}

          <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '15.5px' }}>Ý tưởng gắn từ video này</h2>
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
                <div key={idea.id} className="rs-card-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    type="button"
                    className="rs-title-link"
                    onClick={() => navigate('idea-detail', { params: { ideaId: idea.id } })}
                  >
                    {idea.title}
                  </button>
                  {Object.entries(idea.projectLinks).map(([pid, link]) => {
                    const pr = projects.find((p) => p.id === pid);
                    return (
                      <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '12.5px' }}>{pr?.name ?? pid}</span>
                        <select
                          aria-label={`Đổi trạng thái cho ${pr?.name ?? pid}`}
                          className="rs-select rs-select-compact"
                          value={link.status}
                          onChange={(e) => updateProjectIdeaStatus(idea.id, pid, e.target.value as IdeaStatus)}
                        >
                          {(Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[]).map((st) => (
                            <option key={st} value={st}>
                              {IDEA_STATUS_LABELS[st]}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export const ArticleDetailScreen: React.FC = () => {
  const { currentEntry, goBack } = useAppNavigation();
  const { openSaveIdeaModal } = usePrototypeWorkspace();
  const article = DEMO_RSS_ARTICLES.find((a) => a.id === currentEntry.params.articleId) ?? DEMO_RSS_ARTICLES[0];

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Chi tiết bài báo RSS</h1>
            <span className="rs-badge rs-badge-success">Nguồn: RSS (Dữ liệu ngoài YouTube)</span>
          </div>
          <p className="rs-page-subtitle">
            {article.feedName} · Xuất bản: {article.publishedAt} · Hiển thị văn bản thuần an toàn chống XSS
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={goBack}>
            ← Quay lại
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
                sourceUrl: article.url,
                tags: article.tags,
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
          {article.summaryText}
        </p>
        <div>
          <a className="rs-btn rs-btn-secondary" href={article.url} target="_blank" rel="noreferrer">
            Mở bài viết gốc ngoài trình duyệt (https://) ↗
          </a>
        </div>
      </article>
    </div>
  );
};

export const IdeaDetailScreen: React.FC = () => {
  const { currentEntry, goBack } = useAppNavigation();
  const { ideas, projects, updateProjectIdeaStatus, updateProjectIdeaAngle, attachIdeaToProject } =
    usePrototypeWorkspace();
  const idea = ideas.find((i) => i.id === currentEntry.params.ideaId) ?? ideas[0];

  if (!idea) return null;

  const unattached = projects.filter((p) => !idea.projectLinks[p.id]);

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <h1 className="rs-page-title">Chi tiết Ý tưởng</h1>
          <p className="rs-page-subtitle">1 bản ý tưởng gốc — triển khai độc lập sang nhiều Project với 5 trạng thái riêng</p>
        </div>
        <button type="button" className="rs-btn rs-btn-secondary" onClick={goBack}>
          ← Quay lại
        </button>
      </div>

      <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>{idea.title}</h2>
        <p style={{ margin: 0, color: 'var(--rs-text-secondary)' }}>{idea.notes}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="rs-badge">Nguồn: {idea.sourceTitleSnapshot}</span>
          {idea.sourceUrl && (
            <a href={idea.sourceUrl} target="_blank" rel="noreferrer" className="rs-badge">
              Liên kết nguồn gốc ↗
            </a>
          )}
          {idea.apiPurged && (
            <span className="rs-badge rs-badge-warning">
              Dữ liệu API hết hạn 30 ngày đã xóa sạch — Ý tưởng &amp; URL tham chiếu giữ nguyên
            </span>
          )}
        </div>
      </section>

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
              if (e.target.value) attachIdeaToProject(idea.id, e.target.value, idea.title);
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

      <div className="rs-grid-2">
        {Object.entries(idea.projectLinks).map(([pid, link]) => {
          const proj = projects.find((p) => p.id === pid);
          return (
            <ProjectLinkEditorCard
              key={`${idea.id}-${pid}`}
              projectName={proj?.name ?? pid}
              initialStatus={link.status}
              initialAngle={link.projectAngle}
              initialNotes={link.projectNotes}
              initialUrl={link.publishedVideoUrl}
              onStatusChange={(st) => updateProjectIdeaStatus(idea.id, pid, st)}
              onSaveDetails={(a, n, u) => updateProjectIdeaAngle(idea.id, pid, a, n, u)}
            />
          );
        })}
      </div>
    </div>
  );
};

const ProjectLinkEditorCard: React.FC<{
  projectName: string;
  initialStatus: IdeaStatus;
  initialAngle: string;
  initialNotes: string;
  initialUrl: string;
  onStatusChange: (s: IdeaStatus) => void;
  onSaveDetails: (angle: string, notes: string, url: string) => void;
}> = ({ projectName, initialStatus, initialAngle, initialNotes, initialUrl, onStatusChange, onSaveDetails }) => {
  const [angle, setAngle] = useState(initialAngle);
  const [notes, setNotes] = useState(initialNotes);
  const [url, setUrl] = useState(initialUrl);

  return (
    <div className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong>{projectName}</strong>
        <select
          aria-label={`Trạng thái trong ${projectName}`}
          className="rs-select rs-select-compact"
          value={initialStatus}
          onChange={(e) => onStatusChange(e.target.value as IdeaStatus)}
        >
          {(Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[]).map((st) => (
            <option key={st} value={st}>
              {IDEA_STATUS_LABELS[st]}
            </option>
          ))}
        </select>
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
      <div>
        <button type="button" className="rs-btn rs-btn-secondary rs-btn-sm" onClick={() => onSaveDetails(angle, notes, url)}>
          Lưu thay đổi cho Project này
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
          <a href={systemSettings.legalLinks.youtubeTosUrl} target="_blank" rel="noreferrer">
            YouTube Terms of Service
          </a>{' '}
          và{' '}
          <a href={systemSettings.legalLinks.googlePrivacyUrl} target="_blank" rel="noreferrer">
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
