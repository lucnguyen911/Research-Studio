import React from 'react';
import type { ScreenId } from '../prototype/types';
import { STAGE_TWO_INFO } from '../prototype/demoData';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace } from '../state/workspaceContext';

export const StageTwoScreen: React.FC<{
  screenId: keyof typeof STAGE_TWO_INFO;
}> = ({ screenId }) => {
  const { navigate } = useAppNavigation();
  const info = STAGE_TWO_INFO[screenId];

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">{info.title}</h1>
            <span className="rs-badge">Giai đoạn 2 · Chưa kích hoạt trong MVP V1</span>
          </div>
          <p className="rs-page-subtitle">Phân khu: {info.scope} · Tuân thủ lộ trình SPEC.md Mục 3</p>
        </div>
      </div>

      <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: 820 }}>
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: '15.5px' }}>Mục tiêu dự kiến ở Giai đoạn 2</h2>
          <p style={{ margin: 0, color: 'var(--rs-text-secondary)' }}>{info.goal}</p>
        </div>

        <div className="rs-card-subtle">
          <h3 style={{ margin: '0 0 6px', fontSize: '14px' }}>Lý do chưa kích hoạt ở MVP V1 (Standard Mode)</h3>
          <p style={{ margin: 0, color: 'var(--rs-text-secondary)' }}>{info.reason}</p>
        </div>

        <p style={{ margin: 0, fontSize: '13px', color: 'var(--rs-text-muted)' }}>
          Không hiển thị số liệu mẫu giả lập, biểu đồ giả, thanh tiến độ giả hay công tắc kích hoạt ngầm. Không phát sinh tác vụ API hoặc AI nền.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: 4 }}>
          {info.alternatives.map((alt) => (
            <button
              key={alt.screenId}
              type="button"
              className="rs-btn rs-btn-primary"
              onClick={() => navigate(alt.screenId as ScreenId)}
            >
              {alt.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export const GlobalModeBanners: React.FC<{ requiresYouTubeApi?: boolean }> = ({
  requiresYouTubeApi = false,
}) => {
  const { uiMode, setUiMode, setAutoRefreshEnabled, pushToast, apiCachePurged, restoreYouTubeCacheDemo } =
    usePrototypeWorkspace();
  const { navigate } = useAppNavigation();

  return (
    <>
      {uiMode === 'offline' && (
        <div className="rs-banner rs-banner-warn" role="status">
          <div>
            <strong>Ngoại tuyến / Mất kết nối Internet:</strong> Không thể gọi YouTube API hoặc tải RSS mới. Dữ liệu
            local còn hạn (&lt;= 30 ngày), RSS đã lưu và toàn bộ Kho ý tưởng vẫn xem, lọc, sắp xếp và chỉnh sửa bình thường.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="rs-btn rs-btn-sm rs-btn-secondary" onClick={() => setUiMode('normal')}>
              Thử lại kết nối
            </button>
          </div>
        </div>
      )}

      {requiresYouTubeApi && (uiMode === 'no_api_key' || apiCachePurged) && (
        <div className="rs-banner rs-banner-warn" role="alert">
          <div>
            {uiMode === 'no_api_key' ? (
              <>
                <strong>Chưa có YouTube Data API v3 Key:</strong> Các chức năng RSS, Kho ý tưởng chung và Quản lý ý
                tưởng vẫn hoạt động 100%. Vui lòng dán API Key (lưu qua Windows DPAPI) để tra cứu YouTube.
              </>
            ) : (
              <>
                <strong>Đã xóa toàn bộ cache YouTube API Data:</strong> Tất cả dữ liệu metadata/thống kê từ YouTube API
                đã được xóa sạch theo yêu cầu. Toàn bộ Project, Ý tưởng và nguồn RSS do bạn tạo vẫn nguyên vẹn 100%.
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {uiMode === 'no_api_key' ? (
              <button
                type="button"
                className="rs-btn rs-btn-sm rs-btn-primary"
                onClick={() => navigate('system-settings')}
              >
                Mở Cài đặt API Key
              </button>
            ) : (
              <button type="button" className="rs-btn rs-btn-sm rs-btn-primary" onClick={restoreYouTubeCacheDemo}>
                Nạp lại dữ liệu YouTube DEMO
              </button>
            )}
          </div>
        </div>
      )}

      {requiresYouTubeApi && uiMode === 'quota_search_exhausted' && (
        <div className="rs-banner rs-banner-danger" role="alert">
          <div>
            <strong>Hết hạn mức Bucket Search Queries (100/100 lượt/ngày):</strong> <code>search.list</code> đã chạm
            trần ngày PT (ước tính reset 00:00 PT = 14:00 GMT+7). Các thao tác thuộc{' '}
            <strong>General Data API</strong> (Xu hướng, Cập nhật kênh đối thủ đã có ID) vẫn chạy bình thường.
          </div>
          <button type="button" className="rs-btn rs-btn-sm rs-btn-secondary" onClick={() => setUiMode('normal')}>
            Đặt lại mô phỏng quota
          </button>
        </div>
      )}

      {requiresYouTubeApi && uiMode === 'quota_general_exhausted' && (
        <div className="rs-banner rs-banner-danger" role="alert">
          <div>
            <strong>Hết hạn mức Bucket General Data API (10.000/10.000 units/ngày):</strong> Tạm dừng làm mới
            YouTube tự động và thủ công tới mốc reset 00:00 PT. Bạn vẫn đọc và quản lý Ý tưởng / RSS cục bộ.
          </div>
          <button type="button" className="rs-btn rs-btn-sm rs-btn-secondary" onClick={() => setUiMode('normal')}>
            Đặt lại mô phỏng quota
          </button>
        </div>
      )}

      {uiMode === 'refreshing' && (
        <div className="rs-banner rs-banner-amber" role="status">
          <div>
            <strong>Đang làm mới dữ liệu nền (DEMO):</strong> Đang đồng bộ lô 2 kênh đối thủ &amp; 3 nguồn RSS (ước
            tính 4 units General Data API · 0 lượt Search Queries). Tiến trình có thể hủy an toàn bất kỳ lúc nào.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="rs-btn rs-btn-sm rs-btn-danger"
              onClick={() => {
                setUiMode('normal');
                setAutoRefreshEnabled(false);
                pushToast('success', 'Đã hủy tác vụ làm mới đang chạy.');
              }}
            >
              Hủy (Cancel)
            </button>
            <button
              type="button"
              className="rs-btn rs-btn-sm rs-btn-secondary"
              onClick={() => {
                setUiMode('normal');
                pushToast('success', 'Đã hoàn tất làm mới dữ liệu DEMO.');
              }}
            >
              Hoàn tất ngay
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const LoadingSkeletonCard: React.FC<{ label?: string }> = ({
  label = 'Đang nạp dữ liệu từ SQLite cục bộ...',
}) => (
  <section className="rs-card" aria-busy="true" aria-label={label}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <strong>{label}</strong>
      <span className="rs-badge rs-badge-demo">LOADING DEMO</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="rs-skeleton-line" style={{ width: '92%' }} />
      <div className="rs-skeleton-line" style={{ width: '78%' }} />
      <div className="rs-skeleton-line" style={{ width: '86%' }} />
      <div className="rs-skeleton-line" style={{ width: '64%' }} />
    </div>
  </section>
);

export const EmptyStateCard: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}> = ({ title, description, actionLabel, onAction, secondaryLabel, onSecondary }) => (
  <section className="rs-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
    <h2 style={{ margin: '0 0 6px', fontSize: '16px' }}>{title}</h2>
    <p style={{ margin: '0 auto 14px', maxWidth: 520, color: 'var(--rs-text-secondary)' }}>{description}</p>
    <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
      {actionLabel && onAction && (
        <button type="button" className="rs-btn rs-btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      {secondaryLabel && onSecondary && (
        <button type="button" className="rs-btn rs-btn-secondary" onClick={onSecondary}>
          {secondaryLabel}
        </button>
      )}
    </div>
  </section>
);
