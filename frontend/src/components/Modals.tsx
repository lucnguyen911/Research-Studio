import React, { useState } from 'react';
import { DEMO_VIDEOS, formatInt } from '../prototype/demoData';
import type { ProjectItem } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace, type SaveIdeaDraft } from '../state/workspaceContext';
import { FormatBadgeGroup } from './FormatBadgeGroup';
import { SparklineCell } from './SparklineCell';

export const CreateProjectModal: React.FC = () => {
  const { createProjectModalOpen, setCreateProjectModalOpen, createProject, systemSettings } =
    usePrototypeWorkspace();
  const { switchProject } = useAppNavigation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [regionCode, setRegionCode] = useState(systemSettings.defaultRegionCode || 'VN');
  const [relevanceLanguage, setRelevanceLanguage] = useState(systemSettings.defaultRelevanceLanguage || 'vi');
  const [targetFormat, setTargetFormat] = useState<ProjectItem['targetFormat']>('all');
  const [submitting, setSubmitting] = useState(false);

  if (!createProjectModalOpen) return null;

  const canSave = name.trim().length > 0 && !submitting;

  return (
    <div className="rs-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-proj-title">
      <div className="rs-modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="create-proj-title" style={{ margin: 0, fontSize: '17px' }}>
            Tạo Project mới
          </h2>
          <button
            type="button"
            className="rs-btn rs-btn-ghost rs-btn-sm"
            disabled={submitting}
            onClick={() => setCreateProjectModalOpen(false)}
          >
            Đóng
          </button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>Tên Project / Kênh *</span>
          <input
            type="text"
            className="rs-input"
            placeholder="Ví dụ: Kênh Review Công cụ AI"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>Mô tả định hướng kênh</span>
          <textarea
            className="rs-textarea"
            placeholder="Mục tiêu chủ đề, nhóm khán giả, định dạng chính..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="rs-grid-3">
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Thị trường</span>
            <select className="rs-select" value={regionCode} onChange={(e) => setRegionCode(e.target.value)}>
              <option value="VN">VN — Việt Nam</option>
              <option value="US">US — Hoa Kỳ</option>
              <option value="JP">JP — Nhật Bản</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Ngôn ngữ</span>
            <select className="rs-select" value={relevanceLanguage} onChange={(e) => setRelevanceLanguage(e.target.value)}>
              <option value="vi">vi — Tiếng Việt</option>
              <option value="en">en — English</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Định dạng trọng tâm</span>
            <select
              className="rs-select"
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value as ProjectItem['targetFormat'])}
            >
              <option value="all">Tất cả</option>
              <option value="long_form">Video dài</option>
              <option value="shorts">Shorts</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            className="rs-btn rs-btn-secondary"
            disabled={submitting}
            onClick={() => setCreateProjectModalOpen(false)}
          >
            Hủy
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            disabled={!canSave}
            onClick={() => {
              void (async () => {
                setSubmitting(true);
                try {
                  const created = await createProject({
                    name,
                    description,
                    regionCode,
                    relevanceLanguage,
                    targetFormat,
                  });
                  if (created) {
                    setCreateProjectModalOpen(false);
                    setName('');
                    setDescription('');
                    switchProject(created.id);
                  }
                } finally {
                  setSubmitting(false);
                }
              })();
            }}
          >
            {submitting ? 'Đang lưu...' : 'Tạo Project & Chuyển sang Project này'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SaveIdeaModalBody: React.FC<{
  draft: SaveIdeaDraft;
  onClose: () => void;
}> = ({ draft, onClose }) => {
  const { currentEntry } = useAppNavigation();
  const { projects, saveIdea } = usePrototypeWorkspace();
  const [title, setTitle] = useState(draft.title);
  const [notes, setNotes] = useState('');
  const [projectAngle, setProjectAngle] = useState('');
  const [inGlobalVault, setInGlobalVault] = useState(true);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(() =>
    currentEntry.projectId && projects.some((p) => p.id === currentEntry.projectId) ? [currentEntry.projectId] : [],
  );

  const togglePid = (pid: string) => {
    setSelectedProjectIds((prev) => (prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]));
  };

  return (
    <div className="rs-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="save-idea-title">
      <div className="rs-modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="save-idea-title" style={{ margin: 0, fontSize: '17px' }}>
            Lưu thành Ý tưởng (User-Created Data)
          </h2>
          <button type="button" className="rs-btn rs-btn-ghost rs-btn-sm" onClick={onClose}>
            Đóng
          </button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>Tiêu đề Ý tưởng *</span>
          <input type="text" className="rs-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>Ghi chú gốc (Kho chung)</span>
          <textarea
            className="rs-textarea"
            placeholder="Điểm hay học được, bố cục mở đầu 30 giây đầu..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Gắn vào Project (không nhân bản bản gốc)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {projects.length === 0 ? (
              <span style={{ color: 'var(--rs-text-muted)', fontSize: '13px' }}>
                Chưa có Project nào — sẽ lưu vào Kho ý tưởng chung.
              </span>
            ) : (
              projects.map((p) => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.includes(p.id)}
                    onChange={() => togglePid(p.id)}
                  />
                  <span>{p.name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {selectedProjectIds.length > 0 && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Góc khai thác cho Project đã chọn</span>
            <input
              type="text"
              className="rs-input"
              placeholder="Ví dụ: Bóc tách case study cho khán giả Việt Nam"
              value={projectAngle}
              onChange={(e) => setProjectAngle(e.target.value)}
            />
          </label>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={inGlobalVault} onChange={(e) => setInGlobalVault(e.target.checked)} />
          <span>Hiển thị trong Kho ý tưởng chung (Global Vault)</span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            disabled={!title.trim()}
            onClick={() => {
              saveIdea({
                title,
                notes,
                sourceType: draft.sourceType,
                sourceRefId: draft.sourceRefId,
                sourceTitleSnapshot: draft.sourceTitleSnapshot,
                sourceUrl: draft.sourceUrl,
                tags: draft.tags,
                inGlobalVault,
                targetProjectIds: selectedProjectIds,
                projectAngle,
              });
              onClose();
            }}
          >
            Lưu Ý tưởng vĩnh viễn
          </button>
        </div>
      </div>
    </div>
  );
};

export const SaveIdeaModal: React.FC = () => {
  const { saveIdeaModalDraft, openSaveIdeaModal } = usePrototypeWorkspace();
  if (!saveIdeaModalDraft) return null;
  return (
    <SaveIdeaModalBody
      key={`${saveIdeaModalDraft.sourceRefId}-${saveIdeaModalDraft.title}`}
      draft={saveIdeaModalDraft}
      onClose={() => openSaveIdeaModal(null)}
    />
  );
};

export const ConfirmDeleteModal: React.FC<{
  open: boolean;
  title: string;
  warningText: string;
  requireExactText?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ open, title, warningText, requireExactText, confirmLabel, onCancel, onConfirm }) => {
  const [typed, setTyped] = useState('');
  if (!open) return null;

  const isConfirmed = requireExactText ? typed.trim() === requireExactText : true;

  return (
    <div className="rs-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-del-title">
      <div className="rs-modal">
        <h2 id="confirm-del-title" style={{ margin: 0, fontSize: '17px', color: 'var(--rs-danger-text)' }}>
          {title}
        </h2>
        <p style={{ margin: 0, color: 'var(--rs-text-secondary)' }}>{warningText}</p>
        {requireExactText && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              Nhập chính xác <code>{requireExactText}</code> để mở khóa nút xóa:
            </span>
            <input
              type="text"
              className="rs-input"
              placeholder={requireExactText}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={onCancel}>
            Hủy bỏ
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-danger"
            disabled={!isConfirmed}
            onClick={() => {
              setTyped('');
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const LegalConsentModal: React.FC = () => {
  const { legalModalOpen, setLegalModalOpen, acceptLegalConsent, systemSettings } = usePrototypeWorkspace();
  const [submitting, setSubmitting] = useState(false);
  if (!legalModalOpen) return null;

  return (
    <div className="rs-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
      <div className="rs-modal">
        <h2 id="legal-modal-title" style={{ margin: 0, fontSize: '17px' }}>
          Chính sách Quyền riêng tư &amp; Điều khoản YouTube API Services
        </h2>
        <div style={{ fontSize: '13.5px', color: 'var(--rs-text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0 }}>
            Research Studio sử dụng <strong>YouTube API Services</strong> bằng khóa API cá nhân của chính bạn để tra cứu
            dữ liệu công khai trên máy Windows 11 cục bộ.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              Sử dụng tính năng YouTube đồng nghĩa bạn đồng ý chịu sự ràng buộc của{' '}
              <a href={systemSettings.legalLinks.youtubeTosUrl} target="_blank" rel="noreferrer">
                YouTube Terms of Service
              </a>
              .
            </li>
            <li>
              Xem thêm{' '}
              <a href={systemSettings.legalLinks.googlePrivacyUrl} target="_blank" rel="noreferrer">
                Google Privacy Policy
              </a>
              .
            </li>
            <li>
              Dữ liệu YouTube API lưu cục bộ tối đa <strong>30 ngày lịch</strong>, 0% Telemetry, không gửi dữ liệu nghiên
              cứu lên cloud bên thứ ba.
            </li>
          </ul>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            className="rs-btn rs-btn-secondary"
            disabled={submitting}
            onClick={() => setLegalModalOpen(false)}
          >
            Đóng
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            disabled={submitting}
            onClick={() => {
              void (async () => {
                setSubmitting(true);
                try {
                  const ok = await acceptLegalConsent(true);
                  if (ok) {
                    setLegalModalOpen(false);
                  }
                } finally {
                  setSubmitting(false);
                }
              })();
            }}
          >
            {submitting ? 'Đang lưu...' : 'Tôi đã đọc & Đồng ý'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const VideoInspectorDrawer: React.FC = () => {
  const { inspectorVideoId, openInspectorVideo, openSaveIdeaModal } = usePrototypeWorkspace();
  const { navigate } = useAppNavigation();
  if (!inspectorVideoId) return null;

  const video = DEMO_VIDEOS.find((v) => v.id === inspectorVideoId);
  if (!video) return null;

  return (
    <aside className="rs-drawer" aria-label="Panel xem nhanh video">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Xem nhanh Video (Inspector)</strong>
        <button type="button" className="rs-btn rs-btn-ghost rs-btn-sm" onClick={() => openInspectorVideo(null)}>
          Đóng ×
        </button>
      </div>
      <div className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 700, lineHeight: 1.35 }}>{video.title}</div>
        <div style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
          {video.channelTitle} · Đăng {video.publishedAt} · {video.durationDisplay}
        </div>
        <div className="rs-tabular" style={{ display: 'flex', gap: 12, fontSize: '13px' }}>
          <span>👁 {formatInt(video.viewCount)}</span>
          <span>👍 {formatInt(video.likeCount)}</span>
          <span>💬 {formatInt(video.commentCount)}</span>
        </div>
        <FormatBadgeGroup video={video} compact />
        <SparklineCell
          points={video.snapshots30d.map((s) => s.viewCount)}
          labels={video.snapshots30d.map((s) => s.capturedAt)}
          badgeLabel="Mốc viewCount thô <= 30 ngày"
          directionLabel={
            video.snapshots30d.length >= 2
              ? `+${formatInt(video.snapshots30d[video.snapshots30d.length - 1].viewCount - video.snapshots30d[0].viewCount)}`
              : '1 mốc'
          }
          tooltipTitle="Chuỗi mốc thô SQLite"
          tooltipDetail="Hiển thị nguyên bản số liệu các lần thu thập <= 30 ngày, không tính tỷ lệ."
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="rs-btn rs-btn-primary rs-btn-sm"
          onClick={() =>
            openSaveIdeaModal({
              title: video.title,
              sourceType: 'youtube_video',
              sourceRefId: video.id,
              sourceTitleSnapshot: video.title,
              sourceUrl: `https://www.youtube.com/watch?v=${video.id}`,
              tags: video.tags,
            })
          }
        >
          + Lưu Ý tưởng
        </button>
        <button
          type="button"
          className="rs-btn rs-btn-secondary rs-btn-sm"
          onClick={() => navigate('video-detail', { params: { videoId: video.id, fromChannelId: video.channelId } })}
        >
          Mở Chi tiết đầy đủ →
        </button>
      </div>
    </aside>
  );
};
