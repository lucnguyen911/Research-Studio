import { createContext, useContext } from 'react';
import type {
  PurgeCacheResultDto,
  QuotaStatusDto,
  SystemSettingsDto,
  UpdateSystemSettingsPayload,
} from '../api/types';
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
  ScreenId,
  ThemeMode,
  UiSimulatorMode,
} from '../prototype/types';

const DEMO_PREVIEW_SCREENS = new Set<ScreenId>([
  'global-trends',
  'global-search',
  'global-news',
  'global-ideas',
  'project-competitors',
  'project-breakout',
  'project-keywords',
  'project-ideas',
  'channel-detail',
  'video-detail',
  'article-detail',
  'idea-detail',
]);

export function isDemoPreviewScreen(screenId: ScreenId): boolean {
  return DEMO_PREVIEW_SCREENS.has(screenId);
}

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

  isBootstrapping: boolean;
  backendOnline: boolean;
  lastSyncAt: string | null;
  systemSettings: SystemSettingsDto;
  quotaStatus: QuotaStatusDto;
  refreshWorkspaceStatus: () => Promise<boolean>;

  projects: ProjectItem[];
  createProject: (input: {
    name: string;
    description?: string;
    regionCode: string;
    relevanceLanguage: string;
    targetFormat: ProjectItem['targetFormat'];
  }) => Promise<ProjectItem | null>;
  updateProject: (projectId: string, patch: Partial<ProjectItem>) => Promise<boolean>;
  exportProjectJson: (projectId: string, fallbackName: string) => Promise<boolean>;
  deleteProject: (projectId: string, confirmName: string) => Promise<boolean>;

  updateSystemPreferences: (patch: UpdateSystemSettingsPayload) => Promise<boolean>;
  acceptLegalConsent: (accepted: boolean) => Promise<boolean>;
  saveApiKey: (rawKey: string) => Promise<boolean>;
  removeApiKey: () => Promise<boolean>;
  purgeYoutubeCache: () => Promise<PurgeCacheResultDto | null>;

  // Derived compatibility flags & preview helpers (remaining DEMO screens cleared in M3-M5)
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
  updateProjectIdeaAngle: (
    ideaId: string,
    projectId: string,
    angle: string,
    notes: string,
    publishedVideoUrl: string,
  ) => void;
  attachIdeaToProject: (ideaId: string, projectId: string, projectAngle: string) => void;
  deleteIdea: (ideaId: string) => void;

  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (next: boolean) => void;
  apiCachePurged: boolean;
  legalAccepted: boolean;
  setLegalAccepted: (accepted: boolean) => void;
  maskedApiKey: string;

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
