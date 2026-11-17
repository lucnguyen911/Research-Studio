import React, { useState } from 'react';
import { getTranslations } from '../i18n/translations';
import { formatInt, formatSnapshotDeltaLabel } from '../prototype/demoData';
import type { IdeaPriority, ProjectItem } from '../prototype/types';
import { useAppNavigation } from '../state/navigationStore';
import { usePrototypeWorkspace, type SaveIdeaDraft } from '../state/workspaceContext';
import { FormatBadgeGroup } from './FormatBadgeGroup';
import { SparklineCell } from './SparklineCell';

export const CreateProjectModal: React.FC = () => {
  const { uiLanguage, createProjectModalOpen, setCreateProjectModalOpen, createProject, systemSettings } =
    usePrototypeWorkspace();
  const t = getTranslations(uiLanguage);
  const m = t.modals;
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
            {m.createProjectTitle}
          </h2>
          <button
            type="button"
            className="rs-btn rs-btn-ghost rs-btn-sm"
            disabled={submitting}
            onClick={() => setCreateProjectModalOpen(false)}
          >
            {t.common.close}
          </button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>{m.projectNameLabel}</span>
          <input
            type="text"
            className="rs-input"
            placeholder={m.projectNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>{m.projectDescLabel}</span>
          <textarea
            className="rs-textarea"
            placeholder={m.projectDescPlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="rs-grid-3">
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{m.regionLabel}</span>
            <select className="rs-select" value={regionCode} onChange={(e) => setRegionCode(e.target.value)}>
              {t.trends.regions.slice(0, 3).map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{m.languageLabel}</span>
            <select className="rs-select" value={relevanceLanguage} onChange={(e) => setRelevanceLanguage(e.target.value)}>
              <option value="vi">{m.langViOption}</option>
              <option value="en">{m.langEnOption}</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{m.targetFormatLabel}</span>
            <select
              className="rs-select"
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value as ProjectItem['targetFormat'])}
            >
              <option value="all">{m.formatAll}</option>
              <option value="long_form">{m.formatLong}</option>
              <option value="shorts">{m.formatShorts}</option>
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
            {t.common.cancel}
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
            {submitting ? t.common.saving : m.createProjectSubmit}
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
  const { uiLanguage, projects, saveIdea } = usePrototypeWorkspace();
  const t = getTranslations(uiLanguage);
  const m = t.modals;
  const [title, setTitle] = useState(draft.title);
  const [notes, setNotes] = useState('');
  const [projectAngle, setProjectAngle] = useState('');
  const [priority, setPriority] = useState<IdeaPriority>('medium');
  const [inGlobalVault, setInGlobalVault] = useState(true);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(() =>
    currentEntry.projectId && projects.some((p) => p.id === currentEntry.projectId) ? [currentEntry.projectId] : [],
  );
  const [saving, setSaving] = useState(false);

  const togglePid = (pid: string) => {
    setSelectedProjectIds((prev) => (prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]));
  };

  return (
    <div className="rs-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="save-idea-title">
      <div className="rs-modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="save-idea-title" style={{ margin: 0, fontSize: '17px' }}>
            {m.saveIdeaTitle}
          </h2>
          <button type="button" className="rs-btn rs-btn-ghost rs-btn-sm" onClick={onClose} disabled={saving}>
            {t.common.close}
          </button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>{m.ideaTitleLabel}</span>
          <input type="text" className="rs-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>{m.ideaNotesLabel}</span>
          <textarea
            className="rs-textarea"
            placeholder={m.ideaNotesPlaceholder}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{m.attachProjectLabel}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {projects.length === 0 ? (
              <span style={{ color: 'var(--rs-text-muted)', fontSize: '13px' }}>{m.noProjectsHint}</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontWeight: 600 }}>{m.projectAngleLabel}</span>
              <input
                type="text"
                className="rs-input"
                placeholder={m.projectAnglePlaceholder}
                value={projectAngle}
                onChange={(e) => setProjectAngle(e.target.value)}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontWeight: 600 }}>{m.priorityLabel}</span>
              <select
                className="rs-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as IdeaPriority)}
              >
                <option value="high">{m.priorityHigh}</option>
                <option value="medium">{m.priorityMedium}</option>
                <option value="low">{m.priorityLow}</option>
              </select>
            </label>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={inGlobalVault} onChange={(e) => setInGlobalVault(e.target.checked)} />
          <span>{m.showInGlobalVault}</span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="rs-btn rs-btn-secondary" onClick={onClose} disabled={saving}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            disabled={!title.trim() || saving}
            onClick={() => {
              setSaving(true);
              void saveIdea({
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
                priority,
              }).then((ok) => {
                setSaving(false);
                if (ok) onClose();
              });
            }}
          >
            {saving ? t.common.saving : m.saveIdeaSubmit}
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
  const { uiLanguage } = usePrototypeWorkspace();
  const t = getTranslations(uiLanguage);
  const m = t.modals;
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
              {m.typeToConfirmPrefix} <code>{requireExactText}</code> {m.typeToConfirmSuffix}
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
            {t.common.cancel}
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
  const { uiLanguage, legalModalOpen, setLegalModalOpen, acceptLegalConsent, systemSettings } =
    usePrototypeWorkspace();
  const t = getTranslations(uiLanguage);
  const m = t.modals;
  const [submitting, setSubmitting] = useState(false);
  if (!legalModalOpen) return null;

  return (
    <div className="rs-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
      <div className="rs-modal">
        <h2 id="legal-modal-title" style={{ margin: 0, fontSize: '17px' }}>
          {m.legalTitle}
        </h2>
        <div style={{ fontSize: '13.5px', color: 'var(--rs-text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0 }}>
            {m.legalIntroBeforeStrong}
            <strong>{m.legalIntroStrong}</strong>
            {m.legalIntroAfterStrong}
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              {m.legalBullet1Before}
              <a href={systemSettings.legalLinks.youtubeTosUrl} target="_blank" rel="noopener noreferrer">
                {m.legalTosLinkText}
              </a>
              .
            </li>
            <li>
              {m.legalBullet2Before}
              <a href={systemSettings.legalLinks.googlePrivacyUrl} target="_blank" rel="noopener noreferrer">
                {m.legalPrivacyLinkText}
              </a>
              .
            </li>
            <li>
              {m.legalBullet3BeforeStrong}
              <strong>{m.legalBullet3Strong}</strong>
              {m.legalBullet3AfterStrong}
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
            {t.common.close}
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
            {submitting ? t.common.saving : m.legalAcceptBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

export const VideoInspectorDrawer: React.FC = () => {
  const { uiLanguage, inspectorVideoId, openInspectorVideo, openSaveIdeaModal, cachedVideosById } =
    usePrototypeWorkspace();
  const { navigate } = useAppNavigation();
  const t = getTranslations(uiLanguage);
  const m = t.modals;
  if (!inspectorVideoId) return null;

  const video = cachedVideosById[inspectorVideoId];
  if (!video) {
    return (
      <aside className="rs-drawer" aria-label={m.quickViewAria}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{m.quickViewTitle}</strong>
          <button type="button" className="rs-btn rs-btn-ghost rs-btn-sm" onClick={() => openInspectorVideo(null)}>
            {m.quickViewClose}
          </button>
        </div>
        <div className="rs-card" style={{ fontSize: '13.5px', color: 'var(--rs-text-secondary)' }}>
          {m.quickViewMissing}
        </div>
      </aside>
    );
  }

  return (
    <aside className="rs-drawer" aria-label={m.quickViewAria}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{m.quickViewTitle}</strong>
        <button type="button" className="rs-btn rs-btn-ghost rs-btn-sm" onClick={() => openInspectorVideo(null)}>
          {m.quickViewClose}
        </button>
      </div>
      <div className="rs-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 700, lineHeight: 1.35 }}>{video.title}</div>
        <div style={{ fontSize: '12.5px', color: 'var(--rs-text-muted)' }}>
          {video.channelTitle} · {m.quickViewPublished} {video.publishedAt} · {video.durationDisplay}
        </div>
        <div className="rs-tabular" style={{ display: 'flex', gap: 12, fontSize: '13px', color: 'var(--rs-text-secondary)' }}>
          <span>{m.quickViewViews(formatInt(video.viewCount))}</span>
          <span>{m.quickViewLikes(formatInt(video.likeCount))}</span>
          <span>{m.quickViewComments(formatInt(video.commentCount))}</span>
        </div>
        <FormatBadgeGroup video={video} compact />
        <SparklineCell
          points={video.snapshots30d.map((s) => s.viewCount)}
          labels={video.snapshots30d.map((s) => s.capturedAt)}
          badgeLabel={t.videoTable.historyTitle}
          directionLabel={formatSnapshotDeltaLabel(video.snapshots30d)}
          tooltipTitle={t.videoTable.historyTitle}
          tooltipDetail={t.videoTable.historyDetail}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
          {t.videoTable.addIdeaBtn}
        </button>
        <button
          type="button"
          className="rs-btn rs-btn-secondary rs-btn-sm"
          onClick={() => navigate('video-detail', { params: { videoId: video.id, fromChannelId: video.channelId } })}
        >
          {m.quickViewDetailBtn}
        </button>
        <a
          href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rs-link-quiet"
          style={{ marginLeft: 'auto' }}
        >
          YouTube ↗
        </a>
      </div>
    </aside>
  );
};
