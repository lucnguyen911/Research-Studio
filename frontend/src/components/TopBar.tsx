import React, { useEffect, useRef, useState } from 'react';
import { getActiveLocale, getTranslations } from '../i18n/translations';
import type { UiLanguage } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { isDemoPreviewScreen, usePrototypeWorkspace } from '../state/workspaceContext';

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
    uiLanguage,
    setUiLanguage,
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

  const t = getTranslations(uiLanguage).topbar;
  const locale = getActiveLocale(uiLanguage);

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
        { label: t.globalCrumb, onClick: () => navigate('global-overview') },
        { label: t.screenTitles[sid] },
      ];
    }
    if (sid.startsWith('project-')) {
      return [
        {
          label: activeProject ? activeProject.name : t.projectFallbackCrumb,
          onClick: () => navigate('project-overview'),
        },
        { label: t.screenTitles[sid] },
      ];
    }
    if (sid === 'channel-detail') {
      const chId = currentEntry.params.channelId;
      const sampleVid = chId ? Object.values(cachedVideosById).find((v) => v.channelId === chId) : undefined;
      return [
        { label: activeProject ? activeProject.name : t.projectFallbackCrumb, onClick: () => navigate('project-overview') },
        { label: t.competitorsCrumb, onClick: () => navigate('project-competitors') },
        { label: sampleVid?.channelTitle ?? chId ?? t.channelCrumb },
      ];
    }
    if (sid === 'video-detail') {
      const vid = currentEntry.params.videoId ? cachedVideosById[currentEntry.params.videoId] : undefined;
      const fromChId = currentEntry.params.fromChannelId ?? vid?.channelId;
      const crumbs: Array<{ label: string; onClick?: () => void }> = [];
      if (currentEntry.params.fromScreen === 'global-trends' || currentEntry.params.fromScreen === 'global-search') {
        crumbs.push({
          label: t.screenTitles[currentEntry.params.fromScreen],
          onClick: () => navigate(currentEntry.params.fromScreen!),
        });
      } else {
        crumbs.push({
          label: t.competitorsCrumb,
          onClick: () => navigate('project-competitors'),
        });
        if (fromChId) {
          crumbs.push({
            label: vid?.channelTitle || t.channelCrumb,
            onClick: () => navigate('channel-detail', { params: { channelId: fromChId } }),
          });
        }
      }
      crumbs.push({ label: vid?.title || t.videoCrumb });
      return crumbs;
    }
    if (sid === 'article-detail') {
      return [
        { label: t.rssCrumb, onClick: () => navigate('global-news') },
        { label: t.screenTitles[sid] },
      ];
    }
    if (sid === 'idea-detail') {
      const idea = ideas.find((i) => i.id === currentEntry.params.ideaId);
      return [
        { label: t.ideasCrumb, onClick: () => navigate('global-ideas') },
        { label: idea?.title ?? t.ideaCrumb },
      ];
    }
    return [{ label: t.systemCrumb }, { label: t.screenTitles[sid] }];
  };

  const crumbs = buildCrumbs();

  const quotaExhausted = quotaStatus.searchQueries.exhausted || quotaStatus.generalData.exhausted;
  const quotaWarning = quotaStatus.searchQueries.warning || quotaStatus.generalData.warning;

  const urgentAlert = !isBootstrapping && !backendOnline
    ? {
        label: t.alerts.offline,
        danger: true,
        onClick: () => {
          void refreshWorkspaceStatus();
        },
      }
    : systemSettings.apiKeyStatus === 'unreadable'
      ? {
          label: t.alerts.apiKeyError,
          danger: true,
          onClick: () => navigate('system-settings'),
        }
      : quotaExhausted
        ? {
            label: t.alerts.quotaExhausted,
            danger: true,
            onClick: () => setPopoverOpen((v) => !v),
          }
        : quotaWarning
          ? {
              label: t.alerts.quotaWarning,
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
            title={t.backTitle}
            aria-label={t.backLabel}
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
            title={t.forwardTitle}
            aria-label={t.forwardLabel}
          >
            <svg {...iconProps}>
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>

        <nav className="rs-breadcrumb" aria-label={t.breadcrumbAria}>
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
          <span className="rs-tag-stage2" title={t.stage2BadgeTitle}>
            {t.stage2Badge}
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
            title={t.quotaBtnTitle}
          >
            <span className={dotClass} aria-hidden="true" />
            <span>{t.quotaBtnLabel}</span>
            <svg {...iconProps} width={13} height={13}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {popoverOpen && (
            <div className="rs-topbar-popover" role="dialog" aria-label={t.quotaDialogAria}>
              <div className="rs-popover-header">
                <span className="rs-popover-title">{t.quotaTitle}</span>
                <span className="rs-popover-meta" title={t.resetHintTitle}>
                  {t.resetHint}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div>
                  <div className="rs-popover-kv-row" style={{ marginBottom: 4 }}>
                    <span>{t.quotaSearch}</span>
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
                    <span>{t.quotaData}</span>
                    <strong className="rs-tabular">
                      {quotaStatus.generalData.used.toLocaleString(locale)} /{' '}
                      {quotaStatus.generalData.limit.toLocaleString(locale)}
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
                  <span>{t.localConnection}</span>
                  <strong>{isBootstrapping ? t.statusChecking : backendOnline ? t.statusActive : t.statusOffline}</strong>
                </div>
                <div className="rs-popover-kv-row">
                  <span>{t.apiKeyLabel}</span>
                  <strong>
                    {systemSettings.apiKeyStatus === 'configured'
                      ? t.apiKeyConfigured(systemSettings.maskedApiKey ?? '***')
                      : systemSettings.apiKeyStatus === 'unreadable'
                        ? t.apiKeyError
                        : t.apiKeyMissing}
                  </strong>
                </div>
                <div className="rs-popover-kv-row">
                  <span>{t.youtubeTermsLabel}</span>
                  <strong>{systemSettings.legalConsentAccepted ? t.termsAccepted : t.termsNotAccepted}</strong>
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
                  {t.settingsBtn}
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
                    {t.acceptTermsBtn}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <label className="rs-topbar-lang" title={t.languageAria}>
          <svg {...iconProps} width={14} height={14}>
            <circle cx="12" cy="12" r="9" />
            <path d="M3.6 9h16.8" />
            <path d="M3.6 15h16.8" />
            <path d="M12 3a14.5 14.5 0 0 0 0 18" />
            <path d="M12 3a14.5 14.5 0 0 1 0 18" />
          </svg>
          <select
            aria-label={t.languageAria}
            className="rs-topbar-lang-select"
            value={uiLanguage}
            onChange={(e) => setUiLanguage(e.target.value as UiLanguage)}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>

        <button
          type="button"
          className="rs-btn rs-btn-secondary rs-btn-icon"
          onClick={toggleTheme}
          title={theme === 'light' ? t.switchToDark : t.switchToLight}
          aria-label={theme === 'light' ? t.switchToDark : t.switchToLight}
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
          title={t.settingsBtn}
          aria-label={t.settingsBtn}
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
