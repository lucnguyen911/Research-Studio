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
      ? { label: 'Video dài (Xác minh nguồn)', cls: 'rs-badge rs-badge-success' }
      : video.sourceFormatStatus === 'shorts'
        ? { label: 'Shorts (Xác minh nguồn)', cls: 'rs-badge rs-badge-warning' }
        : { label: 'Chưa xác định (<= 180s)', cls: 'rs-badge' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
      <span className={sourceBadge.cls} title="Lớp 1: Trạng thái xác minh trực tiếp từ nguồn YouTube API">
        {sourceBadge.label}
      </span>

      {video.formatHint && (
        <span
          className="rs-badge"
          style={{ fontSize: '12px', fontWeight: 500 }}
          title={`Căn cứ: ${video.formatHintBasis ?? 'Không có'}`}
        >
          Gợi ý: {video.formatHint} ({video.formatHintConfidence})
        </span>
      )}

      {!compact && video.formatHintBasis && (
        <span style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
          Căn cứ: {video.formatHintBasis}
        </span>
      )}

      {manualLabel !== 'none' && (
        <span className="rs-badge rs-badge-demo" title="Lớp 3: Nhãn thủ công của bạn — không ghi đè dữ liệu nguồn API">
          Nhãn thủ công: {manualLabel === 'long_form' ? 'Video dài' : 'Shorts'}
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
          <option value="none">Gắn nhãn thủ công...</option>
          <option value="long_form">Video dài (Thủ công)</option>
          <option value="shorts">Shorts (Thủ công)</option>
        </select>
      )}
    </div>
  );
};
