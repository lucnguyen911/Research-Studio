import React, { useState } from 'react';
import {
  DEMO_RSS_TOPICS,
  DEMO_VIDEOS,
  IDEA_STATUS_LABELS,
  formatInt,
} from '../prototype/demoData';
import type { IdeaPriority, IdeaStatus, ProjectItem } from '../prototype/types';
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
  const { isBootstrapping } = usePrototypeWorkspace();

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
        <button type="button" className="rs-btn rs-btn-secondary" onClick={() => navigate('project-settings')}>
          Chỉnh sửa Cài đặt dự án (P6)
        </button>
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      <div className="rs-grid-3">
        <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: '15px' }}>Thông số mục tiêu Project</h2>
          <div style={{ fontSize: '13.5px', color: 'var(--rs-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>
              Mã Project: <code className="rs-mono">{project.id}</code>
            </div>
            <div>
              Thị trường / Ngôn ngữ: <strong>{project.regionCode} / {project.relevanceLanguage}</strong>
            </div>
            <div>
              Định dạng trọng tâm: <strong>{formatLabel}</strong>
            </div>
            <div>
              Cập nhật gần nhất: <span className="rs-tabular">{project.updatedAt}</span>
            </div>
          </div>
        </section>

        <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: '15px' }}>Nguồn RSS liên kết &amp; Không gian Ý tưởng</h2>
          <div className="rs-tabular" style={{ fontSize: '13.5px', color: 'var(--rs-text-secondary)' }}>
            <div>
              Nguồn RSS đang gắn với Project: <strong>{project.linkedFeedIds.length}</strong> nguồn
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)', marginTop: 4 }}>
              Tổng hợp số liệu Đối thủ (P2), Từ khóa (P4) và Phễu Ý tưởng 5 trạng thái (P5) sẽ tự động hiển thị sau khi hoàn tất Milestone 3–6.
            </div>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="rs-btn rs-btn-sm rs-btn-secondary" onClick={() => navigate('project-settings')}>
              Quản lý ở P6
            </button>
            <button type="button" className="rs-btn rs-btn-sm rs-btn-primary" onClick={() => navigate('project-ideas')}>
              Xem trước Quản lý ý tưởng (P5)
            </button>
          </div>
        </section>

        <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: '15px' }}>Công cụ nghiên cứu thuộc Project</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <button type="button" className="rs-btn rs-btn-sm rs-btn-secondary" onClick={() => navigate('project-competitors')}>
              P2 · Theo dõi đối thủ (xem trước M5)
            </button>
            <button type="button" className="rs-btn rs-btn-sm rs-btn-secondary" onClick={() => navigate('project-breakout')}>
              P3 · Video bứt phá Standard Mode (xem trước M5)
            </button>
            <button type="button" className="rs-btn rs-btn-sm rs-btn-secondary" onClick={() => navigate('project-keywords')}>
              P4 · Nghiên cứu từ khóa + RSS (xem trước M5)
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export const CompetitorsScreen: React.FC = () => {
  const project = useActiveProject();
  const { currentEntry, navigate, updateViewState } = useAppNavigation();
  const { uiMode, channels, addChannelToProject, removeChannelFromProject, apiCachePurged } =
    usePrototypeWorkspace();
  const [channelInput, setChannelInput] = useState('');

  if (!project) return <NoProjectEmpty />;

  const vs = currentEntry.viewState;
  const projectChannels = uiMode === 'empty' ? [] : channels.filter((c) => c.projectIds.includes(project.id));
  const projectVideos =
    uiMode === 'empty' || apiCachePurged || uiMode === 'no_api_key'
      ? []
      : DEMO_VIDEOS.filter((v) => projectChannels.some((ch) => ch.id === v.channelId));

  const addBlocked = !channelInput.trim() || uiMode === 'offline' || uiMode === 'no_api_key' || uiMode === 'quota_general_exhausted';

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Theo dõi đối thủ (P2) — {project.name}</h1>
            <span className="rs-badge">Phân giải @handle/ID: 1 unit API · 0 Search Queries</span>
          </div>
          <p className="rs-page-subtitle">
            Bấm tên kênh để đi qua luồng 4 cấp: Theo dõi đối thủ → Chi tiết kênh → Danh sách video → Chi tiết video
          </p>
        </div>
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      <div className="rs-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flex: '1 1 360px' }}>
          <input
            type="text"
            aria-label="Dán URL, @handle hoặc channel_id đối thủ"
            className="rs-input"
            style={{ flex: 1 }}
            placeholder="Dán URL kênh, @handle hoặc UC... (tốn 1 unit API + ~2 units uploads)"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
          />
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            disabled={addBlocked}
            onClick={() => {
              addChannelToProject(project.id, channelInput);
              setChannelInput('');
            }}
          >
            + Thêm đối thủ
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

      {uiMode === 'loading' ? (
        <LoadingSkeletonCard />
      ) : vs.tab === 'videos' ? (
        <VideoResearchTable
          videos={projectVideos}
          fromScreen="project-competitors"
          projectIdForBreakout={project.id}
          showSnapshotsColumn
        />
      ) : projectChannels.length === 0 ? (
        <EmptyStateCard
          title="Project chưa có kênh đối thủ nào"
          description="Dán URL, @handle hoặc UC... của kênh đối thủ ở thanh phía trên để bắt đầu theo dõi bằng chi phí API thấp."
        />
      ) : (
        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th>Kênh đối thủ &amp; Ghi chú riêng của Project</th>
                <th className="rs-num-cell">Subscriber (API gốc)</th>
                <th className="rs-num-cell">Tổng Video</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {projectChannels.map((ch) => {
                const status = ch.statusByProject[project.id] ?? 'active';
                return (
                  <tr key={ch.id}>
                    <td style={{ minWidth: 320 }}>
                      <button
                        type="button"
                        className="rs-title-link"
                        style={{ fontSize: '14.5px' }}
                        onClick={() => navigate('channel-detail', { params: { channelId: ch.id } })}
                      >
                        {ch.title} ({ch.handle})
                      </button>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--rs-text-secondary)' }}>
                        {ch.projectNotes[project.id] ?? 'Chưa có ghi chú riêng.'}
                      </p>
                      {ch.projectIds.length > 1 && (
                        <span className="rs-badge" style={{ marginTop: 4 }}>
                          Kênh dùng chung bởi {ch.projectIds.length} Project (chỉ 1 bản ghi gốc)
                        </span>
                      )}
                    </td>
                    <td className="rs-num-cell">{formatInt(ch.subscriberCount)}</td>
                    <td className="rs-num-cell">{formatInt(ch.videoCount)}</td>
                    <td>
                      <span
                        className={`rs-badge ${
                          status === 'error'
                            ? 'rs-badge-danger'
                            : status === 'paused'
                              ? 'rs-badge-warning'
                              : 'rs-badge-success'
                        }`}
                      >
                        {status === 'error' ? 'Lỗi cô lập' : status === 'paused' ? 'Tạm dừng' : 'Đang theo dõi'}
                      </span>
                      <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)', marginTop: 4 }}>
                        Cập nhật: {ch.lastFetchedAt}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-primary"
                          onClick={() => navigate('channel-detail', { params: { channelId: ch.id } })}
                        >
                          Mở Chi tiết kênh →
                        </button>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-danger"
                          onClick={() => removeChannelFromProject(project.id, ch.id)}
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
  const { uiMode, channels, apiCachePurged } = usePrototypeWorkspace();
  const { navigate } = useAppNavigation();

  if (!project) return <NoProjectEmpty />;

  const projectChannels = channels.filter((c) => c.projectIds.includes(project.id));
  const projectVideos =
    uiMode === 'empty' || apiCachePurged || uiMode === 'no_api_key'
      ? []
      : DEMO_VIDEOS.filter((v) => projectChannels.some((ch) => ch.id === v.channelId) || v.projectIds.includes(project.id));

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Video bứt phá — Standard Mode (P3)</h1>
            <span className="rs-badge">Dữ liệu YouTube API (Standard Mode)</span>
          </div>
          <p className="rs-page-subtitle">
            Sàng lọc video mới từ tệp đối thủ của <strong>{project.name}</strong> bằng số liệu API gốc và đánh dấu thủ công
          </p>
        </div>
        <button type="button" className="rs-btn rs-btn-secondary" onClick={() => navigate('project-competitors')}>
          Quản lý đối thủ ({projectChannels.length})
        </button>
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <strong>CÔNG BỐ PHẠM VI STANDARD MODE (TUÂN THỦ YOUTUBE DEVELOPER POLICIES)</strong>
          <span className="rs-badge rs-badge-demo">Không có module mở khóa ngầm</span>
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

      {uiMode === 'loading' ? (
        <LoadingSkeletonCard />
      ) : (
        <VideoResearchTable
          videos={projectVideos}
          fromScreen="project-breakout"
          projectIdForBreakout={project.id}
          showSnapshotsColumn
          showDateWindowFilter
          showMinViewsFilter
          showBreakoutToggle
        />
      )}
    </div>
  );
};

export const KeywordResearchScreen: React.FC = () => {
  const project = useActiveProject();
  const { currentEntry, updateViewState } = useAppNavigation();
  const { uiMode, keywords, addKeyword, deleteKeyword, scanKeywordDemo, openSaveIdeaModal, apiCachePurged } =
    usePrototypeWorkspace();
  const [newKw, setNewKw] = useState('');
  const [priority, setPriority] = useState<IdeaPriority>('medium');

  if (!project) return <NoProjectEmpty />;

  const projectKeywords = uiMode === 'empty' ? [] : keywords.filter((k) => k.projectId === project.id);
  const selectedKw =
    projectKeywords.find((k) => k.id === currentEntry.viewState.selectedKeywordId) ?? projectKeywords[0] ?? null;
  const matchedVideos =
    uiMode === 'empty' || apiCachePurged || uiMode === 'no_api_key' || !selectedKw
      ? []
      : DEMO_VIDEOS.filter((v) => selectedKw.matchedVideoIds.includes(v.id));

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Nghiên cứu từ khóa (P4) — {project.name}</h1>
            <span className="rs-badge">Standard Mode · Không hiển thị Search Volume giả</span>
          </div>
          <p className="rs-page-subtitle">
            Áp dụng mặc định thị trường <strong>{project.regionCode}</strong> / ngôn ngữ <strong>{project.relevanceLanguage}</strong> · Chi phí mỗi lần quét: 1 Search Queries + 1 API unit
          </p>
        </div>
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      <div className="rs-toolbar">
        <input
          type="text"
          className="rs-input"
          style={{ flex: '1 1 240px' }}
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
          disabled={!newKw.trim()}
          onClick={() => {
            addKeyword(project.id, newKw, priority);
            setNewKw('');
          }}
        >
          + Thêm từ khóa
        </button>
      </div>

      {uiMode === 'loading' ? (
        <LoadingSkeletonCard />
      ) : projectKeywords.length === 0 ? (
        <EmptyStateCard
          title="Chưa có từ khóa nghiên cứu nào trong Project"
          description="Thêm các cụm từ khóa chủ lực của kênh để chủ động quét kết quả YouTube và đối chiếu tín hiệu RSS."
        />
      ) : (
        <div className="rs-detail-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="rs-table-wrap">
              <table className="rs-table">
                <thead>
                  <tr>
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
                          <button
                            type="button"
                            className="rs-title-link"
                            onClick={() => updateViewState({ selectedKeywordId: kw.id })}
                          >
                            {kw.keyword}
                          </button>
                          <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)', marginTop: 2 }}>
                            Ưu tiên: <strong>{kw.priority}</strong> · Khớp RSS: {kw.rssMatchCount} bài
                          </div>
                        </td>
                        <td style={{ fontSize: '12.5px' }}>
                          {kw.lastScannedAt ? (
                            <span className="rs-badge rs-badge-success">{kw.lastScannedAt} (Còn hạn 30d)</span>
                          ) : (
                            <span className="rs-badge">Chưa quét YouTube</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="rs-btn rs-btn-sm rs-btn-primary"
                              disabled={uiMode === 'offline' || uiMode === 'no_api_key' || uiMode === 'quota_search_exhausted'}
                              onClick={() => scanKeywordDemo(kw.id)}
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
                              onClick={() => deleteKeyword(kw.id)}
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
                  Kết quả YouTube cho từ khóa: “{selectedKw.keyword}”
                </h2>
                <VideoResearchTable
                  videos={matchedVideos}
                  fromScreen="project-keywords"
                  emptyTitle="Từ khóa này chưa có kết quả video trong cache"
                  emptyDescription="Bấm Quét YT (1 lượt Search Queries + 1 unit General Data API) để lấy danh sách video thực tế từ YouTube."
                />
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
                Chỉ tính trên {project.linkedFeedIds.length} nguồn RSS đã gắn trong Cài đặt dự án (0 quota YouTube).
              </p>
            </div>
            {DEMO_RSS_TOPICS.slice(0, 3).map((t) => (
              <div
                key={t.phrase}
                className="rs-card-subtle"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
              >
                <div style={{ fontWeight: 600 }}>{t.phrase}</div>
                <SparklineCell
                  points={uiMode === 'insufficient_data' ? [t.articleCount] : t.points7d}
                  badgeLabel={`${t.articleCount} bài RSS`}
                  directionLabel={t.direction === 'up' ? '↗ Tăng' : '→ Ổn'}
                  tooltipTitle="Tần suất xuất hiện trên RSS Project"
                  tooltipDetail="Tính bằng Python tất định trên các bài báo RSS gắn vào Project này."
                  insufficientText="Chưa đủ dữ liệu"
                />
              </div>
            ))}
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
                          <a href={safePublishedUrl} target="_blank" rel="noreferrer">
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
