import { createContext, useContext } from 'react';
import type {
  PurgeCacheResultDto,
  QuotaStatusDto,
  RssFeedDto,
  RssRefreshAllResultDto,
  SystemSettingsDto,
  UpdateSystemSettingsPayload,
} from '../api/types';
import type {
  IdeaItem,
  IdeaPriority,
  IdeaSourceType,
  IdeaStatus,
  ManualFormatLabel,
  ProjectItem,
  RssFeedItem,
  ScreenId,
  ThemeMode,
  UiLanguage,
  UiSimulatorMode,
  VideoItem,
} from '../prototype/types';

// All MVP screens are wired to real Backend + SQLite
const DEMO_PREVIEW_SCREENS = new Set<ScreenId>([]);

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
  uiLanguage: UiLanguage;
  setUiLanguage: (next: UiLanguage) => void;
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
  syncQuotaStatus: () => Promise<void>;
  refreshWorkspaceStatus: () => Promise<boolean>;
  resetVolatileCachesAndSync: () => Promise<boolean>;

  projects: ProjectItem[];
  createProject: (input: {
    name: string;
    description?: string;
    regionCode: string;
    relevanceLanguage: string;
    targetFormat: ProjectItem['targetFormat'];
  }) => Promise<ProjectItem | null>;
  updateProject: (projectId: string, patch: Partial<ProjectItem>) => Promise<boolean>;
  updateProjectRssFeeds: (projectId: string, feedIds: string[]) => Promise<boolean>;
  exportProjectJson: (projectId: string, fallbackName: string) => Promise<boolean>;
  deleteProject: (projectId: string, confirmName: string) => Promise<boolean>;

  updateSystemPreferences: (patch: UpdateSystemSettingsPayload) => Promise<boolean>;
  acceptLegalConsent: (accepted: boolean) => Promise<boolean>;
  saveApiKey: (rawKey: string) => Promise<boolean>;
  removeApiKey: () => Promise<boolean>;
  purgeYoutubeCache: () => Promise<PurgeCacheResultDto | null>;

  // Real YouTube in-memory registry & SQLite-backed manual format labels
  cachedVideosById: Record<string, VideoItem>;
  registerVideosInMemory: (videos: VideoItem[]) => void;
  manualFormatMap: Record<string, ManualFormatLabel>;
  setManualFormat: (videoId: string, label: ManualFormatLabel) => Promise<boolean>;

  // Real SQLite-backed RSS state
  rssFeedDtos: RssFeedDto[];
  rssFeeds: RssFeedItem[];
  reloadRssFeeds: (signal?: AbortSignal) => Promise<RssFeedDto[]>;
  addRssFeed: (url: string, name: string, groupTag?: string) => Promise<RssFeedDto | null>;
  toggleRssFeedEnabled: (feedId: string, nextEnabled?: boolean) => Promise<boolean>;
  retryRssFeed: (feedId: string, signal?: AbortSignal) => Promise<boolean>;
  deleteRssFeed: (feedId: string) => Promise<boolean>;
  refreshAllRssFeeds: (signal?: AbortSignal) => Promise<RssRefreshAllResultDto | null>;

  // Real SQLite-backed Competitor, Breakout (Standard Mode) & Keyword actions
  addChannelToProject: (projectId: string, identifier: string, notes?: string) => Promise<boolean>;

  breakoutByProject: Record<string, Record<string, { flagged: boolean; note: string }>>;
  registerProjectBreakoutStates: (projectId: string, videos: VideoItem[]) => void;
  toggleBreakoutFlag: (projectId: string, videoId: string) => Promise<boolean>;
  setBreakoutNote: (
    projectId: string,
    videoId: string,
    note: string,
    flagged?: boolean,
  ) => Promise<boolean>;

  addKeyword: (projectId: string, keyword: string, priority: IdeaPriority, notes?: string) => Promise<boolean>;

  ideas: IdeaItem[];
  reloadIdeas: (signal?: AbortSignal) => Promise<void>;
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
    priority?: IdeaPriority;
  }) => Promise<boolean>;
  updateIdeaCore: (
    ideaId: string,
    patch: {
      title?: string;
      notes?: string;
      tags?: string[];
      inGlobalVault?: boolean;
    },
  ) => Promise<boolean>;
  updateProjectIdeaStatus: (ideaId: string, projectId: string, status: IdeaStatus) => Promise<boolean>;
  updateProjectIdeaAngle: (
    ideaId: string,
    projectId: string,
    angle: string,
    notes: string,
    publishedVideoUrl: string,
    priority?: IdeaPriority,
  ) => Promise<boolean>;
  attachIdeaToProject: (
    ideaId: string,
    projectId: string,
    projectAngle: string,
    priority?: IdeaPriority,
  ) => Promise<boolean>;
  detachIdeaFromProject: (ideaId: string, projectId: string) => Promise<boolean>;
  deleteIdea: (ideaId: string) => Promise<boolean>;

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
