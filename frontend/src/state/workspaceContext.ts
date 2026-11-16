import { createContext, useContext } from 'react';
import type {
  ChannelItem,
  IdeaItem,
  IdeaPriority,
  IdeaSourceType,
  IdeaStatus,
  KeywordItem,
  ManualFormatLabel,
  ProjectItem,
  RssFeedItem,
  ThemeMode,
  UiSimulatorMode,
} from '../prototype/types';

export interface ToastNotice {
  id: string;
  kind: 'success' | 'error';
  message: string;
}

export interface SaveIdeaDraft {
  title: string;
  sourceType: IdeaSourceType;
  sourceRefId: string;
  sourceTitleSnapshot: string;
  sourceUrl: string;
  tags: string[];
}

export interface PrototypeWorkspaceContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (next: ThemeMode) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  uiMode: UiSimulatorMode;
  setUiMode: (mode: UiSimulatorMode) => void;

  projects: ProjectItem[];
  createProject: (input: { name: string; regionCode: string; relevanceLanguage: string; targetFormat: ProjectItem['targetFormat'] }) => ProjectItem;
  updateProject: (projectId: string, patch: Partial<ProjectItem>) => void;
  deleteProject: (projectId: string) => void;
  toggleZeroProjectsDemo: () => void;

  channels: ChannelItem[];
  addChannelToProject: (projectId: string, handleOrUrl: string) => void;
  removeChannelFromProject: (projectId: string, channelId: string) => void;

  manualFormatMap: Record<string, ManualFormatLabel>;
  setManualFormat: (videoId: string, label: ManualFormatLabel) => void;

  breakoutByProject: Record<string, Record<string, { flagged: boolean; note: string }>>;
  toggleBreakoutFlag: (projectId: string, videoId: string) => void;
  setBreakoutNote: (projectId: string, videoId: string, note: string) => void;

  rssFeeds: RssFeedItem[];
  toggleRssFeedEnabled: (feedId: string) => void;
  retryRssFeed: (feedId: string) => void;
  addRssFeed: (url: string, name: string) => void;

  keywords: KeywordItem[];
  addKeyword: (projectId: string, keyword: string, priority: IdeaPriority) => void;
  deleteKeyword: (keywordId: string) => void;
  scanKeywordDemo: (keywordId: string) => void;

  ideas: IdeaItem[];
  saveIdea: (input: {
    title: string;
    notes: string;
    sourceType: IdeaSourceType;
    sourceRefId: string;
    sourceTitleSnapshot: string;
    sourceUrl: string;
    tags: string[];
    inGlobalVault: boolean;
    targetProjectIds: string[];
    projectAngle: string;
  }) => void;
  updateProjectIdeaStatus: (ideaId: string, projectId: string, status: IdeaStatus) => void;
  updateProjectIdeaAngle: (ideaId: string, projectId: string, angle: string, notes: string, publishedVideoUrl: string) => void;
  attachIdeaToProject: (ideaId: string, projectId: string, projectAngle: string) => void;
  deleteIdea: (ideaId: string) => void;

  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (next: boolean) => void;
  apiCachePurged: boolean;
  purgeYouTubeCacheDemo: () => void;
  restoreYouTubeCacheDemo: () => void;
  legalAccepted: boolean;
  setLegalAccepted: (accepted: boolean) => void;
  maskedApiKey: string;
  saveApiKeyDemo: (rawKey: string) => void;

  quotaSearchUsed: number;
  quotaGeneralUsed: number;
  incrementQuotaDemo: (bucket: 'search' | 'general', amount: number) => void;

  inspectorVideoId: string | null;
  openInspectorVideo: (videoId: string | null) => void;

  saveIdeaModalDraft: SaveIdeaDraft | null;
  openSaveIdeaModal: (draft: SaveIdeaDraft | null) => void;
  createProjectModalOpen: boolean;
  setCreateProjectModalOpen: (open: boolean) => void;
  legalModalOpen: boolean;
  setLegalModalOpen: (open: boolean) => void;

  toasts: ToastNotice[];
  pushToast: (kind: 'success' | 'error', message: string) => void;
  dismissToast: (id: string) => void;
}

export const PrototypeWorkspaceContext = createContext<PrototypeWorkspaceContextValue | null>(null);

export function usePrototypeWorkspace(): PrototypeWorkspaceContextValue {
  const ctx = useContext(PrototypeWorkspaceContext);
  if (!ctx) {
    throw new Error('usePrototypeWorkspace must be used within PrototypeWorkspaceProvider');
  }
  return ctx;
}
