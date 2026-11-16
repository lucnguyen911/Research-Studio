import React, { createContext, useContext, useLayoutEffect } from 'react';
import type { NavHistoryEntry, RouteParams, ScreenId, ViewFilterState } from '../prototype/types';
import { DEMO_PROJECTS } from '../prototype/demoData';

const STORAGE_KEY = 'rs_nav_stack_v1';

export const DEFAULT_VIEW_STATE: ViewFilterState = {
  search: '',
  formatFilter: 'all',
  includeManualInFormat: false,
  manualFilter: 'all',
  channelFilter: 'all',
  statusFilter: 'all',
  priorityFilter: 'all',
  originFilter: 'all',
  linkStateFilter: 'all',
  dateWindow: '14',
  minViews: '',
  onlyBreakout: false,
  onlyBookmarked: false,
  selectedFeedId: 'all',
  selectedKeywordId: 'kw-01',
  sortBy: 'viewCount',
  sortDir: 'desc',
  tab: 'channels',
  page: 1,
  scrollTop: 0,
};

export interface NavStoreState {
  entries: NavHistoryEntry[];
  index: number;
}

const SCREEN_HASH_MAP: Record<ScreenId, string> = {
  'global-overview': 'global/overview',
  'global-trends': 'global/trends',
  'global-search': 'global/search',
  'global-featured-stage2': 'global/featured-stage2',
  'global-news': 'global/news',
  'global-ideas': 'global/ideas',
  'project-overview': 'project/overview',
  'project-hot-topics-stage2': 'project/hot-topics-stage2',
  'project-keywords': 'project/keywords',
  'project-breakout': 'project/breakout',
  'project-competitors': 'project/competitors',
  'project-evergreen-stage2': 'project/evergreen-stage2',
  'project-opportunities-stage2': 'project/opportunities-stage2',
  'project-ai-stage2': 'project/ai-stage2',
  'project-ideas': 'project/ideas',
  'project-settings': 'project/settings',
  'channel-detail': 'detail/channel',
  'video-detail': 'detail/video',
  'article-detail': 'detail/article',
  'idea-detail': 'detail/idea',
  'system-settings': 'system/settings',
};

const ALL_SCREEN_IDS = Object.keys(SCREEN_HASH_MAP) as ScreenId[];

function isProjectScopedScreen(screenId: ScreenId): boolean {
  return screenId.startsWith('project-');
}

function makeEntryId(): string {
  return `nav-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildHash(entry: NavHistoryEntry): string {
  const slug = SCREEN_HASH_MAP[entry.screenId] ?? 'global/overview';
  const query = new URLSearchParams();
  if (entry.projectId && (isProjectScopedScreen(entry.screenId) || entry.params.channelId || entry.params.videoId)) {
    query.set('pid', entry.projectId);
  }
  if (entry.params.channelId) query.set('cid', entry.params.channelId);
  if (entry.params.videoId) query.set('vid', entry.params.videoId);
  if (entry.params.articleId) query.set('aid', entry.params.articleId);
  if (entry.params.ideaId) query.set('iid', entry.params.ideaId);
  const qs = query.toString();
  return `#/${slug}${qs ? `?${qs}` : ''}`;
}

function parseHashToFallbackEntry(defaultProjectId: string | null): NavHistoryEntry {
  const rawHash = typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '') : '';
  const [pathPart, qsPart] = rawHash.split('?');
  const qs = new URLSearchParams(qsPart || '');
  const matchedScreen = ALL_SCREEN_IDS.find((id) => SCREEN_HASH_MAP[id] === pathPart) ?? 'global-overview';
  const pid = qs.get('pid') || defaultProjectId;
  return {
    entryId: makeEntryId(),
    screenId: matchedScreen,
    projectId: pid,
    params: {
      channelId: qs.get('cid') || undefined,
      videoId: qs.get('vid') || undefined,
      articleId: qs.get('aid') || undefined,
      ideaId: qs.get('iid') || undefined,
    },
    viewState: { ...DEFAULT_VIEW_STATE },
  };
}

function saveStoreToSession(state: NavStoreState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in sandboxed iframes
  }
}

function loadInitialStore(): NavStoreState {
  if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  const fallbackPid = DEMO_PROJECTS[0]?.id ?? null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NavStoreState>;
      if (Array.isArray(parsed.entries) && parsed.entries.length > 0) {
        const historyState = window.history.state as { entryId?: string } | null;
        let resolvedIndex = typeof parsed.index === 'number' ? parsed.index : parsed.entries.length - 1;
        if (historyState?.entryId) {
          const matchedIdx = parsed.entries.findIndex((e) => e.entryId === historyState.entryId);
          if (matchedIdx >= 0) {
            resolvedIndex = matchedIdx;
          }
        }
        resolvedIndex = Math.max(0, Math.min(resolvedIndex, parsed.entries.length - 1));
        const restored: NavStoreState = { entries: parsed.entries, index: resolvedIndex };
        const current = restored.entries[resolvedIndex];
        window.history.replaceState({ entryId: current.entryId }, '', buildHash(current));
        return restored;
      }
    }
  } catch {
    // Corrupted sessionStorage falls back cleanly
  }

  const initialEntry = parseHashToFallbackEntry(fallbackPid);
  const initialState: NavStoreState = { entries: [initialEntry], index: 0 };
  if (typeof window !== 'undefined') {
    window.history.replaceState({ entryId: initialEntry.entryId }, '', buildHash(initialEntry));
  }
  saveStoreToSession(initialState);
  return initialState;
}

let navState: NavStoreState = loadInitialStore();
const listeners = new Set<() => void>();

function emit(): void {
  saveStoreToSession(navState);
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeNav(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNavSnapshot(): NavStoreState {
  return navState;
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (event: PopStateEvent) => {
    const stateObj = event.state as { entryId?: string } | null;
    if (stateObj?.entryId) {
      const idx = navState.entries.findIndex((e) => e.entryId === stateObj.entryId);
      if (idx >= 0) {
        navState = { ...navState, index: idx };
        emit();
        return;
      }
    }
    const activePid = navState.entries[navState.index]?.projectId ?? DEMO_PROJECTS[0]?.id ?? null;
    const fallbackEntry = parseHashToFallbackEntry(activePid);
    navState = { entries: [fallbackEntry], index: 0 };
    emit();
  });
}

export function navigateTo(
  screenId: ScreenId,
  options?: {
    projectId?: string | null;
    params?: RouteParams;
    viewState?: Partial<ViewFilterState>;
  },
): void {
  const current = navState.entries[navState.index];
  const nextProjectId = options?.projectId !== undefined ? options.projectId : current.projectId;
  const nextEntry: NavHistoryEntry = {
    entryId: makeEntryId(),
    screenId,
    projectId: nextProjectId,
    params: options?.params ? { ...options.params } : {},
    viewState: {
      ...DEFAULT_VIEW_STATE,
      ...(options?.viewState ?? {}),
      scrollTop: options?.viewState?.scrollTop ?? 0,
    },
  };
  const trimmedHistory = navState.entries.slice(0, navState.index + 1);
  const nextEntries = [...trimmedHistory, nextEntry];
  navState = { entries: nextEntries, index: nextEntries.length - 1 };
  if (typeof window !== 'undefined') {
    window.history.pushState({ entryId: nextEntry.entryId }, '', buildHash(nextEntry));
  }
  emit();
}

export function goBack(): void {
  if (navState.index <= 0) return;
  if (typeof window !== 'undefined') {
    window.history.back();
  }
}

export function goForward(): void {
  if (navState.index >= navState.entries.length - 1) return;
  if (typeof window !== 'undefined') {
    window.history.forward();
  }
}

export function switchActiveProjectAtomic(newProjectId: string | null): void {
  const current = navState.entries[navState.index];
  const targetScreen: ScreenId =
    isProjectScopedScreen(current.screenId) ? current.screenId : 'project-overview';
  navigateTo(targetScreen, {
    projectId: newProjectId,
    params: {},
    viewState: { page: 1, scrollTop: 0 },
  });
}

export function updateCurrentViewState(partial: Partial<ViewFilterState>, options?: { silentScroll?: boolean }): void {
  const current = navState.entries[navState.index];
  const updatedEntry: NavHistoryEntry = {
    ...current,
    viewState: {
      ...current.viewState,
      ...partial,
    },
  };
  const nextEntries = [...navState.entries];
  nextEntries[navState.index] = updatedEntry;
  navState = { ...navState, entries: nextEntries };
  if (options?.silentScroll) {
    saveStoreToSession(navState);
    return;
  }
  emit();
}

export function reconcileValidProjects(validProjectIds: string[]): void {
  const current = navState.entries[navState.index];
  if (current.projectId && !validProjectIds.includes(current.projectId)) {
    const fallbackId = validProjectIds[0] ?? null;
    const nextScreen: ScreenId = fallbackId
      ? isProjectScopedScreen(current.screenId)
        ? current.screenId
        : 'project-overview'
      : 'global-overview';
    const nextEntry: NavHistoryEntry = {
      ...current,
      entryId: makeEntryId(),
      screenId: nextScreen,
      projectId: fallbackId,
      params: {},
      viewState: { ...DEFAULT_VIEW_STATE },
    };
    const nextEntries = [...navState.entries];
    nextEntries[navState.index] = nextEntry;
    navState = { ...navState, entries: nextEntries };
    if (typeof window !== 'undefined') {
      window.history.replaceState({ entryId: nextEntry.entryId }, '', buildHash(nextEntry));
    }
    emit();
  }
}

export interface AppNavigationContextValue {
  currentEntry: NavHistoryEntry;
  canGoBack: boolean;
  canGoForward: boolean;
  historyPosition: string;
  navigate: typeof navigateTo;
  goBack: typeof goBack;
  goForward: typeof goForward;
  switchProject: typeof switchActiveProjectAtomic;
  updateViewState: typeof updateCurrentViewState;
  reconcileProjects: typeof reconcileValidProjects;
}

export const AppNavigationContext = createContext<AppNavigationContextValue | null>(null);

export function useAppNavigation(): AppNavigationContextValue {
  const ctx = useContext(AppNavigationContext);
  if (!ctx) {
    throw new Error('useAppNavigation must be used within AppNavigationProvider');
  }
  return ctx;
}

export function useScrollContainerSync(
  scrollRef: React.RefObject<HTMLElement | null>,
  entryId: string,
  targetScrollTop: number,
): () => void {
  const isRestoringRef = React.useRef(false);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    isRestoringRef.current = true;
    const rafId = window.requestAnimationFrame(() => {
      el.scrollTop = targetScrollTop;
      window.requestAnimationFrame(() => {
        isRestoringRef.current = false;
      });
    });
    return () => {
      window.cancelAnimationFrame(rafId);
      isRestoringRef.current = false;
    };
  }, [entryId, scrollRef, targetScrollTop]);

  return () => {
    if (isRestoringRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    updateCurrentViewState({ scrollTop: Math.round(el.scrollTop) }, { silentScroll: true });
  };
}
