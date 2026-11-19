import type {
  GlobalScreenId,
  IdeaStatus,
  ProjectScreenId,
  ScreenId,
  UiLanguage,
} from '../prototype/types';

export const UI_LANGUAGE_STORAGE_KEY = 'rs_ui_lang';

let activeLanguageCache: UiLanguage | null = null;

export function getActiveUiLanguage(): UiLanguage {
  if (activeLanguageCache) {
    return activeLanguageCache;
  }
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(UI_LANGUAGE_STORAGE_KEY) : null;
    activeLanguageCache = saved === 'en' ? 'en' : 'vi';
    return activeLanguageCache;
  } catch {
    return 'vi';
  }
}

export function applyUiLanguageToDom(lang: UiLanguage): void {
  activeLanguageCache = lang;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, lang);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getActiveLocale(lang: UiLanguage = getActiveUiLanguage()): string {
  return lang === 'en' ? 'en-US' : 'vi-VN';
}

export interface TranslationDict {
  common: {
    loading: string;
    loadingBadge: string;
    retry: string;
    refresh: string;
    refreshing: string;
    cancel: string;
    close: string;
    save: string;
    saving: string;
    delete: string;
    openSettings: string;
    viewAll: string;
    noneDash: string;
    secondsAgoFallback: string;
    projectWord: string;
  };
  sidebar: {
    mainNavAria: string;
    selectPlatformAria: string;
    platformMenuAria: string;
    platformComingSoonTag: string;
    platformTooltip: (name: string) => string;
    platforms: {
      youtube: string;
      tiktokSoon: string;
      facebookSoon: string;
      instagramSoon: string;
      xSoon: string;
    };
    areaAria: string;
    overviewArea: string;
    overviewAreaTitle: string;
    projectArea: string;
    projectAreaTitle: string;
    globalSection: string;
    projectSection: string;
    selectProjectAria: string;
    noProjectsOption: string;
    createProjectTitle: string;
    stage2Tag: string;
    stage2Title: string;
    settingsLabel: string;
    settingsTitle: string;
    expandSidebar: string;
    collapseSidebar: string;
    globalMenu: Record<GlobalScreenId, string>;
    projectMenu: Record<ProjectScreenId, string>;
  };
  topbar: {
    brandHomeTitle: string;
    platformYoutubeCrumb: string;
    overviewAreaCrumb: string;
    projectAreaCrumb: string;
    backLabel: string;
    backTitle: string;
    forwardLabel: string;
    forwardTitle: string;
    breadcrumbAria: string;
    globalCrumb: string;
    projectFallbackCrumb: string;
    competitorsCrumb: string;
    channelCrumb: string;
    videoCrumb: string;
    rssCrumb: string;
    ideasCrumb: string;
    ideaCrumb: string;
    systemCrumb: string;
    stage2Badge: string;
    stage2BadgeTitle: string;
    screenTitles: Record<ScreenId, string>;
    alerts: {
      offline: string;
      apiKeyError: string;
      quotaExhausted: string;
      quotaWarning: string;
    };
    quotaBtnLabel: string;
    quotaBtnTitle: string;
    quotaDialogAria: string;
    quotaTitle: string;
    resetHint: string;
    resetHintTitle: string;
    quotaSearch: string;
    quotaData: string;
    localConnection: string;
    statusChecking: string;
    statusActive: string;
    statusOffline: string;
    apiKeyLabel: string;
    apiKeyConfigured: (masked: string) => string;
    apiKeyError: string;
    apiKeyMissing: string;
    youtubeTermsLabel: string;
    termsAccepted: string;
    termsNotAccepted: string;
    acceptTermsBtn: string;
    languageLabel: string;
    languageAria: string;
    switchToDark: string;
    switchToLight: string;
    settingsBtn: string;
    windowMinimize: string;
    windowMaximize: string;
    windowRestore: string;
    windowClose: string;
  };
  overview: {
    title: string;
    createProjectBtn: string;
    offlineError: string;
    keyUnreadableError: string;
    updateKeyBtn: string;
    quotaExhaustedNotice: string;
    viewSettingsBtn: string;
    statProjects: string;
    statOpenProject: string;
    statNoProjects: string;
    statActiveProject: (name: string) => string;
    statProjectCount: (n: number) => string;
    statIdeas: string;
    statOpenVault: string;
    statUnlinkedIdeas: (n: number) => string;
    statInIdeaVault: string;
    statNews: string;
    statViewNews: string;
    statSourcesWithErrors: (enabled: number, errors: number) => string;
    statSourcesFollowing: (enabled: number) => string;
    recentIdeasTitle: string;
    noIdeasYet: string;
    addIdeaBtn: string;
    sharedVaultLabel: string;
    linkedProjectsCount: (n: number) => string;
    latestNewsTitle: string;
    noNewsYet: string;
    addFeedBtn: string;
    rssSourcePrefix: string;
    shortcutsTitle: string;
    shortcuts: {
      trends: { title: string; desc: string };
      search: { title: string; desc: string };
      news: { title: string; desc: string };
      ideas: { title: string; desc: string };
    };
  };
  trends: {
    title: string;
    sourceLabel: string;
    updatedPrefix: string;
    notLoadedYet: string;
    youtubeTrendingLink: string;
    loadBtn: string;
    refreshBtn: string;
    offlineReason: string;
    termsReason: string;
    keyUnreadableReason: string;
    keyMissingReason: string;
    quotaExhaustedReason: string;
    loadFailedError: string;
    fetchFailedToast: string;
    loadedToast: (count: number, region: string) => string;
    cancelledToast: string;
    offlineBanner: string;
    keyUnreadableBanner: string;
    updateKeyBtn: string;
    quotaExhaustedBanner: string;
    quotaWarningBanner: (used: string, limit: string) => string;
    needTermsNotice: string;
    needKeyNotice: string;
    acceptTermsBtn: string;
    countryLabel: string;
    categoryLabel: string;
    videoCount: (n: number) => string;
    loadingLabel: string;
    setupTitle: string;
    setupNeedTermsDesc: string;
    setupNeedKeyDesc: string;
    setupKeyBtn: string;
    emptyTitle: string;
    emptyDesc: (region: string) => string;
    noMatchTitle: string;
    noMatchDesc: string;
    regions: Array<{ code: string; label: string }>;
    categories: Record<string, string>;
  };
  videoTable: {
    searchAria: string;
    searchPlaceholder: string;
    channelFilterAria: string;
    allChannels: (n: number) => string;
    dateFilterAria: string;
    dateLast3d: string;
    dateLast7d: string;
    dateLast14d: string;
    dateLast30d: string;
    dateAllSaved: string;
    minViewsAria: string;
    minViewsPlaceholder: string;
    sortAria: string;
    sortViewsDesc: string;
    sortViewsAsc: string;
    sortLikesDesc: string;
    sortCommentsDesc: string;
    sortPublishedDesc: string;
    sortDurationDesc: string;
    onlyBreakoutLabel: string;
    formatGroupAria: string;
    formatAll: (n: number) => string;
    formatLong: (n: number) => string;
    formatShorts: (n: number) => string;
    formatUnknown: (n: number) => string;
    formatUnknownTitle: string;
    includeManualLabel: string;
    includeManualTitle: string;
    resetFilters: string;
    emptyDefaultTitle: string;
    emptyDefaultDesc: string;
    colVideo: string;
    colFormat: string;
    colViews: string;
    colLikes: string;
    colComments: string;
    colHistory: string;
    colActions: string;
    breakoutFlagged: string;
    breakoutUnflagged: string;
    breakoutFlagTitle: string;
    breakoutUnflagTitle: string;
    addIdeaBtn: string;
    quickViewBtn: string;
    addCompetitorBtn: string;
    historyBadge: (n: number) => string;
    historyTitle: string;
    historyDetail: string;
    historyInsufficient: string;
    paginationRange: (start: number, end: number, total: number) => string;
    prevPage: string;
    nextPage: string;
    pageStatus: (page: number, totalPages: number) => string;
  };
  formatBadge: {
    longForm: string;
    shorts: string;
    unknown: string;
    sourceTitle: string;
    unknownTitle: string;
    hintPrefix: string;
    confidenceLabel: string;
    basisLabel: string;
    manualPrefix: string;
    manualTitle: string;
    manualAria: (title: string) => string;
    selectNone: string;
    selectLong: string;
    selectShorts: string;
    hintLikelyShorts: string;
    hintLikelyLongForm: string;
    confLowMedium: string;
    confMediumHigh: string;
  };
  sparkline: {
    defaultInsufficient: string;
    pointLabel: (idx: number) => string;
    zeroPoints: string;
    onePoint: string;
  };
  modals: {
    createProjectTitle: string;
    projectNameLabel: string;
    projectNamePlaceholder: string;
    projectDescLabel: string;
    projectDescPlaceholder: string;
    regionLabel: string;
    languageLabel: string;
    langViOption: string;
    langEnOption: string;
    targetFormatLabel: string;
    formatAll: string;
    formatLong: string;
    formatShorts: string;
    createProjectSubmit: string;
    saveIdeaTitle: string;
    ideaTitleLabel: string;
    ideaNotesLabel: string;
    ideaNotesPlaceholder: string;
    attachProjectLabel: string;
    noProjectsHint: string;
    projectAngleLabel: string;
    projectAnglePlaceholder: string;
    priorityLabel: string;
    priorityHigh: string;
    priorityMedium: string;
    priorityLow: string;
    showInGlobalVault: string;
    saveIdeaSubmit: string;
    typeToConfirmPrefix: string;
    typeToConfirmSuffix: string;
    legalTitle: string;
    legalIntroBeforeStrong: string;
    legalIntroStrong: string;
    legalIntroAfterStrong: string;
    legalBullet1Before: string;
    legalTosLinkText: string;
    legalBullet2Before: string;
    legalPrivacyLinkText: string;
    legalBullet3BeforeStrong: string;
    legalBullet3Strong: string;
    legalBullet3AfterStrong: string;
    legalAcceptBtn: string;
    quickViewAria: string;
    quickViewTitle: string;
    quickViewClose: string;
    quickViewMissing: string;
    quickViewPublished: string;
    quickViewViews: (n: string) => string;
    quickViewLikes: (n: string) => string;
    quickViewComments: (n: string) => string;
    quickViewDetailBtn: string;
  };
  statusViews: {
    stage2Badge: string;
    scopeLine: (scope: string) => string;
    stage2GoalTitle: string;
    stage2ReasonTitle: string;
    stage2FooterNote: string;
    offlineTitle: string;
    offlineDesc: string;
    retryBtn: string;
    legalBannerTitle: string;
    legalBannerDesc: string;
    legalBannerBtn: string;
    keyUnreadableTitle: string;
    keyUnreadableDesc: string;
    keyUnreadableBtn: string;
    keyMissingTitle: string;
    keyMissingDesc: string;
    keyMissingBtn: string;
    quotaSearchWarnTitle: (used: number, limit: number) => string;
    quotaSearchWarnDesc: (remaining: number, resetText: string) => string;
    quotaDataWarnTitle: (used: string, limit: string) => string;
    quotaDataWarnDesc: (resetText: string) => string;
    quotaSearchExhaustedTitle: (used: number, limit: number) => string;
    quotaSearchExhaustedDesc: (ptDate: string) => string;
    quotaDataExhaustedTitle: (used: string, limit: string) => string;
    quotaDataExhaustedDesc: string;
    defaultLoadingLabel: string;
    stage2Info: Record<
      | 'global-featured-stage2'
      | 'project-hot-topics-stage2'
      | 'project-evergreen-stage2'
      | 'project-opportunities-stage2'
      | 'project-ai-stage2',
      {
        title: string;
        scope: string;
        goal: string;
        reason: string;
        alternatives: Array<{
          label: string;
          screenId: 'global-trends' | 'global-search' | 'project-keywords' | 'project-breakout' | 'project-ideas';
        }>;
      }
    >;
  };
  settings: {
    title: string;
    subtitle: string;
    loadingLabel: string;
    appearanceTitle: string;
    uiLanguageLabel: string;
    uiLanguageHint: string;
    themeModeLabel: string;
    themeLightBtn: string;
    themeDarkBtn: string;
    apiKeyTitle: string;
    keyConfiguredBadge: (masked: string) => string;
    keyUnreadableBadge: string;
    keyMissingBadge: string;
    needLegalBeforeKey: string;
    keyUnreadableWarning: string;
    apiKeyPlaceholder: string;
    saveApiKeyBtn: string;
    savingApiKeyBtn: string;
    removeApiKeyBtn: string;
    apiKeySecurityNote: string;
    refreshQuotaTitle: string;
    allowAutoRefresh: string;
    defaultRegionLabel: string;
    defaultSearchLangLabel: string;
    warnThresholdLabel: string;
    competitorIntervalLabel: string;
    rssIntervalLabel: string;
    maxUnitsPerBatchLabel: string;
    dailyAutoCapLabel: string;
    savePrefsBtn: string;
    savingPrefsBtn: string;
    legalAndDataTitle: string;
    legalAcceptedBadge: (at: string) => string;
    legalNotAcceptedBadge: string;
    legalDescriptionPrefix: string;
    legalDescriptionAnd: string;
    legalDescriptionSuffix: string;
    openLegalModalBtn: string;
    purgeCacheBtn: string;
    purgingCacheBtn: string;
    purgeConfirmTitle: string;
    purgeConfirmWarning: string;
    purgeConfirmBtn: string;
    storage: {
      sectionTitle: string;
      loadingStatus: string;
      loadFailed: string;
      dataDirHeading: string;
      defaultBadge: string;
      customBadge: string;
      envLockedNote: string;
      sizeLabel: (formattedSize: string) => string;
      openFolderBtn: string;
      resetDefaultBtn: string;
      newDataDirLabel: string;
      newDataDirPlaceholder: string;
      browseBtn: string;
      applyDirBtn: string;
      applyingDirBtn: string;
      dirKeepOldNote: string;
      conflictTitle: (dir: string, projectsCount: number, ideasCount: number) => string;
      conflictUseExisting: string;
      conflictOverwrite: string;
      backupHeading: string;
      autoBackupToggle: string;
      externalDirLabel: string;
      externalDirPlaceholder: string;
      saveExternalBtn: string;
      clearExternalBtn: string;
      externalStatusOk: string;
      externalStatusMissing: string;
      backupNowBtn: string;
      backingUpBtn: string;
      pickRestoreFileBtn: string;
      lastBackupLabel: (when: string | null) => string;
      recentBackupsHeading: string;
      openBackupsFolderBtn: string;
      noBackupsYet: string;
      locationLocal: string;
      locationExternal: string;
      locationBoth: string;
      kindManual: string;
      kindAuto: string;
      kindPreRestore: string;
      restoreBtn: string;
      restoringBtn: string;
      restoreConfirmTitle: (name: string) => string;
      restoreConfirmDesc: string;
      restoreConfirmBtn: string;
    };
  };
  toasts: {
    errorPrefix: string;
    successPrefix: string;
    networkUnreachable: string;
    httpFailed: (status: number) => string;
    themeSaveError: string;
    prefsSaved: string;
    prefsSaveError: string;
    legalAccepted: string;
    legalRevoked: string;
    legalSaveError: string;
    apiKeySaved: (masked: string) => string;
    apiKeySaveError: string;
    apiKeyRemoved: string;
    apiKeyRemoveError: string;
    loadIdeasError: string;
    cachePurged: (videosCount: number) => string;
    cachePurgeError: string;
    storageConfigSaved: string;
    storageConfigError: string;
    storageBackupCreated: (filename: string) => string;
    storageBackupError: string;
    storageMigrated: (dir: string) => string;
    storageMigrateError: string;
    storageRestored: (filename: string) => string;
    storageRestoreError: string;
    storageOpenFolderError: string;
    storagePickError: string;
    projectCreated: (name: string) => string;
    projectCreateError: string;
    projectUpdated: (name: string) => string;
    projectUpdateError: string;
    projectFeedsError: string;
    projectExported: (filename: string) => string;
    projectExportError: string;
    projectDeleted: (name: string, backupFile: string) => string;
    projectDeleteError: string;
    manualFormatCleared: string;
    manualFormatSaved: (label: string) => string;
    manualFormatError: string;
    rssAdded: (name: string) => string;
    rssAddError: string;
    rssEnabled: (name: string) => string;
    rssDisabled: (name: string) => string;
    rssToggleError: string;
    rssRefreshedOne: (name: string, count: number) => string;
    rssFeedError: (name: string, detail: string) => string;
    rssRefreshOneError: string;
    rssDeleted: string;
    rssDeleteError: string;
    rssRefreshedPartial: (ok: number, total: number, errors: number) => string;
    rssRefreshedAll: (ok: number) => string;
    rssRefreshAllError: string;
    breakoutFlagged: string;
    breakoutUnflagged: string;
    breakoutError: string;
    noteSaved: string;
    noteSaveError: string;
    competitorReused: string;
    competitorAdded: (count: number) => string;
    competitorAddError: string;
    keywordSaved: (kw: string) => string;
    keywordSaveError: string;
    ideaSaved: string;
    ideaSaveError: string;
    ideaCoreUpdated: string;
    ideaCoreUpdateError: string;
    ideaStatusUpdated: string;
    ideaStatusUpdateError: string;
    ideaAngleSaved: string;
    ideaAngleSaveError: string;
    ideaAttached: string;
    ideaAttachError: string;
    ideaDetached: string;
    ideaDetachError: string;
    ideaDeleted: string;
    ideaDeleteError: string;
    projectFallbackMoved: string;
    projectFallbackGlobal: string;
  };
  ideaStatusLabels: Record<IdeaStatus, string>;
}

const VI: TranslationDict = {
  common: {
    loading: 'Đang tải...',
    loadingBadge: 'Đang tải',
    retry: 'Thử lại',
    refresh: 'Làm mới',
    refreshing: 'Đang tải...',
    cancel: 'Hủy',
    close: 'Đóng',
    save: 'Lưu',
    saving: 'Đang lưu...',
    delete: 'Xóa',
    openSettings: 'Mở Cài đặt',
    viewAll: 'Xem tất cả',
    noneDash: '—',
    secondsAgoFallback: 'Không rõ',
    projectWord: 'dự án',
  },
  sidebar: {
    mainNavAria: 'Điều hướng chính',
    selectPlatformAria: 'Chọn nền tảng mạng xã hội',
    platformTooltip: (name) => `Nền tảng: ${name}`,
    platforms: {
      youtube: 'YouTube',
      tiktokSoon: 'TikTok — Sắp ra mắt',
      facebookSoon: 'Facebook — Sắp ra mắt',
      instagramSoon: 'Instagram — Sắp ra mắt',
      xSoon: 'X — Sắp ra mắt',
    },
    platformMenuAria: 'Danh sách nền tảng mạng xã hội',
    platformComingSoonTag: 'Sắp ra mắt',
    areaAria: 'Chọn khu vực điều hướng',
    overviewArea: 'Tổng quan',
    overviewAreaTitle: 'Mở trang Tổng quan chung',
    projectArea: 'Dự án',
    projectAreaTitle: 'Mở trang Tổng quan dự án',
    globalSection: 'Nghiên cứu chung',
    projectSection: 'Nghiên cứu dự án',
    selectProjectAria: 'Chọn dự án đang hoạt động',
    noProjectsOption: 'Chưa có dự án',
    createProjectTitle: 'Tạo dự án mới',
    stage2Tag: 'GĐ 2',
    stage2Title: 'Tính năng thuộc Giai đoạn 2',
    settingsLabel: 'Cài đặt',
    settingsTitle: 'Cài đặt hệ thống',
    expandSidebar: 'Mở rộng thanh bên',
    collapseSidebar: 'Thu gọn thanh bên',
    globalMenu: {
      'global-overview': 'Tổng quan',
      'global-trends': 'Khám phá xu hướng',
      'global-search': 'Nghiên cứu tự do',
      'global-featured-stage2': 'Video nổi bật',
      'global-news': 'Tin tức & thảo luận',
      'global-ideas': 'Kho ý tưởng chung',
    },
    projectMenu: {
      'project-overview': 'Tổng quan dự án',
      'project-hot-topics-stage2': 'Chủ đề nóng',
      'project-keywords': 'Nghiên cứu từ khóa',
      'project-breakout': 'Video bứt phá',
      'project-competitors': 'Theo dõi đối thủ',
      'project-evergreen-stage2': 'Chủ đề dài hạn',
      'project-opportunities-stage2': 'Cơ hội nội dung',
      'project-ai-stage2': 'Nghiên cứu AI',
      'project-ideas': 'Quản lý ý tưởng',
      'project-settings': 'Cài đặt dự án',
    },
  },
  topbar: {
    brandHomeTitle: 'Về trang Tổng quan',
    platformYoutubeCrumb: 'YouTube',
    overviewAreaCrumb: 'Tổng quan',
    projectAreaCrumb: 'Dự án',
    backLabel: 'Quay lại',
    backTitle: 'Quay lại trang trước',
    forwardLabel: 'Tiến tới',
    forwardTitle: 'Tiến tới trang sau',
    breadcrumbAria: 'Đường dẫn điều hướng',
    globalCrumb: 'Nghiên cứu chung',
    projectFallbackCrumb: 'Dự án',
    competitorsCrumb: 'Theo dõi đối thủ',
    channelCrumb: 'Chi tiết kênh',
    videoCrumb: 'Chi tiết video',
    rssCrumb: 'Tin tức & thảo luận',
    ideasCrumb: 'Kho ý tưởng chung',
    ideaCrumb: 'Chi tiết ý tưởng',
    systemCrumb: 'Hệ thống',
    stage2Badge: 'Giai đoạn 2',
    stage2BadgeTitle: 'Tính năng thuộc Giai đoạn 2',
    screenTitles: {
      'global-overview': 'Tổng quan',
      'global-trends': 'Khám phá xu hướng',
      'global-search': 'Nghiên cứu tự do',
      'global-featured-stage2': 'Video nổi bật',
      'global-news': 'Tin tức & thảo luận',
      'global-ideas': 'Kho ý tưởng chung',
      'project-overview': 'Tổng quan dự án',
      'project-hot-topics-stage2': 'Chủ đề nóng',
      'project-keywords': 'Nghiên cứu từ khóa',
      'project-breakout': 'Video bứt phá',
      'project-competitors': 'Theo dõi đối thủ',
      'project-evergreen-stage2': 'Chủ đề dài hạn',
      'project-opportunities-stage2': 'Cơ hội nội dung',
      'project-ai-stage2': 'Nghiên cứu AI',
      'project-ideas': 'Quản lý ý tưởng',
      'project-settings': 'Cài đặt dự án',
      'channel-detail': 'Chi tiết kênh',
      'video-detail': 'Chi tiết video',
      'article-detail': 'Chi tiết bài viết',
      'idea-detail': 'Chi tiết ý tưởng',
      'system-settings': 'Cài đặt',
    },
    alerts: {
      offline: 'Mất kết nối',
      apiKeyError: 'Lỗi API Key',
      quotaExhausted: 'Hết hạn mức API',
      quotaWarning: 'Sắp hết hạn mức',
    },
    quotaBtnLabel: 'Hạn mức',
    quotaBtnTitle: 'Xem hạn mức YouTube và trạng thái kết nối',
    quotaDialogAria: 'Hạn mức và trạng thái',
    quotaTitle: 'Hạn mức YouTube hôm nay',
    resetHint: 'Đặt lại 00:00 (giờ PT)',
    resetHintTitle: 'Hạn mức được đặt lại lúc 00:00 theo giờ Thái Bình Dương',
    quotaSearch: 'Tìm kiếm',
    quotaData: 'Dữ liệu',
    localConnection: 'Kết nối cục bộ',
    statusChecking: 'Đang kiểm tra',
    statusActive: 'Đang hoạt động',
    statusOffline: 'Mất kết nối',
    apiKeyLabel: 'YouTube API Key',
    apiKeyConfigured: (masked) => `Đã cấu hình (${masked})`,
    apiKeyError: 'Lỗi đọc khóa',
    apiKeyMissing: 'Chưa thiết lập',
    youtubeTermsLabel: 'Điều khoản YouTube',
    termsAccepted: 'Đã xác nhận',
    termsNotAccepted: 'Chưa xác nhận',
    acceptTermsBtn: 'Xác nhận điều khoản',
    languageLabel: 'Ngôn ngữ',
    languageAria: 'Chọn ngôn ngữ giao diện',
    switchToDark: 'Chuyển sang giao diện tối',
    switchToLight: 'Chuyển sang giao diện sáng',
    settingsBtn: 'Cài đặt',
    windowMinimize: 'Thu nhỏ',
    windowMaximize: 'Phóng to',
    windowRestore: 'Khôi phục kích thước',
    windowClose: 'Đóng',
  },
  overview: {
    title: 'Tổng quan',
    createProjectBtn: '+ Tạo dự án',
    offlineError: 'Không thể kết nối dịch vụ dữ liệu cục bộ.',
    keyUnreadableError: 'Không đọc được YouTube API Key đã lưu.',
    updateKeyBtn: 'Cập nhật khóa',
    quotaExhaustedNotice: 'Hạn mức YouTube hôm nay đã hết (đặt lại lúc 00:00 giờ PT). Dữ liệu đã lưu và RSS vẫn hoạt động.',
    viewSettingsBtn: 'Xem cài đặt',
    statProjects: 'Dự án',
    statOpenProject: 'Mở →',
    statNoProjects: 'Chưa có dự án nào',
    statActiveProject: (name) => `Đang chọn: ${name}`,
    statProjectCount: (n) => `${n} dự án`,
    statIdeas: 'Ý tưởng',
    statOpenVault: 'Mở kho →',
    statUnlinkedIdeas: (n) => `${n} chưa gắn dự án`,
    statInIdeaVault: 'Trong kho ý tưởng',
    statNews: 'Tin tức mới',
    statViewNews: 'Xem tin →',
    statSourcesWithErrors: (enabled, errors) => `${enabled} nguồn đang bật · ${errors} nguồn lỗi`,
    statSourcesFollowing: (enabled) => `${enabled} nguồn đang theo dõi`,
    recentIdeasTitle: 'Ý tưởng gần đây',
    noIdeasYet: 'Chưa có ý tưởng nào được lưu.',
    addIdeaBtn: 'Thêm ý tưởng',
    sharedVaultLabel: 'Kho chung',
    linkedProjectsCount: (n) => `${n} dự án`,
    latestNewsTitle: 'Tin tức mới nhất',
    noNewsYet: 'Chưa có bài viết mới từ các nguồn RSS.',
    addFeedBtn: 'Thêm nguồn tin',
    rssSourcePrefix: 'Nguồn RSS',
    shortcutsTitle: 'Lối tắt',
    shortcuts: {
      trends: { title: 'Xu hướng', desc: 'Video thịnh hành theo quốc gia' },
      search: { title: 'Nghiên cứu', desc: 'Tìm kiếm video và kênh' },
      news: { title: 'Tin tức', desc: 'Theo dõi nguồn tin RSS' },
      ideas: { title: 'Ý tưởng', desc: 'Kho lưu trữ chủ đề nội dung' },
    },
  },
  trends: {
    title: 'Khám phá xu hướng',
    sourceLabel: 'Nguồn: YouTube',
    updatedPrefix: 'Cập nhật',
    notLoadedYet: 'Chưa tải dữ liệu',
    youtubeTrendingLink: 'YouTube Thịnh hành ↗',
    loadBtn: 'Tải xu hướng',
    refreshBtn: 'Làm mới xu hướng',
    offlineReason: 'Chưa kết nối được dịch vụ dữ liệu cục bộ.',
    termsReason: 'Cần xác nhận điều khoản YouTube trước khi tải dữ liệu mới.',
    keyUnreadableReason: 'YouTube API Key hiện tại không đọc được.',
    keyMissingReason: 'Cần cài đặt YouTube API Key trong Cài đặt.',
    quotaExhaustedReason: 'Đã hết hạn mức dữ liệu YouTube hôm nay.',
    loadFailedError: 'Không tải được dữ liệu xu hướng đã lưu.',
    fetchFailedToast: 'Không thể tải dữ liệu xu hướng từ YouTube.',
    loadedToast: (count, region) => `Đã cập nhật ${count} video xu hướng (${region}).`,
    cancelledToast: 'Đã hủy tải xu hướng.',
    offlineBanner: 'Không kết nối được dịch vụ dữ liệu cục bộ.',
    keyUnreadableBanner: 'Không đọc được YouTube API Key đã lưu.',
    updateKeyBtn: 'Cập nhật API Key',
    quotaExhaustedBanner: 'Đã hết hạn mức dữ liệu YouTube hôm nay (đặt lại lúc 00:00 giờ PT). Bạn vẫn xem được các video đã lưu.',
    quotaWarningBanner: (used, limit) => `Sắp chạm hạn mức dữ liệu YouTube trong ngày (${used}/${limit}).`,
    needTermsNotice: 'Cần xác nhận điều khoản YouTube để cập nhật danh sách mới.',
    needKeyNotice: 'Cần cấu hình YouTube API Key để cập nhật danh sách mới.',
    acceptTermsBtn: 'Xác nhận điều khoản',
    countryLabel: 'Quốc gia',
    categoryLabel: 'Danh mục',
    videoCount: (n) => `${n} video`,
    loadingLabel: 'Đang tải danh sách xu hướng...',
    setupTitle: 'Chưa thiết lập kết nối YouTube',
    setupNeedTermsDesc: 'Xác nhận điều khoản YouTube và lưu API Key cá nhân trong Cài đặt để tải danh sách video thịnh hành.',
    setupNeedKeyDesc: 'Thêm YouTube API Key cá nhân trong Cài đặt để tải danh sách video thịnh hành.',
    setupKeyBtn: 'Thiết lập API Key',
    emptyTitle: 'Chưa có dữ liệu xu hướng cho lựa chọn này',
    emptyDesc: (region) => `Bấm "Tải xu hướng" để lấy danh sách video thịnh hành mới nhất tại ${region}.`,
    noMatchTitle: 'Không có video nào khớp bộ lọc',
    noMatchDesc: 'Thử đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc.',
    regions: [
      { code: 'VN', label: 'VN — Việt Nam' },
      { code: 'US', label: 'US — Hoa Kỳ' },
      { code: 'JP', label: 'JP — Nhật Bản' },
      { code: 'KR', label: 'KR — Hàn Quốc' },
      { code: 'GB', label: 'GB — Vương quốc Anh' },
      { code: 'DE', label: 'DE — Đức' },
    ],
    categories: {
      all: 'Tất cả danh mục',
      '28': 'Khoa học & Công nghệ',
      '27': 'Giáo dục',
      '20': 'Trò chơi',
      '24': 'Giải trí',
      '25': 'Tin tức & Chính trị',
      '22': 'Đời sống & Nhật ký',
      '26': 'Hướng dẫn & Phong cách',
    },
  },
  videoTable: {
    searchAria: 'Tìm theo tiêu đề video hoặc tên kênh',
    searchPlaceholder: 'Tìm theo tiêu đề hoặc kênh...',
    channelFilterAria: 'Lọc theo kênh',
    allChannels: (n) => `Tất cả kênh (${n})`,
    dateFilterAria: 'Thời gian đăng',
    dateLast3d: 'Đăng ≤ 3 ngày',
    dateLast7d: 'Đăng ≤ 7 ngày',
    dateLast14d: 'Đăng ≤ 14 ngày',
    dateLast30d: 'Đăng ≤ 30 ngày',
    dateAllSaved: 'Mọi thời điểm đã lưu',
    minViewsAria: 'Lượt xem tối thiểu',
    minViewsPlaceholder: 'Lượt xem từ...',
    sortAria: 'Sắp xếp danh sách video',
    sortViewsDesc: 'Lượt xem: Cao đến thấp',
    sortViewsAsc: 'Lượt xem: Thấp đến cao',
    sortLikesDesc: 'Lượt thích: Nhiều nhất',
    sortCommentsDesc: 'Bình luận: Nhiều nhất',
    sortPublishedDesc: 'Mới đăng nhất',
    sortDurationDesc: 'Thời lượng dài nhất',
    onlyBreakoutLabel: 'Chỉ video bứt phá',
    formatGroupAria: 'Lọc theo định dạng video',
    formatAll: (n) => `Tất cả (${n})`,
    formatLong: (n) => `Video dài (${n})`,
    formatShorts: (n) => `Shorts (${n})`,
    formatUnknown: (n) => `Chưa rõ định dạng (${n})`,
    formatUnknownTitle: 'Video ngắn ≤ 3 phút chưa xác định rõ định dạng từ nguồn YouTube',
    includeManualLabel: 'Tính cả nhãn thủ công',
    includeManualTitle: 'Gộp video bạn đã gắn nhãn thủ công vào bộ lọc Video dài / Shorts',
    resetFilters: 'Đặt lại bộ lọc',
    emptyDefaultTitle: 'Không có video nào khớp bộ lọc hiện tại',
    emptyDefaultDesc: 'Thử đặt lại bộ lọc hoặc làm mới nguồn dữ liệu để tải video mới nhất.',
    colVideo: 'Video',
    colFormat: 'Định dạng',
    colViews: 'Lượt xem',
    colLikes: 'Lượt thích',
    colComments: 'Bình luận',
    colHistory: 'Lịch sử lượt xem',
    colActions: 'Thao tác',
    breakoutFlagged: '★ Bứt phá',
    breakoutUnflagged: '☆ Bứt phá',
    breakoutFlagTitle: 'Bỏ đánh dấu bứt phá',
    breakoutUnflagTitle: 'Đánh dấu video bứt phá',
    addIdeaBtn: '+ Ý tưởng',
    quickViewBtn: 'Xem nhanh',
    addCompetitorBtn: '+ Đối thủ',
    historyBadge: (n) => `${n} mốc gần đây`,
    historyTitle: 'Lịch sử lượt xem',
    historyDetail: 'Số liệu lượt xem theo các lần thu thập gần đây.',
    historyInsufficient: '1 lần lấy dữ liệu',
    paginationRange: (start, end, total) => `${start}–${end} / ${total} video`,
    prevPage: 'Trước',
    nextPage: 'Sau',
    pageStatus: (page, totalPages) => `Trang ${page} / ${totalPages}`,
  },
  formatBadge: {
    longForm: 'Video dài',
    shorts: 'Shorts',
    unknown: 'Chưa rõ định dạng',
    sourceTitle: 'Xác minh trực tiếp từ nguồn YouTube',
    unknownTitle: 'Video ≤ 3 phút chưa xác định định dạng từ nguồn YouTube',
    hintPrefix: 'Gợi ý',
    confidenceLabel: 'Độ tin cậy',
    basisLabel: 'Căn cứ',
    manualPrefix: 'Thủ công',
    manualTitle: 'Nhãn thủ công của bạn — tách biệt với dữ liệu nguồn YouTube',
    manualAria: (title) => `Nhãn thủ công cho ${title}`,
    selectNone: 'Gắn nhãn...',
    selectLong: 'Thủ công: Video dài',
    selectShorts: 'Thủ công: Shorts',
    hintLikelyShorts: 'Khả năng cao là Shorts',
    hintLikelyLongForm: 'Khả năng cao là Video dài',
    confLowMedium: 'Thấp–Trung bình',
    confMediumHigh: 'Trung bình–Cao',
  },
  sparkline: {
    defaultInsufficient: 'Chưa đủ mốc dữ liệu',
    pointLabel: (idx) => `Mốc ${idx + 1}`,
    zeroPoints: '0 mốc',
    onePoint: '1 mốc',
  },
  modals: {
    createProjectTitle: 'Tạo dự án mới',
    projectNameLabel: 'Tên dự án / Kênh *',
    projectNamePlaceholder: 'Ví dụ: Kênh đánh giá công cụ AI',
    projectDescLabel: 'Mô tả định hướng kênh',
    projectDescPlaceholder: 'Mục tiêu chủ đề, nhóm khán giả, định dạng chính...',
    regionLabel: 'Thị trường',
    languageLabel: 'Ngôn ngữ',
    langViOption: 'vi — Tiếng Việt',
    langEnOption: 'en — Tiếng Anh',
    targetFormatLabel: 'Định dạng trọng tâm',
    formatAll: 'Tất cả',
    formatLong: 'Video dài',
    formatShorts: 'Shorts',
    createProjectSubmit: 'Tạo dự án & Chuyển sang dự án này',
    saveIdeaTitle: 'Lưu thành ý tưởng',
    ideaTitleLabel: 'Tiêu đề ý tưởng *',
    ideaNotesLabel: 'Ghi chú gốc (Kho chung)',
    ideaNotesPlaceholder: 'Điểm hay học được, bố cục mở đầu 30 giây đầu...',
    attachProjectLabel: 'Gắn vào dự án (không nhân bản bản gốc)',
    noProjectsHint: 'Chưa có dự án nào — sẽ lưu vào kho ý tưởng chung.',
    projectAngleLabel: 'Góc khai thác cho dự án đã chọn',
    projectAnglePlaceholder: 'Ví dụ: Phân tích tình huống thực tế cho khán giả Việt Nam',
    priorityLabel: 'Mức ưu tiên triển khai',
    priorityHigh: 'Cao (Ưu tiên làm trước)',
    priorityMedium: 'Trung bình',
    priorityLow: 'Thấp (Làm sau)',
    showInGlobalVault: 'Hiển thị trong kho ý tưởng chung',
    saveIdeaSubmit: 'Lưu ý tưởng',
    typeToConfirmPrefix: 'Nhập chính xác',
    typeToConfirmSuffix: 'để mở khóa nút xóa:',
    legalTitle: 'Chính sách quyền riêng tư & Điều khoản YouTube',
    legalIntroBeforeStrong: 'Research Studio sử dụng dịch vụ ',
    legalIntroStrong: 'YouTube',
    legalIntroAfterStrong: ' bằng API Key cá nhân của chính bạn để tra cứu dữ liệu công khai ngay trên máy tính cá nhân.',
    legalBullet1Before: 'Việc sử dụng tính năng YouTube đồng nghĩa bạn đồng ý tuân thủ ',
    legalTosLinkText: 'Điều khoản dịch vụ YouTube',
    legalBullet2Before: 'Xem thêm ',
    legalPrivacyLinkText: 'Chính sách quyền riêng tư của Google',
    legalBullet3BeforeStrong: 'Dữ liệu YouTube tải về được lưu cục bộ tối đa ',
    legalBullet3Strong: '30 ngày',
    legalBullet3AfterStrong: ', không gửi dữ liệu nghiên cứu ra bên ngoài.',
    legalAcceptBtn: 'Tôi đã đọc & Đồng ý',
    quickViewAria: 'Xem nhanh video',
    quickViewTitle: 'Xem nhanh video',
    quickViewClose: 'Đóng ×',
    quickViewMissing: 'Không còn dữ liệu video trong phiên hiện tại. Bạn có thể mở trang chi tiết từ danh sách nguồn.',
    quickViewPublished: 'Đăng',
    quickViewViews: (n) => `${n} lượt xem`,
    quickViewLikes: (n) => `${n} thích`,
    quickViewComments: (n) => `${n} bình luận`,
    quickViewDetailBtn: 'Chi tiết →',
  },
  statusViews: {
    stage2Badge: 'Giai đoạn 2 · Chưa mở khóa trong bản hiện tại',
    scopeLine: (scope) => `Phân khu: ${scope}`,
    stage2GoalTitle: 'Mục tiêu dự kiến ở Giai đoạn 2',
    stage2ReasonTitle: 'Lý do chưa kích hoạt ở phiên bản hiện tại',
    stage2FooterNote: 'Không hiển thị số liệu mẫu giả lập hay chỉ số ước lượng khi chưa đủ dữ liệu lịch sử.',
    offlineTitle: 'Không kết nối được dịch vụ dữ liệu cục bộ:',
    offlineDesc: 'Không thể đọc hoặc ghi dữ liệu mới. Hãy kiểm tra và thử kết nối lại.',
    retryBtn: 'Thử lại kết nối',
    legalBannerTitle: 'Chưa xác nhận Điều khoản YouTube & Chính sách quyền riêng tư:',
    legalBannerDesc: 'Vui lòng đọc và đồng ý trước khi lưu API Key hoặc tải dữ liệu từ YouTube.',
    legalBannerBtn: 'Xem & Xác nhận điều khoản',
    keyUnreadableTitle: 'Không đọc được YouTube API Key đã lưu:',
    keyUnreadableDesc: 'Có thể dữ liệu được chuyển từ tài khoản Windows khác. Hãy dán lại API Key mới trong Cài đặt.',
    keyUnreadableBtn: 'Mở Cài đặt API Key',
    keyMissingTitle: 'Chưa có YouTube API Key:',
    keyMissingDesc: 'Bạn vẫn quản lý Dự án, RSS và Ý tưởng bình thường. Thêm API Key trong Cài đặt để tra cứu YouTube.',
    keyMissingBtn: 'Thiết lập API Key',
    quotaSearchWarnTitle: (used, limit) => `Sắp hết lượt tìm kiếm YouTube (${used}/${limit} lượt/ngày):`,
    quotaSearchWarnDesc: (remaining, resetText) => `Còn ${remaining} lượt tìm mới trước mốc đặt lại ${resetText}.`,
    quotaDataWarnTitle: (used, limit) => `Sắp chạm hạn mức dữ liệu YouTube (${used}/${limit} đơn vị/ngày):`,
    quotaDataWarnDesc: (resetText) => `Hãy ưu tiên dữ liệu đã lưu hoặc đợi đặt lại lúc ${resetText}.`,
    quotaSearchExhaustedTitle: (used, limit) => `Đã hết lượt tìm kiếm YouTube hôm nay (${used}/${limit}):`,
    quotaSearchExhaustedDesc: (ptDate) => `Lượt tìm kiếm theo ngày (${ptDate}) đã đạt giới hạn. Các tính năng không tìm kiếm vẫn dùng bình thường.`,
    quotaDataExhaustedTitle: (used, limit) => `Đã hết hạn mức dữ liệu YouTube hôm nay (${used}/${limit}):`,
    quotaDataExhaustedDesc: 'Tạm dừng tải mới từ YouTube tới mốc đặt lại lúc 00:00 giờ PT.',
    defaultLoadingLabel: 'Đang tải dữ liệu...',
    stage2Info: {
      'global-featured-stage2': {
        title: 'Video nổi bật — Giai đoạn 2',
        scope: 'Nghiên cứu chung',
        goal: 'Khám phá tổng hợp các video nổi bật liên kênh dựa trên chuỗi biến động tăng trưởng và bộ chỉ số phân tích chuyên sâu.',
        reason: 'Chưa khả dụng ở bản hiện tại vì cần lịch sử theo dõi dài hơn 30 ngày và các chỉ số phân tích mở rộng ở Giai đoạn 2.',
        alternatives: [
          { label: 'Mở Khám phá xu hướng', screenId: 'global-trends' },
          { label: 'Mở Nghiên cứu tự do', screenId: 'global-search' },
        ],
      },
      'project-hot-topics-stage2': {
        title: 'Chủ đề nóng — Giai đoạn 2',
        scope: 'Nghiên cứu dự án',
        goal: 'Phát hiện cụm chủ đề bùng nổ theo tốc độ tăng trưởng đa kênh trong ngách của dự án.',
        reason: 'Chưa khả dụng ở bản hiện tại nhằm giữ trải nghiệm gọn nhẹ và tránh tạo các chỉ số tổng hợp ngoài phạm vi cho phép.',
        alternatives: [
          { label: 'Mở Video bứt phá', screenId: 'project-breakout' },
          { label: 'Mở Nghiên cứu từ khóa', screenId: 'project-keywords' },
        ],
      },
      'project-evergreen-stage2': {
        title: 'Chủ đề dài hạn — Giai đoạn 2',
        scope: 'Nghiên cứu dự án',
        goal: 'Theo dõi các chủ đề có nhu cầu ổn định nhiều quý dựa trên lịch sử nhiều tháng.',
        reason: 'Cần dữ liệu thống kê lưu trữ dài hạn vượt giới hạn 30 ngày của bản hiện tại, sẽ được bổ sung ở Giai đoạn 2.',
        alternatives: [
          { label: 'Mở Nghiên cứu từ khóa', screenId: 'project-keywords' },
          { label: 'Mở Quản lý ý tưởng', screenId: 'project-ideas' },
        ],
      },
      'project-opportunities-stage2': {
        title: 'Cơ hội nội dung — Giai đoạn 2',
        scope: 'Nghiên cứu dự án',
        goal: 'Chấm điểm cơ hội kết hợp từ khoảng trống chủ đề, hiệu suất đối thủ và nhu cầu tìm kiếm.',
        reason: 'Điểm cơ hội tổng hợp thuộc nhóm chỉ số phân tích nâng cao của Giai đoạn 2.',
        alternatives: [
          { label: 'Mở Video bứt phá', screenId: 'project-breakout' },
          { label: 'Mở Nghiên cứu từ khóa', screenId: 'project-keywords' },
        ],
      },
      'project-ai-stage2': {
        title: 'Nghiên cứu AI — Giai đoạn 2',
        scope: 'Nghiên cứu dự án',
        goal: 'Tóm tắt bình luận, gợi ý góc khai thác và soạn phác thảo bằng AI cục bộ hoặc đám mây tùy chọn.',
        reason: 'Phiên bản hiện tại tập trung hoàn thiện dữ liệu nghiên cứu gốc và quản lý ý tưởng ổn định trước khi tích hợp AI.',
        alternatives: [
          { label: 'Mở Quản lý ý tưởng', screenId: 'project-ideas' },
          { label: 'Mở Video bứt phá', screenId: 'project-breakout' },
        ],
      },
    },
  },
  settings: {
    title: 'Cài đặt',
    subtitle: 'Tùy chỉnh ngôn ngữ, giao diện, kết nối YouTube API Key, tự động cập nhật và điều khoản sử dụng.',
    loadingLabel: 'Đang tải cài đặt...',
    appearanceTitle: 'Giao diện & Ngôn ngữ',
    uiLanguageLabel: 'Ngôn ngữ giao diện',
    uiLanguageHint: 'Thay đổi tức thì trên toàn bộ khung giao diện.',
    themeModeLabel: 'Chế độ màu sắc',
    themeLightBtn: 'Giao diện sáng (Mặc định)',
    themeDarkBtn: 'Giao diện tối',
    apiKeyTitle: 'Kết nối YouTube API Key',
    keyConfiguredBadge: (masked) => `Đã lưu (${masked})`,
    keyUnreadableBadge: 'Không đọc được khóa cũ',
    keyMissingBadge: 'Chưa thiết lập API Key',
    needLegalBeforeKey: 'Vui lòng xác nhận Điều khoản YouTube & Quyền riêng tư ở mục bên dưới trước khi lưu API Key.',
    keyUnreadableWarning: 'API Key đã lưu trước đây không đọc được trên tài khoản Windows hiện tại. Hãy dán khóa mới hoặc xóa khóa cũ bên dưới.',
    apiKeyPlaceholder: 'Dán YouTube API Key mới...',
    saveApiKeyBtn: 'Lưu API Key',
    savingApiKeyBtn: 'Đang lưu...',
    removeApiKeyBtn: 'Xóa khóa',
    apiKeySecurityNote: 'API Key được mã hóa bảo mật ngay trên máy Windows của bạn và không bao giờ hiển thị lại nguyên bản.',
    refreshQuotaTitle: 'Tự động cập nhật & Giới hạn',
    allowAutoRefresh: 'Cho phép tự động cập nhật dữ liệu khi ứng dụng đang mở (không tốn lượt tìm kiếm)',
    defaultRegionLabel: 'Quốc gia mặc định',
    defaultSearchLangLabel: 'Ngôn ngữ tìm kiếm mặc định',
    warnThresholdLabel: 'Ngưỡng cảnh báo (%)',
    competitorIntervalLabel: 'Chu kỳ kênh đối thủ (giờ)',
    rssIntervalLabel: 'Chu kỳ nguồn RSS (giờ)',
    maxUnitsPerBatchLabel: 'Giới hạn mỗi đợt cập nhật',
    dailyAutoCapLabel: 'Giới hạn tự động mỗi ngày',
    savePrefsBtn: 'Lưu cài đặt',
    savingPrefsBtn: 'Đang lưu...',
    legalAndDataTitle: 'Điều khoản YouTube & Dữ liệu tạm',
    legalAcceptedBadge: (at) => `Đã xác nhận${at ? ` (${at})` : ''}`,
    legalNotAcceptedBadge: 'Chưa xác nhận',
    legalDescriptionPrefix: 'Research Studio hoạt động cục bộ trên máy tính cá nhân và không thu thập dữ liệu sử dụng. Việc dùng tính năng YouTube đồng nghĩa bạn tuân theo ',
    legalDescriptionAnd: ' và ',
    legalDescriptionSuffix: '. Dữ liệu tải từ YouTube được lưu tối đa 30 ngày.',
    openLegalModalBtn: 'Xem & Xác nhận điều khoản',
    purgeCacheBtn: 'Xóa dữ liệu YouTube tạm thời',
    purgingCacheBtn: 'Đang xóa...',
    purgeConfirmTitle: 'Xóa toàn bộ dữ liệu YouTube tạm thời?',
    purgeConfirmWarning: 'Thao tác sẽ xóa sạch dữ liệu video và kênh tải từ YouTube. Toàn bộ Dự án, Ý tưởng, Từ khóa, Nhãn thủ công và nguồn RSS do bạn tạo vẫn giữ nguyên 100%.',
    purgeConfirmBtn: 'Xác nhận xóa',
    storage: {
      sectionTitle: 'Lưu trữ & Sao lưu dữ liệu',
      loadingStatus: 'Đang kiểm tra thông tin lưu trữ...',
      loadFailed: 'Không tải được thông tin thư mục lưu trữ.',
      dataDirHeading: 'Thư mục dữ liệu chính',
      defaultBadge: 'Mặc định (Ổ C)',
      customBadge: 'Thư mục riêng',
      envLockedNote: 'Đang cố định đường dẫn theo cấu hình khởi chạy.',
      sizeLabel: (formattedSize) => `Dung lượng hiện tại: ${formattedSize}`,
      openFolderBtn: 'Mở thư mục',
      resetDefaultBtn: 'Về mặc định',
      newDataDirLabel: 'Đổi sang ổ đĩa hoặc thư mục khác (khuyên dùng ngoài ổ C)',
      newDataDirPlaceholder: 'Ví dụ: F:\\ResearchStudioData',
      browseBtn: 'Chọn...',
      applyDirBtn: 'Đổi thư mục',
      applyingDirBtn: 'Đang chuyển...',
      dirKeepOldNote: 'Dữ liệu ở thư mục trước luôn được giữ nguyên làm bản dự phòng, không tự xóa.',
      conflictTitle: (dir, projectsCount, ideasCount) =>
        `Thư mục "${dir}" đã có sẵn dữ liệu Research Studio (${projectsCount} dự án, ${ideasCount} ý tưởng). Bạn muốn xử lý thế nào?`,
      conflictUseExisting: 'Dùng dữ liệu có sẵn ở đó',
      conflictOverwrite: 'Chép đè dữ liệu hiện tại sang',
      backupHeading: 'Sao lưu dự phòng & Khôi phục',
      autoBackupToggle: 'Tự động sao lưu mỗi ngày khi mở ứng dụng (giữ 7 bản gần nhất, không kèm API Key)',
      externalDirLabel: 'Thư mục sao lưu ngoài (Google Drive, OneDrive hoặc ổ khác)',
      externalDirPlaceholder: 'Dán đường dẫn hoặc bấm Chọn... (không bắt buộc)',
      saveExternalBtn: 'Lưu thư mục',
      clearExternalBtn: 'Bỏ đặt',
      externalStatusOk: 'Đã kết nối thư mục sao lưu ngoài',
      externalStatusMissing: 'Chưa tìm thấy thư mục sao lưu ngoài đã cấu hình',
      backupNowBtn: 'Sao lưu ngay',
      backingUpBtn: 'Đang sao lưu...',
      pickRestoreFileBtn: 'Chọn tệp khôi phục...',
      lastBackupLabel: (when) => (when ? `Bản sao lưu gần nhất: ${when}` : 'Chưa có bản sao lưu người dùng nào.'),
      recentBackupsHeading: 'Các bản sao lưu gần đây',
      openBackupsFolderBtn: 'Mở kho sao lưu',
      noBackupsYet: 'Chưa có bản sao lưu nào. Bấm "Sao lưu ngay" để tạo bản an toàn đầu tiên.',
      locationLocal: 'Trên máy',
      locationExternal: 'Thư mục ngoài',
      locationBoth: 'Cả 2 nơi',
      kindManual: 'Thủ công',
      kindAuto: 'Tự động',
      kindPreRestore: 'Trước khôi phục',
      restoreBtn: 'Khôi phục',
      restoringBtn: 'Đang khôi phục...',
      restoreConfirmTitle: (name) => `Khôi phục dữ liệu từ "${name}"?`,
      restoreConfirmDesc:
        'Hệ thống sẽ tự động chụp lại dữ liệu hiện tại một bản trước khi nạp lại bản sao lưu. API Key đang lưu trên máy vẫn được giữ nguyên.',
      restoreConfirmBtn: 'Xác nhận khôi phục',
    },
  },
  toasts: {
    errorPrefix: 'Lỗi: ',
    successPrefix: 'Thành công: ',
    networkUnreachable: 'Không kết nối được dịch vụ dữ liệu cục bộ.',
    httpFailed: (status) => `Yêu cầu máy chủ thất bại (HTTP ${status}).`,
    themeSaveError: 'Không lưu được chủ đề giao diện.',
    prefsSaved: 'Đã lưu cài đặt hệ thống.',
    prefsSaveError: 'Không lưu được cài đặt hệ thống.',
    legalAccepted: 'Đã xác nhận đồng ý Điều khoản YouTube & Chính sách quyền riêng tư.',
    legalRevoked: 'Đã thu hồi trạng thái xác nhận điều khoản.',
    legalSaveError: 'Không lưu được xác nhận điều khoản.',
    apiKeySaved: (masked) => `Đã lưu bảo mật API Key (${masked}).`,
    apiKeySaveError: 'Không thể lưu YouTube API Key.',
    apiKeyRemoved: 'Đã xóa YouTube API Key. Dữ liệu nghiên cứu của bạn vẫn nguyên vẹn.',
    apiKeyRemoveError: 'Không thể xóa YouTube API Key.',
    loadIdeasError: 'Không thể tải danh sách ý tưởng.',
    cachePurged: (videosCount) => `Đã xóa ${videosCount} video YouTube tạm thời. Dữ liệu của bạn được giữ 100%.`,
    cachePurgeError: 'Không thể xóa dữ liệu YouTube tạm thời.',
    storageConfigSaved: 'Đã lưu cấu hình sao lưu dữ liệu.',
    storageConfigError: 'Không lưu được cấu hình sao lưu.',
    storageBackupCreated: (filename) => `Đã tạo bản sao lưu sạch: ${filename}`,
    storageBackupError: 'Không thể tạo bản sao lưu.',
    storageMigrated: (dir) => `Đã chuyển thư mục dữ liệu sang: ${dir}`,
    storageMigrateError: 'Không thể chuyển thư mục dữ liệu.',
    storageRestored: (filename) => `Đã khôi phục dữ liệu thành công từ ${filename}.`,
    storageRestoreError: 'Không thể khôi phục từ bản sao lưu này.',
    storageOpenFolderError: 'Không mở được thư mục trên máy.',
    storagePickError: 'Không mở được hộp thoại chọn đường dẫn.',
    projectCreated: (name) => `Đã tạo dự án mới: ${name}`,
    projectCreateError: 'Không thể tạo dự án mới.',
    projectUpdated: (name) => `Đã lưu cấu hình dự án "${name}".`,
    projectUpdateError: 'Không thể cập nhật cài đặt dự án.',
    projectFeedsError: 'Không thể lưu liên kết RSS cho dự án.',
    projectExported: (filename) => `Đã xuất tệp JSON: ${filename}`,
    projectExportError: 'Không thể xuất tệp JSON dự án.',
    projectDeleted: (name, backupFile) => `Đã xóa dự án "${name}" (đã sao lưu ${backupFile} và giữ toàn bộ dữ liệu dùng chung).`,
    projectDeleteError: 'Không thể xóa dự án.',
    manualFormatCleared: 'Đã xóa nhãn thủ công.',
    manualFormatSaved: (label) => `Đã lưu nhãn thủ công: ${label}`,
    manualFormatError: 'Không thể cập nhật nhãn định dạng thủ công.',
    rssAdded: (name) => `Đã thêm nguồn RSS "${name}".`,
    rssAddError: 'Không thể thêm nguồn RSS.',
    rssEnabled: (name) => `Đã bật lại nguồn "${name}".`,
    rssDisabled: (name) => `Đã tạm tắt nguồn "${name}".`,
    rssToggleError: 'Không thể thay đổi trạng thái nguồn RSS.',
    rssRefreshedOne: (name, count) => `Nguồn "${name}" đã nạp ${count} bài mới.`,
    rssFeedError: (name, detail) => `Nguồn "${name}" gặp lỗi: ${detail}`,
    rssRefreshOneError: 'Không thể làm mới nguồn RSS.',
    rssDeleted: 'Đã xóa nguồn RSS khỏi danh sách.',
    rssDeleteError: 'Không thể xóa nguồn RSS.',
    rssRefreshedPartial: (ok, total, errors) => `Đã làm mới ${ok}/${total} nguồn RSS (${errors} nguồn lỗi).`,
    rssRefreshedAll: (ok) => `Đã làm mới xong ${ok} nguồn RSS đang bật.`,
    rssRefreshAllError: 'Không thể làm mới danh sách nguồn RSS.',
    breakoutFlagged: 'Đã đánh dấu video bứt phá.',
    breakoutUnflagged: 'Đã bỏ đánh dấu video bứt phá.',
    breakoutError: 'Không thể cập nhật đánh dấu bứt phá.',
    noteSaved: 'Đã lưu ghi chú phân tích video.',
    noteSaveError: 'Không thể lưu ghi chú phân tích.',
    competitorReused: 'Đã gắn kênh đối thủ từ dữ liệu đã lưu.',
    competitorAdded: (count) => `Đã thêm kênh đối thủ và nạp ${count} video.`,
    competitorAddError: 'Không thể thêm kênh đối thủ vào dự án.',
    keywordSaved: (kw) => `Đã lưu từ khóa "${kw}" vào dự án.`,
    keywordSaveError: 'Không thể lưu từ khóa vào dự án.',
    ideaSaved: 'Đã lưu ý tưởng mới.',
    ideaSaveError: 'Không thể lưu ý tưởng.',
    ideaCoreUpdated: 'Đã cập nhật nội dung ý tưởng.',
    ideaCoreUpdateError: 'Không thể cập nhật nội dung ý tưởng.',
    ideaStatusUpdated: 'Đã cập nhật trạng thái ý tưởng.',
    ideaStatusUpdateError: 'Không thể cập nhật trạng thái ý tưởng.',
    ideaAngleSaved: 'Đã lưu góc khai thác cho dự án.',
    ideaAngleSaveError: 'Không thể lưu thay đổi cho dự án này.',
    ideaAttached: 'Đã gắn ý tưởng vào dự án.',
    ideaAttachError: 'Không thể gắn ý tưởng vào dự án.',
    ideaDetached: 'Đã gỡ ý tưởng khỏi dự án này.',
    ideaDetachError: 'Không thể gỡ ý tưởng khỏi dự án.',
    ideaDeleted: 'Đã xóa vĩnh viễn ý tưởng gốc.',
    ideaDeleteError: 'Không thể xóa ý tưởng.',
    projectFallbackMoved: 'Dự án trước đó không còn tồn tại; đã tự động chuyển sang dự án khả dụng.',
    projectFallbackGlobal: 'Dự án trước đó đã bị xóa; đã chuyển về Nghiên cứu chung.',
  },
  ideaStatusLabels: {
    new: 'Mới lưu',
    researching: 'Đang nghiên cứu',
    approved: 'Chốt làm',
    produced: 'Đã sản xuất',
    skipped: 'Bỏ qua',
  },
};

const EN: TranslationDict = {
  common: {
    loading: 'Loading...',
    loadingBadge: 'Loading',
    retry: 'Retry',
    refresh: 'Refresh',
    refreshing: 'Loading...',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    saving: 'Saving...',
    delete: 'Delete',
    openSettings: 'Open Settings',
    viewAll: 'View all',
    noneDash: '—',
    secondsAgoFallback: 'Unknown',
    projectWord: 'project',
  },
  sidebar: {
    mainNavAria: 'Main navigation',
    selectPlatformAria: 'Select social platform',
    platformTooltip: (name) => `Platform: ${name}`,
    platforms: {
      youtube: 'YouTube',
      tiktokSoon: 'TikTok — Coming soon',
      facebookSoon: 'Facebook — Coming soon',
      instagramSoon: 'Instagram — Coming soon',
      xSoon: 'X — Coming soon',
    },
    platformMenuAria: 'Social platforms list',
    platformComingSoonTag: 'Soon',
    areaAria: 'Select navigation area',
    overviewArea: 'Overview',
    overviewAreaTitle: 'Open Global Overview',
    projectArea: 'Projects',
    projectAreaTitle: 'Open Project Overview',
    globalSection: 'Global Research',
    projectSection: 'Project Research',
    selectProjectAria: 'Select active project',
    noProjectsOption: 'No projects yet',
    createProjectTitle: 'Create new project',
    stage2Tag: 'Phase 2',
    stage2Title: 'Scheduled for Phase 2',
    settingsLabel: 'Settings',
    settingsTitle: 'System Settings',
    expandSidebar: 'Expand sidebar',
    collapseSidebar: 'Collapse sidebar',
    globalMenu: {
      'global-overview': 'Overview',
      'global-trends': 'Trend Discovery',
      'global-search': 'Free Research',
      'global-featured-stage2': 'Featured Videos',
      'global-news': 'News & Discussions',
      'global-ideas': 'Shared Idea Vault',
    },
    projectMenu: {
      'project-overview': 'Project Overview',
      'project-hot-topics-stage2': 'Hot Topics',
      'project-keywords': 'Keyword Research',
      'project-breakout': 'Breakout Videos',
      'project-competitors': 'Competitors',
      'project-evergreen-stage2': 'Evergreen Topics',
      'project-opportunities-stage2': 'Content Opportunities',
      'project-ai-stage2': 'AI Research',
      'project-ideas': 'Idea Management',
      'project-settings': 'Project Settings',
    },
  },
  topbar: {
    brandHomeTitle: 'Go to Overview',
    platformYoutubeCrumb: 'YouTube',
    overviewAreaCrumb: 'Overview',
    projectAreaCrumb: 'Projects',
    backLabel: 'Back',
    backTitle: 'Go back',
    forwardLabel: 'Forward',
    forwardTitle: 'Go forward',
    breadcrumbAria: 'Breadcrumb',
    globalCrumb: 'Global Research',
    projectFallbackCrumb: 'Project',
    competitorsCrumb: 'Competitors',
    channelCrumb: 'Channel Detail',
    videoCrumb: 'Video Detail',
    rssCrumb: 'News & Discussions',
    ideasCrumb: 'Shared Idea Vault',
    ideaCrumb: 'Idea Detail',
    systemCrumb: 'System',
    stage2Badge: 'Phase 2',
    stage2BadgeTitle: 'Scheduled for Phase 2',
    screenTitles: {
      'global-overview': 'Overview',
      'global-trends': 'Trend Discovery',
      'global-search': 'Free Research',
      'global-featured-stage2': 'Featured Videos',
      'global-news': 'News & Discussions',
      'global-ideas': 'Shared Idea Vault',
      'project-overview': 'Project Overview',
      'project-hot-topics-stage2': 'Hot Topics',
      'project-keywords': 'Keyword Research',
      'project-breakout': 'Breakout Videos',
      'project-competitors': 'Competitors',
      'project-evergreen-stage2': 'Evergreen Topics',
      'project-opportunities-stage2': 'Content Opportunities',
      'project-ai-stage2': 'AI Research',
      'project-ideas': 'Idea Management',
      'project-settings': 'Project Settings',
      'channel-detail': 'Channel Detail',
      'video-detail': 'Video Detail',
      'article-detail': 'Article Detail',
      'idea-detail': 'Idea Detail',
      'system-settings': 'Settings',
    },
    alerts: {
      offline: 'Offline',
      apiKeyError: 'API Key Error',
      quotaExhausted: 'Quota Exhausted',
      quotaWarning: 'Low Quota',
    },
    quotaBtnLabel: 'Quota',
    quotaBtnTitle: 'View YouTube quota and connection status',
    quotaDialogAria: 'Quota and status',
    quotaTitle: "Today's YouTube Quota",
    resetHint: 'Resets 00:00 PT',
    resetHintTitle: 'Quota resets at 00:00 Pacific Time',
    quotaSearch: 'Search',
    quotaData: 'Data',
    localConnection: 'Local service',
    statusChecking: 'Checking',
    statusActive: 'Connected',
    statusOffline: 'Disconnected',
    apiKeyLabel: 'YouTube API Key',
    apiKeyConfigured: (masked) => `Configured (${masked})`,
    apiKeyError: 'Unreadable key',
    apiKeyMissing: 'Not set',
    youtubeTermsLabel: 'YouTube Terms',
    termsAccepted: 'Accepted',
    termsNotAccepted: 'Not accepted',
    acceptTermsBtn: 'Review Terms',
    languageLabel: 'Language',
    languageAria: 'Select interface language',
    switchToDark: 'Switch to Dark Mode',
    switchToLight: 'Switch to Light Mode',
    settingsBtn: 'Settings',
    windowMinimize: 'Minimize',
    windowMaximize: 'Maximize',
    windowRestore: 'Restore',
    windowClose: 'Close',
  },
  overview: {
    title: 'Overview',
    createProjectBtn: '+ New Project',
    offlineError: 'Unable to reach the local data service.',
    keyUnreadableError: 'Unable to read the saved YouTube API Key.',
    updateKeyBtn: 'Update Key',
    quotaExhaustedNotice: 'Daily YouTube quota is exhausted (resets at 00:00 PT). Saved research data and RSS remain available.',
    viewSettingsBtn: 'View Settings',
    statProjects: 'Projects',
    statOpenProject: 'Open →',
    statNoProjects: 'No projects yet',
    statActiveProject: (name) => `Active: ${name}`,
    statProjectCount: (n) => `${n} projects`,
    statIdeas: 'Ideas',
    statOpenVault: 'Open vault →',
    statUnlinkedIdeas: (n) => `${n} not linked to a project`,
    statInIdeaVault: 'In idea vault',
    statNews: 'Recent News',
    statViewNews: 'View news →',
    statSourcesWithErrors: (enabled, errors) => `${enabled} active sources · ${errors} errors`,
    statSourcesFollowing: (enabled) => `${enabled} active sources`,
    recentIdeasTitle: 'Recent Ideas',
    noIdeasYet: 'No ideas saved yet.',
    addIdeaBtn: 'Add Idea',
    sharedVaultLabel: 'Shared vault',
    linkedProjectsCount: (n) => `${n} projects`,
    latestNewsTitle: 'Latest News',
    noNewsYet: 'No RSS articles fetched yet.',
    addFeedBtn: 'Add RSS Feed',
    rssSourcePrefix: 'RSS Source',
    shortcutsTitle: 'Shortcuts',
    shortcuts: {
      trends: { title: 'Trends', desc: 'Trending videos by country' },
      search: { title: 'Research', desc: 'Search YouTube videos and channels' },
      news: { title: 'News', desc: 'Follow public RSS feeds' },
      ideas: { title: 'Ideas', desc: 'Shared content idea vault' },
    },
  },
  trends: {
    title: 'Trend Discovery',
    sourceLabel: 'Source: YouTube',
    updatedPrefix: 'Updated',
    notLoadedYet: 'Not loaded yet',
    youtubeTrendingLink: 'YouTube Trending ↗',
    loadBtn: 'Load Trends',
    refreshBtn: 'Refresh Trends',
    offlineReason: 'Local data service is unreachable.',
    termsReason: 'Accept YouTube Terms before fetching new data.',
    keyUnreadableReason: 'Saved YouTube API Key cannot be read.',
    keyMissingReason: 'Add your YouTube API Key in Settings first.',
    quotaExhaustedReason: 'Daily YouTube data quota has been reached.',
    loadFailedError: 'Unable to load saved trend data.',
    fetchFailedToast: 'Unable to fetch trending videos from YouTube.',
    loadedToast: (count, region) => `Updated ${count} trending videos (${region}).`,
    cancelledToast: 'Cancelled trend refresh.',
    offlineBanner: 'Unable to connect to the local data service.',
    keyUnreadableBanner: 'Saved YouTube API Key could not be decrypted.',
    updateKeyBtn: 'Update API Key',
    quotaExhaustedBanner: 'Daily YouTube data quota reached (resets at 00:00 PT). You can still browse saved videos.',
    quotaWarningBanner: (used, limit) => `Approaching daily YouTube data quota (${used}/${limit}).`,
    needTermsNotice: 'Accept YouTube Terms to refresh the list.',
    needKeyNotice: 'Configure a YouTube API Key to refresh the list.',
    acceptTermsBtn: 'Accept Terms',
    countryLabel: 'Country',
    categoryLabel: 'Category',
    videoCount: (n) => `${n} videos`,
    loadingLabel: 'Loading trending videos...',
    setupTitle: 'YouTube Connection Not Set Up',
    setupNeedTermsDesc: 'Accept YouTube Terms and save your personal API Key in Settings to load trending videos.',
    setupNeedKeyDesc: 'Add your personal YouTube API Key in Settings to load trending videos.',
    setupKeyBtn: 'Configure API Key',
    emptyTitle: 'No trending data for this selection yet',
    emptyDesc: (region) => `Click "Load Trends" to fetch current trending videos for ${region}.`,
    noMatchTitle: 'No matching videos found',
    noMatchDesc: 'Try changing your search query or resetting filters.',
    regions: [
      { code: 'VN', label: 'VN — Vietnam' },
      { code: 'US', label: 'US — United States' },
      { code: 'JP', label: 'JP — Japan' },
      { code: 'KR', label: 'KR — South Korea' },
      { code: 'GB', label: 'GB — United Kingdom' },
      { code: 'DE', label: 'DE — Germany' },
    ],
    categories: {
      all: 'All Categories',
      '28': 'Science & Technology',
      '27': 'Education',
      '20': 'Gaming',
      '24': 'Entertainment',
      '25': 'News & Politics',
      '22': 'People & Blogs',
      '26': 'Howto & Style',
    },
  },
  videoTable: {
    searchAria: 'Filter by video title or channel name',
    searchPlaceholder: 'Search by title or channel...',
    channelFilterAria: 'Filter by channel',
    allChannels: (n) => `All channels (${n})`,
    dateFilterAria: 'Published window',
    dateLast3d: 'Published ≤ 3 days',
    dateLast7d: 'Published ≤ 7 days',
    dateLast14d: 'Published ≤ 14 days',
    dateLast30d: 'Published ≤ 30 days',
    dateAllSaved: 'All saved dates',
    minViewsAria: 'Minimum views',
    minViewsPlaceholder: 'Min views...',
    sortAria: 'Sort videos',
    sortViewsDesc: 'Views: High to low',
    sortViewsAsc: 'Views: Low to high',
    sortLikesDesc: 'Likes: Most',
    sortCommentsDesc: 'Comments: Most',
    sortPublishedDesc: 'Newest first',
    sortDurationDesc: 'Longest duration',
    onlyBreakoutLabel: 'Breakout videos only',
    formatGroupAria: 'Filter by video format',
    formatAll: (n) => `All (${n})`,
    formatLong: (n) => `Long-form (${n})`,
    formatShorts: (n) => `Shorts (${n})`,
    formatUnknown: (n) => `Unclassified (${n})`,
    formatUnknownTitle: 'Videos ≤ 3 min without definitive source classification from YouTube',
    includeManualLabel: 'Include manual labels',
    includeManualTitle: 'Include videos you manually labeled in Long-form / Shorts filters',
    resetFilters: 'Reset filters',
    emptyDefaultTitle: 'No videos match current filters',
    emptyDefaultDesc: 'Try resetting filters or refreshing the source to load recent videos.',
    colVideo: 'Video',
    colFormat: 'Format',
    colViews: 'Views',
    colLikes: 'Likes',
    colComments: 'Comments',
    colHistory: 'View History',
    colActions: 'Actions',
    breakoutFlagged: '★ Breakout',
    breakoutUnflagged: '☆ Breakout',
    breakoutFlagTitle: 'Remove breakout flag',
    breakoutUnflagTitle: 'Mark as breakout video',
    addIdeaBtn: '+ Idea',
    quickViewBtn: 'Quick View',
    addCompetitorBtn: '+ Track Channel',
    historyBadge: (n) => `${n} points`,
    historyTitle: 'View History',
    historyDetail: 'Raw view counts across recent collection timestamps.',
    historyInsufficient: '1 snapshot',
    paginationRange: (start, end, total) => `${start}–${end} of ${total} videos`,
    prevPage: 'Previous',
    nextPage: 'Next',
    pageStatus: (page, totalPages) => `Page ${page} / ${totalPages}`,
  },
  formatBadge: {
    longForm: 'Long-form',
    shorts: 'Shorts',
    unknown: 'Unclassified',
    sourceTitle: 'Verified directly from YouTube source data',
    unknownTitle: 'Short video ≤ 3 min without definitive YouTube classification',
    hintPrefix: 'Hint',
    confidenceLabel: 'Confidence',
    basisLabel: 'Basis',
    manualPrefix: 'Manual',
    manualTitle: 'Your manual label — stored separately from YouTube source data',
    manualAria: (title) => `Manual format label for ${title}`,
    selectNone: 'Set label...',
    selectLong: 'Manual: Long-form',
    selectShorts: 'Manual: Shorts',
    hintLikelyShorts: 'Likely Shorts',
    hintLikelyLongForm: 'Likely Long-form',
    confLowMedium: 'Low–Medium',
    confMediumHigh: 'Medium–High',
  },
  sparkline: {
    defaultInsufficient: 'Not enough snapshots',
    pointLabel: (idx) => `Point ${idx + 1}`,
    zeroPoints: '0 points',
    onePoint: '1 point',
  },
  modals: {
    createProjectTitle: 'Create New Project',
    projectNameLabel: 'Project / Channel Name *',
    projectNamePlaceholder: 'Example: AI Tools Review Channel',
    projectDescLabel: 'Channel Direction Notes',
    projectDescPlaceholder: 'Topic focus, target audience, primary formats...',
    regionLabel: 'Region',
    languageLabel: 'Language',
    langViOption: 'vi — Vietnamese',
    langEnOption: 'en — English',
    targetFormatLabel: 'Primary Format',
    formatAll: 'All',
    formatLong: 'Long-form',
    formatShorts: 'Shorts',
    createProjectSubmit: 'Create & Switch to Project',
    saveIdeaTitle: 'Save Idea',
    ideaTitleLabel: 'Idea Title *',
    ideaNotesLabel: 'Core Notes (Shared Vault)',
    ideaNotesPlaceholder: 'Key takeaways, opening hook structure...',
    attachProjectLabel: 'Link to Projects (without duplicating the core idea)',
    noProjectsHint: 'No projects yet — will be saved in Shared Idea Vault.',
    projectAngleLabel: 'Angle for selected project(s)',
    projectAnglePlaceholder: 'Example: Case study breakdown for target audience',
    priorityLabel: 'Priority',
    priorityHigh: 'High',
    priorityMedium: 'Medium',
    priorityLow: 'Low',
    showInGlobalVault: 'Keep visible in Shared Idea Vault',
    saveIdeaSubmit: 'Save Idea',
    typeToConfirmPrefix: 'Type',
    typeToConfirmSuffix: 'to confirm deletion:',
    legalTitle: 'YouTube Terms of Service & Privacy Policy',
    legalIntroBeforeStrong: 'Research Studio uses ',
    legalIntroStrong: 'YouTube',
    legalIntroAfterStrong: ' API Services with your personal API Key locally on your PC to look up public data.',
    legalBullet1Before: 'By using YouTube features, you agree to be bound by the ',
    legalTosLinkText: 'YouTube Terms of Service',
    legalBullet2Before: 'See also ',
    legalPrivacyLinkText: 'Google Privacy Policy',
    legalBullet3BeforeStrong: 'Fetched YouTube data is stored locally for up to ',
    legalBullet3Strong: '30 days',
    legalBullet3AfterStrong: ', with zero telemetry or third-party cloud uploads.',
    legalAcceptBtn: 'I Have Read & Agree',
    quickViewAria: 'Quick view video',
    quickViewTitle: 'Quick View',
    quickViewClose: 'Close ×',
    quickViewMissing: 'Video data is no longer in the current session. Open the full detail page from the list.',
    quickViewPublished: 'Published',
    quickViewViews: (n) => `${n} views`,
    quickViewLikes: (n) => `${n} likes`,
    quickViewComments: (n) => `${n} comments`,
    quickViewDetailBtn: 'Full Detail →',
  },
  statusViews: {
    stage2Badge: 'Phase 2 · Not unlocked in current release',
    scopeLine: (scope) => `Scope: ${scope}`,
    stage2GoalTitle: 'Planned for Phase 2',
    stage2ReasonTitle: 'Why it is deferred',
    stage2FooterNote: 'No simulated numbers or placeholder charts are shown before historical tracking is supported.',
    offlineTitle: 'Local data service disconnected:',
    offlineDesc: 'Unable to read or save data right now. Check the local service and retry.',
    retryBtn: 'Retry Connection',
    legalBannerTitle: 'YouTube Terms & Privacy Policy not accepted:',
    legalBannerDesc: 'Please review and accept before saving an API Key or calling YouTube.',
    legalBannerBtn: 'Review & Accept Terms',
    keyUnreadableTitle: 'Saved YouTube API Key cannot be read:',
    keyUnreadableDesc: 'Data may have been moved from another Windows user account. Save a new API Key in Settings.',
    keyUnreadableBtn: 'Open API Key Settings',
    keyMissingTitle: 'No YouTube API Key configured:',
    keyMissingDesc: 'Projects, RSS, and Ideas work independently. Add an API Key in Settings to query YouTube.',
    keyMissingBtn: 'Configure API Key',
    quotaSearchWarnTitle: (used, limit) => `Approaching daily YouTube search limit (${used}/${limit}):`,
    quotaSearchWarnDesc: (remaining, resetText) => `${remaining} searches remaining before reset at ${resetText}.`,
    quotaDataWarnTitle: (used, limit) => `Approaching daily YouTube data limit (${used}/${limit}):`,
    quotaDataWarnDesc: (resetText) => `Prefer cached data or wait until reset at ${resetText}.`,
    quotaSearchExhaustedTitle: (used, limit) => `Daily YouTube search limit reached (${used}/${limit}):`,
    quotaSearchExhaustedDesc: (ptDate) => `Search queries for ${ptDate} reached the cap. Non-search features remain available.`,
    quotaDataExhaustedTitle: (used, limit) => `Daily YouTube data limit reached (${used}/${limit}):`,
    quotaDataExhaustedDesc: 'New YouTube data fetches are paused until 00:00 PT.',
    defaultLoadingLabel: 'Loading data...',
    stage2Info: {
      'global-featured-stage2': {
        title: 'Featured Videos — Phase 2',
        scope: 'Global Research',
        goal: 'Discover cross-channel standout videos based on multi-week growth trends and advanced signals.',
        reason: 'Deferred to Phase 2 because it requires > 30 days of historical snapshots and extended analytics.',
        alternatives: [
          { label: 'Open Trend Discovery', screenId: 'global-trends' },
          { label: 'Open Free Research', screenId: 'global-search' },
        ],
      },
      'project-hot-topics-stage2': {
        title: 'Hot Topics — Phase 2',
        scope: 'Project Research',
        goal: 'Detect fast-rising topic clusters across channels within your project niche.',
        reason: 'Deferred to Phase 2 to keep the current release lightweight and free of derived aggregation metrics.',
        alternatives: [
          { label: 'Open Breakout Videos', screenId: 'project-breakout' },
          { label: 'Open Keyword Research', screenId: 'project-keywords' },
        ],
      },
      'project-evergreen-stage2': {
        title: 'Evergreen Topics — Phase 2',
        scope: 'Project Research',
        goal: 'Track topics with steady long-term demand over multiple months.',
        reason: 'Requires multi-month historical data beyond the 30-day retention window of the current release.',
        alternatives: [
          { label: 'Open Keyword Research', screenId: 'project-keywords' },
          { label: 'Open Idea Management', screenId: 'project-ideas' },
        ],
      },
      'project-opportunities-stage2': {
        title: 'Content Opportunities — Phase 2',
        scope: 'Project Research',
        goal: 'Score content gaps combining competitor medians, outlier multipliers, and search demand.',
        reason: 'Opportunity scoring relies on derived metrics scheduled for Phase 2.',
        alternatives: [
          { label: 'Open Breakout Videos', screenId: 'project-breakout' },
          { label: 'Open Keyword Research', screenId: 'project-keywords' },
        ],
      },
      'project-ai-stage2': {
        title: 'AI Research — Phase 2',
        scope: 'Project Research',
        goal: 'Summarize comments, propose angles, and draft outlines using optional local or cloud AI models.',
        reason: 'The current release focuses on deterministic research workflows before adding optional AI integration.',
        alternatives: [
          { label: 'Open Idea Management', screenId: 'project-ideas' },
          { label: 'Open Breakout Videos', screenId: 'project-breakout' },
        ],
      },
    },
  },
  settings: {
    title: 'Settings',
    subtitle: 'Manage interface language, appearance, YouTube API Key, background refresh, and usage terms.',
    loadingLabel: 'Loading settings...',
    appearanceTitle: 'Appearance & Language',
    uiLanguageLabel: 'Interface Language',
    uiLanguageHint: 'Switches immediately across the workspace.',
    themeModeLabel: 'Color Theme',
    themeLightBtn: 'Light Mode (Default)',
    themeDarkBtn: 'Dark Mode',
    apiKeyTitle: 'YouTube API Key',
    keyConfiguredBadge: (masked) => `Saved (${masked})`,
    keyUnreadableBadge: 'Unreadable key',
    keyMissingBadge: 'Not configured',
    needLegalBeforeKey: 'Please accept the YouTube Terms & Privacy Policy below before saving an API Key.',
    keyUnreadableWarning: 'Your previously saved API Key cannot be read on this Windows account. Paste a new key or remove the old one below.',
    apiKeyPlaceholder: 'Paste your YouTube API Key...',
    saveApiKeyBtn: 'Save API Key',
    savingApiKeyBtn: 'Saving...',
    removeApiKeyBtn: 'Remove Key',
    apiKeySecurityNote: 'Your API Key is encrypted locally on Windows and is never sent back to the browser in plain text.',
    refreshQuotaTitle: 'Auto Refresh & Limits',
    allowAutoRefresh: 'Allow controlled auto-refresh while app is open (uses 0 search quota)',
    defaultRegionLabel: 'Default Country',
    defaultSearchLangLabel: 'Default Search Language',
    warnThresholdLabel: 'Warning Threshold (%)',
    competitorIntervalLabel: 'Competitor Refresh (hours)',
    rssIntervalLabel: 'RSS Refresh (hours)',
    maxUnitsPerBatchLabel: 'Max Batch Size',
    dailyAutoCapLabel: 'Daily Auto Cap',
    savePrefsBtn: 'Save Settings',
    savingPrefsBtn: 'Saving...',
    legalAndDataTitle: 'YouTube Terms & Temporary Data',
    legalAcceptedBadge: (at) => `Accepted${at ? ` (${at})` : ''}`,
    legalNotAcceptedBadge: 'Not accepted',
    legalDescriptionPrefix: 'Research Studio runs locally on your PC with zero telemetry. Using YouTube features means agreeing to the ',
    legalDescriptionAnd: ' and ',
    legalDescriptionSuffix: '. Fetched YouTube data is kept locally for up to 30 days.',
    openLegalModalBtn: 'Review & Accept Terms',
    purgeCacheBtn: 'Clear Cached YouTube Data',
    purgingCacheBtn: 'Clearing...',
    purgeConfirmTitle: 'Clear all temporary YouTube data?',
    purgeConfirmWarning: 'This deletes all cached YouTube video and channel metadata. Your Projects, Ideas, Keywords, Manual Labels, and RSS feeds remain 100% intact.',
    purgeConfirmBtn: 'Confirm Clear',
    storage: {
      sectionTitle: 'Data Storage & Backup',
      loadingStatus: 'Checking storage details...',
      loadFailed: 'Unable to load storage details.',
      dataDirHeading: 'Primary Data Folder',
      defaultBadge: 'Default Location',
      customBadge: 'Custom Folder',
      envLockedNote: 'Locked by launch environment configuration.',
      sizeLabel: (formattedSize) => `Current size: ${formattedSize}`,
      openFolderBtn: 'Open Folder',
      resetDefaultBtn: 'Reset to Default',
      newDataDirLabel: 'Move to another drive or folder',
      newDataDirPlaceholder: 'Example: D:\\ResearchStudioData',
      browseBtn: 'Browse...',
      applyDirBtn: 'Apply Folder',
      applyingDirBtn: 'Moving...',
      dirKeepOldNote: 'Your previous folder stays untouched on disk as an extra safety copy.',
      conflictTitle: (dir, projectsCount, ideasCount) =>
        `"${dir}" already contains Research Studio data (${projectsCount} projects, ${ideasCount} ideas). How would you like to proceed?`,
      conflictUseExisting: 'Use Existing Data There',
      conflictOverwrite: 'Copy Current Data Over It',
      backupHeading: 'Backups & Restore',
      autoBackupToggle: 'Back up automatically once per day on startup (keeps latest 7, excludes API Key)',
      externalDirLabel: 'External Backup Folder (Google Drive, OneDrive, or another drive)',
      externalDirPlaceholder: 'Paste path or click Browse... (optional)',
      saveExternalBtn: 'Save Folder',
      clearExternalBtn: 'Clear',
      externalStatusOk: 'External backup folder ready',
      externalStatusMissing: 'Configured external backup folder is currently unreachable',
      backupNowBtn: 'Back Up Now',
      backingUpBtn: 'Backing up...',
      pickRestoreFileBtn: 'Choose Backup File...',
      lastBackupLabel: (when) => (when ? `Latest backup: ${when}` : 'No user backups created yet.'),
      recentBackupsHeading: 'Recent Backups',
      openBackupsFolderBtn: 'Open Backups Folder',
      noBackupsYet: 'No backups yet. Click "Back Up Now" to create your first safe copy.',
      locationLocal: 'Local',
      locationExternal: 'External',
      locationBoth: 'Both',
      kindManual: 'Manual',
      kindAuto: 'Auto',
      kindPreRestore: 'Pre-restore',
      restoreBtn: 'Restore',
      restoringBtn: 'Restoring...',
      restoreConfirmTitle: (name) => `Restore workspace data from "${name}"?`,
      restoreConfirmDesc:
        'A safety backup of your current workspace will be created automatically before restoring, and your saved API Key on this PC stays intact.',
      restoreConfirmBtn: 'Confirm Restore',
    },
  },
  toasts: {
    errorPrefix: 'Error: ',
    successPrefix: 'Success: ',
    networkUnreachable: 'Unable to connect to the local data service.',
    httpFailed: (status) => `Server request failed (HTTP ${status}).`,
    themeSaveError: 'Failed to save theme preference.',
    prefsSaved: 'System settings saved.',
    prefsSaveError: 'Failed to save system settings.',
    legalAccepted: 'YouTube Terms & Privacy Policy accepted.',
    legalRevoked: 'Legal consent revoked.',
    legalSaveError: 'Failed to save legal consent.',
    apiKeySaved: (masked) => `API Key saved securely (${masked}).`,
    apiKeySaveError: 'Unable to save YouTube API Key.',
    apiKeyRemoved: 'YouTube API Key removed. All research data remains intact.',
    apiKeyRemoveError: 'Unable to remove YouTube API Key.',
    loadIdeasError: 'Unable to load ideas.',
    cachePurged: (videosCount) => `Cleared ${videosCount} cached YouTube videos. Your own data remains 100% safe.`,
    cachePurgeError: 'Unable to clear temporary YouTube data.',
    storageConfigSaved: 'Backup settings saved.',
    storageConfigError: 'Unable to save backup settings.',
    storageBackupCreated: (filename) => `Created clean backup: ${filename}`,
    storageBackupError: 'Unable to create backup.',
    storageMigrated: (dir) => `Switched active data folder to: ${dir}`,
    storageMigrateError: 'Unable to switch data folder.',
    storageRestored: (filename) => `Restored workspace data from ${filename}.`,
    storageRestoreError: 'Unable to restore from this backup.',
    storageOpenFolderError: 'Unable to open folder.',
    storagePickError: 'Unable to open file or folder dialog.',
    projectCreated: (name) => `Created project: ${name}`,
    projectCreateError: 'Unable to create project.',
    projectUpdated: (name) => `Saved settings for "${name}".`,
    projectUpdateError: 'Unable to update project settings.',
    projectFeedsError: 'Unable to save RSS links for this project.',
    projectExported: (filename) => `Exported JSON file: ${filename}`,
    projectExportError: 'Unable to export project JSON.',
    projectDeleted: (name, backupFile) => `Deleted project "${name}" (backup saved as ${backupFile}; shared data preserved).`,
    projectDeleteError: 'Unable to delete project.',
    manualFormatCleared: 'Manual format label removed.',
    manualFormatSaved: (label) => `Saved manual label: ${label}`,
    manualFormatError: 'Unable to update manual format label.',
    rssAdded: (name) => `Added RSS feed "${name}".`,
    rssAddError: 'Unable to add RSS feed.',
    rssEnabled: (name) => `Enabled feed "${name}".`,
    rssDisabled: (name) => `Paused feed "${name}".`,
    rssToggleError: 'Unable to toggle RSS feed.',
    rssRefreshedOne: (name, count) => `Feed "${name}" fetched ${count} new items.`,
    rssFeedError: (name, detail) => `Feed "${name}" error: ${detail}`,
    rssRefreshOneError: 'Unable to refresh RSS feed.',
    rssDeleted: 'Removed RSS feed.',
    rssDeleteError: 'Unable to remove RSS feed.',
    rssRefreshedPartial: (ok, total, errors) => `Refreshed ${ok}/${total} feeds (${errors} failed).`,
    rssRefreshedAll: (ok) => `Refreshed ${ok} active RSS feeds.`,
    rssRefreshAllError: 'Unable to refresh RSS feeds.',
    breakoutFlagged: 'Marked video as breakout.',
    breakoutUnflagged: 'Removed breakout mark.',
    breakoutError: 'Unable to update breakout mark.',
    noteSaved: 'Saved video analysis notes.',
    noteSaveError: 'Unable to save analysis notes.',
    competitorReused: 'Linked competitor channel from local cache.',
    competitorAdded: (count) => `Added competitor channel and loaded ${count} videos.`,
    competitorAddError: 'Unable to add competitor channel.',
    keywordSaved: (kw) => `Saved keyword "${kw}" to project.`,
    keywordSaveError: 'Unable to save keyword.',
    ideaSaved: 'Idea saved.',
    ideaSaveError: 'Unable to save idea.',
    ideaCoreUpdated: 'Idea updated.',
    ideaCoreUpdateError: 'Unable to update idea.',
    ideaStatusUpdated: 'Updated idea status.',
    ideaStatusUpdateError: 'Unable to update idea status.',
    ideaAngleSaved: 'Saved project angle.',
    ideaAngleSaveError: 'Unable to save project angle.',
    ideaAttached: 'Linked idea to project.',
    ideaAttachError: 'Unable to link idea to project.',
    ideaDetached: 'Unlinked idea from project.',
    ideaDetachError: 'Unable to unlink idea from project.',
    ideaDeleted: 'Deleted idea permanently.',
    ideaDeleteError: 'Unable to delete idea.',
    projectFallbackMoved: 'Previous project no longer exists; switched to an available project.',
    projectFallbackGlobal: 'Previous project was deleted; returned safely to Global Research.',
  },
  ideaStatusLabels: {
    new: 'New',
    researching: 'Researching',
    approved: 'Approved',
    produced: 'Produced',
    skipped: 'Skipped',
  },
};

export const TRANSLATIONS: Record<UiLanguage, TranslationDict> = {
  vi: VI,
  en: EN,
};

export function getTranslations(lang: UiLanguage = getActiveUiLanguage()): TranslationDict {
  return TRANSLATIONS[lang];
}
