import { getActiveLocale, getTranslations } from '../i18n/translations';
import type { IdeaItem } from './types';

export const IDEA_STATUS_LABELS: Record<IdeaItem['projectLinks'][string]['status'], string> = {
  new: 'Mới lưu',
  researching: 'Đang nghiên cứu',
  approved: 'Chốt làm',
  produced: 'Đã sản xuất',
  skipped: 'Bỏ qua',
};

export const STAGE_TWO_INFO: Record<
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
> = getTranslations('vi').statusViews.stage2Info;

export function getStageTwoInfo(
  screenId: keyof typeof STAGE_TWO_INFO,
): (typeof STAGE_TWO_INFO)[keyof typeof STAGE_TWO_INFO] {
  return getTranslations().statusViews.stage2Info[screenId];
}

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString(getActiveLocale());
}

export function formatSnapshotDeltaLabel(snapshots: Array<{ viewCount: number }>): string {
  const sp = getTranslations().sparkline;
  if (snapshots.length === 0) return sp.zeroPoints;
  if (snapshots.length === 1) return sp.onePoint;
  const delta = snapshots[snapshots.length - 1].viewCount - snapshots[0].viewCount;
  if (delta > 0) return `↗ +${formatInt(delta)}`;
  if (delta < 0) return `↘ -${formatInt(Math.abs(delta))}`;
  return '→ 0';
}
