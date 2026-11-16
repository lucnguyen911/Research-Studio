import React from 'react';
import type { ScreenId } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { isDemoPreviewScreen, usePrototypeWorkspace } from '../state/workspaceContext';

const SCREEN_TITLES: Record<ScreenId, string> = {
  'global-overview': 'Tổng quan',
  'global-trends': 'Khám phá xu hướng',
  'global-search': 'Nghiên cứu tự do',
  'global-featured-stage2': 'Video nổi bật (Giai đoạn 2)',
  'global-news': 'Tin tức & thảo luận (RSS)',
  'global-ideas': 'Kho ý tưởng chung',
  'project-overview': 'Tổng quan dự án',
  'project-hot-topics-stage2': 'Chủ đề nóng (Giai đoạn 2)',
  'project-keywords': 'Nghiên cứu từ khóa',
  'project-breakout': 'Video bứt phá (Standard Mode)',
  'project-competitors': 'Theo dõi đối thủ',
  'project-evergreen-stage2': 'Chủ đề dài hạn (Giai đoạn 2)',
  'project-opportunities-stage2': 'Cơ hội nội dung (Giai đoạn 2)',
  'project-ai-stage2': 'Nghiên cứu AI (Giai đoạn 2)',
  'project-ideas': 'Quản lý ý tưởng',
  'project-settings': 'Cài đặt dự án',
  'channel-detail': 'Chi tiết kênh',
  'video-detail': 'Chi tiết video',
  'article-detail': 'Chi tiết bài báo RSS',
  'idea-detail': 'Chi tiết ý tưởng',
  'system-settings': 'Cài đặt hệ thống & Pháp lý',
};

export const TopBar: React.FC = () => {
  const { currentEntry, canGoBack, canGoForward, goBack, goForward, navigate } = useAppNavigation();
  const {
    theme,
    toggleTheme,
    backendOnline,
    isBootstrapping,
    systemSettings,
    quotaStatus,
    projects,
    cachedVideosById,
    ideas,
  } = usePrototypeWorkspace();

  const activeProject = projects.find((p) => p.id === currentEntry.projectId) ?? projects[0] ?? null;
  const isPreview = isDemoPreviewScreen(currentEntry.screenId);

  const buildCrumbs = (): Array<{ label: string; onClick?: () => void }> => {
    const sid = currentEntry.screenId;
    if (sid.startsWith('global-')) {
      return [
        { label: 'Global Research', onClick: () => navigate('global-overview') },
        { label: SCREEN_TITLES[sid] },
      ];
    }
    if (sid.startsWith('project-')) {
      return [
        {
          label: activeProject ? `Project: ${activeProject.name}` : 'Chưa có Project',
          onClick: () => navigate('project-overview'),
        },
        { label: SCREEN_TITLES[sid] },
      ];
    }
    if (sid === 'channel-detail') {
      const chId = currentEntry.params.channelId;
      const sampleVid = chId ? Object.values(cachedVideosById).find((v) => v.channelId === chId) : undefined;
      return [
        { label: activeProject ? activeProject.name : 'Project', onClick: () => navigate('project-overview') },
        { label: 'Theo dõi đối thủ', onClick: () => navigate('project-competitors') },
        { label: sampleVid?.channelTitle ?? chId ?? 'Chi tiết kênh' },
      ];
    }
    if (sid === 'video-detail') {
      const vid = currentEntry.params.videoId ? cachedVideosById[currentEntry.params.videoId] : undefined;
      const fromChId = currentEntry.params.fromChannelId ?? vid?.channelId;
      const crumbs: Array<{ label: string; onClick?: () => void }> = [];
      if (currentEntry.params.fromScreen === 'global-trends' || currentEntry.params.fromScreen === 'global-search') {
        crumbs.push({
          label: SCREEN_TITLES[currentEntry.params.fromScreen],
          onClick: () => navigate(currentEntry.params.fromScreen!),
        });
      } else {
        crumbs.push({
          label: 'Theo dõi đối thủ',
          onClick: () => navigate('project-competitors'),
        });
        if (fromChId) {
          crumbs.push({
            label: vid?.channelTitle || 'Chi tiết kênh',
            onClick: () => navigate('channel-detail', { params: { channelId: fromChId } }),
          });
        }
      }
      crumbs.push({ label: vid?.title || 'Chi tiết video' });
      return crumbs;
    }
    if (sid === 'article-detail') {
      return [
        { label: 'Tin tức & thảo luận', onClick: () => navigate('global-news') },
        { label: 'Chi tiết bài báo RSS' },
      ];
    }
    if (sid === 'idea-detail') {
      const idea = ideas.find((i) => i.id === currentEntry.params.ideaId);
      return [
        { label: 'Kho ý tưởng', onClick: () => navigate('global-ideas') },
        { label: idea?.title ?? 'Chi tiết ý tưởng' },
      ];
    }
    return [{ label: 'Hệ thống' }, { label: SCREEN_TITLES[sid] }];
  };

  const crumbs = buildCrumbs();

  const statusBadge = isBootstrapping
    ? { label: 'Đang kết nối SQLite...', cls: 'rs-badge' }
    : !backendOnline
      ? { label: 'Mất kết nối Backend', cls: 'rs-badge rs-badge-danger' }
      : systemSettings.apiKeyStatus === 'unreadable'
        ? { label: 'API Key lỗi giải mã', cls: 'rs-badge rs-badge-danger' }
        : !systemSettings.legalConsentAccepted
          ? { label: 'Chưa xác nhận Pháp lý', cls: 'rs-badge rs-badge-warning' }
          : systemSettings.apiKeyStatus === 'missing'
            ? { label: 'Thiếu API Key', cls: 'rs-badge rs-badge-warning' }
            : { label: 'Local SQLite · Sẵn sàng', cls: 'rs-badge rs-badge-success' };

  return (
    <header className="rs-topbar">
      <div className="rs-topbar-left">
        <div className="rs-nav-btn-group">
          <button
            type="button"
            className="rs-btn rs-btn-secondary rs-btn-icon"
            disabled={!canGoBack}
            onClick={goBack}
            title="Quay lại (Back)"
            aria-label="Quay lại"
          >
            ←
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-secondary rs-btn-icon"
            disabled={!canGoForward}
            onClick={goForward}
            title="Tiến tới (Forward)"
            aria-label="Tiến tới"
          >
            →
          </button>
        </div>

        <nav className="rs-breadcrumb" aria-label="Breadcrumb">
          {crumbs.map((c, idx) => (
            <React.Fragment key={`${c.label}-${idx}`}>
              {idx > 0 && <span aria-hidden="true">/</span>}
              {c.onClick ? (
                <button type="button" className="rs-crumb-btn" onClick={c.onClick} title={c.label}>
                  {c.label}
                </button>
              ) : (
                <span className="rs-crumb-current" title={c.label}>
                  {c.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {isPreview && (
          <span
            className="rs-badge rs-badge-demo"
            title="Màn hình xem trước giao diện — sẽ nối dữ liệu SQLite & API thật ở Milestone 3–5"
          >
            DEMO (Xem trước M3–M5)
          </span>
        )}
      </div>

      <div className="rs-topbar-right">
        <span className={statusBadge.cls}>{statusBadge.label}</span>

        <span
          className="rs-badge rs-tabular"
          title={`Ước tính quota YouTube API ngày PT (${quotaStatus.ptDate}) · Reset 00:00 PT`}
        >
          Search: {quotaStatus.searchQueries.used}/{quotaStatus.searchQueries.limit} · API:{' '}
          {quotaStatus.generalData.used.toLocaleString('vi-VN')}/{quotaStatus.generalData.limit.toLocaleString('vi-VN')}
        </span>

        <button
          type="button"
          className="rs-btn rs-btn-secondary rs-btn-sm"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Chuyển sang Dark Mode' : 'Chuyển sang Light Mode'}
          aria-label={theme === 'light' ? 'Chuyển sang Dark Mode' : 'Chuyển sang Light Mode'}
        >
          {theme === 'light' ? '☀ Sáng' : '☾ Tối'}
        </button>

        <button
          type="button"
          className="rs-btn rs-btn-secondary rs-btn-icon"
          onClick={() => navigate('system-settings')}
          title="Cài đặt hệ thống & Pháp lý"
          aria-label="Cài đặt hệ thống"
        >
          ⚙
        </button>
      </div>
    </header>
  );
};
