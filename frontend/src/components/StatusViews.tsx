import React from 'react';
import { formatDateTimeVi } from '../api/mappers';
import type { ScreenId } from '../prototype/types';
import { STAGE_TWO_INFO } from '../prototype/demoData';
import { useAppNavigation } from '../state/navigationStore';
import { isDemoPreviewScreen, usePrototypeWorkspace } from '../state/workspaceContext';

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
  const {
    isBootstrapping,
    backendOnline,
    systemSettings,
    quotaStatus,
    refreshWorkspaceStatus,
    setLegalModalOpen,
  } = usePrototypeWorkspace();
  const { currentEntry, navigate } = useAppNavigation();
  const isPreview = isDemoPreviewScreen(currentEntry.screenId);

  return (
    <>
      {isPreview && (
        <div className="rs-banner rs-banner-amber" role="status">
          <div>
            <strong>Màn hình xem trước giao diện (DEMO):</strong> Phần này vẫn đang dùng dữ liệu minh họa đọc-chỉ và sẽ
            được kết nối SQLite + API thật trong Milestone 3–5.
          </div>
        </div>
      )}

      {!isBootstrapping && !backendOnline && (
        <div className="rs-banner rs-banner-warn" role="status">
          <div>
            <strong>Không kết nối được Backend cục bộ (127.0.0.1:8000):</strong> Không thể đọc/ghi SQLite hoặc gọi API mới.
            Hãy kiểm tra tiến trình Uvicorn/FastAPI và bấm thử lại.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="rs-btn rs-btn-sm rs-btn-secondary"
              onClick={() => {
                void refreshWorkspaceStatus();
              }}
            >
              Thử lại kết nối
            </button>
          </div>
        </div>
      )}

      {requiresYouTubeApi && backendOnline && !systemSettings.legalConsentAccepted && (
        <div className="rs-banner rs-banner-warn" role="alert">
          <div>
            <strong>Chưa xác nhận Chính sách Quyền riêng tư &amp; Điều khoản YouTube:</strong> Theo yêu cầu pháp lý,
            vui lòng đọc và xác nhận đồng ý trước khi lưu API Key hoặc gọi YouTube Data API.
          </div>
          <button type="button" className="rs-btn rs-btn-sm rs-btn-primary" onClick={() => setLegalModalOpen(true)}>
            Mở xác nhận Pháp lý
          </button>
        </div>
      )}

      {requiresYouTubeApi && backendOnline && systemSettings.apiKeyStatus === 'unreadable' && (
        <div className="rs-banner rs-banner-danger" role="alert">
          <div>
            <strong>Không giải mã được YouTube API Key cũ (DPAPI):</strong> Có thể tệp dữ liệu được chuyển từ máy hoặc
            tài khoản Windows khác. Hệ thống vẫn đọc dữ liệu local bình thường; vui lòng dán lại API Key mới trong Cài đặt.
          </div>
          <button type="button" className="rs-btn rs-btn-sm rs-btn-primary" onClick={() => navigate('system-settings')}>
            Mở Cài đặt nhập lại API Key
          </button>
        </div>
      )}

      {requiresYouTubeApi &&
        backendOnline &&
        systemSettings.legalConsentAccepted &&
        systemSettings.apiKeyStatus === 'missing' && (
          <div className="rs-banner rs-banner-warn" role="alert">
            <div>
              <strong>Chưa có YouTube Data API v3 Key:</strong> Các chức năng quản trị Project, RSS và Kho ý tưởng vẫn hoạt
              động độc lập. Dán khóa cá nhân (mã hóa Windows DPAPI) trong Cài đặt để bật tra cứu YouTube.
            </div>
            <button type="button" className="rs-btn rs-btn-sm rs-btn-primary" onClick={() => navigate('system-settings')}>
              Mở Cài đặt API Key
            </button>
          </div>
        )}

      {requiresYouTubeApi &&
        backendOnline &&
        quotaStatus.searchQueries.warning &&
        !quotaStatus.searchQueries.exhausted && (
          <div className="rs-banner rs-banner-warn" role="status">
            <div>
              <strong>
                Cảnh báo sắp chạm ngưỡng Search Queries ({quotaStatus.searchQueries.used}/
                {quotaStatus.searchQueries.limit} lượt/ngày):
              </strong>{' '}
              Ước tính từ sổ kế toán quota cục bộ; còn {quotaStatus.searchQueries.remaining} lượt tìm mới trước mốc
              reset 00:00 PT ({formatDateTimeVi(quotaStatus.resetAtUtc)}).
            </div>
          </div>
        )}

      {requiresYouTubeApi &&
        backendOnline &&
        quotaStatus.generalData.warning &&
        !quotaStatus.generalData.exhausted && (
          <div className="rs-banner rs-banner-warn" role="status">
            <div>
              <strong>
                Cảnh báo sắp chạm ngưỡng General Data API (
                {quotaStatus.generalData.used.toLocaleString('vi-VN')}/
                {quotaStatus.generalData.limit.toLocaleString('vi-VN')} units/ngày):
              </strong>{' '}
              Ước tính từ sổ kế toán quota cục bộ; hãy ưu tiên dùng dữ liệu đã lưu đệm hoặc đợi reset lúc{' '}
              {formatDateTimeVi(quotaStatus.resetAtUtc)}.
            </div>
          </div>
        )}

      {requiresYouTubeApi && backendOnline && quotaStatus.searchQueries.exhausted && (
        <div className="rs-banner rs-banner-danger" role="alert">
          <div>
            <strong>
              Hết hạn mức Bucket Search Queries ({quotaStatus.searchQueries.used}/{quotaStatus.searchQueries.limit} lượt/ngày):
            </strong>{' '}
            <code>search.list</code> đã chạm trần ngày PT ({quotaStatus.ptDate}). Bucket{' '}
            <strong>General Data API</strong> vẫn khả dụng bình thường.
          </div>
        </div>
      )}

      {requiresYouTubeApi && backendOnline && quotaStatus.generalData.exhausted && (
        <div className="rs-banner rs-banner-danger" role="alert">
          <div>
            <strong>
              Hết hạn mức Bucket General Data API ({quotaStatus.generalData.used.toLocaleString('vi-VN')}/
              {quotaStatus.generalData.limit.toLocaleString('vi-VN')} units/ngày):
            </strong>{' '}
            Tạm dừng làm mới YouTube tới mốc reset 00:00 PT.
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
      <span className="rs-badge">Đang tải</span>
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
