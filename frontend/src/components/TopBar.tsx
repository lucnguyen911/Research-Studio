import React from 'react';
import type { ScreenId, UiSimulatorMode } from '../prototype/types';
import { DEMO_RSS_ARTICLES, DEMO_VIDEOS } from '../prototype/demoData';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace } from '../state/workspaceContext';

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
    uiMode,
    setUiMode,
    projects,
    channels,
    ideas,
    quotaSearchUsed,
    quotaGeneralUsed,
  } = usePrototypeWorkspace();

  const activeProject = projects.find((p) => p.id === currentEntry.projectId) ?? projects[0] ?? null;

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
      const ch = channels.find((c) => c.id === currentEntry.params.channelId);
      return [
        { label: activeProject ? activeProject.name : 'Project', onClick: () => navigate('project-overview') },
        { label: 'Theo dõi đối thủ', onClick: () => navigate('project-competitors') },
        { label: ch?.title ?? 'Chi tiết kênh' },
      ];
    }
    if (sid === 'video-detail') {
      const vid = DEMO_VIDEOS.find((v) => v.id === currentEntry.params.videoId);
      const fromChId = currentEntry.params.fromChannelId ?? vid?.channelId;
      const ch = channels.find((c) => c.id === fromChId);
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
        if (ch) {
          crumbs.push({
            label: ch.title,
            onClick: () => navigate('channel-detail', { params: { channelId: ch.id } }),
          });
        }
      }
      crumbs.push({ label: 'Chi tiết video' });
      return crumbs;
    }
    if (sid === 'article-detail') {
      const art = DEMO_RSS_ARTICLES.find((a) => a.id === currentEntry.params.articleId);
      return [
        { label: 'Tin tức & thảo luận', onClick: () => navigate('global-news') },
        { label: art?.feedName ?? 'Chi tiết bài báo' },
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
  const displaySearchQuota = uiMode === 'quota_search_exhausted' ? 100 : quotaSearchUsed;
  const displayGeneralQuota = uiMode === 'quota_general_exhausted' ? 10000 : quotaGeneralUsed;

  const networkBadge =
    uiMode === 'offline'
      ? { label: 'Ngoại tuyến (Local)', cls: 'rs-badge rs-badge-warning' }
      : uiMode === 'no_api_key'
        ? { label: 'Thiếu API Key', cls: 'rs-badge rs-badge-warning' }
        : { label: 'Online · Cache <= 30d', cls: 'rs-badge rs-badge-success' };

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

        <span className="rs-badge rs-badge-demo" title="Dữ liệu mô phỏng cho Prototype Phase 6 (Gate D)">
          DEMO
        </span>
      </div>

      <div className="rs-topbar-right">
        <span className={networkBadge.cls}>{networkBadge.label}</span>

        <span
          className="rs-badge rs-tabular"
          title="Ước tính quota YouTube API trên máy này · Reset 00:00 PT"
        >
          Search: {displaySearchQuota}/100 · API: {displayGeneralQuota.toLocaleString('vi-VN')}/10.000
        </span>

        <select
          id="rs-ui-mode-select"
          name="rs_ui_mode"
          aria-label="Mô phỏng trạng thái UI (DEMO)"
          title="Chuyển nhanh 14 trạng thái UI bắt buộc của Phase 6"
          className="rs-select rs-select-compact"
          value={uiMode}
          onChange={(e) => setUiMode(e.target.value as UiSimulatorMode)}
        >
          <option value="normal">UI: Bình thường</option>
          <option value="loading">UI: Loading</option>
          <option value="empty">UI: Empty state</option>
          <option value="no_api_key">UI: Không có API Key</option>
          <option value="offline">UI: Mất kết nối Internet</option>
          <option value="quota_search_exhausted">UI: Hết quota Search (100/100)</option>
          <option value="quota_general_exhausted">UI: Hết quota API chung</option>
          <option value="rss_error">UI: Nguồn RSS lỗi</option>
          <option value="insufficient_data">UI: Không đủ dữ liệu</option>
          <option value="refreshing">UI: Đang làm mới (Cancel)</option>
        </select>

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
