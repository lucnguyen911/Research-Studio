import React, { useEffect, useRef } from 'react';
import { useAppNavigation, useScrollContainerSync } from './state/navigationStore';
import { AppNavigationProvider } from './state/AppNavigationProvider';
import { usePrototypeWorkspace } from './state/workspaceContext';
import { PrototypeWorkspaceProvider } from './state/PrototypeWorkspaceContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { StageTwoScreen } from './components/StatusViews';
import {
  CreateProjectModal,
  LegalConsentModal,
  SaveIdeaModal,
  VideoInspectorDrawer,
} from './components/Modals';
import {
  FreeResearchScreen,
  GlobalIdeaVaultScreen,
  GlobalOverviewScreen,
  RssNewsScreen,
  TrendDiscoveryScreen,
} from './screens/GlobalScreens';
import {
  BreakoutVideosScreen,
  CompetitorsScreen,
  KeywordResearchScreen,
  ProjectIdeasScreen,
  ProjectOverviewScreen,
  ProjectSettingsScreen,
} from './screens/ProjectScreens';
import {
  ArticleDetailScreen,
  ChannelDetailScreen,
  IdeaDetailScreen,
  SystemSettingsScreen,
  VideoDetailScreen,
} from './screens/DetailAndSystemScreens';

const ScreenOutlet: React.FC = () => {
  const { currentEntry } = useAppNavigation();

  switch (currentEntry.screenId) {
    case 'global-overview':
      return <GlobalOverviewScreen />;
    case 'global-trends':
      return <TrendDiscoveryScreen />;
    case 'global-search':
      return <FreeResearchScreen />;
    case 'global-featured-stage2':
      return <StageTwoScreen screenId="global-featured-stage2" />;
    case 'global-news':
      return <RssNewsScreen />;
    case 'global-ideas':
      return <GlobalIdeaVaultScreen />;
    case 'project-overview':
      return <ProjectOverviewScreen key={currentEntry.projectId ?? 'no-project'} />;
    case 'project-hot-topics-stage2':
      return <StageTwoScreen screenId="project-hot-topics-stage2" />;
    case 'project-keywords':
      return <KeywordResearchScreen key={currentEntry.projectId ?? 'no-project'} />;
    case 'project-breakout':
      return <BreakoutVideosScreen key={currentEntry.projectId ?? 'no-project'} />;
    case 'project-competitors':
      return <CompetitorsScreen key={currentEntry.projectId ?? 'no-project'} />;
    case 'project-evergreen-stage2':
      return <StageTwoScreen screenId="project-evergreen-stage2" />;
    case 'project-opportunities-stage2':
      return <StageTwoScreen screenId="project-opportunities-stage2" />;
    case 'project-ai-stage2':
      return <StageTwoScreen screenId="project-ai-stage2" />;
    case 'project-ideas':
      return <ProjectIdeasScreen key={currentEntry.projectId ?? 'no-project'} />;
    case 'project-settings':
      return <ProjectSettingsScreen />;
    case 'channel-detail':
      return <ChannelDetailScreen key={currentEntry.params.channelId ?? 'ch'} />;
    case 'video-detail':
      return <VideoDetailScreen key={`${currentEntry.projectId ?? 'none'}-${currentEntry.params.videoId ?? 'vid'}`} />;
    case 'article-detail':
      return <ArticleDetailScreen key={currentEntry.params.articleId ?? 'art'} />;
    case 'idea-detail':
      return <IdeaDetailScreen key={currentEntry.params.ideaId ?? 'idea'} />;
    case 'system-settings':
      return <SystemSettingsScreen />;
    default:
      return <GlobalOverviewScreen />;
  }
};

const WorkspaceShell: React.FC = () => {
  const { currentEntry, reconcileProjects } = useAppNavigation();
  const { isBootstrapping, backendOnline, projects, toasts, dismissToast, pushToast } = usePrototypeWorkspace();
  const scrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isBootstrapping || !backendOnline) return;
    reconcileProjects(
      projects.map((p) => p.id),
      (msg) => pushToast('success', msg),
    );
  }, [isBootstrapping, backendOnline, projects, currentEntry.entryId, currentEntry.projectId, reconcileProjects, pushToast]);

  const handleScroll = useScrollContainerSync(
    scrollRef,
    currentEntry.entryId,
    currentEntry.viewState.scrollTop,
  );

  return (
    <div className="rs-shell">
      <Sidebar />
      <div className="rs-main-col">
        <TopBar />
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <main
            id="rs-main-scroll"
            ref={scrollRef}
            className="rs-content-scroll"
            onScroll={handleScroll}
          >
            <ScreenOutlet />
          </main>
          <VideoInspectorDrawer />
        </div>
      </div>

      <CreateProjectModal />
      <SaveIdeaModal />
      <LegalConsentModal />

      {toasts.length > 0 && (
        <div className="rs-toast-stack" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="rs-toast"
              style={{
                borderColor: toast.kind === 'error' ? 'var(--rs-danger-border)' : 'var(--rs-success-border)',
              }}
            >
              <span>
                <strong style={{ color: toast.kind === 'error' ? 'var(--rs-danger-text)' : 'var(--rs-success-text)' }}>
                  {toast.kind === 'error' ? 'Lỗi: ' : 'Thành công: '}
                </strong>
                {toast.message}
              </span>
              <button type="button" className="rs-btn rs-btn-ghost rs-btn-sm" onClick={() => dismissToast(toast.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function App() {
  return (
    <PrototypeWorkspaceProvider>
      <AppNavigationProvider>
        <WorkspaceShell />
      </AppNavigationProvider>
    </PrototypeWorkspaceProvider>
  );
}

export default App;
