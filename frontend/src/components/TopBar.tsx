import React, { useEffect, useRef, useState } from 'react';
import type { ScreenId } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { isDemoPreviewScreen, usePrototypeWorkspace } from '../state/workspaceContext';

const SCREEN_TITLES: Record<ScreenId, string> = {
  'global-overview': 'Tổng quan',
  'global-trends': 'Khám phá xu hướng',
  'global-search': 'Nghiên cứu tự do',
  'global-featured-stage2': 'Video nổi bật',
  'global-news': 'Tin tức & thảo luận',
  'global-ideas': 'Kho ý tưởng chung',
  'project-overview': 'Tổng quan dự án',
  'project-hot-topics-stage2': 'Chủ đề nóng',
  'project-keywords': 'Nghiên cứu từ khóa',
  'project-breakout': 'Video bứt phá',
  'project-competitors': 'Theo dõi đối thủ',
  'project-evergreen-stage2': 'Chủ đề dài hạn',
  'project-opportunities-stage2': 'Cơ hội nội dung',
  'project-ai-stage2': 'Nghiên cứu AI',
  'project-ideas': 'Quản lý ý tưởng',
  'project-settings': 'Cài đặt dự án',
  'channel-detail': 'Chi tiết kênh',
  'video-detail': 'Chi tiết video',
  'article-detail': 'Chi tiết bài viết',
  'idea-detail': 'Chi tiết ý tưởng',
  'system-settings': 'Cài đặt',
};

const iconProps = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
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
    refreshWorkspaceStatus,
    setLegalModalOpen,
  } = usePrototypeWorkspace();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (popoverWrapRef.current && !popoverWrapRef.current.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [popoverOpen]);

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
          label: activeProject ? activeProject.name : 'Dự án',
          onClick: () => navigate('project-overview'),
        },
        { label: SCREEN_TITLES[sid] },
      ];
    }
    if (sid === 'channel-detail') {
      const chId = currentEntry.params.channelId;
      const sampleVid = chId ? Object.values(cachedVideosById).find((v) => v.channelId === chId) : undefined;
      return [
        { label: activeProject ? activeProject.name : 'Dự án', onClick: () => navigate('project-overview') },
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
        { label: 'Chi tiết bài viết' },
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

  const quotaExhausted = quotaStatus.searchQueries.exhausted || quotaStatus.generalData.exhausted;
  const quotaWarning = quotaStatus.searchQueries.warning || quotaStatus.generalData.warning;

  const urgentAlert = !isBootstrapping && !backendOnline
    ? {
        label: 'Mất kết nối',
        danger: true,
        onClick: () => {
          void refreshWorkspaceStatus();
        },
      }
    : systemSettings.apiKeyStatus === 'unreadable'
      ? {
          label: 'Lỗi API Key',
          danger: true,
          onClick: () => navigate('system-settings'),
        }
      : quotaExhausted
        ? {
            label: 'Hết hạn mức API',
            danger: true,
            onClick: () => setPopoverOpen((v) => !v),
          }
        : quotaWarning
          ? {
              label: 'Sắp hết hạn mức',
              danger: false,
              onClick: () => setPopoverOpen((v) => !v),
            }
          : null;

  const dotClass =
    (!isBootstrapping && !backendOnline) || systemSettings.apiKeyStatus === 'unreadable' || quotaExhausted
      ? 'rs-status-dot is-danger'
      : quotaWarning || systemSettings.apiKeyStatus === 'missing' || !systemSettings.legalConsentAccepted
        ? 'rs-status-dot is-warning'
        : 'rs-status-dot';

  const searchPct = Math.min(
    100,
    quotaStatus.searchQueries.limit > 0
      ? (quotaStatus.searchQueries.used / quotaStatus.searchQueries.limit) * 100
      : 0,
  );
  const generalPct = Math.min(
    100,
    quotaStatus.generalData.limit > 0
      ? (quotaStatus.generalData.used / quotaStatus.generalData.limit) * 100
      : 0,
  );

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
            <svg {...iconProps}>
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-secondary rs-btn-icon"
            disabled={!canGoForward}
            onClick={goForward}
            title="Tiến tới (Forward)"
            aria-label="Tiến tới"
          >
            <svg {...iconProps}>
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
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
          <span className="rs-tag-stage2" title="Tính năng thuộc Giai đoạn 2">
            Giai đoạn 2
          </span>
        )}
      </div>

      <div className="rs-topbar-right">
        {urgentAlert && (
          <button
            type="button"
            className={`rs-topbar-alert ${urgentAlert.danger ? 'is-danger' : ''}`}
            onClick={urgentAlert.onClick}
          >
            {urgentAlert.label}
          </button>
        )}

        <div className="rs-topbar-popover-wrap" ref={popoverWrapRef}>
          <button
            type="button"
            className="rs-topbar-status-btn"
            aria-expanded={popoverOpen}
            aria-haspopup="dialog"
            onClick={() => setPopoverOpen((v) => !v)}
            title="Xem hạn mức YouTube và trạng thái kết nối"
          >
            <span className={dotClass} aria-hidden="true" />
            <span>Hạn mức</span>
            <svg {...iconProps} width={13} height={13}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {popoverOpen && (
            <div className="rs-topbar-popover" role="dialog" aria-label="Hạn mức và trạng thái">
              <div className="rs-popover-header">
                <span className="rs-popover-title">Hạn mức YouTube hôm nay</span>
                <span className="rs-popover-meta">Reset 00:00 PT</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div>
                  <div className="rs-popover-kv-row" style={{ marginBottom: 4 }}>
                    <span>Tìm kiếm</span>
                    <strong className="rs-tabular">
                      {quotaStatus.searchQueries.used} / {quotaStatus.searchQueries.limit}
                    </strong>
                  </div>
                  <div className="rs-progress-track">
                    <div
                      className={`rs-progress-fill ${quotaStatus.searchQueries.warning ? 'is-danger' : ''}`}
                      style={{ width: `${searchPct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="rs-popover-kv-row" style={{ marginBottom: 4 }}>
                    <span>Dữ liệu</span>
                    <strong className="rs-tabular">
                      {quotaStatus.generalData.used.toLocaleString('vi-VN')} /{' '}
                      {quotaStatus.generalData.limit.toLocaleString('vi-VN')}
                    </strong>
                  </div>
                  <div className="rs-progress-track">
                    <div
                      className={`rs-progress-fill ${quotaStatus.generalData.warning ? 'is-danger' : ''}`}
                      style={{ width: `${generalPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="rs-popover-divider" />

              <div className="rs-popover-kv">
                <div className="rs-popover-kv-row">
                  <span>Kết nối cục bộ</span>
                  <strong>{isBootstrapping ? 'Đang kiểm tra' : backendOnline ? 'Đang hoạt động' : 'Mất kết nối'}</strong>
                </div>
                <div className="rs-popover-kv-row">
                  <span>YouTube API Key</span>
                  <strong>
                    {systemSettings.apiKeyStatus === 'configured'
                      ? `Đã cấu hình (${systemSettings.maskedApiKey ?? 'ẩn'})`
                      : systemSettings.apiKeyStatus === 'unreadable'
                        ? 'Lỗi đọc khóa'
                        : 'Chưa thiết lập'}
                  </strong>
                </div>
                <div className="rs-popover-kv-row">
                  <span>Điều khoản YouTube</span>
                  <strong>{systemSettings.legalConsentAccepted ? 'Đã xác nhận' : 'Chưa xác nhận'}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="rs-btn rs-btn-secondary rs-btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setPopoverOpen(false);
                    navigate('system-settings');
                  }}
                >
                  Mở Cài đặt
                </button>
                {!systemSettings.legalConsentAccepted && (
                  <button
                    type="button"
                    className="rs-btn rs-btn-tinted rs-btn-sm"
                    onClick={() => {
                      setPopoverOpen(false);
                      setLegalModalOpen(true);
                    }}
                  >
                    Xác nhận điều khoản
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="rs-btn rs-btn-secondary rs-btn-icon"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Chuyển sang Dark Mode' : 'Chuyển sang Light Mode'}
          aria-label={theme === 'light' ? 'Chuyển sang Dark Mode' : 'Chuyển sang Light Mode'}
        >
          {theme === 'light' ? (
            <svg {...iconProps}>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          ) : (
            <svg {...iconProps}>
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="rs-btn rs-btn-secondary rs-btn-icon"
          onClick={() => navigate('system-settings')}
          title="Cài đặt"
          aria-label="Cài đặt"
        >
          <svg {...iconProps}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </button>
      </div>
    </header>
  );
};
