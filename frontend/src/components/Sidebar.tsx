import React from 'react';
import type { GlobalScreenId, ProjectScreenId, ScreenId } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace } from '../state/workspaceContext';

const GLOBAL_MENU: Array<{ id: GlobalScreenId; label: string; stage2?: boolean }> = [
  { id: 'global-overview', label: 'Tổng quan' },
  { id: 'global-trends', label: 'Khám phá xu hướng' },
  { id: 'global-search', label: 'Nghiên cứu tự do' },
  { id: 'global-featured-stage2', label: 'Video nổi bật', stage2: true },
  { id: 'global-news', label: 'Tin tức & thảo luận' },
  { id: 'global-ideas', label: 'Kho ý tưởng chung' },
];

const PROJECT_MENU: Array<{ id: ProjectScreenId; label: string; stage2?: boolean }> = [
  { id: 'project-overview', label: 'Tổng quan dự án' },
  { id: 'project-hot-topics-stage2', label: 'Chủ đề nóng', stage2: true },
  { id: 'project-keywords', label: 'Nghiên cứu từ khóa' },
  { id: 'project-breakout', label: 'Video bứt phá' },
  { id: 'project-competitors', label: 'Theo dõi đối thủ' },
  { id: 'project-evergreen-stage2', label: 'Chủ đề dài hạn', stage2: true },
  { id: 'project-opportunities-stage2', label: 'Cơ hội nội dung', stage2: true },
  { id: 'project-ai-stage2', label: 'Nghiên cứu AI', stage2: true },
  { id: 'project-ideas', label: 'Quản lý ý tưởng' },
  { id: 'project-settings', label: 'Cài đặt dự án' },
];

type NavIconId = ScreenId | 'collapse-left' | 'collapse-right' | 'plus';

const SidebarIcon: React.FC<{ id: NavIconId; size?: number }> = ({ id, size = 16 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
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
  const { currentEntry, navigate, switchProject } = useAppNavigation();
  const { projects, sidebarCollapsed, toggleSidebar, setCreateProjectModalOpen } = usePrototypeWorkspace();

  const activeProjectId = currentEntry.projectId ?? projects[0]?.id ?? '';

  const renderNavBtn = (item: { id: ScreenId; label: string; stage2?: boolean }) => {
    const isActive = currentEntry.screenId === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => navigate(item.id)}
        title={sidebarCollapsed ? `${item.label}${item.stage2 ? ' — Giai đoạn 2' : ''}` : undefined}
        className={`rs-nav-item ${isActive ? 'is-active' : ''} ${item.stage2 ? 'is-stage2' : ''}`}
      >
        <span className="rs-nav-icon">
          <SidebarIcon id={item.id} />
        </span>
        {!sidebarCollapsed && <span className="rs-nav-label">{item.label}</span>}
        {!sidebarCollapsed && item.stage2 && (
          <span className="rs-tag-stage2" title="Tính năng thuộc Giai đoạn 2">
            GĐ 2
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className={`rs-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`} aria-label="Điều hướng chính">
      <div className="rs-brand">
        <div className="rs-brand-left">
          <div className="rs-brand-logo" aria-hidden="true">
            RS
          </div>
          {!sidebarCollapsed && <div className="rs-brand-title">Research Studio</div>}
        </div>
      </div>

      <div className="rs-sidebar-scroll">
        <div>
          {!sidebarCollapsed && <div className="rs-nav-section-title">Global Research</div>}
          <nav className="rs-nav-list" aria-label="Global Research">
            {GLOBAL_MENU.map(renderNavBtn)}
          </nav>
        </div>

        <div className="rs-sidebar-divider" />

        <div>
          {!sidebarCollapsed && <div className="rs-nav-section-title">Project Research</div>}
          {!sidebarCollapsed && (
            <div className="rs-project-switcher">
              <select
                id="rs-project-select"
                aria-label="Chọn Project đang hoạt động"
                className="rs-select rs-select-compact"
                value={activeProjectId}
                disabled={projects.length === 0}
                onChange={(e) => switchProject(e.target.value)}
              >
                {projects.length === 0 ? (
                  <option value="">Chưa có Project</option>
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
                title="Tạo Project mới"
                aria-label="Tạo Project mới"
              >
                <SidebarIcon id="plus" size={14} />
              </button>
            </div>
          )}

          <nav className="rs-nav-list" aria-label="Project Research">
            {PROJECT_MENU.map(renderNavBtn)}
          </nav>
        </div>
      </div>

      <div className="rs-sidebar-footer">
        <button
          type="button"
          className={`rs-nav-item ${currentEntry.screenId === 'system-settings' ? 'is-active' : ''}`}
          style={{ flex: 1 }}
          onClick={() => navigate('system-settings')}
          title={sidebarCollapsed ? 'Cài đặt' : 'Cài đặt hệ thống & Pháp lý'}
        >
          <span className="rs-nav-icon">
            <SidebarIcon id="system-settings" />
          </span>
          {!sidebarCollapsed && <span className="rs-nav-label">Cài đặt</span>}
        </button>

        <button
          type="button"
          className="rs-btn rs-btn-secondary rs-btn-icon"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Mở rộng Sidebar' : 'Thu gọn Sidebar'}
          aria-label={sidebarCollapsed ? 'Mở rộng Sidebar' : 'Thu gọn Sidebar'}
        >
          <SidebarIcon id={sidebarCollapsed ? 'collapse-right' : 'collapse-left'} size={15} />
        </button>
      </div>
    </aside>
  );
};
