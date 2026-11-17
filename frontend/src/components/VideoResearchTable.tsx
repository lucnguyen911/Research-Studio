import React from 'react';
import { getTranslations } from '../i18n/translations';
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
  emptyTitle,
  emptyDescription,
}) => {
  const { currentEntry, navigate, updateViewState } = useAppNavigation();
  const {
    uiLanguage,
    uiMode,
    manualFormatMap,
    breakoutByProject,
    toggleBreakoutFlag,
    openSaveIdeaModal,
    openInspectorVideo,
    projects,
    addChannelToProject,
  } = usePrototypeWorkspace();
  const t = getTranslations(uiLanguage).videoTable;
  const resolvedEmptyTitle = emptyTitle ?? t.emptyDefaultTitle;
  const resolvedEmptyDescription = emptyDescription ?? t.emptyDefaultDesc;

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

  const hasActiveFilter =
    vs.search.trim() !== '' ||
    vs.formatFilter !== 'all' ||
    vs.includeManualInFormat ||
    vs.manualFilter !== 'all' ||
    (showChannelFilter && vs.channelFilter !== 'all') ||
    (showDateWindowFilter && vs.dateWindow !== 'all') ||
    (showMinViewsFilter && vs.minViews.trim() !== '') ||
    (showBreakoutToggle && vs.onlyBreakout);

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

  if (videos.length === 0 && !hasActiveFilter) {
    return <EmptyStateCard title={resolvedEmptyTitle} description={resolvedEmptyDescription} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="rs-table-controls">
        <div className="rs-table-controls-row">
          <input
            type="search"
            aria-label={t.searchAria}
            className="rs-input"
            style={{ minWidth: 220, flex: '1 1 220px' }}
            placeholder={t.searchPlaceholder}
            value={vs.search}
            onChange={(e) => updateViewState({ search: e.target.value, page: 1 })}
          />

          {showChannelFilter && (
            <select
              aria-label={t.channelFilterAria}
              className="rs-select rs-select-compact"
              value={vs.channelFilter}
              onChange={(e) => updateViewState({ channelFilter: e.target.value, page: 1 })}
            >
              <option value="all">{t.allChannels(distinctChannels.length)}</option>
              {distinctChannels.map(([cid, cname]) => (
                <option key={cid} value={cid}>
                  {cname}
                </option>
              ))}
            </select>
          )}

          {showDateWindowFilter && (
            <select
              aria-label={t.dateFilterAria}
              className="rs-select rs-select-compact"
              value={vs.dateWindow}
              onChange={(e) => updateViewState({ dateWindow: e.target.value as ViewFilterState['dateWindow'], page: 1 })}
            >
              <option value="3">{t.dateLast3d}</option>
              <option value="7">{t.dateLast7d}</option>
              <option value="14">{t.dateLast14d}</option>
              <option value="30">{t.dateLast30d}</option>
              <option value="all">{t.dateAllSaved}</option>
            </select>
          )}

          {showMinViewsFilter && (
            <input
              type="number"
              aria-label={t.minViewsAria}
              className="rs-input"
              style={{ width: 140 }}
              placeholder={t.minViewsPlaceholder}
              value={vs.minViews}
              onChange={(e) => updateViewState({ minViews: e.target.value, page: 1 })}
            />
          )}

          <select
            aria-label={t.sortAria}
            className="rs-select rs-select-compact"
            value={`${vs.sortBy}:${vs.sortDir}`}
            onChange={(e) => {
              const [sortBy, sortDir] = e.target.value.split(':') as [ViewFilterState['sortBy'], 'desc' | 'asc'];
              updateViewState({ sortBy, sortDir, page: 1 });
            }}
          >
            <option value="viewCount:desc">{t.sortViewsDesc}</option>
            <option value="viewCount:asc">{t.sortViewsAsc}</option>
            <option value="likeCount:desc">{t.sortLikesDesc}</option>
            <option value="commentCount:desc">{t.sortCommentsDesc}</option>
            <option value="publishedAt:desc">{t.sortPublishedDesc}</option>
            <option value="durationSeconds:desc">{t.sortDurationDesc}</option>
          </select>

          {showBreakoutToggle && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={vs.onlyBreakout}
                onChange={(e) => updateViewState({ onlyBreakout: e.target.checked, page: 1 })}
              />
              <span>{t.onlyBreakoutLabel}</span>
            </label>
          )}
        </div>

        <div className="rs-table-controls-row" style={{ justifyContent: 'space-between' }}>
          <div className="rs-pill-group" role="group" aria-label={t.formatGroupAria}>
            <button
              type="button"
              className={`rs-pill-tab ${vs.formatFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => updateViewState({ formatFilter: 'all', page: 1 })}
            >
              {t.formatAll(videos.length)}
            </button>
            <button
              type="button"
              className={`rs-pill-tab ${vs.formatFilter === 'long_form' ? 'is-active' : ''}`}
              onClick={() => updateViewState({ formatFilter: 'long_form', page: 1 })}
            >
              {t.formatLong(getEffectiveFormatCount('long_form'))}
            </button>
            <button
              type="button"
              className={`rs-pill-tab ${vs.formatFilter === 'shorts' ? 'is-active' : ''}`}
              onClick={() => updateViewState({ formatFilter: 'shorts', page: 1 })}
            >
              {t.formatShorts(getEffectiveFormatCount('shorts'))}
            </button>
            <button
              type="button"
              className={`rs-pill-tab ${vs.formatFilter === 'unknown' ? 'is-active' : ''}`}
              title={t.formatUnknownTitle}
              onClick={() => updateViewState({ formatFilter: 'unknown', page: 1 })}
            >
              {t.formatUnknown(getEffectiveFormatCount('unknown'))}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '12.5px', cursor: 'pointer' }}
              title={t.includeManualTitle}
            >
              <input
                type="checkbox"
                checked={vs.includeManualInFormat}
                onChange={(e) => updateViewState({ includeManualInFormat: e.target.checked, page: 1 })}
              />
              <span>{t.includeManualLabel}</span>
            </label>

            {hasActiveFilter && (
              <button type="button" className="rs-btn rs-btn-ghost rs-btn-sm" onClick={resetFilters}>
                {t.resetFilters}
              </button>
            )}
          </div>
        </div>
      </div>

      {pagedVideos.length === 0 ? (
        <EmptyStateCard
          title={resolvedEmptyTitle}
          description={resolvedEmptyDescription}
          actionLabel={t.resetFilters}
          onAction={resetFilters}
        />
      ) : (
        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th>{t.colVideo}</th>
                <th>{t.colFormat}</th>
                <th className="rs-num-cell">
                  <button type="button" className="rs-sort-btn" onClick={() => toggleSortColumn('viewCount')}>
                    {t.colViews} {vs.sortBy === 'viewCount' ? (vs.sortDir === 'desc' ? '↓' : '↑') : ''}
                  </button>
                </th>
                <th className="rs-num-cell">
                  <button type="button" className="rs-sort-btn" onClick={() => toggleSortColumn('likeCount')}>
                    {t.colLikes} {vs.sortBy === 'likeCount' ? (vs.sortDir === 'desc' ? '↓' : '↑') : ''}
                  </button>
                </th>
                <th className="rs-num-cell">
                  <button type="button" className="rs-sort-btn" onClick={() => toggleSortColumn('commentCount')}>
                    {t.colComments} {vs.sortBy === 'commentCount' ? (vs.sortDir === 'desc' ? '↓' : '↑') : ''}
                  </button>
                </th>
                {showSnapshotsColumn && <th>{t.colHistory}</th>}
                <th>{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {pagedVideos.map((v) => {
                const breakoutState = projectIdForBreakout ? breakoutByProject[projectIdForBreakout]?.[v.id] : undefined;
                const snapshotPoints =
                  uiMode === 'insufficient_data' ? v.snapshots30d.slice(-1) : v.snapshots30d;

                return (
                  <tr key={v.id}>
                    <td style={{ minWidth: 280 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div className="rs-thumb" aria-hidden="true">
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
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
                            <button
                              type="button"
                              className="rs-crumb-btn"
                              style={{ padding: 0, fontWeight: 600 }}
                              onClick={() => navigate('channel-detail', { params: { channelId: v.channelId } })}
                            >
                              {v.channelTitle}
                            </button>
                            <span aria-hidden="true">·</span>
                            <span>{v.publishedAt}</span>
                            <span aria-hidden="true">·</span>
                            <a
                              href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rs-link-quiet"
                            >
                              YouTube ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ minWidth: 165 }}>
                      <FormatBadgeGroup video={v} compact />
                    </td>

                    <td className="rs-num-cell" style={{ fontWeight: 600 }}>
                      {formatInt(v.viewCount)}
                    </td>

                    <td className="rs-num-cell" style={{ color: 'var(--rs-text-secondary)' }}>
                      {formatInt(v.likeCount)}
                    </td>

                    <td className="rs-num-cell" style={{ color: 'var(--rs-text-secondary)' }}>
                      {formatInt(v.commentCount)}
                    </td>

                    {showSnapshotsColumn && (
                      <td style={{ minWidth: 155 }}>
                        <SparklineCell
                          points={snapshotPoints.map((s) => s.viewCount)}
                          labels={snapshotPoints.map((s) => s.capturedAt)}
                          badgeLabel={t.historyBadge(snapshotPoints.length)}
                          directionLabel={formatSnapshotDeltaLabel(snapshotPoints)}
                          tooltipTitle={t.historyTitle}
                          tooltipDetail={t.historyDetail}
                          insufficientText={t.historyInsufficient}
                        />
                      </td>
                    )}

                    <td style={{ minWidth: 175 }}>
                      <div className="rs-row-actions">
                        {projectIdForBreakout && (
                          <button
                            type="button"
                            className={`rs-btn rs-btn-sm ${breakoutState?.flagged ? 'rs-btn-primary' : 'rs-btn-secondary'}`}
                            title={breakoutState?.flagged ? t.breakoutFlagTitle : t.breakoutUnflagTitle}
                            onClick={() => {
                              void toggleBreakoutFlag(projectIdForBreakout, v.id);
                            }}
                          >
                            {breakoutState?.flagged ? t.breakoutFlagged : t.breakoutUnflagged}
                          </button>
                        )}
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
                          {t.addIdeaBtn}
                        </button>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-secondary"
                          onClick={() => openInspectorVideo(v.id)}
                        >
                          {t.quickViewBtn}
                        </button>
                        {activeProject && !projectIdForBreakout && v.channelId && (
                          <button
                            type="button"
                            className="rs-btn rs-btn-sm rs-btn-secondary"
                            onClick={() => {
                              void addChannelToProject(activeProject.id, v.channelId);
                            }}
                          >
                            {t.addCompetitorBtn}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="rs-pagination">
            <div className="rs-tabular" style={{ fontSize: '13px', color: 'var(--rs-text-secondary)' }}>
              {t.paginationRange((safePage - 1) * pageSize + 1, Math.min(safePage * pageSize, sorted.length), sorted.length)}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                className="rs-btn rs-btn-sm rs-btn-secondary"
                disabled={safePage <= 1}
                onClick={() => updateViewState({ page: safePage - 1 })}
              >
                {t.prevPage}
              </button>
              <span className="rs-tabular" style={{ fontSize: '13px', fontWeight: 600 }}>
                {t.pageStatus(safePage, totalPages)}
              </span>
              <button
                type="button"
                className="rs-btn rs-btn-sm rs-btn-secondary"
                disabled={safePage >= totalPages}
                onClick={() => updateViewState({ page: safePage + 1 })}
              >
                {t.nextPage}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
