import { getActiveLocale, getTranslations } from '../i18n/translations';
import type { IdeaDto, RssFeedDto, YoutubeVideoDto } from './types';
import type { IdeaItem, ManualFormatLabel, ProjectIdeaLink, RssFeedItem, VideoItem } from '../prototype/types';

export function formatDurationSeconds(seconds: number | null, isLive = false): string {
  if (isLive) return 'LIVE';
  if (seconds === null || Number.isNaN(seconds) || seconds < 0) return '—';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${mins}:${pad(secs)}`;
}

export function formatDateTimeVi(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const ms = Date.parse(isoString);
  if (Number.isNaN(ms)) return isoString;
  return new Date(ms).toLocaleString(getActiveLocale());
}

function computeDaysAgo(publishedAt: string | null): number {
  if (!publishedAt) return 999;
  const ms = Date.parse(publishedAt);
  if (Number.isNaN(ms)) return 999;
  const diff = (Date.now() - ms) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.round(diff * 10) / 10);
}

function translateHint(rawHint: string | null): string | null {
  if (!rawHint) return null;
  if (rawHint === 'likely_shorts') return getTranslations().formatBadge.hintLikelyShorts;
  if (rawHint === 'likely_long_form') return getTranslations().formatBadge.hintLikelyLongForm;
  return rawHint;
}

function translateHintConfidence(rawConfidence: string | null): string | null {
  if (!rawConfidence) return null;
  if (rawConfidence === 'medium_high') return getTranslations().formatBadge.confMediumHigh;
  if (rawConfidence === 'low_medium') return getTranslations().formatBadge.confLowMedium;
  return getTranslations().formatBadge.confLowMedium;
}

export function mapYoutubeVideoDtoToItem(dto: YoutubeVideoDto): VideoItem {
  const manual: ManualFormatLabel = dto.manualFormat ?? 'none';
  return {
    id: dto.videoId,
    channelId: dto.channelId ?? '',
    channelTitle: dto.channelTitle ?? (dto.hasValidApiData ? 'Kênh chưa rõ' : 'Metadata API đã hết hạn'),
    title: dto.title ?? `Video ${dto.videoId} (Dữ liệu API đã hết hạn 30 ngày)`,
    thumbnailUrl: dto.thumbnailUrl,
    hasValidApiData: dto.hasValidApiData,
    publishedAt: formatDateTimeVi(dto.publishedAt),
    daysAgo: computeDaysAgo(dto.publishedAt),
    durationSeconds: dto.durationSeconds ?? 0,
    durationDisplay: formatDurationSeconds(dto.durationSeconds, dto.isLiveStreaming),
    viewCount: dto.viewCount,
    likeCount: dto.likeCount,
    commentCount: dto.commentCount,
    sourceFormatStatus: dto.sourceFormatStatus,
    formatHint: translateHint(dto.formatHint),
    formatHintConfidence: translateHintConfidence(dto.formatHintConfidence),
    formatHintBasis: dto.formatHintBasis,
    defaultManualFormat: manual,
    tags: dto.tags,
    snapshots30d: dto.snapshots30d.map((snap) => ({
      capturedAt: formatDateTimeVi(snap.capturedAt),
      shortLabel: snap.capturedAt.slice(5, 10),
      viewCount: snap.viewCount ?? 0,
    })),
    projectIds: [],
    isUserBreakout: dto.isUserBreakout,
    breakoutNotes: dto.breakoutNotes,
    apiFetchedAt: formatDateTimeVi(dto.apiFetchedAt),
    apiExpiresAt: formatDateTimeVi(dto.apiExpiresAt),
  };
}

export function mapRssFeedDtoToItem(dto: RssFeedDto): RssFeedItem {
  return {
    id: dto.id,
    name: dto.name,
    url: dto.url,
    groupTag: dto.groupTag || 'Chung',
    enabled: dto.enabled,
    status: dto.lastStatus === 'error' ? 'error' : 'ok',
    lastFetchedAt: formatDateTimeVi(dto.lastFetchedAt),
    errorCode: dto.lastErrorCode ?? undefined,
    errorMessage: dto.lastErrorMessage ?? undefined,
  };
}

export function mapIdeaDtoToItem(dto: IdeaDto): IdeaItem {
  const projectLinks: Record<string, ProjectIdeaLink> = {};
  for (const [pid, link] of Object.entries(dto.projectLinks)) {
    projectLinks[pid] = {
      status: link.status,
      priority: link.priority,
      projectAngle: link.projectAngle,
      projectNotes: link.projectNotes,
      publishedVideoUrl: link.publishedVideoUrl,
      statusUpdatedAt: formatDateTimeVi(link.statusUpdatedAt),
    };
  }
  return {
    id: dto.id,
    title: dto.title,
    notes: dto.notes,
    sourceType: dto.sourceType,
    sourceRefId: dto.sourceRefId,
    sourceTitleSnapshot: dto.sourceTitleSnapshot,
    sourceUrl: dto.sourceUrl,
    apiPurged: dto.apiPurged,
    inGlobalVault: dto.inGlobalVault,
    tags: dto.tags,
    updatedAt: formatDateTimeVi(dto.updatedAt),
    projectLinks,
  };
}
