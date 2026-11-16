import React from 'react';
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
  const { manualFormatMap, setManualFormat } = usePrototypeWorkspace();
  const [saving, setSaving] = React.useState(false);
  const manualLabel: ManualFormatLabel = manualFormatMap[video.id] ?? video.defaultManualFormat ?? 'none';

  const sourceBadge =
    video.sourceFormatStatus === 'long_form'
      ? {
          label: 'Video dài',
          cls: 'rs-badge rs-badge-success',
          title: 'Xác minh trực tiếp từ nguồn YouTube',
        }
      : video.sourceFormatStatus === 'shorts'
        ? {
            label: 'Shorts',
            cls: 'rs-badge rs-badge-warning',
            title: 'Xác minh trực tiếp từ nguồn YouTube',
          }
        : {
            label: 'Chưa rõ định dạng',
            cls: 'rs-badge',
            title: 'Video ≤ 3 phút chưa xác định định dạng từ nguồn YouTube',
          };

  const hintTitle = `Gợi ý: ${video.formatHint ?? ''} · Độ tin cậy: ${video.formatHintConfidence ?? '—'} · Căn cứ: ${video.formatHintBasis ?? 'Không có'}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
      <span className={sourceBadge.cls} title={sourceBadge.title}>
        {sourceBadge.label}
      </span>

      {video.formatHint && (
        <span
          className="rs-badge"
          style={{ fontSize: '12px', fontWeight: 500 }}
          title={hintTitle}
        >
          Gợi ý: {video.formatHint}
          {!compact && video.formatHintConfidence ? ` (${video.formatHintConfidence})` : ''}
        </span>
      )}

      {!compact && video.formatHintBasis && (
        <span style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
          Căn cứ: {video.formatHintBasis}
        </span>
      )}

      {manualLabel !== 'none' && (!compact || !showManualControl) && (
        <span className="rs-badge rs-badge-demo" title="Nhãn thủ công của bạn — tách biệt với dữ liệu nguồn YouTube">
          Thủ công: {manualLabel === 'long_form' ? 'Video dài' : 'Shorts'}
        </span>
      )}

      {showManualControl && (
        <select
          aria-label={`Nhãn thủ công cho ${video.title}`}
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
          <option value="none">Gắn nhãn...</option>
          <option value="long_form">Thủ công: Video dài</option>
          <option value="shorts">Thủ công: Shorts</option>
        </select>
      )}
    </div>
  );
};
