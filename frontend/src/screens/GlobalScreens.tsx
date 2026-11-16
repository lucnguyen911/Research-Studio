import React, { useState } from 'react';
import {
  DEMO_RSS_ARTICLES,
  DEMO_RSS_TOPICS,
  DEMO_SEARCH_SESSIONS,
  DEMO_VIDEOS,
  IDEA_STATUS_LABELS,
} from '../prototype/demoData';
import type { IdeaSourceType } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace } from '../state/workspaceContext';
import { SparklineCell } from '../components/SparklineCell';
import { EmptyStateCard, GlobalModeBanners, LoadingSkeletonCard } from '../components/StatusViews';
import { VideoResearchTable } from '../components/VideoResearchTable';
import { ConfirmDeleteModal } from '../components/Modals';

export const GlobalOverviewScreen: React.FC = () => {
  const { navigate } = useAppNavigation();
  const {
    uiMode,
    setUiMode,
    projects,
    ideas,
    rssFeeds,
    autoRefreshEnabled,
    quotaSearchUsed,
    quotaGeneralUsed,
    pushToast,
    toggleZeroProjectsDemo,
  } = usePrototypeWorkspace();

  const brokenFeeds = rssFeeds.filter((f) => f.status === 'error');
  const unlinkedIdeas = ideas.filter((i) => Object.keys(i.projectLinks).length === 0);
  const searchQuota = uiMode === 'quota_search_exhausted' ? 100 : quotaSearchUsed;
  const generalQuota = uiMode === 'quota_general_exhausted' ? 10000 : quotaGeneralUsed;

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <h1 className="rs-page-title">Tổng quan Global Research (G1)</h1>
          <p className="rs-page-subtitle">
            Hoạt động độc lập ngay cả khi chưa có Project nào · Dữ liệu mô phỏng DEMO tuân thủ Standard Mode
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="rs-btn rs-btn-secondary rs-btn-sm" onClick={toggleZeroProjectsDemo}>
            {projects.length > 0 ? 'Thử trạng thái 0 Project' : 'Khôi phục 3 Project mẫu'}
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            disabled={uiMode === 'offline'}
            onClick={() => {
              setUiMode('refreshing');
              pushToast('success', 'Bắt đầu làm mới các nguồn đến hạn (DEMO — 0 lượt Search Queries).');
            }}
          >
            Làm mới nguồn đến hạn ngay
          </button>
        </div>
      </div>

      <GlobalModeBanners />

      {uiMode === 'loading' ? (
        <LoadingSkeletonCard />
      ) : (
        <>
          <div className="rs-grid-3">
            <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '15px' }}>Hạn mức YouTube API (Hôm nay PT)</h2>
                <span className="rs-badge">Reset 00:00 PT</span>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '13px', marginBottom: 4 }}>
                  <span>Search Queries (<code>search.list</code>)</span>
                  <strong className="rs-tabular" style={{ whiteSpace: 'nowrap' }}>{searchQuota} / 100 lượt</strong>
                </div>
                <div className="rs-progress-track">
                  <div
                    className={`rs-progress-fill ${searchQuota >= 80 ? 'is-danger' : ''}`}
                    style={{ width: `${searchQuota}%` }}
                  />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '13px', marginBottom: 4 }}>
                  <span>General Data API (<code>videos</code> / <code>channels</code>)</span>
                  <strong className="rs-tabular" style={{ whiteSpace: 'nowrap' }}>{generalQuota.toLocaleString('vi-VN')} / 10.000</strong>
                </div>
                <div className="rs-progress-track">
                  <div
                    className={`rs-progress-fill ${generalQuota >= 8000 ? 'is-danger' : ''}`}
                    style={{ width: `${Math.min(100, (generalQuota / 10000) * 100)}%` }}
                  />
                </div>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
                Ước tính cục bộ từ máy này · Tự động làm mới dùng 0 lượt Search Queries.
              </span>
            </section>

            <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '15px' }}>Dữ liệu đệm &amp; Làm mới tự động</h2>
                <span className={`rs-badge ${autoRefreshEnabled ? 'rs-badge-success' : ''}`}>
                  {autoRefreshEnabled ? 'Đang bật khi mở app' : 'Đang tắt'}
                </span>
              </div>
              <div className="rs-tabular" style={{ fontSize: '13.5px', color: 'var(--rs-text-secondary)' }}>
                <div>Lần chạy gần nhất: 16/11/2026 09:40</div>
                <div>Bản ghi YouTube API sắp chạm hạn 30 ngày: <strong>2 video</strong></div>
                <div>Nguồn RSS đang lỗi cô lập: <strong>{brokenFeeds.length}</strong> / {rssFeeds.length} feeds</div>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="rs-btn rs-btn-sm rs-btn-secondary"
                  onClick={() => navigate('system-settings')}
                >
                  Cài đặt API Key &amp; Làm mới
                </button>
              </div>
            </section>

            <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '15px' }}>Kho ý tưởng chung (Global Vault)</h2>
                <span className="rs-badge">Giữ vĩnh viễn</span>
              </div>
              <div className="rs-tabular" style={{ fontSize: '13.5px', color: 'var(--rs-text-secondary)' }}>
                <div>Tổng số ý tưởng gốc: <strong>{ideas.length}</strong></div>
                <div>Chưa gắn vào Project nào: <strong>{unlinkedIdeas.length}</strong></div>
                <div>Project đang quản lý: <strong>{projects.length}</strong></div>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="rs-btn rs-btn-sm rs-btn-primary"
                  onClick={() => navigate('global-ideas')}
                >
                  Mở Kho ý tưởng chung →
                </button>
              </div>
            </section>
          </div>

          <div className="rs-grid-2">
            <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '15.5px' }}>Tin tức RSS mới nhất</h2>
                  <span style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
                    Nguồn: RSS / Atom (Dữ liệu ngoài YouTube · 0 quota)
                  </span>
                </div>
                <button
                  type="button"
                  className="rs-btn rs-btn-sm rs-btn-secondary"
                  onClick={() => navigate('global-news')}
                >
                  Xem tất cả RSS
                </button>
              </div>
              {DEMO_RSS_ARTICLES.slice(0, 4).map((art) => (
                <div
                  key={art.id}
                  style={{
                    paddingTop: 8,
                    borderTop: '1px solid var(--rs-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <button
                      type="button"
                      className="rs-title-link"
                      onClick={() => navigate('article-detail', { params: { articleId: art.id } })}
                    >
                      {art.title}
                    </button>
                    <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
                      {art.feedName} · {art.publishedAt}
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '15.5px' }}>5 Ý tưởng cập nhật gần nhất</h2>
                  <span style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
                    User-Created Data — Không bị xóa khi dọn cache 30 ngày
                  </span>
                </div>
                <button
                  type="button"
                  className="rs-btn rs-btn-sm rs-btn-secondary"
                  onClick={() => navigate('global-trends')}
                >
                  Khám phá xu hướng
                </button>
              </div>
              {ideas.slice(0, 5).map((idea) => (
                <div
                  key={idea.id}
                  style={{
                    paddingTop: 8,
                    borderTop: '1px solid var(--rs-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    className="rs-title-link"
                    onClick={() => navigate('idea-detail', { params: { ideaId: idea.id } })}
                  >
                    {idea.title}
                  </button>
                  <span className="rs-badge">{Object.keys(idea.projectLinks).length} Project</span>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export const TrendDiscoveryScreen: React.FC = () => {
  const { uiMode, apiCachePurged, incrementQuotaDemo, pushToast } = usePrototypeWorkspace();
  const [region, setRegion] = useState('VN');
  const [category, setCategory] = useState('all');

  const trendVideos =
    uiMode === 'empty' || apiCachePurged || uiMode === 'no_api_key'
      ? []
      : DEMO_VIDEOS.filter((v) => v.isTrendDemo && (region === 'ALL' || v.regionCode === region)).filter(
          (v) => category === 'all' || v.categoryName === category,
        );

  const blocked = uiMode === 'no_api_key' || uiMode === 'offline' || uiMode === 'quota_general_exhausted';

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Khám phá xu hướng (G2)</h1>
            <span className="rs-badge">Nguồn: YouTube Data API (mostPopular)</span>
          </div>
          <p className="rs-page-subtitle">
            Cập nhật gần nhất: 16/11/2026 09:40 · Lưu đệm tối đa 30 ngày lịch · 0 lượt Search Queries
          </p>
        </div>

        <button
          type="button"
          className="rs-btn rs-btn-primary"
          disabled={blocked}
          onClick={() => {
            incrementQuotaDemo('general', 1);
            pushToast('success', 'Đã làm mới Khám phá xu hướng DEMO (-1 unit General Data API).');
          }}
        >
          Làm mới xu hướng (1 unit API)
        </button>
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      <div className="rs-toolbar">
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Quốc gia:</span>
          <select className="rs-select rs-select-compact" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="VN">VN — Việt Nam</option>
            <option value="US">US — Hoa Kỳ</option>
            <option value="ALL">Tất cả thị trường DEMO</option>
          </select>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Danh mục:</span>
          <select className="rs-select rs-select-compact" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Tất cả danh mục</option>
            <option value="Khoa học & Công nghệ">Khoa học &amp; Công nghệ</option>
            <option value="Giáo dục & Tài chính">Giáo dục &amp; Tài chính</option>
          </select>
        </label>
        <a
          href="https://www.youtube.com/feed/trending"
          target="_blank"
          rel="noreferrer"
          style={{ marginLeft: 'auto', fontSize: '12.5px', fontWeight: 600, color: 'var(--rs-accent-text)' }}
        >
          Dữ liệu thuộc YouTube ↗
        </a>
      </div>

      {uiMode === 'loading' ? (
        <LoadingSkeletonCard />
      ) : (
        <VideoResearchTable
          videos={trendVideos}
          fromScreen="global-trends"
          emptyTitle="Chưa có dữ liệu Xu hướng khả dụng"
          emptyDescription="Kiểm tra API Key hoặc bấm Làm mới xu hướng (1 unit General Data API) để nạp dữ liệu."
        />
      )}
    </div>
  );
};

export const FreeResearchScreen: React.FC = () => {
  const { currentEntry } = useAppNavigation();
  const {
    uiMode,
    apiCachePurged,
    projects,
    addKeyword,
    incrementQuotaDemo,
    pushToast,
  } = usePrototypeWorkspace();
  const [queryInput, setQueryInput] = useState('ai local windows 11');
  const [activeSessionId, setActiveSessionId] = useState(DEMO_SEARCH_SESSIONS[0].id);

  const activeProject = projects.find((p) => p.id === currentEntry.projectId) ?? projects[0] ?? null;
  const activeSession = DEMO_SEARCH_SESSIONS.find((s) => s.id === activeSessionId) ?? DEMO_SEARCH_SESSIONS[0];

  const searchVideos =
    uiMode === 'empty' || apiCachePurged || uiMode === 'no_api_key'
      ? []
      : DEMO_VIDEOS.filter((v) => activeSession.videoIds.includes(v.id));

  const searchBlocked =
    !queryInput.trim() ||
    uiMode === 'no_api_key' ||
    uiMode === 'offline' ||
    uiMode === 'quota_search_exhausted';

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Nghiên cứu tự do (G3)</h1>
            <span className="rs-badge">Chi phí tìm mới: 1 lượt Search Queries + 1 unit General Data API</span>
          </div>
          <p className="rs-page-subtitle">
            Chỉ gọi YouTube API khi bạn bấm Tìm; mở lại phiên cũ còn hạn &lt;= 30 ngày tiêu tốn 0 quota
          </p>
        </div>
      </div>

      <GlobalModeBanners requiresYouTubeApi />

      <div className="rs-toolbar">
        <input
          type="text"
          aria-label="Nhập từ khóa tìm kiếm YouTube"
          className="rs-input"
          style={{ flex: '1 1 260px' }}
          placeholder="Nhập từ khóa muốn khảo sát trên YouTube..."
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
        />
        <button
          type="button"
          className="rs-btn rs-btn-primary"
          disabled={searchBlocked}
          onClick={() => {
            incrementQuotaDemo('search', 1);
            incrementQuotaDemo('general', 1);
            pushToast('success', `Đã thực hiện tìm kiếm "${queryInput.trim()}" (-1 Search Queries, -1 API unit).`);
          }}
        >
          Tìm trên YouTube (1 Search + 1 API)
        </button>
        {activeProject && queryInput.trim() && (
          <button
            type="button"
            className="rs-btn rs-btn-secondary"
            onClick={() => addKeyword(activeProject.id, queryInput.trim(), 'medium')}
          >
            + Lưu từ khóa vào {activeProject.name}
          </button>
        )}
      </div>

      <div className="rs-card-subtle" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <strong style={{ fontSize: '13px' }}>Phiên tìm đã lưu (&lt;= 30 ngày · Mở lại 0 quota):</strong>
        {DEMO_SEARCH_SESSIONS.map((sess) => (
          <button
            key={sess.id}
            type="button"
            className={`rs-pill-tab ${activeSessionId === sess.id ? 'is-active' : ''}`}
            onClick={() => {
              setActiveSessionId(sess.id);
              setQueryInput(sess.query);
            }}
          >
            “{sess.query}” ({sess.regionCode}) · {sess.videoIds.length} video
          </button>
        ))}
      </div>

      {uiMode === 'loading' ? (
        <LoadingSkeletonCard />
      ) : (
        <VideoResearchTable
          videos={searchVideos}
          fromScreen="global-search"
          emptyTitle="Không có kết quả tìm kiếm khả dụng"
          emptyDescription="Nhập từ khóa hợp lệ hoặc chọn một phiên tìm kiếm còn hạn <= 30 ngày để xem lại với 0 quota."
        />
      )}
    </div>
  );
};

export const RssNewsScreen: React.FC = () => {
  const { currentEntry, navigate, updateViewState } = useAppNavigation();
  const { uiMode, rssFeeds, toggleRssFeedEnabled, retryRssFeed, addRssFeed, openSaveIdeaModal, pushToast } =
    usePrototypeWorkspace();
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const vs = currentEntry.viewState;

  const articles =
    uiMode === 'empty'
      ? []
      : DEMO_RSS_ARTICLES.filter((a) => {
          if (vs.selectedFeedId !== 'all' && a.feedId !== vs.selectedFeedId) return false;
          if (vs.onlyBookmarked && !a.bookmarked) return false;
          if (vs.search.trim()) {
            const q = vs.search.trim().toLowerCase();
            return a.title.toLowerCase().includes(q) || a.summaryText.toLowerCase().includes(q);
          }
          return true;
        });

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 className="rs-page-title">Tin tức &amp; thảo luận (G4)</h1>
            <span className="rs-badge rs-badge-success">Nguồn: RSS / Atom (Dữ liệu ngoài YouTube · 0 quota)</span>
          </div>
          <p className="rs-page-subtitle">
            Làm sạch HTML an toàn chống XSS · Cô lập nguồn lỗi theo từng feed · Đọc đầy đủ khi mất mạng
          </p>
        </div>
        <button
          type="button"
          className="rs-btn rs-btn-primary"
          disabled={uiMode === 'offline'}
          onClick={() => pushToast('success', 'Đã làm mới các nguồn RSS đang bật (0 quota YouTube).')}
        >
          Làm mới RSS (0 quota)
        </button>
      </div>

      <GlobalModeBanners />

      <div className="rs-toolbar">
        <input
          type="url"
          className="rs-input"
          style={{ flex: '1 1 250px' }}
          placeholder="https://example.com/feed.xml"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
        />
        <input
          type="text"
          className="rs-input"
          style={{ width: 200 }}
          placeholder="Tên hiển thị nguồn..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="button"
          className="rs-btn rs-btn-secondary"
          disabled={!newUrl.trim()}
          onClick={() => {
            addRssFeed(newUrl, newName);
            setNewUrl('');
            setNewName('');
          }}
        >
          + Thêm nguồn RSS
        </button>
      </div>

      <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong style={{ fontSize: '14px' }}>Trạng thái nguồn RSS đã cấu hình (Cô lập lỗi theo từng nguồn):</strong>
        <div className="rs-grid-2">
          {rssFeeds.map((feed) => {
            const forceError = uiMode === 'rss_error' || feed.status === 'error';
            return (
              <div
                key={feed.id}
                className="rs-card-subtle"
                style={{
                  borderColor: forceError ? 'var(--rs-danger-border)' : 'var(--rs-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong>{feed.name}</strong>
                  <span className={`rs-badge ${forceError ? 'rs-badge-danger' : 'rs-badge-success'}`}>
                    {forceError ? feed.errorCode ?? 'HTTP 404 / XML Lỗi' : 'Hoạt động'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--rs-text-muted)' }}>
                  {feed.url} · Lần kiểm tra cuối: {feed.lastFetchedAt}
                </div>
                {forceError && (
                  <div style={{ fontSize: '12.5px', color: 'var(--rs-danger-text)' }}>
                    {feed.errorMessage ?? 'Feed gặp lỗi kết nối/XML. Các nguồn RSS khác vẫn hoạt động bình thường.'}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  <button
                    type="button"
                    className="rs-btn rs-btn-sm rs-btn-secondary"
                    onClick={() => toggleRssFeedEnabled(feed.id)}
                  >
                    {feed.enabled ? 'Tạm tắt' : 'Bật lại'}
                  </button>
                  {forceError && (
                    <button
                      type="button"
                      className="rs-btn rs-btn-sm rs-btn-tinted"
                      onClick={() => retryRssFeed(feed.id)}
                    >
                      Thử lại nguồn này
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {uiMode === 'loading' ? (
        <LoadingSkeletonCard />
      ) : (
        <div className="rs-detail-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="rs-toolbar">
              <input
                type="search"
                className="rs-input"
                style={{ flex: '1 1 200px' }}
                placeholder="Lọc bài viết RSS..."
                value={vs.search}
                onChange={(e) => updateViewState({ search: e.target.value })}
              />
              <select
                aria-label="Chọn nguồn RSS"
                className="rs-select rs-select-compact"
                value={vs.selectedFeedId}
                onChange={(e) => updateViewState({ selectedFeedId: e.target.value })}
              >
                <option value="all">Tất cả nguồn RSS ({rssFeeds.length})</option>
                {rssFeeds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={vs.onlyBookmarked}
                  onChange={(e) => updateViewState({ onlyBookmarked: e.target.checked })}
                />
                <span>Chỉ bài đã đánh dấu</span>
              </label>
            </div>

            {articles.length === 0 ? (
              <EmptyStateCard
                title="Không có bài viết RSS khớp bộ lọc"
                description="Thử chọn Tất cả nguồn RSS hoặc làm mới nguồn tin đang bật."
                actionLabel="Xóa bộ lọc"
                onAction={() => updateViewState({ search: '', selectedFeedId: 'all', onlyBookmarked: false })}
              />
            ) : (
              articles.map((art) => (
                <article key={art.id} className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <button
                      type="button"
                      className="rs-title-link"
                      style={{ fontSize: '15px' }}
                      onClick={() => navigate('article-detail', { params: { articleId: art.id } })}
                    >
                      {art.title}
                    </button>
                    {art.bookmarked && <span className="rs-badge rs-badge-demo">Đã đánh dấu</span>}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
                    {art.feedName} · {art.publishedAt} · Nguồn: RSS (Ngoài YouTube)
                  </div>
                  <p style={{ margin: 0, color: 'var(--rs-text-secondary)', fontSize: '13.5px' }}>{art.summaryText}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="rs-btn rs-btn-sm rs-btn-tinted"
                      onClick={() =>
                        openSaveIdeaModal({
                          title: art.title,
                          sourceType: 'rss_article',
                          sourceRefId: art.id,
                          sourceTitleSnapshot: art.title,
                          sourceUrl: art.url,
                          tags: art.tags,
                        })
                      }
                    >
                      + Tạo Ý tưởng
                    </button>
                    <a className="rs-btn rs-btn-sm rs-btn-secondary" href={art.url} target="_blank" rel="noreferrer">
                      Mở bài gốc ↗
                    </a>
                  </div>
                </article>
              ))
            )}
          </div>

          <section className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: '15px' }}>Cụm từ nổi bật trên RSS (Python tất định · DEMO)</h2>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
              Tần suất tính trực tiếp trên tập bài RSS ngoài YouTube — hợp lệ hoàn toàn vì không dùng YouTube API Data.
            </p>
            <table className="rs-table">
              <thead>
                <tr>
                  <th>Cụm từ RSS</th>
                  <th>Xu hướng 7 ngày</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_RSS_TOPICS.map((topic) => (
                  <tr key={topic.phrase}>
                    <td style={{ fontWeight: 600 }}>{topic.phrase}</td>
                    <td>
                      <SparklineCell
                        points={uiMode === 'insufficient_data' ? [topic.articleCount] : topic.points7d}
                        badgeLabel={`${topic.articleCount} bài RSS`}
                        directionLabel={topic.direction === 'up' ? '↗ Tăng' : '→ Ổn định'}
                        tooltipTitle={`Tần suất "${topic.phrase}" trên RSS`}
                        tooltipDetail="Số bài báo/diễn đàn nhắc tới cụm từ trong 7 ngày qua (Nguồn: RSS)."
                        insufficientText="Chưa đủ dữ liệu RSS"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
};

export const GlobalIdeaVaultScreen: React.FC = () => {
  const { currentEntry, navigate, updateViewState } = useAppNavigation();
  const { uiMode, ideas, projects, openSaveIdeaModal, attachIdeaToProject, deleteIdea } = usePrototypeWorkspace();
  const [confirmIdeaId, setConfirmIdeaId] = useState<string | null>(null);
  const vs = currentEntry.viewState;

  const filtered =
    uiMode === 'empty'
      ? []
      : ideas.filter((idea) => {
          if (vs.originFilter !== 'all' && idea.sourceType !== vs.originFilter) return false;
          const linkCount = Object.keys(idea.projectLinks).length;
          if (vs.linkStateFilter === 'unlinked' && linkCount > 0) return false;
          if (vs.linkStateFilter === 'linked' && linkCount === 0) return false;
          if (vs.search.trim()) {
            const q = vs.search.trim().toLowerCase();
            return idea.title.toLowerCase().includes(q) || idea.notes.toLowerCase().includes(q);
          }
          return true;
        });

  const targetDeleteIdea = ideas.find((i) => i.id === confirmIdeaId) ?? null;

  return (
    <div className="rs-container">
      <div className="rs-page-header">
        <div>
          <h1 className="rs-page-title">Kho ý tưởng chung (G5 — Global Idea Vault)</h1>
          <p className="rs-page-subtitle">
            Lưu vĩnh viễn trên máy · Gắn 1 bản ý tưởng gốc vào nhiều Project mà không lưu trùng
          </p>
        </div>
        <button
          type="button"
          className="rs-btn rs-btn-primary"
          onClick={() =>
            openSaveIdeaModal({
              title: '',
              sourceType: 'manual',
              sourceRefId: `manual-${Date.now()}`,
              sourceTitleSnapshot: 'Tạo viết tay trong Kho chung',
              sourceUrl: '',
              tags: [],
            })
          }
        >
          + Tạo Ý tưởng mới
        </button>
      </div>

      <GlobalModeBanners />

      <div className="rs-toolbar">
        <input
          type="search"
          className="rs-input"
          style={{ flex: '1 1 220px' }}
          placeholder="Tìm tiêu đề, ghi chú ý tưởng..."
          value={vs.search}
          onChange={(e) => updateViewState({ search: e.target.value })}
        />
        <select
          aria-label="Lọc theo nguồn gốc"
          className="rs-select rs-select-compact"
          value={vs.originFilter}
          onChange={(e) => updateViewState({ originFilter: e.target.value as 'all' | IdeaSourceType })}
        >
          <option value="all">Tất cả nguồn gốc</option>
          <option value="manual">Viết tay</option>
          <option value="youtube_video">Từ Video YouTube</option>
          <option value="rss_article">Từ Bài báo RSS</option>
          <option value="keyword">Từ Từ khóa</option>
        </select>
        <select
          aria-label="Lọc trạng thái gắn Project"
          className="rs-select rs-select-compact"
          value={vs.linkStateFilter}
          onChange={(e) => updateViewState({ linkStateFilter: e.target.value as 'all' | 'unlinked' | 'linked' })}
        >
          <option value="all">Tất cả liên kết Project</option>
          <option value="unlinked">Chưa gắn Project</option>
          <option value="linked">Đã gắn ít nhất 1 Project</option>
        </select>
      </div>

      {uiMode === 'loading' ? (
        <LoadingSkeletonCard />
      ) : filtered.length === 0 ? (
        <EmptyStateCard
          title="Chưa có ý tưởng nào khớp bộ lọc"
          description="Tạo ý tưởng viết tay mới hoặc lưu ý tưởng từ Khám phá xu hướng / Tin tức RSS."
          actionLabel="+ Tạo Ý tưởng mới"
          onAction={() =>
            openSaveIdeaModal({
              title: 'Ý tưởng mới',
              sourceType: 'manual',
              sourceRefId: 'manual-new',
              sourceTitleSnapshot: 'Viết tay',
              sourceUrl: '',
              tags: [],
            })
          }
        />
      ) : (
        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th>Ý tưởng gốc &amp; Nguồn tham chiếu</th>
                <th>Project đang gắn &amp; Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((idea) => {
                const unattachedProjects = projects.filter((p) => !idea.projectLinks[p.id]);
                return (
                  <tr key={idea.id}>
                    <td style={{ minWidth: 340 }}>
                      <button
                        type="button"
                        className="rs-title-link"
                        onClick={() => navigate('idea-detail', { params: { ideaId: idea.id } })}
                      >
                        {idea.title}
                      </button>
                      <p style={{ margin: '4px 0', fontSize: '13px', color: 'var(--rs-text-secondary)' }}>
                        {idea.notes}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span className="rs-badge">Nguồn: {idea.sourceTitleSnapshot}</span>
                        {idea.apiPurged && (
                          <span className="rs-badge rs-badge-warning">
                            Metadata YouTube API đã hết hạn 30 ngày — Đã bảo toàn Ý tưởng
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ minWidth: 250 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {Object.keys(idea.projectLinks).length === 0 ? (
                          <span className="rs-badge">Chưa gắn Project</span>
                        ) : (
                          Object.entries(idea.projectLinks).map(([pid, link]) => {
                            const proj = projects.find((p) => p.id === pid);
                            return (
                              <span key={pid} className="rs-badge rs-badge-demo">
                                {proj?.name ?? pid}: {IDEA_STATUS_LABELS[link.status]}
                              </span>
                            );
                          })
                        )}
                        {unattachedProjects.length > 0 && (
                          <select
                            aria-label={`Gắn "${idea.title}" vào Project`}
                            className="rs-select rs-select-compact"
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                attachIdeaToProject(idea.id, e.target.value, idea.title);
                              }
                            }}
                          >
                            <option value="">+ Gắn nhanh sang Project...</option>
                            {unattachedProjects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td style={{ minWidth: 150 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-secondary"
                          onClick={() => navigate('idea-detail', { params: { ideaId: idea.id } })}
                        >
                          Chi tiết
                        </button>
                        <button
                          type="button"
                          className="rs-btn rs-btn-sm rs-btn-danger"
                          onClick={() => setConfirmIdeaId(idea.id)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDeleteModal
        open={Boolean(targetDeleteIdea)}
        title="Xác nhận xóa Ý tưởng gốc?"
        warningText={`Ý tưởng "${targetDeleteIdea?.title ?? ''}" hiện đang liên kết với ${
          targetDeleteIdea ? Object.keys(targetDeleteIdea.projectLinks).length : 0
        } Project. Thao tác này sẽ xóa ý tưởng và các góc khai thác gắn kèm.`}
        confirmLabel="Xác nhận xóa Ý tưởng"
        onCancel={() => setConfirmIdeaId(null)}
        onConfirm={() => {
          if (targetDeleteIdea) deleteIdea(targetDeleteIdea.id);
          setConfirmIdeaId(null);
        }}
      />
    </div>
  );
};
