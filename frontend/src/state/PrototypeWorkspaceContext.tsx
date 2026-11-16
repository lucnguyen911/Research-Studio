import React, { useEffect, useState } from 'react';
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
  DEMO_CHANNELS,
  DEMO_IDEAS,
  DEMO_KEYWORDS,
  DEMO_PROJECTS,
  DEMO_RSS_FEEDS,
  DEMO_VIDEOS,
} from '../prototype/demoData';
import {
  PrototypeWorkspaceContext,
  type PrototypeWorkspaceContextValue,
  type SaveIdeaDraft,
  type ToastNotice,
} from './workspaceContext';

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

export const PrototypeWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      return localStorage.getItem('rs_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uiMode, setUiModeState] = useState<UiSimulatorMode>('normal');

  const [projects, setProjects] = useState<ProjectItem[]>(DEMO_PROJECTS);
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

  const [breakoutByProject, setBreakoutByProject] = useState<Record<string, Record<string, { flagged: boolean; note: string }>>>({
    'proj-ai-tech': {
      'vid-01': { flagged: true, note: 'Mốc view tăng đều trên cấu hình RTX GPU phổ biến, góc triển khai local rất sát tệp người xem.' },
      'vid-05': { flagged: true, note: 'Chủ đề 0 USD RSS + SQLite giữ lượng bình luận kỹ thuật cao.' },
    },
    'proj-finance': {
      'vid-13': { flagged: true, note: 'Video khung 21 phút phân tích ETF giữ tương tác thảo luận cao.' },
    },
  });

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [apiCachePurged, setApiCachePurged] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(true);
  const [maskedApiKey, setMaskedApiKey] = useState('AIza...9x2A');

  const [quotaSearchUsed, setQuotaSearchUsed] = useState(14);
  const [quotaGeneralUsed, setQuotaGeneralUsed] = useState(420);

  const [inspectorVideoId, setInspectorVideoId] = useState<string | null>(null);
  const [saveIdeaModalDraft, setSaveIdeaModalDraft] = useState<SaveIdeaDraft | null>(null);
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const pushToast = (kind: 'success' | 'error', message: string) => {
    const id = `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  };

  const setTheme = (next: ThemeMode) => {
    applyThemeToDom(next);
    setThemeState(next);
  };

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
  };

  const setUiMode = (mode: UiSimulatorMode) => {
    setUiModeState(mode);
    if (mode === 'rss_error') {
      pushToast('error', 'Mô phỏng: Nguồn RSS example.com gặp lỗi HTTP 404 (đã cô lập feed này).');
    }
  };

  const incrementQuotaDemo = (bucket: 'search' | 'general', amount: number) => {
    if (bucket === 'search') {
      setQuotaSearchUsed((prev) => Math.min(100, prev + amount));
    } else {
      setQuotaGeneralUsed((prev) => Math.min(10000, prev + amount));
    }
  };

  const createProject = (input: { name: string; regionCode: string; relevanceLanguage: string; targetFormat: ProjectItem['targetFormat'] }): ProjectItem => {
    const item: ProjectItem = {
      id: `proj-${Date.now().toString(36)}`,
      name: input.name.trim(),
      description: `Dự án nghiên cứu mới (${input.regionCode} / ${input.relevanceLanguage})`,
      regionCode: input.regionCode,
      relevanceLanguage: input.relevanceLanguage,
      targetFormat: input.targetFormat,
      linkedFeedIds: ['feed-tinhte'],
      updatedAt: 'Vừa tạo (DEMO)',
    };
    setProjects((prev) => [...prev, item]);
    pushToast('success', `Đã tạo Project mới: ${item.name} (DEMO)`);
    return item;
  };

  const updateProject = (projectId: string, patch: Partial<ProjectItem>) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...patch, updatedAt: 'Vừa lưu (DEMO)' } : p)));
    pushToast('success', 'Đã lưu cài đặt Project (cô lập theo project_id).');
  };

  const deleteProject = (projectId: string) => {
    const target = projects.find((p) => p.id === projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setChannels((prev) => prev.map((c) => ({ ...c, projectIds: c.projectIds.filter((id) => id !== projectId) })));
    setIdeas((prev) =>
      prev.map((idea) => {
        if (!idea.projectLinks[projectId]) return idea;
        const copy = { ...idea.projectLinks };
        delete copy[projectId];
        return { ...idea, projectLinks: copy };
      }),
    );
    pushToast('success', `Đã xóa Project "${target?.name ?? projectId}" & giữ 100% thực thể dùng chung (DEMO).`);
  };

  const toggleZeroProjectsDemo = () => {
    if (projects.length > 0) {
      setProjects([]);
      pushToast('success', 'Đã chuyển sang trạng thái 0 Project để kiểm tra hoạt động Global Research.');
    } else {
      setProjects(DEMO_PROJECTS);
      pushToast('success', 'Đã khôi phục 3 Project mẫu DEMO.');
    }
  };

  const addChannelToProject = (projectId: string, handleOrUrl: string) => {
    const cleaned = handleOrUrl.trim();
    if (!cleaned) return;
    incrementQuotaDemo('general', 3);
    const id = `ch-${Date.now().toString(36)}`;
    const newCh: ChannelItem = {
      id,
      title: cleaned.replace(/^https?:\/\/(www\.)?youtube\.com\//, '').replace(/^@/, '') || 'Kênh đối thủ mới (DEMO)',
      handle: cleaned.startsWith('@') ? cleaned : `@${cleaned.slice(0, 18)}`,
      subscriberCount: 48200,
      videoCount: 95,
      country: 'VN',
      projectIds: [projectId],
      projectNotes: { [projectId]: 'Mới thêm bằng URL/@handle (1 unit channels.list + 2 units uploads — 0 Search Queries).' },
      lastFetchedAt: 'Vừa cập nhật (DEMO)',
      statusByProject: { [projectId]: 'active' },
    };
    setChannels((prev) => [newCh, ...prev]);
    pushToast('success', `Đã thêm đối thủ "${newCh.title}" (+3 units General Data API, 0 Search Queries).`);
  };

  const removeChannelFromProject = (projectId: string, channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, projectIds: c.projectIds.filter((pid) => pid !== projectId) } : c)),
    );
    pushToast('success', 'Đã gỡ kênh khỏi Project này (bản ghi kênh dùng chung ở Project khác được giữ nguyên).');
  };

  const setManualFormat = (videoId: string, label: ManualFormatLabel) => {
    setManualFormatMap((prev) => ({ ...prev, [videoId]: label }));
    pushToast(
      'success',
      label === 'none'
        ? 'Đã xóa nhãn định dạng thủ công (giữ nguyên xác minh từ nguồn API).'
        : `Đã gắn nhãn thủ công: ${label === 'long_form' ? 'Video dài (Thủ công)' : 'Shorts (Thủ công)'}`,
    );
  };

  const toggleBreakoutFlag = (projectId: string, videoId: string) => {
    setBreakoutByProject((prev) => {
      const projMap = prev[projectId] ?? {};
      const existing = projMap[videoId] ?? { flagged: false, note: '' };
      return {
        ...prev,
        [projectId]: {
          ...projMap,
          [videoId]: { ...existing, flagged: !existing.flagged },
        },
      };
    });
  };

  const setBreakoutNote = (projectId: string, videoId: string, note: string) => {
    setBreakoutByProject((prev) => {
      const projMap = prev[projectId] ?? {};
      const existing = projMap[videoId] ?? { flagged: false, note: '' };
      return {
        ...prev,
        [projectId]: {
          ...projMap,
          [videoId]: { ...existing, note },
        },
      };
    });
    pushToast('success', 'Đã lưu ghi chú Bứt phá riêng cho Project (User-Created Data).');
  };

  const toggleRssFeedEnabled = (feedId: string) => {
    setRssFeeds((prev) => prev.map((f) => (f.id === feedId ? { ...f, enabled: !f.enabled } : f)));
  };

  const retryRssFeed = (feedId: string) => {
    setRssFeeds((prev) =>
      prev.map((f) => (f.id === feedId ? { ...f, status: 'ok', lastFetchedAt: 'Vừa thử lại (DEMO)', errorCode: undefined, errorMessage: undefined } : f)),
    );
    pushToast('success', 'Đã thử lại nguồn RSS thành công (0 quota YouTube).');
  };

  const addRssFeed = (url: string, name: string) => {
    const cleanedUrl = url.trim();
    if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
      pushToast('error', 'URL RSS không hợp lệ: chỉ chấp nhận giao thức https:// hoặc http://.');
      return;
    }
    const newFeed: RssFeedItem = {
      id: `feed-${Date.now().toString(36)}`,
      name: name.trim() || cleanedUrl,
      url: cleanedUrl,
      groupTag: 'Tùy chỉnh',
      enabled: true,
      status: 'ok',
      lastFetchedAt: 'Vừa thêm (DEMO)',
    };
    setRssFeeds((prev) => [newFeed, ...prev]);
    pushToast('success', `Đã thêm nguồn RSS "${newFeed.name}" (0 quota YouTube).`);
  };

  const addKeyword = (projectId: string, keyword: string, priority: IdeaPriority) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    const item: KeywordItem = {
      id: `kw-${Date.now().toString(36)}`,
      projectId,
      keyword: trimmed,
      priority,
      notes: 'Từ khóa tự nhập của Project (lưu vĩnh viễn).',
      lastScannedAt: null,
      matchedVideoIds: [],
      rssMatchCount: 2,
    };
    setKeywords((prev) => [item, ...prev]);
    pushToast('success', `Đã thêm từ khóa "${trimmed}" vào Project.`);
  };

  const deleteKeyword = (keywordId: string) => {
    setKeywords((prev) => prev.filter((k) => k.id !== keywordId));
    pushToast('success', 'Đã xóa từ khóa khỏi Project.');
  };

  const scanKeywordDemo = (keywordId: string) => {
    if (uiMode === 'quota_search_exhausted') {
      pushToast('error', 'Bucket Search Queries đã hết hạn mức (100/100). Chờ reset 00:00 PT.');
      return;
    }
    if (uiMode === 'no_api_key') {
      pushToast('error', 'Chưa cấu hình YouTube Data API v3 Key trong Cài đặt.');
      return;
    }
    incrementQuotaDemo('search', 1);
    incrementQuotaDemo('general', 1);
    setKeywords((prev) =>
      prev.map((k) =>
        k.id === keywordId
          ? { ...k, lastScannedAt: 'Vừa quét (DEMO)', matchedVideoIds: ['vid-01', 'vid-03', 'vid-05'] }
          : k,
      ),
    );
    pushToast('success', 'Đã quét YouTube xong (-1 lượt Search Queries, -1 unit General Data API).');
  };

  const saveIdea: PrototypeWorkspaceContextValue['saveIdea'] = (input) => {
    const newId = `idea-${Date.now().toString(36)}`;
    const links: IdeaItem['projectLinks'] = {};
    for (const pid of input.targetProjectIds) {
      links[pid] = {
        status: 'new',
        priority: 'medium',
        projectAngle: input.projectAngle || input.title,
        projectNotes: '',
        publishedVideoUrl: '',
        statusUpdatedAt: 'Vừa lưu (DEMO)',
      };
    }
    const item: IdeaItem = {
      id: newId,
      title: input.title.trim(),
      notes: input.notes.trim(),
      sourceType: input.sourceType,
      sourceRefId: input.sourceRefId,
      sourceTitleSnapshot: input.sourceTitleSnapshot,
      sourceUrl: input.sourceUrl,
      inGlobalVault: input.inGlobalVault,
      tags: input.tags,
      updatedAt: 'Vừa lưu (DEMO)',
      projectLinks: links,
    };
    setIdeas((prev) => [item, ...prev]);
    pushToast('success', `Đã lưu Ý tưởng "${item.title}" (${input.targetProjectIds.length} Project liên kết).`);
  };

  const updateProjectIdeaStatus = (ideaId: string, projectId: string, status: IdeaStatus) => {
    setIdeas((prev) =>
      prev.map((idea) => {
        if (idea.id !== ideaId || !idea.projectLinks[projectId]) return idea;
        return {
          ...idea,
          updatedAt: 'Vừa cập nhật (DEMO)',
          projectLinks: {
            ...idea.projectLinks,
            [projectId]: {
              ...idea.projectLinks[projectId],
              status,
              statusUpdatedAt: 'Vừa cập nhật (DEMO)',
            },
          },
        };
      }),
    );
    pushToast('success', 'Đã cập nhật trạng thái riêng trong Project này.');
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
          updatedAt: 'Vừa cập nhật (DEMO)',
          projectLinks: {
            ...idea.projectLinks,
            [projectId]: {
              ...idea.projectLinks[projectId],
              projectAngle: angle,
              projectNotes: notes,
              publishedVideoUrl,
              statusUpdatedAt: 'Vừa cập nhật (DEMO)',
            },
          },
        };
      }),
    );
    pushToast('success', 'Đã lưu góc khai thác & ghi chú riêng của Project.');
  };

  const attachIdeaToProject = (ideaId: string, projectId: string, projectAngle: string) => {
    setIdeas((prev) =>
      prev.map((idea) => {
        if (idea.id !== ideaId) return idea;
        return {
          ...idea,
          updatedAt: 'Vừa gắn Project (DEMO)',
          projectLinks: {
            ...idea.projectLinks,
            [projectId]: {
              status: 'new',
              priority: 'medium',
              projectAngle: projectAngle || idea.title,
              projectNotes: '',
              publishedVideoUrl: '',
              statusUpdatedAt: 'Vừa gắn Project (DEMO)',
            },
          },
        };
      }),
    );
    pushToast('success', 'Đã gắn bản ý tưởng gốc sang Project mới (không nhân bản dữ liệu).');
  };

  const deleteIdea = (ideaId: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
    pushToast('success', 'Đã xóa Ý tưởng sau khi xác nhận.');
  };

  const purgeYouTubeCacheDemo = () => {
    setApiCachePurged(true);
    pushToast('success', 'Đã xóa toàn bộ cache YouTube API Data. Toàn bộ Project, Ý tưởng & RSS vẫn giữ 100%.');
  };

  const restoreYouTubeCacheDemo = () => {
    setApiCachePurged(false);
    pushToast('success', 'Đã nạp lại dữ liệu demo YouTube API (cache <= 30 ngày).');
  };

  const saveApiKeyDemo = (rawKey: string) => {
    const cleaned = rawKey.trim();
    if (cleaned.length < 10) {
      pushToast('error', 'API Key quá ngắn hoặc không hợp lệ (mô phỏng kiểm tra đầu vào).');
      return;
    }
    setMaskedApiKey(`${cleaned.slice(0, 4)}...${cleaned.slice(-4)}`);
    if (uiMode === 'no_api_key') {
      setUiModeState('normal');
    }
    pushToast('success', 'Đã mã hóa giả lập qua DPAPI và chỉ hiển thị dạng che.');
  };

  return (
    <PrototypeWorkspaceContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        sidebarCollapsed,
        toggleSidebar: () => setSidebarCollapsed((s) => !s),
        uiMode,
        setUiMode,
        projects,
        createProject,
        updateProject,
        deleteProject,
        toggleZeroProjectsDemo,
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
        autoRefreshEnabled,
        setAutoRefreshEnabled,
        apiCachePurged,
        purgeYouTubeCacheDemo,
        restoreYouTubeCacheDemo,
        legalAccepted,
        setLegalAccepted,
        maskedApiKey,
        saveApiKeyDemo,
        quotaSearchUsed,
        quotaGeneralUsed,
        incrementQuotaDemo,
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

