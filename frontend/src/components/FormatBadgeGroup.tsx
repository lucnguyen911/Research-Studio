import React from 'react';
import { getTranslations } from '../i18n/translations';
import type { ManualFormatLabel, VideoItem } from '../prototype/types';
import { usePrototypeWorkspace } from '../state/workspaceContext';

interface FormatBadgeGroupProps {
  video: VideoItem;
  compact?: boolean;
  showManualControl?: boolean;
}

export const FormatBadgeGroup: React.FC<FormatBadgeGroupProps> = ({
  video,
  compact = false,
  showManualControl = true,
}) => {
  const { uiLanguage, manualFormatMap, setManualFormat } = usePrototypeWorkspace();
  const t = getTranslations(uiLanguage).formatBadge;
  const [saving, setSaving] = React.useState(false);
  const manualLabel: ManualFormatLabel = manualFormatMap[video.id] ?? video.defaultManualFormat ?? 'none';

  const sourceBadge =
    video.sourceFormatStatus === 'long_form'
      ? { label: t.longForm, cls: 'rs-badge rs-badge-success', title: t.sourceTitle }
      : video.sourceFormatStatus === 'shorts'
        ? { label: t.shorts, cls: 'rs-badge rs-badge-warning', title: t.sourceTitle }
        : { label: t.unknown, cls: 'rs-badge', title: t.unknownTitle };

  const localizedHint =
    !video.formatHint
      ? null
      : video.formatHint === 'likely_shorts' ||
          video.formatHint === 'Khả năng cao là Shorts' ||
          video.formatHint === 'Likely Shorts'
        ? t.hintLikelyShorts
        : video.formatHint === 'likely_long_form' ||
            video.formatHint === 'Khả năng cao là Video dài' ||
            video.formatHint === 'Likely Long-form'
          ? t.hintLikelyLongForm
          : video.formatHint;

  const localizedConfidence =
    !video.formatHintConfidence
      ? null
      : video.formatHintConfidence === 'medium_high' ||
          video.formatHintConfidence === 'Trung bình–Cao' ||
          video.formatHintConfidence === 'Medium–High'
        ? t.confMediumHigh
        : video.formatHintConfidence === 'low_medium' ||
            video.formatHintConfidence === 'Thấp–Trung bình' ||
            video.formatHintConfidence === 'Low–Medium'
          ? t.confLowMedium
          : video.formatHintConfidence;

  const hintTitle = `${t.hintPrefix}: ${localizedHint ?? ''} · ${t.confidenceLabel}: ${localizedConfidence ?? '—'} · ${t.basisLabel}: ${video.formatHintBasis ?? '—'}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
      <span className={sourceBadge.cls} title={sourceBadge.title}>
        {sourceBadge.label}
      </span>

      {localizedHint && (
        <span
          className="rs-badge"
          style={{ fontSize: '12px', fontWeight: 500 }}
          title={hintTitle}
        >
          {t.hintPrefix}: {localizedHint}
          {!compact && localizedConfidence ? ` (${localizedConfidence})` : ''}
        </span>
      )}

      {!compact && video.formatHintBasis && (
        <span style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
          {t.basisLabel}: {video.formatHintBasis}
        </span>
      )}

      {manualLabel !== 'none' && (!compact || !showManualControl) && (
        <span className="rs-badge rs-badge-demo" title={t.manualTitle}>
          {t.manualPrefix}: {manualLabel === 'long_form' ? t.longForm : t.shorts}
        </span>
      )}

      {showManualControl && (
        <select
          aria-label={t.manualAria(video.title)}
          value={manualLabel}
          disabled={saving}
          onChange={(e) => {
            const val = e.target.value as ManualFormatLabel;
            void (async () => {
              setSaving(true);
              try {
                await setManualFormat(video.id, val);
              } finally {
                setSaving(false);
              }
            })();
          }}
          className="rs-select rs-select-compact"
        >
          <option value="none">{t.selectNone}</option>
          <option value="long_form">{t.selectLong}</option>
          <option value="shorts">{t.selectShorts}</option>
        </select>
      )}
    </div>
  );
};
