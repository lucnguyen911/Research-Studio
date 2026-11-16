import React from 'react';

interface SparklineCellProps {
  points: number[];
  labels?: string[];
  badgeLabel: string;
  directionLabel: string;
  tooltipTitle: string;
  tooltipDetail: string;
  insufficientText?: string;
}

export const SparklineCell: React.FC<SparklineCellProps> = ({
  points,
  labels,
  badgeLabel,
  directionLabel,
  tooltipTitle,
  tooltipDetail,
  insufficientText = 'Chưa đủ mốc (>= 2 lần lấy <= 30 ngày)',
}) => {
  if (points.length < 2) {
    return (
      <div className="rs-spark-wrap" tabIndex={0}>
        <span className="rs-badge" style={{ fontWeight: 500 }}>
          {insufficientText}
        </span>
        <div className="rs-spark-tooltip" role="tooltip">
          <strong>{tooltipTitle}</strong>
          <div style={{ marginTop: 4, color: 'var(--rs-text-secondary)' }}>{tooltipDetail}</div>
        </div>
      </div>
    );
  }

  const width = 92;
  const height = 24;
  const pad = 3;
  const minVal = Math.min(...points);
  const maxVal = Math.max(...points);
  const span = Math.max(1, maxVal - minVal);

  const coords = points.map((val, idx) => {
    const x = pad + (idx / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((val - minVal) / span) * (height - pad * 2);
    return { x, y, val };
  });

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  return (
    <div className="rs-spark-wrap" tabIndex={0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <polyline
            fill="none"
            stroke="var(--rs-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
          />
          {coords.map((c, idx) => (
            <circle
              key={idx}
              cx={c.x}
              cy={c.y}
              r={idx === coords.length - 1 ? 2.8 : 1.8}
              fill={idx === coords.length - 1 ? 'var(--rs-accent)' : 'var(--rs-bg-card)'}
              stroke="var(--rs-accent)"
              strokeWidth="1.2"
            />
          ))}
        </svg>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--rs-accent-text)' }} className="rs-tabular">
          {directionLabel}
        </span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>{badgeLabel}</div>

      <div className="rs-spark-tooltip" role="tooltip">
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{tooltipTitle} (DEMO)</div>
        <div style={{ color: 'var(--rs-text-secondary)', marginBottom: 6 }}>{tooltipDetail}</div>
        {coords.map((c, idx) => (
          <div
            key={idx}
            className="rs-tabular"
            style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}
          >
            <span>{labels?.[idx] ?? `Mốc ${idx + 1}`}</span>
            <strong>{c.val.toLocaleString('vi-VN')}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};
