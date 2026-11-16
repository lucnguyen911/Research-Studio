import React from 'react';
import type { GlobalScreenId, ProjectScreenId, ScreenId } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace } from '../state/workspaceContext';

const GLOBAL_MENU: Array<{ id: GlobalScreenId; label: string; short: string; stage2?: boolean }> = [
  { id: 'global-overview', label: 'Tổng quan', short: 'G1' },
  { id: 'global-trends', label: 'Khám phá xu hướng', short: 'G2' },
  { id: 'global-search', label: 'Nghiên cứu tự do', short: 'G3' },
  { id: 'global-featured-stage2', label: 'Video nổi bật', short: '2', stage2: true },
  { id: 'global-news', label: 'Tin tức & thảo luận', short: 'G4' },
  { id: 'global-ideas', label: 'Kho ý tưởng chung', short: 'G5' },
];

const PROJECT_MENU: Array<{ id: ProjectScreenId; label: string; short: string; stage2?: boolean }> = [
  { id: 'project-overview', label: 'Tổng quan dự án', short: 'P1' },
  { id: 'project-hot-topics-stage2', label: 'Chủ đề nóng', short: '2', stage2: true },
  { id: 'project-keywords', label: 'Nghiên cứu từ khóa', short: 'P4' },
  { id: 'project-breakout', label: 'Video bứt phá', short: 'P3' },
  { id: 'project-competitors', label: 'Theo dõi đối thủ', short: 'P2' },
  { id: 'project-evergreen-stage2', label: 'Chủ đề dài hạn', short: '2', stage2: true },
  { id: 'project-opportunities-stage2', label: 'Cơ hội nội dung', short: '2', stage2: true },
  { id: 'project-ai-stage2', label: 'Nghiên cứu AI', short: '2', stage2: true },
  { id: 'project-ideas', label: 'Quản lý ý tưởng', short: 'P5' },
  { id: 'project-settings', label: 'Cài đặt dự án', short: 'P6' },
];

export const Sidebar: React.FC = () => {
  const { currentEntry, navigate, switchProject } = useAppNavigation();
  const { projects, sidebarCollapsed, toggleSidebar, setCreateProjectModalOpen } = usePrototypeWorkspace();

  const activeProjectId = currentEntry.projectId ?? projects[0]?.id ?? '';

  const renderNavBtn = (item: { id: ScreenId; label: string; short: string; stage2?: boolean }) => {
    const isActive = currentEntry.screenId === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => navigate(item.id)}
        title={sidebarCollapsed ? `${item.label}${item.stage2 ? ' — Giai đoạn 2' : ''}` : undefined}
        className={`rs-nav-item ${isActive ? 'is-active' : ''} ${item.stage2 ? 'is-stage2' : ''}`}
      >
        <span
          className="rs-mono"
          style={{
            width: 24,
            height: 22,
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 700,
            flexShrink: 0,
            background: isActive ? 'var(--rs-cta-grad)' : 'var(--rs-bg-subtle)',
            color: isActive ? 'var(--rs-cta-text)' : 'var(--rs-text-muted)',
            border: '1px solid var(--rs-border)',
          }}
        >
          {item.short}
        </span>
        {!sidebarCollapsed && <span className="rs-nav-label">{item.label}</span>}
        {!sidebarCollapsed && item.stage2 && <span className="rs-badge-stage2">Giai đoạn 2</span>}
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
          {!sidebarCollapsed && (
            <div style={{ minWidth: 0 }}>
              <div className="rs-brand-title">Research Studio</div>
              <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>Local-first · DEMO</div>
            </div>
          )}
        </div>
      </div>

      <div className="rs-sidebar-scroll">
        <div>
          {!sidebarCollapsed && <div className="rs-nav-section-title">GLOBAL RESEARCH</div>}
          <nav className="rs-nav-list" aria-label="Global Research">
            {GLOBAL_MENU.map(renderNavBtn)}
          </nav>
        </div>

        <div style={{ height: 1, background: 'var(--rs-border)', margin: '2px 4px' }} />

        <div>
          {!sidebarCollapsed && <div className="rs-nav-section-title">PROJECT RESEARCH</div>}
          {!sidebarCollapsed && (
            <div className="rs-project-box" style={{ marginBottom: 6 }}>
              <label
                htmlFor="rs-project-select"
                style={{ fontSize: '12px', fontWeight: 600, color: 'var(--rs-text-muted)' }}
              >
                Project đang chọn ({projects.length})
              </label>
              <select
                id="rs-project-select"
                aria-label="Chọn Project đang hoạt động"
                className="rs-select rs-select-compact"
                value={activeProjectId}
                disabled={projects.length === 0}
                onChange={(e) => switchProject(e.target.value)}
              >
                {projects.length === 0 ? (
                  <option value="">Chưa có Project nào</option>
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
                className="rs-btn rs-btn-sm rs-btn-tinted"
                onClick={() => setCreateProjectModalOpen(true)}
              >
                + Tạo Project mới
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
          title="Cài đặt hệ thống & Pháp lý"
        >
          <span
            className="rs-mono"
            style={{
              width: 24,
              height: 22,
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              background: 'var(--rs-bg-subtle)',
              border: '1px solid var(--rs-border)',
              flexShrink: 0,
            }}
          >
            ⚙
          </span>
          {!sidebarCollapsed && <span className="rs-nav-label">Cài đặt &amp; Pháp lý</span>}
        </button>

        <button
          type="button"
          className="rs-btn rs-btn-secondary rs-btn-icon"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Mở rộng Sidebar' : 'Thu gọn Sidebar'}
          aria-label={sidebarCollapsed ? 'Mở rộng Sidebar' : 'Thu gọn Sidebar'}
        >
          {sidebarCollapsed ? '»' : '«'}
        </button>
      </div>
    </aside>
  );
};
