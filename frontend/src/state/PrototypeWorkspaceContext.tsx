import React, { useCallback, useEffect, useState } from 'react';
import {
  ApiClientError,
  createProjectApi,
  deleteProjectApi,
  deleteYoutubeApiKeyApi,
  exportProjectJsonApi,
  fetchProjectsApi,
  fetchQuotaStatus,
  fetchSystemSettings,
  isAbortError,
  purgeYoutubeCacheApi,
  saveYoutubeApiKeyApi,
  setLegalConsentApi,
  updateProjectApi,
  updateSystemSettingsApi,
} from '../api/client';
import type {
  ProjectDto,
  PurgeCacheResultDto,
  QuotaStatusDto,
  SystemSettingsDto,
  UpdateSystemSettingsPayload,
} from '../api/types';
import {
  DEMO_CHANNELS,
  DEMO_IDEAS,
  DEMO_KEYWORDS,
  DEMO_RSS_FEEDS,
  DEMO_VIDEOS,
} from '../prototype/demoData';
import type {
  ChannelItem,
  IdeaItem,
  IdeaPriority,
  IdeaStatus,
  KeywordItem,
  ManualFormatLabel,
  ProjectItem,
  RssFeedItem,
  ThemeMode,
  UiSimulatorMode,
} from '../prototype/types';
import {
  PrototypeWorkspaceContext,
  type PrototypeWorkspaceContextValue,
  type SaveIdeaDraft,
  type ToastNotice,
} from './workspaceContext';

const DEFAULT_SYSTEM_SETTINGS: SystemSettingsDto = {
  apiKeyStatus: 'missing',
  maskedApiKey: null,
  legalConsentAccepted: false,
  legalConsentAcceptedAt: null,
  themeMode: 'light',
  defaultRegionCode: 'VN',
  defaultRelevanceLanguage: 'vi',
  autoRefreshEnabled: true,
  autoRefreshChannelIntervalHours: 12,
  autoRefreshRssIntervalHours: 4,
  autoRefreshMaxApiUnitsPerBatch: 15,
  autoRefreshDailyQuotaCap: 3000,
  quotaWarningRatio: 0.8,
  quotaLimits: {
    searchQueriesDailyLimit: 100,
    generalDataDailyLimit: 10000,
  },
  legalLinks: {
    youtubeTosUrl: 'https://www.youtube.com/t/terms',
    googlePrivacyUrl: 'https://policies.google.com/privacy',
    youtubeBrandingUrl: 'https://developers.google.com/youtube/terms/branding-guidelines',
  },
  updatedAt: null,
};

const DEFAULT_QUOTA_STATUS: QuotaStatusDto = {
  ptDate: '—',
  resetAtUtc: '',
  warningRatio: 0.8,
  autoRefreshDailyQuotaCap: 3000,
  searchQueries: {
    used: 0,
    limit: 100,
    remaining: 100,
    warning: false,
    exhausted: false,
    exhaustedUntilUtc: null,
  },
  generalData: {
    used: 0,
    limit: 10000,
    remaining: 10000,
    warning: false,
    exhausted: false,
    exhaustedUntilUtc: null,
  },
};

function dtoToProjectItem(dto: ProjectDto): ProjectItem {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    regionCode: dto.regionCode,
    relevanceLanguage: dto.relevanceLanguage,
    targetFormat: dto.targetFormat,
    linkedFeedIds: dto.linkedFeedIds,
    updatedAt: dto.updatedAt,
  };
}

function applyThemeToDom(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(mode);
  root.setAttribute('data-theme', mode);
  root.style.colorScheme = mode;
  try {
    localStorage.setItem('rs_theme', mode);
  } catch {
    // Ignore storage errors
  }
}

function formatErrorToast(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) {
    return err.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export const PrototypeWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      return localStorage.getItem('rs_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [backendOnline, setBackendOnline] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettingsDto>(DEFAULT_SYSTEM_SETTINGS);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatusDto>(DEFAULT_QUOTA_STATUS);
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  // Legacy preview states strictly kept in-memory for screens wired later in M3-M5
  const [previewUiMode, setPreviewUiMode] = useState<UiSimulatorMode>('normal');
  const [channels, setChannels] = useState<ChannelItem[]>(DEMO_CHANNELS);
  const [rssFeeds, setRssFeeds] = useState<RssFeedItem[]>(DEMO_RSS_FEEDS);
  const [keywords, setKeywords] = useState<KeywordItem[]>(DEMO_KEYWORDS);
  const [ideas, setIdeas] = useState<IdeaItem[]>(DEMO_IDEAS);
  const [manualFormatMap, setManualFormatMap] = useState<Record<string, ManualFormatLabel>>(() => {
    const initial: Record<string, ManualFormatLabel> = {};
    for (const v of DEMO_VIDEOS) {
      if (v.defaultManualFormat !== 'none') {
        initial[v.id] = v.defaultManualFormat;
      }
    }
    return initial;
  });
  const [breakoutByProject, setBreakoutByProject] = useState<
    Record<string, Record<string, { flagged: boolean; note: string }>>
  >({});
  const [apiCachePurged, setApiCachePurged] = useState(false);

  const [inspectorVideoId, setInspectorVideoId] = useState<string | null>(null);
  const [saveIdeaModalDraft, setSaveIdeaModalDraft] = useState<SaveIdeaDraft | null>(null);
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((kind: 'success' | 'error', message: string) => {
    const id = `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);

  const syncFromBackend = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    try {
      const [settingsRes, quotaRes, projectListRes] = await Promise.all([
        fetchSystemSettings(signal),
        fetchQuotaStatus(signal),
        fetchProjectsApi(signal),
      ]);
      setSystemSettings(settingsRes);
      setQuotaStatus(quotaRes);
      setProjects(projectListRes.map(dtoToProjectItem));
      setThemeState(settingsRes.themeMode);
      applyThemeToDom(settingsRes.themeMode);
      setBackendOnline(true);
      setLastSyncAt(new Date().toLocaleTimeString('vi-VN'));
      return true;
    } catch (err) {
      if (isAbortError(err)) return false;
      setBackendOnline(false);
      return false;
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchSystemSettings(controller.signal),
      fetchQuotaStatus(controller.signal),
      fetchProjectsApi(controller.signal),
    ])
      .then(([settingsRes, quotaRes, projectListRes]) => {
        if (controller.signal.aborted) return;
        setSystemSettings(settingsRes);
        setQuotaStatus(quotaRes);
        setProjects(projectListRes.map(dtoToProjectItem));
        setThemeState(settingsRes.themeMode);
        applyThemeToDom(settingsRes.themeMode);
        setBackendOnline(true);
        setLastSyncAt(new Date().toLocaleTimeString('vi-VN'));
        setIsBootstrapping(false);
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setBackendOnline(false);
        setIsBootstrapping(false);
      });
    return () => {
      controller.abort();
    };
  }, []);

  const refreshWorkspaceStatus = useCallback(async (): Promise<boolean> => {
    const ok = await syncFromBackend();
    if (!ok) {
      pushToast('error', 'Không thể kết nối tới Backend cục bộ (127.0.0.1:8000).');
    }
    return ok;
  }, [pushToast, syncFromBackend]);

  const setTheme = useCallback(
    (next: ThemeMode) => {
      applyThemeToDom(next);
      setThemeState(next);
      void updateSystemSettingsApi({ themeMode: next })
        .then((updated) => {
          setSystemSettings(updated);
          setBackendOnline(true);
        })
        .catch((err) => {
          if (!isAbortError(err)) {
            pushToast('error', formatErrorToast(err, 'Không lưu được chủ đề giao diện lên SQLite.'));
          }
        });
    },
    [pushToast],
  );

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
  }, [setTheme, theme]);

  const updateSystemPreferences = useCallback(
    async (patch: UpdateSystemSettingsPayload): Promise<boolean> => {
      try {
        const updated = await updateSystemSettingsApi(patch);
        setSystemSettings(updated);
        setThemeState(updated.themeMode);
        applyThemeToDom(updated.themeMode);
        setBackendOnline(true);
        const quota = await fetchQuotaStatus();
        setQuotaStatus(quota);
        pushToast('success', 'Đã lưu cài đặt hệ thống xuống SQLite.');
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, 'Không lưu được cài đặt hệ thống.'));
        }
        return false;
      }
    },
    [pushToast],
  );

  const acceptLegalConsent = useCallback(
    async (accepted: boolean): Promise<boolean> => {
      try {
        const updated = await setLegalConsentApi(accepted);
        setSystemSettings(updated);
        setBackendOnline(true);
        pushToast(
          'success',
          accepted
            ? 'Đã xác nhận đồng ý Chính sách Quyền riêng tư & Điều khoản YouTube.'
            : 'Đã thu hồi trạng thái đồng ý Pháp lý.',
        );
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, 'Không lưu được xác nhận Pháp lý.'));
        }
        return false;
      }
    },
    [pushToast],
  );

  const saveApiKey = useCallback(
    async (rawKey: string): Promise<boolean> => {
      try {
        const updated = await saveYoutubeApiKeyApi(rawKey);
        setSystemSettings(updated);
        setBackendOnline(true);
        pushToast('success', `Đã mã hóa API Key qua Windows DPAPI (${updated.maskedApiKey ?? 'đã lưu'}).`);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, 'Không thể lưu YouTube API Key.'));
        }
        return false;
      }
    },
    [pushToast],
  );

  const removeApiKey = useCallback(async (): Promise<boolean> => {
    try {
      const updated = await deleteYoutubeApiKeyApi();
      setSystemSettings(updated);
      setBackendOnline(true);
      pushToast('success', 'Đã xóa YouTube API Key khỏi DPAPI. Toàn bộ dữ liệu nghiên cứu vẫn nguyên vẹn.');
      return true;
    } catch (err) {
      if (!isAbortError(err)) {
        pushToast('error', formatErrorToast(err, 'Không thể xóa YouTube API Key.'));
      }
      return false;
    }
  }, [pushToast]);

  const purgeYoutubeCache = useCallback(async (): Promise<PurgeCacheResultDto | null> => {
    try {
      const result = await purgeYoutubeCacheApi();
      setApiCachePurged(true);
      setBackendOnline(true);
      pushToast(
        'success',
        `Đã xóa sạch cache YouTube API (xóa ${result.videosDeleted + result.videosTombstoned} video cache, ${result.dbBackupsDeleted} bản sao lưu .db). Dữ liệu của bạn được giữ 100%.`,
      );
      return result;
    } catch (err) {
      if (!isAbortError(err)) {
        pushToast('error', formatErrorToast(err, 'Không thể xóa cache YouTube API.'));
      }
      return null;
    }
  }, [pushToast]);

  const createProject = useCallback(
    async (input: {
      name: string;
      description?: string;
      regionCode: string;
      relevanceLanguage: string;
      targetFormat: ProjectItem['targetFormat'];
    }): Promise<ProjectItem | null> => {
      try {
        const created = await createProjectApi({
          name: input.name.trim(),
          description: input.description?.trim() ?? '',
          regionCode: input.regionCode,
          relevanceLanguage: input.relevanceLanguage,
          targetFormat: input.targetFormat,
        });
        const item = dtoToProjectItem(created);
        setProjects((prev) => [item, ...prev]);
        setBackendOnline(true);
        pushToast('success', `Đã tạo Project mới: ${item.name}`);
        return item;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, 'Không thể tạo Project mới.'));
        }
        return null;
      }
    },
    [pushToast],
  );

  const updateProject = useCallback(
    async (projectId: string, patch: Partial<ProjectItem>): Promise<boolean> => {
      try {
        const updatedDto = await updateProjectApi(projectId, {
          name: patch.name,
          description: patch.description,
          regionCode: patch.regionCode,
          relevanceLanguage: patch.relevanceLanguage,
          targetFormat: patch.targetFormat,
        });
        const updated = dtoToProjectItem(updatedDto);
        setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
        setBackendOnline(true);
        pushToast('success', `Đã lưu cấu hình Project "${updated.name}".`);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, 'Không thể cập nhật cài đặt Project.'));
        }
        return false;
      }
    },
    [pushToast],
  );

  const exportProjectJson = useCallback(
    async (projectId: string, fallbackName: string): Promise<boolean> => {
      try {
        const filename = await exportProjectJsonApi(projectId, fallbackName);
        pushToast('success', `Đã xuất tệp JSON sạch (0 API Key): ${filename}`);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, 'Không thể xuất tệp JSON Project.'));
        }
        return false;
      }
    },
    [pushToast],
  );

  const deleteProject = useCallback(
    async (projectId: string, confirmName: string): Promise<boolean> => {
      try {
        const result = await deleteProjectApi(projectId, confirmName);
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        setBackendOnline(true);
        pushToast(
          'success',
          `Đã xóa Project "${result.deletedProjectName}" (đã sao lưu ${result.recoveryBackupFilename} và giữ 100% dữ liệu dùng chung).`,
        );
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, 'Không thể xóa Project.'));
        }
        return false;
      }
    },
    [pushToast],
  );

  // Legacy preview helpers solely for DEMO preview screens prior to M3-M5 integration
  const setManualFormat = (videoId: string, label: ManualFormatLabel) => {
    setManualFormatMap((prev) => ({ ...prev, [videoId]: label }));
    pushToast('success', 'Đã cập nhật nhãn thử nghiệm xem trước (sẽ nối SQLite ở M3).');
  };

  const toggleBreakoutFlag = (projectId: string, videoId: string) => {
    setBreakoutByProject((prev) => {
      const projMap = prev[projectId] ?? {};
      const existing = projMap[videoId] ?? { flagged: false, note: '' };
      return {
        ...prev,
        [projectId]: { ...projMap, [videoId]: { ...existing, flagged: !existing.flagged } },
      };
    });
  };

  const setBreakoutNote = (projectId: string, videoId: string, note: string) => {
    setBreakoutByProject((prev) => {
      const projMap = prev[projectId] ?? {};
      const existing = projMap[videoId] ?? { flagged: false, note: '' };
      return {
        ...prev,
        [projectId]: { ...projMap, [videoId]: { ...existing, note } },
      };
    });
  };

  const addChannelToProject = (projectId: string, handleOrUrl: string) => {
    const cleaned = handleOrUrl.trim();
    if (!cleaned) return;
    const newCh: ChannelItem = {
      id: `ch-${Date.now().toString(36)}`,
      title: cleaned,
      handle: cleaned.startsWith('@') ? cleaned : `@${cleaned.slice(0, 18)}`,
      subscriberCount: 0,
      videoCount: 0,
      country: 'VN',
      projectIds: [projectId],
      projectNotes: { [projectId]: 'Xem trước giao diện M5' },
      lastFetchedAt: 'DEMO',
      statusByProject: { [projectId]: 'active' },
    };
    setChannels((prev) => [newCh, ...prev]);
  };

  const removeChannelFromProject = (projectId: string, channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, projectIds: c.projectIds.filter((pid) => pid !== projectId) } : c)),
    );
  };

  const toggleRssFeedEnabled = (feedId: string) => {
    setRssFeeds((prev) => prev.map((f) => (f.id === feedId ? { ...f, enabled: !f.enabled } : f)));
  };

  const retryRssFeed = (feedId: string) => {
    setRssFeeds((prev) => prev.map((f) => (f.id === feedId ? { ...f, status: 'ok' } : f)));
  };

  const addRssFeed = (url: string, name: string) => {
    const cleanedUrl = url.trim();
    if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
      pushToast('error', 'URL RSS không hợp lệ: chỉ chấp nhận https:// hoặc http://.');
      return;
    }
    const newFeed: RssFeedItem = {
      id: `feed-${Date.now().toString(36)}`,
      name: name.trim() || cleanedUrl,
      url: cleanedUrl,
      groupTag: 'Xem trước',
      enabled: true,
      status: 'ok',
      lastFetchedAt: 'DEMO',
    };
    setRssFeeds((prev) => [newFeed, ...prev]);
  };

  const addKeyword = (projectId: string, keyword: string, priority: IdeaPriority) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    setKeywords((prev) => [
      {
        id: `kw-${Date.now().toString(36)}`,
        projectId,
        keyword: trimmed,
        priority,
        notes: 'Xem trước M5',
        lastScannedAt: null,
        matchedVideoIds: [],
        rssMatchCount: 0,
      },
      ...prev,
    ]);
  };

  const deleteKeyword = (keywordId: string) => {
    setKeywords((prev) => prev.filter((k) => k.id !== keywordId));
  };

  const scanKeywordDemo = (keywordId: string) => {
    setKeywords((prev) =>
      prev.map((k) => (k.id === keywordId ? { ...k, lastScannedAt: 'DEMO' } : k)),
    );
  };

  const saveIdea: PrototypeWorkspaceContextValue['saveIdea'] = (input) => {
    const links: IdeaItem['projectLinks'] = {};
    for (const pid of input.targetProjectIds) {
      links[pid] = {
        status: 'new',
        priority: 'medium',
        projectAngle: input.projectAngle || input.title,
        projectNotes: '',
        publishedVideoUrl: '',
        statusUpdatedAt: 'DEMO',
      };
    }
    const item: IdeaItem = {
      id: `idea-${Date.now().toString(36)}`,
      title: input.title.trim(),
      notes: input.notes.trim(),
      sourceType: input.sourceType,
      sourceRefId: input.sourceRefId,
      sourceTitleSnapshot: input.sourceTitleSnapshot,
      sourceUrl: input.sourceUrl,
      inGlobalVault: input.inGlobalVault,
      tags: input.tags,
      updatedAt: 'DEMO',
      projectLinks: links,
    };
    setIdeas((prev) => [item, ...prev]);
    pushToast('success', 'Đã thêm vào bộ xem trước Ý tưởng (sẽ lưu SQLite thật ở M4).');
  };

  const updateProjectIdeaStatus = (ideaId: string, projectId: string, status: IdeaStatus) => {
    setIdeas((prev) =>
      prev.map((idea) => {
        if (idea.id !== ideaId || !idea.projectLinks[projectId]) return idea;
        return {
          ...idea,
          projectLinks: {
            ...idea.projectLinks,
            [projectId]: { ...idea.projectLinks[projectId], status },
          },
        };
      }),
    );
  };

  const updateProjectIdeaAngle = (
    ideaId: string,
    projectId: string,
    angle: string,
    notes: string,
    publishedVideoUrl: string,
  ) => {
    setIdeas((prev) =>
      prev.map((idea) => {
        if (idea.id !== ideaId || !idea.projectLinks[projectId]) return idea;
        return {
          ...idea,
          projectLinks: {
            ...idea.projectLinks,
            [projectId]: {
              ...idea.projectLinks[projectId],
              projectAngle: angle,
              projectNotes: notes,
              publishedVideoUrl,
            },
          },
        };
      }),
    );
  };

  const attachIdeaToProject = (ideaId: string, projectId: string, projectAngle: string) => {
    setIdeas((prev) =>
      prev.map((idea) => {
        if (idea.id !== ideaId) return idea;
        return {
          ...idea,
          projectLinks: {
            ...idea.projectLinks,
            [projectId]: {
              status: 'new',
              priority: 'medium',
              projectAngle: projectAngle || idea.title,
              projectNotes: '',
              publishedVideoUrl: '',
              statusUpdatedAt: 'DEMO',
            },
          },
        };
      }),
    );
  };

  const deleteIdea = (ideaId: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
  };

  const effectiveUiMode: UiSimulatorMode = !backendOnline
    ? 'offline'
    : systemSettings.apiKeyStatus !== 'configured' || !systemSettings.legalConsentAccepted
      ? 'no_api_key'
      : quotaStatus.searchQueries.exhausted
        ? 'quota_search_exhausted'
        : quotaStatus.generalData.exhausted
          ? 'quota_general_exhausted'
          : previewUiMode;

  return (
    <PrototypeWorkspaceContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        sidebarCollapsed,
        toggleSidebar: () => setSidebarCollapsed((s) => !s),
        uiMode: effectiveUiMode,
        setUiMode: setPreviewUiMode,
        isBootstrapping,
        backendOnline,
        lastSyncAt,
        systemSettings,
        quotaStatus,
        refreshWorkspaceStatus,
        projects,
        createProject,
        updateProject,
        exportProjectJson,
        deleteProject,
        updateSystemPreferences,
        acceptLegalConsent,
        saveApiKey,
        removeApiKey,
        purgeYoutubeCache,
        channels,
        addChannelToProject,
        removeChannelFromProject,
        manualFormatMap,
        setManualFormat,
        breakoutByProject,
        toggleBreakoutFlag,
        setBreakoutNote,
        rssFeeds,
        toggleRssFeedEnabled,
        retryRssFeed,
        addRssFeed,
        keywords,
        addKeyword,
        deleteKeyword,
        scanKeywordDemo,
        ideas,
        saveIdea,
        updateProjectIdeaStatus,
        updateProjectIdeaAngle,
        attachIdeaToProject,
        deleteIdea,
        autoRefreshEnabled: systemSettings.autoRefreshEnabled,
        setAutoRefreshEnabled: (next: boolean) => {
          void updateSystemPreferences({ autoRefreshEnabled: next });
        },
        apiCachePurged,
        legalAccepted: systemSettings.legalConsentAccepted,
        setLegalAccepted: (accepted: boolean) => {
          void acceptLegalConsent(accepted);
        },
        maskedApiKey: systemSettings.maskedApiKey ?? 'Chưa cấu hình',
        quotaSearchUsed: quotaStatus.searchQueries.used,
        quotaGeneralUsed: quotaStatus.generalData.used,
        incrementQuotaDemo: () => undefined,
        inspectorVideoId,
        openInspectorVideo: setInspectorVideoId,
        saveIdeaModalDraft,
        openSaveIdeaModal: setSaveIdeaModalDraft,
        createProjectModalOpen,
        setCreateProjectModalOpen,
        legalModalOpen,
        setLegalModalOpen,
        toasts,
        pushToast,
        dismissToast,
      }}
    >
      {children}
    </PrototypeWorkspaceContext.Provider>
  );
};
