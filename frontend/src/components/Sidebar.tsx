import React, { useEffect, useRef, useState } from 'react';
import { getTranslations } from '../i18n/translations';
import type { GlobalScreenId, ProjectScreenId, ScreenId } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace } from '../state/workspaceContext';

const GLOBAL_CHILD_MENU: Array<{ id: GlobalScreenId; stage2?: boolean }> = [
  { id: 'global-trends' },
  { id: 'global-search' },
  { id: 'global-featured-stage2', stage2: true },
  { id: 'global-news' },
  { id: 'global-ideas' },
];

const PROJECT_CHILD_MENU: Array<{ id: ProjectScreenId; stage2?: boolean }> = [
  { id: 'project-hot-topics-stage2', stage2: true },
  { id: 'project-keywords' },
  { id: 'project-breakout' },
  { id: 'project-competitors' },
  { id: 'project-evergreen-stage2', stage2: true },
  { id: 'project-opportunities-stage2', stage2: true },
  { id: 'project-ai-stage2', stage2: true },
  { id: 'project-ideas' },
  { id: 'project-settings' },
];

const GLOBAL_CHILD_IDS = new Set<ScreenId>(GLOBAL_CHILD_MENU.map((item) => item.id));
const PROJECT_CHILD_IDS = new Set<ScreenId>(PROJECT_CHILD_MENU.map((item) => item.id));

type NavIconId = ScreenId | 'collapse-left' | 'collapse-right' | 'plus';

type PlatformId = 'youtube' | 'tiktok' | 'facebook' | 'instagram' | 'x';

const PLATFORM_OPTIONS: Array<{ id: PlatformId; label: string; available: boolean }> = [
  { id: 'youtube', label: 'YouTube', available: true },
  { id: 'tiktok', label: 'TikTok', available: false },
  { id: 'facebook', label: 'Facebook', available: false },
  { id: 'instagram', label: 'Instagram', available: false },
  { id: 'x', label: 'X', available: false },
];

const PlatformYouTubeIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="4.5" width="20" height="15" rx="4.2" fill="#DC2626" />
    <path d="M10 9l5.5 3-5.5 3V9Z" fill="#FFFFFF" />
  </svg>
);

const PlatformBadgeIcon: React.FC<{ id: PlatformId }> = ({ id }) => {
  switch (id) {
    case 'youtube':
      return <PlatformYouTubeIcon />;
    case 'tiktok':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
        </svg>
      );
    case 'facebook':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'x':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4l16 16" />
          <path d="M20 4L4 20" />
        </svg>
      );
  }
};

const SidebarIcon: React.FC<{ id: NavIconId; size?: number }> = ({ id, size = 15 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.85,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (id) {
    case 'global-overview':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'global-trends':
      return (
        <svg {...common}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      );
    case 'global-search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case 'global-featured-stage2':
      return (
        <svg {...common}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case 'global-news':
      return (
        <svg {...common}>
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'global-ideas':
      return (
        <svg {...common}>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </svg>
      );
    case 'project-overview':
      return (
        <svg {...common}>
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
        </svg>
      );
    case 'project-hot-topics-stage2':
      return (
        <svg {...common}>
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
        </svg>
      );
    case 'project-keywords':
      return (
        <svg {...common}>
          <line x1="4" x2="20" y1="9" y2="9" />
          <line x1="4" x2="20" y1="15" y2="15" />
          <line x1="10" x2="8" y1="3" y2="21" />
          <line x1="16" x2="14" y1="3" y2="21" />
        </svg>
      );
    case 'project-breakout':
      return (
        <svg {...common}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'project-competitors':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'project-evergreen-stage2':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
      );
    case 'project-opportunities-stage2':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case 'project-ai-stage2':
      return (
        <svg {...common}>
          <path d="m12 3-1.91 5.81a2 2 0 0 1-1.28 1.28L3 12l5.81 1.91a2 2 0 0 1 1.28 1.28L12 21l1.91-5.81a2 2 0 0 1 1.28-1.28L21 12l-5.81-1.91a2 2 0 0 1-1.28-1.28L12 3Z" />
        </svg>
      );
    case 'project-ideas':
      return (
        <svg {...common}>
          <path d="m3 17 2 2 4-4" />
          <path d="m3 7 2 2 4-4" />
          <path d="M13 6h8" />
          <path d="M13 12h8" />
          <path d="M13 18h8" />
        </svg>
      );
    case 'project-settings':
      return (
        <svg {...common}>
          <line x1="4" x2="20" y1="8" y2="8" />
          <line x1="4" x2="20" y1="16" y2="16" />
          <circle cx="9" cy="8" r="2" />
          <circle cx="15" cy="16" r="2" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'collapse-left':
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case 'collapse-right':
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      );
  }
};

export const Sidebar: React.FC = () => {
  const { currentEntry, activeArea, navigate, switchProject } = useAppNavigation();
  const { uiLanguage, projects, sidebarCollapsed, toggleSidebar, setCreateProjectModalOpen } =
    usePrototypeWorkspace();
  const t = getTranslations(uiLanguage).sidebar;

  const [platformMenuOpen, setPlatformMenuOpen] = useState(false);
  const platformWrapRef = useRef<HTMLDivElement | null>(null);
  const isPlatformMenuOpen = platformMenuOpen && !sidebarCollapsed;

  useEffect(() => {
    if (!isPlatformMenuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (platformWrapRef.current && !platformWrapRef.current.contains(event.target as Node)) {
        setPlatformMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPlatformMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isPlatformMenuOpen]);

  const activeProjectId = currentEntry.projectId ?? projects[0]?.id ?? '';

  const activeChildScreenId: ScreenId | null = (() => {
    const sid = currentEntry.screenId;
    if (activeArea === 'global' && GLOBAL_CHILD_IDS.has(sid)) return sid;
    if (activeArea === 'project' && PROJECT_CHILD_IDS.has(sid)) return sid;
    const from = currentEntry.params.fromScreen;
    if (activeArea === 'global' && from && GLOBAL_CHILD_IDS.has(from)) return from;
    if (activeArea === 'project' && from && PROJECT_CHILD_IDS.has(from)) return from;
    if (sid === 'channel-detail' || sid === 'video-detail') return 'project-competitors';
    if (sid === 'article-detail') return 'global-news';
    if (sid === 'idea-detail') return activeArea === 'project' ? 'project-ideas' : 'global-ideas';
    return null;
  })();

  const renderGlobalBtn = (item: { id: GlobalScreenId; stage2?: boolean }) => {
    const label = t.globalMenu[item.id];
    const isActive = activeChildScreenId === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => navigate(item.id)}
        aria-current={isActive ? 'page' : undefined}
        title={sidebarCollapsed ? `${label}${item.stage2 ? ` — ${t.stage2Title}` : ''}` : undefined}
        className={`rs-nav-item ${isActive ? 'is-active' : ''} ${item.stage2 ? 'is-stage2' : ''}`}
      >
        <span className="rs-nav-icon">
          <SidebarIcon id={item.id} />
        </span>
        {!sidebarCollapsed && <span className="rs-nav-label">{label}</span>}
        {!sidebarCollapsed && item.stage2 && (
          <span className="rs-tag-stage2" title={t.stage2Title}>
            {t.stage2Tag}
          </span>
        )}
      </button>
    );
  };

  const renderProjectBtn = (item: { id: ProjectScreenId; stage2?: boolean }) => {
    const label = t.projectMenu[item.id];
    const isActive = activeChildScreenId === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => navigate(item.id)}
        aria-current={isActive ? 'page' : undefined}
        title={sidebarCollapsed ? `${label}${item.stage2 ? ` — ${t.stage2Title}` : ''}` : undefined}
        className={`rs-nav-item ${isActive ? 'is-active' : ''} ${item.stage2 ? 'is-stage2' : ''}`}
      >
        <span className="rs-nav-icon">
          <SidebarIcon id={item.id} />
        </span>
        {!sidebarCollapsed && <span className="rs-nav-label">{label}</span>}
        {!sidebarCollapsed && item.stage2 && (
          <span className="rs-tag-stage2" title={t.stage2Title}>
            {t.stage2Tag}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className={`rs-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`} aria-label={t.mainNavAria}>
      <div className="rs-sidebar-top">
        {sidebarCollapsed ? (
          <div
            className="rs-platform-collapsed"
            title={t.platformTooltip(t.platforms.youtube)}
            aria-label={t.platformTooltip(t.platforms.youtube)}
          >
            <PlatformYouTubeIcon />
          </div>
        ) : (
          <div className="rs-platform-dropdown" ref={platformWrapRef}>
            <button
              type="button"
              className={`rs-platform-trigger ${isPlatformMenuOpen ? 'is-open' : ''}`}
              aria-label={t.selectPlatformAria}
              aria-haspopup="listbox"
              aria-expanded={isPlatformMenuOpen}
              onClick={() => setPlatformMenuOpen((v) => !v)}
            >
              <span className="rs-platform-badge is-youtube" aria-hidden="true">
                <PlatformYouTubeIcon />
              </span>
              <span className="rs-platform-name">{t.platforms.youtube}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="rs-platform-chevron"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {isPlatformMenuOpen && (
              <div className="rs-platform-menu" role="listbox" aria-label={t.platformMenuAria}>
                {PLATFORM_OPTIONS.map((platform) => {
                  const isSelected = platform.id === 'youtube';
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={!platform.available}
                      className={`rs-platform-option ${isSelected ? 'is-selected' : ''} ${
                        !platform.available ? 'is-disabled' : ''
                      }`}
                      onClick={() => {
                        if (platform.available) {
                          setPlatformMenuOpen(false);
                        }
                      }}
                    >
                      <span
                        className={`rs-platform-option-icon ${platform.id === 'youtube' ? 'is-youtube' : ''}`}
                        aria-hidden="true"
                      >
                        <PlatformBadgeIcon id={platform.id} />
                      </span>
                      <span className="rs-platform-option-label">{platform.label}</span>
                      {isSelected ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="rs-platform-check"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className="rs-platform-soon-tag">{t.platformComingSoonTag}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {sidebarCollapsed ? (
          <nav className="rs-nav-list" aria-label={t.areaAria}>
            <button
              type="button"
              onClick={() => navigate('global-overview')}
              title={t.overviewAreaTitle}
              aria-label={t.overviewArea}
              aria-current={currentEntry.screenId === 'global-overview' ? 'page' : undefined}
              className={`rs-nav-item ${
                currentEntry.screenId === 'global-overview'
                  ? 'is-active'
                  : activeArea === 'global'
                    ? 'is-area-active'
                    : ''
              }`}
            >
              <span className="rs-nav-icon">
                <SidebarIcon id="global-overview" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate('project-overview')}
              title={t.projectAreaTitle}
              aria-label={t.projectArea}
              aria-current={currentEntry.screenId === 'project-overview' ? 'page' : undefined}
              className={`rs-nav-item ${
                currentEntry.screenId === 'project-overview'
                  ? 'is-active'
                  : activeArea === 'project'
                    ? 'is-area-active'
                    : ''
              }`}
            >
              <span className="rs-nav-icon">
                <SidebarIcon id="project-overview" />
              </span>
            </button>
          </nav>
        ) : (
          <nav className="rs-area-switcher" aria-label={t.areaAria}>
            <button
              type="button"
              onClick={() => navigate('global-overview')}
              title={t.overviewAreaTitle}
              aria-current={currentEntry.screenId === 'global-overview' ? 'page' : undefined}
              className={`rs-area-tab ${activeArea === 'global' ? 'is-selected' : ''} ${
                currentEntry.screenId === 'global-overview' ? 'is-exact' : ''
              }`}
            >
              <span className="rs-area-tab-icon">
                <SidebarIcon id="global-overview" size={14} />
              </span>
              <span>{t.overviewArea}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('project-overview')}
              title={t.projectAreaTitle}
              aria-current={currentEntry.screenId === 'project-overview' ? 'page' : undefined}
              className={`rs-area-tab ${activeArea === 'project' ? 'is-selected' : ''} ${
                currentEntry.screenId === 'project-overview' ? 'is-exact' : ''
              }`}
            >
              <span className="rs-area-tab-icon">
                <SidebarIcon id="project-overview" size={14} />
              </span>
              <span>{t.projectArea}</span>
            </button>
          </nav>
        )}
      </div>

      <div className="rs-sidebar-scroll">
        {activeArea === 'global' ? (
          <nav className="rs-nav-list" aria-label={t.overviewArea}>
            {GLOBAL_CHILD_MENU.map(renderGlobalBtn)}
          </nav>
        ) : (
          <>
            {sidebarCollapsed ? (
              <button
                type="button"
                className="rs-nav-item"
                onClick={() => setCreateProjectModalOpen(true)}
                title={t.createProjectTitle}
                aria-label={t.createProjectTitle}
              >
                <span className="rs-nav-icon">
                  <SidebarIcon id="plus" size={15} />
                </span>
              </button>
            ) : (
              <div className="rs-project-switcher">
                <select
                  id="rs-project-select"
                  aria-label={t.selectProjectAria}
                  className="rs-select rs-select-compact"
                  value={activeProjectId}
                  disabled={projects.length === 0}
                  onChange={(e) => switchProject(e.target.value)}
                >
                  {projects.length === 0 ? (
                    <option value="">{t.noProjectsOption}</option>
                  ) : (
                    projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  className="rs-btn rs-btn-secondary rs-btn-icon rs-project-add-btn"
                  onClick={() => setCreateProjectModalOpen(true)}
                  title={t.createProjectTitle}
                  aria-label={t.createProjectTitle}
                >
                  <SidebarIcon id="plus" size={14} />
                </button>
              </div>
            )}

            <nav className="rs-nav-list" aria-label={t.projectArea}>
              {PROJECT_CHILD_MENU.map(renderProjectBtn)}
            </nav>
          </>
        )}

        <div className="rs-sidebar-gradient-divider" />

        <nav className="rs-nav-list" aria-label={t.settingsTitle}>
          <button
            type="button"
            className={`rs-nav-item ${currentEntry.screenId === 'system-settings' ? 'is-active' : ''}`}
            onClick={() => navigate('system-settings')}
            aria-current={currentEntry.screenId === 'system-settings' ? 'page' : undefined}
            title={sidebarCollapsed ? t.settingsLabel : t.settingsTitle}
          >
            <span className="rs-nav-icon">
              <SidebarIcon id="system-settings" />
            </span>
            {!sidebarCollapsed && <span className="rs-nav-label">{t.settingsLabel}</span>}
          </button>
        </nav>

        <div className="rs-sidebar-spacer" />
      </div>

      <div className="rs-sidebar-collapse-row">
        <button
          type="button"
          className="rs-collapse-btn"
          onClick={() => {
            setPlatformMenuOpen(false);
            toggleSidebar();
          }}
          title={sidebarCollapsed ? t.expandSidebar : t.collapseSidebar}
          aria-label={sidebarCollapsed ? t.expandSidebar : t.collapseSidebar}
        >
          <SidebarIcon id={sidebarCollapsed ? 'collapse-right' : 'collapse-left'} size={15} />
        </button>
      </div>
    </aside>
  );
};
