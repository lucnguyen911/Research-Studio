import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiClientError,
  addProjectCompetitorApi,
  createIdeaApi,
  createProjectApi,
  createProjectKeywordApi,
  createRssFeedApi,
  deleteIdeaApi,
  deleteProjectApi,
  deleteRssFeedApi,
  deleteYoutubeApiKeyApi,
  detachIdeaFromProjectApi,
  exportProjectJsonApi,
  fetchIdeasApi,
  fetchProjectsApi,
  fetchQuotaStatus,
  fetchRssFeedsApi,
  fetchSystemSettings,
  isAbortError,
  isNetworkUnreachableError,
  purgeYoutubeCacheApi,
  refreshAllRssFeedsApi,
  refreshSingleRssFeedApi,
  saveYoutubeApiKeyApi,
  setLegalConsentApi,
  setManualVideoFormatApi,
  updateIdeaCoreApi,
  updateProjectApi,
  updateProjectRssFeedsApi,
  updateRssFeedApi,
  updateSystemSettingsApi,
  updateVideoBreakoutApi,
  upsertProjectIdeaLinkApi,
} from '../api/client';
import { mapIdeaDtoToItem, mapRssFeedDtoToItem, mapYoutubeVideoDtoToItem } from '../api/mappers';
import type {
  ProjectDto,
  PurgeCacheResultDto,
  QuotaStatusDto,
  RssFeedDto,
  RssRefreshAllResultDto,
  SystemSettingsDto,
  UpdateSystemSettingsPayload,
} from '../api/types';
import {
  TRANSLATIONS,
  applyUiLanguageToDom,
  getActiveLocale,
  getActiveUiLanguage,
  getTranslations,
} from '../i18n/translations';
import type {
  IdeaItem,
  IdeaPriority,
  IdeaStatus,
  ManualFormatLabel,
  ProjectItem,
  ThemeMode,
  UiLanguage,
  UiSimulatorMode,
  VideoItem,
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
  const [uiLanguage, setUiLanguageState] = useState<UiLanguage>(() => getActiveUiLanguage());
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
  const [rssFeedDtos, setRssFeedDtos] = useState<RssFeedDto[]>([]);

  const [cachedVideosById, setCachedVideosById] = useState<Record<string, VideoItem>>({});
  const [manualFormatMap, setManualFormatMap] = useState<Record<string, ManualFormatLabel>>({});

  const [previewUiMode, setPreviewUiMode] = useState<UiSimulatorMode>('normal');
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [breakoutByProject, setBreakoutByProject] = useState<
    Record<string, Record<string, { flagged: boolean; note: string }>>
  >({});
  const [apiCachePurged, setApiCachePurged] = useState(false);

  const [inspectorVideoId, setInspectorVideoId] = useState<string | null>(null);
  const [saveIdeaModalDraft, setSaveIdeaModalDraft] = useState<SaveIdeaDraft | null>(null);
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const activeToastsRef = useRef<ToastNotice[]>([]);
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    applyUiLanguageToDom(uiLanguage);
  }, [uiLanguage]);

  const setUiLanguage = useCallback((next: UiLanguage) => {
    applyUiLanguageToDom(next);
    setUiLanguageState(next);
  }, []);

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    const existingTimer = toastTimersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      toastTimersRef.current.delete(id);
    }
    const next = activeToastsRef.current.filter((t) => t.id !== id);
    activeToastsRef.current = next;
    setToasts(next);
  }, []);

  const scheduleToastDismiss = useCallback(
    (id: string, kind: 'success' | 'error') => {
      const prevTimer = toastTimersRef.current.get(id);
      if (prevTimer) {
        clearTimeout(prevTimer);
      }
      const timeoutMs = kind === 'error' ? 6000 : 4200;
      const timer = setTimeout(() => {
        dismissToast(id);
      }, timeoutMs);
      toastTimersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  const pushToast = useCallback(
    (kind: 'success' | 'error', message: string) => {
      if (
        kind === 'error' &&
        (message === TRANSLATIONS.vi.toasts.networkUnreachable ||
          message === TRANSLATIONS.en.toasts.networkUnreachable)
      ) {
        setBackendOnline(false);
      }
      const duplicate = activeToastsRef.current.find((t) => t.kind === kind && t.message === message);
      if (duplicate) {
        scheduleToastDismiss(duplicate.id, kind);
        return;
      }
      const id = `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const trimmed = activeToastsRef.current.slice(-3);
      for (const dropped of activeToastsRef.current) {
        if (!trimmed.includes(dropped)) {
          const t = toastTimersRef.current.get(dropped.id);
          if (t) {
            clearTimeout(t);
            toastTimersRef.current.delete(dropped.id);
          }
        }
      }
      const next = [...trimmed, { id, kind, message }];
      activeToastsRef.current = next;
      setToasts(next);
      scheduleToastDismiss(id, kind);
    },
    [scheduleToastDismiss],
  );

  const clearNetworkErrorToasts = useCallback(() => {
    const remaining = activeToastsRef.current.filter(
      (t) =>
        !(
          t.kind === 'error' &&
          (t.message === TRANSLATIONS.vi.toasts.networkUnreachable ||
            t.message === TRANSLATIONS.en.toasts.networkUnreachable)
        ),
    );
    if (remaining.length !== activeToastsRef.current.length) {
      for (const removed of activeToastsRef.current) {
        if (!remaining.includes(removed)) {
          const t = toastTimersRef.current.get(removed.id);
          if (t) {
            clearTimeout(t);
            toastTimersRef.current.delete(removed.id);
          }
        }
      }
      activeToastsRef.current = remaining;
      setToasts(remaining);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchSystemSettings(controller.signal),
      fetchQuotaStatus(controller.signal),
      fetchProjectsApi(controller.signal),
      fetchRssFeedsApi(controller.signal),
      fetchIdeasApi(undefined, controller.signal),
    ])
      .then(([settingsRes, quotaRes, projectListRes, feedsRes, ideasRes]) => {
        if (controller.signal.aborted) return;
        setSystemSettings(settingsRes);
        setQuotaStatus(quotaRes);
        setProjects(projectListRes.map(dtoToProjectItem));
        setRssFeedDtos(feedsRes);
        setIdeas(ideasRes.map(mapIdeaDtoToItem));
        setThemeState(settingsRes.themeMode);
        applyThemeToDom(settingsRes.themeMode);
        setBackendOnline(true);
        clearNetworkErrorToasts();
        setLastSyncAt(new Date().toLocaleTimeString(getActiveLocale()));
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
  }, [clearNetworkErrorToasts]);

  const syncQuotaStatus = useCallback(async (): Promise<void> => {
    try {
      const q = await fetchQuotaStatus();
      setQuotaStatus(q);
      setBackendOnline(true);
    } catch {
      // Non-fatal background sync
    }
  }, []);

  const syncFromBackend = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    try {
      const [settingsRes, quotaRes, projectListRes, feedsRes, ideasRes] = await Promise.all([
        fetchSystemSettings(signal),
        fetchQuotaStatus(signal),
        fetchProjectsApi(signal),
        fetchRssFeedsApi(signal),
        fetchIdeasApi(undefined, signal),
      ]);
      setSystemSettings(settingsRes);
      setQuotaStatus(quotaRes);
      setProjects(projectListRes.map(dtoToProjectItem));
      setRssFeedDtos(feedsRes);
      setIdeas(ideasRes.map(mapIdeaDtoToItem));
      setThemeState(settingsRes.themeMode);
      applyThemeToDom(settingsRes.themeMode);
      setBackendOnline(true);
      clearNetworkErrorToasts();
      setLastSyncAt(new Date().toLocaleTimeString(getActiveLocale()));
      return true;
    } catch (err) {
      if (isAbortError(err)) return false;
      setBackendOnline(false);
      return false;
    } finally {
      setIsBootstrapping(false);
    }
  }, [clearNetworkErrorToasts]);

  const refreshWorkspaceStatus = useCallback(async (): Promise<boolean> => {
    const ok = await syncFromBackend();
    if (!ok) {
      pushToast('error', getTranslations().toasts.networkUnreachable);
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
          clearNetworkErrorToasts();
        })
        .catch((err) => {
          if (isAbortError(err)) return;
          if (isNetworkUnreachableError(err)) {
            setBackendOnline(false);
            return;
          }
          pushToast('error', formatErrorToast(err, getTranslations().toasts.themeSaveError));
        });
    },
    [clearNetworkErrorToasts, pushToast],
  );

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
  }, [setTheme, theme]);

  const updateSystemPreferences = useCallback(
    async (patch: UpdateSystemSettingsPayload): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const updated = await updateSystemSettingsApi(patch);
        setSystemSettings(updated);
        setThemeState(updated.themeMode);
        applyThemeToDom(updated.themeMode);
        setBackendOnline(true);
        const quota = await fetchQuotaStatus();
        setQuotaStatus(quota);
        pushToast('success', tr.prefsSaved);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.prefsSaveError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const acceptLegalConsent = useCallback(
    async (accepted: boolean): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const updated = await setLegalConsentApi(accepted);
        setSystemSettings(updated);
        setBackendOnline(true);
        pushToast('success', accepted ? tr.legalAccepted : tr.legalRevoked);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.legalSaveError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const saveApiKey = useCallback(
    async (rawKey: string): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const updated = await saveYoutubeApiKeyApi(rawKey);
        setSystemSettings(updated);
        setBackendOnline(true);
        pushToast('success', tr.apiKeySaved(updated.maskedApiKey ?? '***'));
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.apiKeySaveError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const removeApiKey = useCallback(async (): Promise<boolean> => {
    const tr = getTranslations().toasts;
    try {
      const updated = await deleteYoutubeApiKeyApi();
      setSystemSettings(updated);
      setBackendOnline(true);
      pushToast('success', tr.apiKeyRemoved);
      return true;
    } catch (err) {
      if (!isAbortError(err)) {
        pushToast('error', formatErrorToast(err, tr.apiKeyRemoveError));
      }
      return false;
    }
  }, [pushToast]);

  const reloadIdeas = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const tr = getTranslations().toasts;
    try {
      const ideasRes = await fetchIdeasApi(undefined, signal);
      setIdeas(ideasRes.map(mapIdeaDtoToItem));
      setBackendOnline(true);
    } catch (err) {
      if (!isAbortError(err)) {
        pushToast('error', formatErrorToast(err, tr.loadIdeasError));
      }
    }
  }, [pushToast]);

  const purgeYoutubeCache = useCallback(async (): Promise<PurgeCacheResultDto | null> => {
    const tr = getTranslations().toasts;
    try {
      const result = await purgeYoutubeCacheApi();
      setApiCachePurged(true);
      setCachedVideosById({});
      setBackendOnline(true);
      await reloadIdeas();
      pushToast('success', tr.cachePurged(result.videosDeleted + result.videosTombstoned));
      return result;
    } catch (err) {
      if (!isAbortError(err)) {
        pushToast('error', formatErrorToast(err, tr.cachePurgeError));
      }
      return null;
    }
  }, [pushToast, reloadIdeas]);

  const createProject = useCallback(
    async (input: {
      name: string;
      description?: string;
      regionCode: string;
      relevanceLanguage: string;
      targetFormat: ProjectItem['targetFormat'];
    }): Promise<ProjectItem | null> => {
      const tr = getTranslations().toasts;
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
        pushToast('success', tr.projectCreated(item.name));
        return item;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.projectCreateError));
        }
        return null;
      }
    },
    [pushToast],
  );

  const updateProject = useCallback(
    async (projectId: string, patch: Partial<ProjectItem>): Promise<boolean> => {
      const tr = getTranslations().toasts;
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
        pushToast('success', tr.projectUpdated(updated.name));
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.projectUpdateError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const updateProjectRssFeeds = useCallback(
    async (projectId: string, feedIds: string[]): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const updatedDto = await updateProjectRssFeedsApi(projectId, feedIds);
        const updated = dtoToProjectItem(updatedDto);
        setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
        setBackendOnline(true);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.projectFeedsError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const exportProjectJson = useCallback(
    async (projectId: string, fallbackName: string): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const filename = await exportProjectJsonApi(projectId, fallbackName);
        pushToast('success', tr.projectExported(filename));
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.projectExportError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const deleteProject = useCallback(
    async (projectId: string, confirmName: string): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const result = await deleteProjectApi(projectId, confirmName);
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        setBreakoutByProject((prev) => {
          const next = { ...prev };
          delete next[projectId];
          return next;
        });
        setBackendOnline(true);
        await reloadIdeas();
        pushToast('success', tr.projectDeleted(result.deletedProjectName, result.recoveryBackupFilename));
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.projectDeleteError));
        }
        return false;
      }
    },
    [pushToast, reloadIdeas],
  );

  const registerVideosInMemory = useCallback((videos: VideoItem[]) => {
    if (videos.length === 0) return;
    setCachedVideosById((prev) => {
      const next = { ...prev };
      for (const v of videos) {
        next[v.id] = v;
      }
      return next;
    });
    setManualFormatMap((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const v of videos) {
        if (v.defaultManualFormat === 'none') {
          if (next[v.id] !== undefined) {
            delete next[v.id];
            changed = true;
          }
        } else if (next[v.id] !== v.defaultManualFormat) {
          next[v.id] = v.defaultManualFormat;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setApiCachePurged(false);
  }, []);

  const setManualFormat = useCallback(
    async (videoId: string, label: ManualFormatLabel): Promise<boolean> => {
      const tr = getTranslations();
      const payload = label === 'none' ? null : label;
      try {
        await setManualVideoFormatApi(videoId, payload);
        setManualFormatMap((prev) => {
          const next = { ...prev };
          if (label === 'none') {
            delete next[videoId];
          } else {
            next[videoId] = label;
          }
          return next;
        });
        setCachedVideosById((prev) => {
          const existing = prev[videoId];
          if (!existing) return prev;
          return { ...prev, [videoId]: { ...existing, defaultManualFormat: label } };
        });
        pushToast(
          'success',
          label === 'none'
            ? tr.toasts.manualFormatCleared
            : tr.toasts.manualFormatSaved(label === 'long_form' ? tr.formatBadge.longForm : tr.formatBadge.shorts),
        );
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.toasts.manualFormatError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const reloadRssFeeds = useCallback(async (signal?: AbortSignal): Promise<RssFeedDto[]> => {
    const items = await fetchRssFeedsApi(signal);
    setRssFeedDtos(items);
    setBackendOnline(true);
    return items;
  }, []);

  const addRssFeed = useCallback(
    async (url: string, name: string, groupTag = ''): Promise<RssFeedDto | null> => {
      const tr = getTranslations().toasts;
      try {
        const created = await createRssFeedApi({ name: name.trim(), url: url.trim(), groupTag });
        setRssFeedDtos((prev) => [created, ...prev]);
        setBackendOnline(true);
        pushToast('success', tr.rssAdded(created.name));
        return created;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.rssAddError));
        }
        return null;
      }
    },
    [pushToast],
  );

  const toggleRssFeedEnabled = useCallback(
    async (feedId: string, nextEnabled?: boolean): Promise<boolean> => {
      const tr = getTranslations().toasts;
      const target = rssFeedDtos.find((f) => f.id === feedId);
      const desired = nextEnabled !== undefined ? nextEnabled : !(target?.enabled ?? true);
      try {
        const updated = await updateRssFeedApi(feedId, { enabled: desired });
        setRssFeedDtos((prev) => prev.map((f) => (f.id === feedId ? updated : f)));
        pushToast('success', desired ? tr.rssEnabled(updated.name) : tr.rssDisabled(updated.name));
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.rssToggleError));
        }
        return false;
      }
    },
    [pushToast, rssFeedDtos],
  );

  const retryRssFeed = useCallback(
    async (feedId: string, signal?: AbortSignal): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const res = await refreshSingleRssFeedApi(feedId, signal);
        setRssFeedDtos((prev) => prev.map((f) => (f.id === feedId ? res.feed : f)));
        if (res.status === 'ok') {
          pushToast('success', tr.rssRefreshedOne(res.feed.name, res.insertedCount ?? 0));
          return true;
        }
        pushToast('error', tr.rssFeedError(res.feed.name, res.errorMessage ?? res.errorCode ?? 'RSS error'));
        return false;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.rssRefreshOneError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const deleteRssFeed = useCallback(
    async (feedId: string): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        await deleteRssFeedApi(feedId);
        setRssFeedDtos((prev) => prev.filter((f) => f.id !== feedId));
        setProjects((prev) =>
          prev.map((p) => ({ ...p, linkedFeedIds: p.linkedFeedIds.filter((fid) => fid !== feedId) })),
        );
        pushToast('success', tr.rssDeleted);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.rssDeleteError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const refreshAllRssFeeds = useCallback(
    async (signal?: AbortSignal): Promise<RssRefreshAllResultDto | null> => {
      const tr = getTranslations().toasts;
      try {
        const summary = await refreshAllRssFeedsApi(signal);
        await reloadRssFeeds(signal);
        if (summary.errorCount > 0) {
          pushToast('error', tr.rssRefreshedPartial(summary.okCount, summary.refreshedCount, summary.errorCount));
        } else {
          pushToast('success', tr.rssRefreshedAll(summary.okCount));
        }
        return summary;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.rssRefreshAllError));
        }
        return null;
      }
    },
    [pushToast, reloadRssFeeds],
  );

  const registerProjectBreakoutStates = useCallback((projectId: string, videos: VideoItem[]) => {
    if (!projectId || videos.length === 0) return;
    setBreakoutByProject((prev) => {
      const existingProj = prev[projectId] ?? {};
      const nextProj = { ...existingProj };
      let changed = false;
      for (const v of videos) {
        if (v.isUserBreakout !== undefined || v.breakoutNotes !== undefined) {
          const flagged = Boolean(v.isUserBreakout);
          const note = v.breakoutNotes ?? '';
          const cur = nextProj[v.id];
          if (!cur || cur.flagged !== flagged || cur.note !== note) {
            nextProj[v.id] = { flagged, note };
            changed = true;
          }
        }
      }
      return changed ? { ...prev, [projectId]: nextProj } : prev;
    });
  }, []);

  const toggleBreakoutFlag = useCallback(
    async (projectId: string, videoId: string): Promise<boolean> => {
      const tr = getTranslations().toasts;
      const existing = breakoutByProject[projectId]?.[videoId] ?? { flagged: false, note: '' };
      const desired = !existing.flagged;
      try {
        const res = await updateVideoBreakoutApi(projectId, videoId, { flagged: desired });
        setBreakoutByProject((prev) => ({
          ...prev,
          [projectId]: {
            ...(prev[projectId] ?? {}),
            [videoId]: { flagged: res.flagged, note: res.notes },
          },
        }));
        pushToast('success', res.flagged ? tr.breakoutFlagged : tr.breakoutUnflagged);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.breakoutError));
        }
        return false;
      }
    },
    [breakoutByProject, pushToast],
  );

  const setBreakoutNote = useCallback(
    async (projectId: string, videoId: string, note: string, flagged?: boolean): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const res = await updateVideoBreakoutApi(projectId, videoId, {
          notes: note,
          ...(flagged !== undefined ? { flagged } : {}),
        });
        setBreakoutByProject((prev) => ({
          ...prev,
          [projectId]: {
            ...(prev[projectId] ?? {}),
            [videoId]: { flagged: res.flagged, note: res.notes },
          },
        }));
        pushToast('success', tr.noteSaved);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.noteSaveError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const addChannelToProject = useCallback(
    async (projectId: string, identifier: string, notes = ''): Promise<boolean> => {
      const tr = getTranslations().toasts;
      const cleaned = identifier.trim();
      if (!cleaned) return false;
      try {
        const res = await addProjectCompetitorApi(projectId, cleaned, notes);
        registerVideosInMemory(res.videos.map(mapYoutubeVideoDtoToItem));
        if (res.quota) {
          setQuotaStatus(res.quota);
        } else {
          await syncQuotaStatus();
        }
        setBackendOnline(true);
        pushToast('success', res.reusedCache ? tr.competitorReused : tr.competitorAdded(res.videos.length));
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          void syncQuotaStatus();
          pushToast('error', formatErrorToast(err, tr.competitorAddError));
        }
        return false;
      }
    },
    [pushToast, registerVideosInMemory, syncQuotaStatus],
  );

  const addKeyword = useCallback(
    async (projectId: string, keyword: string, priority: IdeaPriority, notes = ''): Promise<boolean> => {
      const tr = getTranslations().toasts;
      const trimmed = keyword.trim();
      if (!trimmed) return false;
      try {
        const created = await createProjectKeywordApi(projectId, { keyword: trimmed, priority, notes });
        setBackendOnline(true);
        pushToast('success', tr.keywordSaved(created.keyword));
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.keywordSaveError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const saveIdea: PrototypeWorkspaceContextValue['saveIdea'] = useCallback(
    async (input): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const created = await createIdeaApi({
          title: input.title.trim(),
          notes: input.notes.trim(),
          sourceType: input.sourceType,
          sourceRefId: input.sourceRefId,
          sourceTitleSnapshot: input.sourceTitleSnapshot,
          sourceUrl: input.sourceUrl,
          tags: input.tags,
          inGlobalVault: input.inGlobalVault,
          targetProjectIds: input.targetProjectIds,
          projectAngle: input.projectAngle.trim(),
          priority: input.priority ?? 'medium',
        });
        const mapped = mapIdeaDtoToItem(created);
        setIdeas((prev) => [mapped, ...prev.filter((i) => i.id !== mapped.id)]);
        setBackendOnline(true);
        pushToast('success', tr.ideaSaved);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.ideaSaveError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const updateIdeaCore: PrototypeWorkspaceContextValue['updateIdeaCore'] = useCallback(
    async (ideaId, patch): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const updated = await updateIdeaCoreApi(ideaId, patch);
        const mapped = mapIdeaDtoToItem(updated);
        setIdeas((prev) => prev.map((i) => (i.id === ideaId ? mapped : i)));
        setBackendOnline(true);
        pushToast('success', tr.ideaCoreUpdated);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.ideaCoreUpdateError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const updateProjectIdeaStatus = useCallback(
    async (ideaId: string, projectId: string, status: IdeaStatus): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const updated = await upsertProjectIdeaLinkApi(ideaId, projectId, { status });
        const mapped = mapIdeaDtoToItem(updated);
        setIdeas((prev) => prev.map((i) => (i.id === ideaId ? mapped : i)));
        setBackendOnline(true);
        pushToast('success', tr.ideaStatusUpdated);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.ideaStatusUpdateError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const updateProjectIdeaAngle = useCallback(
    async (
      ideaId: string,
      projectId: string,
      angle: string,
      notes: string,
      publishedVideoUrl: string,
      priority?: IdeaPriority,
    ): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const updated = await upsertProjectIdeaLinkApi(ideaId, projectId, {
          projectAngle: angle,
          projectNotes: notes,
          publishedVideoUrl,
          ...(priority ? { priority } : {}),
        });
        const mapped = mapIdeaDtoToItem(updated);
        setIdeas((prev) => prev.map((i) => (i.id === ideaId ? mapped : i)));
        setBackendOnline(true);
        pushToast('success', tr.ideaAngleSaved);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.ideaAngleSaveError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const attachIdeaToProject = useCallback(
    async (
      ideaId: string,
      projectId: string,
      projectAngle: string,
      priority: IdeaPriority = 'medium',
    ): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const updated = await upsertProjectIdeaLinkApi(ideaId, projectId, {
          status: 'new',
          priority,
          projectAngle,
        });
        const mapped = mapIdeaDtoToItem(updated);
        setIdeas((prev) => prev.map((i) => (i.id === ideaId ? mapped : i)));
        setBackendOnline(true);
        pushToast('success', tr.ideaAttached);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.ideaAttachError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const detachIdeaFromProject = useCallback(
    async (ideaId: string, projectId: string): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        const updated = await detachIdeaFromProjectApi(ideaId, projectId);
        const mapped = mapIdeaDtoToItem(updated);
        setIdeas((prev) => prev.map((i) => (i.id === ideaId ? mapped : i)));
        setBackendOnline(true);
        pushToast('success', tr.ideaDetached);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.ideaDetachError));
        }
        return false;
      }
    },
    [pushToast],
  );

  const deleteIdea = useCallback(
    async (ideaId: string): Promise<boolean> => {
      const tr = getTranslations().toasts;
      try {
        await deleteIdeaApi(ideaId);
        setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
        setBackendOnline(true);
        pushToast('success', tr.ideaDeleted);
        return true;
      } catch (err) {
        if (!isAbortError(err)) {
          pushToast('error', formatErrorToast(err, tr.ideaDeleteError));
        }
        return false;
      }
    },
    [pushToast],
  );

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
        uiLanguage,
        setUiLanguage,
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
        syncQuotaStatus,
        refreshWorkspaceStatus,
        projects,
        createProject,
        updateProject,
        updateProjectRssFeeds,
        exportProjectJson,
        deleteProject,
        updateSystemPreferences,
        acceptLegalConsent,
        saveApiKey,
        removeApiKey,
        purgeYoutubeCache,
        cachedVideosById,
        registerVideosInMemory,
        manualFormatMap,
        setManualFormat,
        rssFeedDtos,
        rssFeeds: rssFeedDtos.map(mapRssFeedDtoToItem),
        reloadRssFeeds,
        addRssFeed,
        toggleRssFeedEnabled,
        retryRssFeed,
        deleteRssFeed,
        refreshAllRssFeeds,
        addChannelToProject,
        breakoutByProject,
        registerProjectBreakoutStates,
        toggleBreakoutFlag,
        setBreakoutNote,
        addKeyword,
        ideas,
        reloadIdeas,
        saveIdea,
        updateIdeaCore,
        updateProjectIdeaStatus,
        updateProjectIdeaAngle,
        attachIdeaToProject,
        detachIdeaFromProject,
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
