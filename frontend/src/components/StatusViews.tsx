import React from 'react';
import { formatDateTimeVi } from '../api/mappers';
import { getActiveLocale, getTranslations } from '../i18n/translations';
import type { ScreenId } from '../prototype/types';
import { STAGE_TWO_INFO } from '../prototype/demoData';
import { useAppNavigation } from '../state/navigationStore';
import { isDemoPreviewScreen, usePrototypeWorkspace } from '../state/workspaceContext';

export const StageTwoScreen: React.FC<{
  screenId: keyof typeof STAGE_TWO_INFO;
}> = ({ screenId }) => {
  const { navigate } = useAppNavigation();
  const { uiLanguage } = usePrototypeWorkspace();
  const sv = getTranslations(uiLanguage).statusViews;
  const info = sv.stage2Info[screenId];

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">{info.title}</h1>
            <span className="rs-badge">{sv.stage2Badge}</span>
          </div>
          <p className="rs-page-subtitle">{sv.scopeLine(info.scope)}</p>
        </div>
      </div>

      <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: 820 }}>
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: '15.5px' }}>{sv.stage2GoalTitle}</h2>
          <p style={{ margin: 0, color: 'var(--rs-text-secondary)' }}>{info.goal}</p>
        </div>

        <div className="rs-card-subtle">
          <h3 style={{ margin: '0 0 6px', fontSize: '14px' }}>{sv.stage2ReasonTitle}</h3>
          <p style={{ margin: 0, color: 'var(--rs-text-secondary)' }}>{info.reason}</p>
        </div>

        <p style={{ margin: 0, fontSize: '13px', color: 'var(--rs-text-muted)' }}>
          {sv.stage2FooterNote}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: 4 }}>
          {info.alternatives.map((alt) => (
            <button
              key={alt.screenId}
              type="button"
              className="rs-btn rs-btn-primary"
              onClick={() => navigate(alt.screenId as ScreenId)}
            >
              {alt.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export const GlobalModeBanners: React.FC<{ requiresYouTubeApi?: boolean }> = ({
  requiresYouTubeApi = false,
}) => {
  const {
    uiLanguage,
    isBootstrapping,
    backendOnline,
    systemSettings,
    quotaStatus,
    refreshWorkspaceStatus,
    setLegalModalOpen,
  } = usePrototypeWorkspace();
  const { currentEntry, navigate } = useAppNavigation();
  const isPreview = isDemoPreviewScreen(currentEntry.screenId);
  const sv = getTranslations(uiLanguage).statusViews;
  const locale = getActiveLocale(uiLanguage);

  return (
    <>
      {isPreview && (
        <div className="rs-banner rs-banner-amber" role="status">
          <div>{sv.stage2Badge}</div>
        </div>
      )}

      {!isBootstrapping && !backendOnline && (
        <div className="rs-banner rs-banner-warn" role="status">
          <div>
            <strong>{sv.offlineTitle}</strong> {sv.offlineDesc}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="rs-btn rs-btn-sm rs-btn-secondary"
              onClick={() => {
                void refreshWorkspaceStatus();
              }}
            >
              {sv.retryBtn}
            </button>
          </div>
        </div>
      )}

      {requiresYouTubeApi && backendOnline && !systemSettings.legalConsentAccepted && (
        <div className="rs-banner rs-banner-warn" role="alert">
          <div>
            <strong>{sv.legalBannerTitle}</strong> {sv.legalBannerDesc}
          </div>
          <button type="button" className="rs-btn rs-btn-sm rs-btn-primary" onClick={() => setLegalModalOpen(true)}>
            {sv.legalBannerBtn}
          </button>
        </div>
      )}

      {requiresYouTubeApi && backendOnline && systemSettings.apiKeyStatus === 'unreadable' && (
        <div className="rs-banner rs-banner-danger" role="alert">
          <div>
            <strong>{sv.keyUnreadableTitle}</strong> {sv.keyUnreadableDesc}
          </div>
          <button type="button" className="rs-btn rs-btn-sm rs-btn-primary" onClick={() => navigate('system-settings')}>
            {sv.keyUnreadableBtn}
          </button>
        </div>
      )}

      {requiresYouTubeApi &&
        backendOnline &&
        systemSettings.legalConsentAccepted &&
        systemSettings.apiKeyStatus === 'missing' && (
          <div className="rs-banner rs-banner-warn" role="alert">
            <div>
              <strong>{sv.keyMissingTitle}</strong> {sv.keyMissingDesc}
            </div>
            <button type="button" className="rs-btn rs-btn-sm rs-btn-primary" onClick={() => navigate('system-settings')}>
              {sv.keyMissingBtn}
            </button>
          </div>
        )}

      {requiresYouTubeApi &&
        backendOnline &&
        quotaStatus.searchQueries.warning &&
        !quotaStatus.searchQueries.exhausted && (
          <div className="rs-banner rs-banner-warn" role="status">
            <div>
              <strong>{sv.quotaSearchWarnTitle(quotaStatus.searchQueries.used, quotaStatus.searchQueries.limit)}</strong>{' '}
              {sv.quotaSearchWarnDesc(quotaStatus.searchQueries.remaining, formatDateTimeVi(quotaStatus.resetAtUtc))}
            </div>
          </div>
        )}

      {requiresYouTubeApi &&
        backendOnline &&
        quotaStatus.generalData.warning &&
        !quotaStatus.generalData.exhausted && (
          <div className="rs-banner rs-banner-warn" role="status">
            <div>
              <strong>
                {sv.quotaDataWarnTitle(
                  quotaStatus.generalData.used.toLocaleString(locale),
                  quotaStatus.generalData.limit.toLocaleString(locale),
                )}
              </strong>{' '}
              {sv.quotaDataWarnDesc(formatDateTimeVi(quotaStatus.resetAtUtc))}
            </div>
          </div>
        )}

      {requiresYouTubeApi && backendOnline && quotaStatus.searchQueries.exhausted && (
        <div className="rs-banner rs-banner-danger" role="alert">
          <div>
            <strong>
              {sv.quotaSearchExhaustedTitle(quotaStatus.searchQueries.used, quotaStatus.searchQueries.limit)}
            </strong>{' '}
            {sv.quotaSearchExhaustedDesc(quotaStatus.ptDate)}
          </div>
        </div>
      )}

      {requiresYouTubeApi && backendOnline && quotaStatus.generalData.exhausted && (
        <div className="rs-banner rs-banner-danger" role="alert">
          <div>
            <strong>
              {sv.quotaDataExhaustedTitle(
                quotaStatus.generalData.used.toLocaleString(locale),
                quotaStatus.generalData.limit.toLocaleString(locale),
              )}
            </strong>{' '}
            {sv.quotaDataExhaustedDesc}
          </div>
        </div>
      )}
    </>
  );
};

export const LoadingSkeletonCard: React.FC<{ label?: string }> = ({ label }) => {
  const { uiLanguage } = usePrototypeWorkspace();
  const tr = getTranslations(uiLanguage);
  const resolvedLabel = label ?? tr.statusViews.defaultLoadingLabel;
  return (
    <section className="rs-card" aria-busy="true" aria-label={resolvedLabel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <strong>{resolvedLabel}</strong>
        <span className="rs-badge">{tr.common.loadingBadge}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="rs-skeleton-line" style={{ width: '92%' }} />
        <div className="rs-skeleton-line" style={{ width: '78%' }} />
        <div className="rs-skeleton-line" style={{ width: '86%' }} />
        <div className="rs-skeleton-line" style={{ width: '64%' }} />
      </div>
    </section>
  );
};

export const EmptyStateCard: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}> = ({ title, description, actionLabel, onAction, secondaryLabel, onSecondary }) => (
  <section className="rs-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
    <h2 style={{ margin: '0 0 6px', fontSize: '16px' }}>{title}</h2>
    <p style={{ margin: '0 auto 14px', maxWidth: 520, color: 'var(--rs-text-secondary)' }}>{description}</p>
    <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
      {actionLabel && onAction && (
        <button type="button" className="rs-btn rs-btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      {secondaryLabel && onSecondary && (
        <button type="button" className="rs-btn rs-btn-secondary" onClick={onSecondary}>
          {secondaryLabel}
        </button>
      )}
    </div>
  </section>
);
