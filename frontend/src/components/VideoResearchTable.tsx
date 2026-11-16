import React from 'react';
import type { ScreenId, VideoItem, ViewFilterState } from '../prototype/types';
import { formatInt, formatSnapshotDeltaLabel } from '../prototype/demoData';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace } from '../state/workspaceContext';
import { FormatBadgeGroup } from './FormatBadgeGroup';
import { SparklineCell } from './SparklineCell';
import { EmptyStateCard } from './StatusViews';

interface VideoResearchTableProps {
  videos: VideoItem[];
  fromScreen: ScreenId;
  fromChannelId?: string;
  pageSize?: number;
  projectIdForBreakout?: string;
  showSnapshotsColumn?: boolean;
  showChannelFilter?: boolean;
  showDateWindowFilter?: boolean;
  showMinViewsFilter?: boolean;
  showBreakoutToggle?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export const VideoResearchTable: React.FC<VideoResearchTableProps> = ({
  videos,
  fromScreen,
  fromChannelId,
  pageSize = 6,
  projectIdForBreakout,
  showSnapshotsColumn = false,
  showChannelFilter = true,
  showDateWindowFilter = false,
  showMinViewsFilter = false,
  showBreakoutToggle = false,
  emptyTitle = 'Không có video nào khớp bộ lọc hiện tại',
  emptyDescription = 'Thử xóa bộ lọc hoặc làm mới nguồn dữ liệu để tải video mới nhất.',
}) => {
  const { currentEntry, navigate, updateViewState } = useAppNavigation();
  const {
    uiMode,
    manualFormatMap,
    breakoutByProject,
    toggleBreakoutFlag,
    openSaveIdeaModal,
    openInspectorVideo,
    projects,
    addChannelToProject,
  } = usePrototypeWorkspace();

  const vs = currentEntry.viewState;
  const activeProject = projects.find((p) => p.id === (projectIdForBreakout ?? currentEntry.projectId)) ?? projects[0];

  const distinctChannels = Array.from(new Map(videos.map((v) => [v.channelId, v.channelTitle])).entries());

  const getEffectiveFormatCount = (fmt: 'long_form' | 'shorts' | 'unknown') =>
    videos.filter((v) => {
      if (v.sourceFormatStatus === fmt) return true;
      const manual = manualFormatMap[v.id] ?? v.defaultManualFormat ?? 'none';
      if (vs.includeManualInFormat && fmt !== 'unknown') {
        return manual === fmt;
      }
      return false;
    }).length;

  const minViewsNum = Number(vs.minViews) || 0;
  const dateDays = vs.dateWindow === 'all' ? 999 : Number(vs.dateWindow);

  const filtered = videos.filter((v) => {
    if (vs.search.trim()) {
      const q = vs.search.trim().toLowerCase();
      if (!v.title.toLowerCase().includes(q) && !v.channelTitle.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (showChannelFilter && vs.channelFilter !== 'all' && v.channelId !== vs.channelFilter) {
      return false;
    }
    if (showDateWindowFilter && v.daysAgo > dateDays) {
      return false;
    }
    if (showMinViewsFilter && minViewsNum > 0 && (v.viewCount ?? 0) < minViewsNum) {
      return false;
    }
    if (vs.formatFilter !== 'all') {
      const matchesSource = v.sourceFormatStatus === vs.formatFilter;
      const manual = manualFormatMap[v.id] ?? v.defaultManualFormat ?? 'none';
      const matchesManual =
        vs.includeManualInFormat && vs.formatFilter !== 'unknown' && manual === vs.formatFilter;
      if (!matchesSource && !matchesManual) return false;
    }
    if (vs.manualFilter !== 'all') {
      const label = manualFormatMap[v.id] ?? v.defaultManualFormat ?? 'none';
      if (vs.manualFilter === 'unlabeled' && label !== 'none') return false;
      if (vs.manualFilter !== 'unlabeled' && label !== vs.manualFilter) return false;
    }
    if (showBreakoutToggle && vs.onlyBreakout && projectIdForBreakout) {
      if (!breakoutByProject[projectIdForBreakout]?.[v.id]?.flagged) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = vs.sortDir === 'asc' ? 1 : -1;
    if (vs.sortBy === 'publishedAt') {
      return (a.daysAgo - b.daysAgo) * (vs.sortDir === 'desc' ? 1 : -1);
    }
    if (vs.sortBy === 'durationSeconds') {
      return (a.durationSeconds - b.durationSeconds) * dir;
    }
    if (vs.sortBy === 'likeCount') {
      return ((a.likeCount ?? -1) - (b.likeCount ?? -1)) * dir;
    }
    if (vs.sortBy === 'commentCount') {
      return ((a.commentCount ?? -1) - (b.commentCount ?? -1)) * dir;
    }
    return ((a.viewCount ?? -1) - (b.viewCount ?? -1)) * dir;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.max(1, Math.min(vs.page, totalPages));
  const pagedVideos = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSortColumn = (col: ViewFilterState['sortBy']) => {
    if (vs.sortBy === col) {
      updateViewState({ sortDir: vs.sortDir === 'desc' ? 'asc' : 'desc', page: 1 });
    } else {
      updateViewState({ sortBy: col, sortDir: 'desc', page: 1 });
    }
  };

  const resetFilters = () =>
    updateViewState({
      search: '',
      formatFilter: 'all',
      includeManualInFormat: false,
      manualFilter: 'all',
      channelFilter: 'all',
      dateWindow: 'all',
      minViews: '',
      onlyBreakout: false,
      page: 1,
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="rs-toolbar">
        <input
          type="search"
          aria-label="Tìm nhanh theo tiêu đề video hoặc tên kênh"
          className="rs-input"
          style={{ minWidth: 220, flex: '1 1 220px' }}
          placeholder="Tìm theo tiêu đề hoặc kênh..."
          value={vs.search}
          onChange={(e) => updateViewState({ search: e.target.value, page: 1 })}
        />

        {showChannelFilter && (
          <select
            aria-label="Lọc theo kênh"
            className="rs-select rs-select-compact"
            value={vs.channelFilter}
            onChange={(e) => updateViewState({ channelFilter: e.target.value, page: 1 })}
          >
            <option value="all">Tất cả kênh ({distinctChannels.length})</option>
            {distinctChannels.map(([cid, cname]) => (
              <option key={cid} value={cid}>
                {cname}
              </option>
            ))}
          </select>
        )}

        {showDateWindowFilter && (
          <select
            aria-label="Cửa sổ ngày đăng"
            className="rs-select rs-select-compact"
            value={vs.dateWindow}
            onChange={(e) => updateViewState({ dateWindow: e.target.value as ViewFilterState['dateWindow'], page: 1 })}
          >
            <option value="3">Đăng &lt;= 3 ngày</option>
            <option value="7">Đăng &lt;= 7 ngày</option>
            <option value="14">Đăng &lt;= 14 ngày</option>
            <option value="30">Đăng &lt;= 30 ngày</option>
            <option value="all">Tất cả trong cache &lt;= 30 ngày</option>
          </select>
        )}

        {showMinViewsFilter && (
          <input
            type="number"
            aria-label="Lượt xem tối thiểu"
            className="rs-input"
            style={{ width: 135 }}
            placeholder="Views >= ..."
            value={vs.minViews}
            onChange={(e) => updateViewState({ minViews: e.target.value, page: 1 })}
          />
        )}

        <select
          aria-label="Sắp xếp theo trường YouTube gốc"
          className="rs-select rs-select-compact"
          value={`${vs.sortBy}:${vs.sortDir}`}
          onChange={(e) => {
            const [sortBy, sortDir] = e.target.value.split(':') as [ViewFilterState['sortBy'], 'desc' | 'asc'];
            updateViewState({ sortBy, sortDir, page: 1 });
          }}
        >
          <option value="viewCount:desc">Sắp xếp: viewCount giảm dần</option>
          <option value="viewCount:asc">Sắp xếp: viewCount tăng dần</option>
          <option value="likeCount:desc">Sắp xếp: likeCount giảm dần</option>
          <option value="commentCount:desc">Sắp xếp: commentCount giảm dần</option>
          <option value="publishedAt:desc">Sắp xếp: Mới đăng nhất</option>
          <option value="durationSeconds:desc">Sắp xếp: Thời lượng dài nhất</option>
        </select>

        {showBreakoutToggle && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={vs.onlyBreakout}
              onChange={(e) => updateViewState({ onlyBreakout: e.target.checked, page: 1 })}
            />
            <span>Chỉ video đã Đánh dấu Bứt phá</span>
          </label>
        )}
      </div>

      <div className="rs-toolbar" style={{ justifyContent: 'space-between' }}>
        <div className="rs-pill-group" role="group" aria-label="Lọc tách biệt 3 trạng thái định dạng nguồn">
          <button
            type="button"
            className={`rs-pill-tab ${vs.formatFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => updateViewState({ formatFilter: 'all', page: 1 })}
          >
            Tất cả ({videos.length})
          </button>
          <button
            type="button"
            className={`rs-pill-tab ${vs.formatFilter === 'long_form' ? 'is-active' : ''}`}
            onClick={() => updateViewState({ formatFilter: 'long_form', page: 1 })}
          >
            Video dài ({getEffectiveFormatCount('long_form')})
          </button>
          <button
            type="button"
            className={`rs-pill-tab ${vs.formatFilter === 'shorts' ? 'is-active' : ''}`}
            onClick={() => updateViewState({ formatFilter: 'shorts', page: 1 })}
          >
            Shorts ({getEffectiveFormatCount('shorts')})
          </button>
          <button
            type="button"
            className={`rs-pill-tab ${vs.formatFilter === 'unknown' ? 'is-active' : ''}`}
            onClick={() => updateViewState({ formatFilter: 'unknown', page: 1 })}
          >
            Chưa xác định &lt;=180s ({getEffectiveFormatCount('unknown')})
          </button>
        </div>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '12.5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={vs.includeManualInFormat}
            onChange={(e) => updateViewState({ includeManualInFormat: e.target.checked, page: 1 })}
          />
          <span>Bao gồm nhãn thủ công của tôi (không gộp ngầm Chưa xác định)</span>
        </label>
      </div>

      {pagedVideos.length === 0 ? (
        <EmptyStateCard
          title={emptyTitle}
          description={emptyDescription}
          actionLabel="Xóa toàn bộ bộ lọc"
          onAction={resetFilters}
        />
      ) : (
        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th>Video &amp; Kênh YouTube</th>
                <th>Định dạng 3 lớp</th>
                <th className="rs-num-cell">
                  <button type="button" className="rs-sort-btn" onClick={() => toggleSortColumn('viewCount')}>
                    Lượt xem {vs.sortBy === 'viewCount' ? (vs.sortDir === 'desc' ? '↓' : '↑') : ''}
                  </button>
                </th>
                <th className="rs-num-cell">
                  <button type="button" className="rs-sort-btn" onClick={() => toggleSortColumn('likeCount')}>
                    Thích / Bình luận
                  </button>
                </th>
                {showSnapshotsColumn && <th>Mốc thô &lt;= 30 ngày</th>}
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {pagedVideos.map((v) => {
                const breakoutState = projectIdForBreakout ? breakoutByProject[projectIdForBreakout]?.[v.id] : undefined;
                const snapshotPoints =
                  uiMode === 'insufficient_data' ? v.snapshots30d.slice(-1) : v.snapshots30d;

                return (
                  <tr key={v.id}>
                    <td style={{ minWidth: 250 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div className="rs-thumb" aria-hidden="true" style={{ width: 92, height: 52, position: 'relative' }}>
                          {v.thumbnailUrl && v.thumbnailUrl.startsWith('https://') ? (
                            <img
                              src={v.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                            />
                          ) : (
                            <span>YT</span>
                          )}
                          <span className="rs-thumb-dur">{v.durationDisplay}</span>
                        </div>
                        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button
                            type="button"
                            className="rs-title-link"
                            onClick={() =>
                              navigate('video-detail', {
                                params: { videoId: v.id, fromScreen, fromChannelId: fromChannelId ?? v.channelId },
                              })
                            }
                          >
                            {v.title}
                          </button>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
                            <button
                              type="button"
                              className="rs-crumb-btn"
                              style={{ padding: 0, fontWeight: 600 }}
                              onClick={() => navigate('channel-detail', { params: { channelId: v.channelId } })}
                            >
                              {v.channelTitle}
                            </button>
                            <span>· Đăng {v.publishedAt}</span>
                            <a
                              href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--rs-accent-text)', textDecoration: 'none', fontWeight: 600 }}
                            >
                              YouTube ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ minWidth: 185 }}>
                      <FormatBadgeGroup video={v} compact />
                    </td>

                    <td className="rs-num-cell" style={{ fontWeight: 700 }}>
                      {formatInt(v.viewCount)}
                    </td>

                    <td className="rs-num-cell" style={{ color: 'var(--rs-text-secondary)' }}>
                      <div>👍 {formatInt(v.likeCount)}</div>
                      <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
                        💬 {formatInt(v.commentCount)}
                      </div>
                    </td>

                    {showSnapshotsColumn && (
                      <td style={{ minWidth: 165 }}>
                        <SparklineCell
                          points={snapshotPoints.map((s) => s.viewCount)}
                          labels={snapshotPoints.map((s) => s.capturedAt)}
                          badgeLabel={`${snapshotPoints.length} mốc thu thập`}
                          directionLabel={formatSnapshotDeltaLabel(snapshotPoints)}
                          tooltipTitle="Mốc viewCount thô <= 30 ngày"
                          tooltipDetail="Chỉ trình bày số liệu gốc theo timestamp (III.E.4.f), không tính Views/ngày hay tỷ lệ."
                          insufficientText="Chưa đủ mốc (1 lần lấy)"
                        />
                      </td>
                    )}

                    <td style={{ minWidth: 155 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                        {projectIdForBreakout && (
                          <button
                            type="button"
                            className={`rs-btn rs-btn-sm ${breakoutState?.flagged ? 'rs-btn-primary' : 'rs-btn-secondary'}`}
                            title={breakoutState?.flagged ? 'Bỏ cờ Đánh dấu Bứt phá thủ công' : 'Đánh dấu Video Bứt phá thủ công'}
                            onClick={() => {
                              void toggleBreakoutFlag(projectIdForBreakout, v.id);
                            }}
                          >
                            {breakoutState?.flagged ? '★ Đã đánh dấu' : '☆ Bứt phá'}
                          </button>
                        )}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="rs-btn rs-btn-sm rs-btn-tinted"
                            onClick={() =>
                              openSaveIdeaModal({
                                title: v.title,
                                sourceType: 'youtube_video',
                                sourceRefId: v.id,
                                sourceTitleSnapshot: v.title,
                                sourceUrl: `https://www.youtube.com/watch?v=${v.id}`,
                                tags: v.tags,
                              })
                            }
                          >
                            + Ý tưởng
                          </button>
                          <button
                            type="button"
                            className="rs-btn rs-btn-sm rs-btn-secondary"
                            onClick={() => openInspectorVideo(v.id)}
                          >
                            Xem nhanh
                          </button>
                          {activeProject && !projectIdForBreakout && v.channelId && (
                            <button
                              type="button"
                              className="rs-btn rs-btn-sm rs-btn-secondary"
                              onClick={() => {
                                void addChannelToProject(activeProject.id, v.channelId);
                              }}
                            >
                              + Đối thủ
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="rs-pagination">
            <div className="rs-tabular" style={{ fontSize: '13px', color: 'var(--rs-text-secondary)' }}>
              Hiển thị {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} trên{' '}
              <strong>{sorted.length}</strong> video ({pageSize} dòng/trang)
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                className="rs-btn rs-btn-sm rs-btn-secondary"
                disabled={safePage <= 1}
                onClick={() => updateViewState({ page: safePage - 1 })}
              >
                Trang trước
              </button>
              <span className="rs-tabular" style={{ fontSize: '13px', fontWeight: 600 }}>
                Trang {safePage} / {totalPages}
              </span>
              <button
                type="button"
                className="rs-btn rs-btn-sm rs-btn-secondary"
                disabled={safePage >= totalPages}
                onClick={() => updateViewState({ page: safePage + 1 })}
              >
                Trang kế
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
