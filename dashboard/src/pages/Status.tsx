import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Image, Video, Music, FileText, Play, User, Eye, RefreshCw, X, Search, Archive } from 'lucide-react';
import { statusApi, type StatusContact, type StatusItem } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSessionsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './Status.css';

function typeIcon(type: StatusItem['type']) {
  switch (type) {
    case 'image': return <Image size={14} />;
    case 'video': return <Video size={14} />;
    case 'audio': return <Music size={14} />;
    case 'gif': return <Play size={14} />;
    default: return <FileText size={14} />;
  }
}

function typeLabel(type: StatusItem['type'], t: (k: string) => string) {
  const map: Record<string, string> = {
    image: t('status.typeImage'),
    video: t('status.typeVideo'),
    audio: t('status.typeAudio'),
    gif: t('status.typeGif'),
    text: t('status.typeText'),
  };
  return map[type] ?? type;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString();
}

function contactDisplayName(c: StatusContact) {
  return c.name ?? c.pushName ?? c.contactId;
}

interface PreviewState {
  objectUrl: string;
  type: StatusItem['type'];
}

export function Status() {
  const { t } = useTranslation();
  useDocumentTitle(t('status.title'));

  const queryClient = useQueryClient();
  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const sessions = allSessions.filter((s) => s.status === 'ready');

  const [sessionId, setSessionId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAllContact, setDownloadingAllContact] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [search, setSearch] = useState('');
  const previewUrlRef = useRef<string | null>(null);

  // Revoke previous preview objectURL when preview changes
  useEffect(() => {
    if (preview) {
      previewUrlRef.current = preview.objectUrl;
    }
    return () => {
      if (previewUrlRef.current && !preview) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [preview]);

  const closePreview = useCallback(() => {
    if (preview) {
      URL.revokeObjectURL(preview.objectUrl);
    }
    setPreview(null);
  }, [preview]);

  // Close preview on Escape key
  useEffect(() => {
    if (!preview) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closePreview(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [preview, closePreview]);

  const handleDownload = useCallback(async (contactId: string, messageId: string) => {
    setDownloadingId(messageId);
    try {
      await statusApi.downloadMedia(sessionId, contactId, messageId);
    } finally {
      setDownloadingId(null);
    }
  }, [sessionId]);

  const handlePreview = useCallback(async (contactId: string, item: StatusItem) => {
    setPreviewingId(item.messageId);
    try {
      const result = await statusApi.previewMedia(sessionId, contactId, item.messageId);
      setPreview({ objectUrl: result.objectUrl, type: item.type });
    } finally {
      setPreviewingId(null);
    }
  }, [sessionId]);

  const handleDownloadAllContact = useCallback(async (contactId: string) => {
    setDownloadingAllContact(contactId);
    try {
      await statusApi.downloadAllContactMedia(sessionId, contactId);
    } finally {
      setDownloadingAllContact(null);
    }
  }, [sessionId]);

  const handleDownloadAll = useCallback(async () => {
    setDownloadingAll(true);
    try {
      await statusApi.downloadAllMedia(sessionId);
    } finally {
      setDownloadingAll(false);
    }
  }, [sessionId]);

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['status-contacts', sessionId] });
    void queryClient.invalidateQueries({ queryKey: ['status-items', sessionId, selectedContactId] });
  }, [queryClient, sessionId, selectedContactId]);

  const {
    data: contactsData,
    isLoading: loadingContacts,
    error: contactsError,
  } = useQuery({
    queryKey: ['status-contacts', sessionId],
    queryFn: () => statusApi.listContacts(sessionId),
    enabled: !!sessionId,
    staleTime: 30_000,
  });

  const {
    data: itemsData,
    isLoading: loadingItems,
    error: itemsError,
  } = useQuery({
    queryKey: ['status-items', sessionId, selectedContactId],
    queryFn: () => statusApi.listItems(sessionId, selectedContactId!),
    enabled: !!sessionId && !!selectedContactId,
    staleTime: 30_000,
  });

  const allContacts: StatusContact[] = contactsData?.contacts ?? [];
  const contacts = search.trim()
    ? allContacts.filter((c) =>
        contactDisplayName(c).toLowerCase().includes(search.toLowerCase()) ||
        c.contactId.includes(search)
      )
    : allContacts;
  const items: StatusItem[] = itemsData?.items ?? [];

  return (
    <div className="status-page">
      <PageHeader
        title={t('status.title')}
        actions={
          sessionId ? (
            <div className="status-header-actions">
              {allContacts.length > 0 && (
                <button
                  className="status-download-all-btn"
                  onClick={() => void handleDownloadAll()}
                  disabled={downloadingAll}
                  title={t('status.downloadAll')}
                >
                  <Archive size={15} />
                  {downloadingAll ? t('status.downloadingAll') : t('status.downloadAll')}
                </button>
              )}
              <button
                className="status-refresh-btn"
                onClick={handleRefresh}
                title={t('status.refresh')}
              >
                <RefreshCw size={15} />
                {t('status.refresh')}
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="status-session-bar">
        <select
          className="status-session-select"
          value={sessionId}
          onChange={(e) => {
            setSessionId(e.target.value);
            setSelectedContactId(null);
            setSearch('');
          }}
          disabled={loadingSessions}
        >
          <option value="">{t('status.selectSession')}</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.phone ?? s.id})
            </option>
          ))}
        </select>
      </div>

      <div className="status-layout">
        {/* Left panel — contacts */}
        <div className="status-contacts-panel">
          {sessionId && allContacts.length > 0 && (
            <div className="status-search-wrap">
              <Search size={14} className="status-search-icon" />
              <input
                className="status-search-input"
                type="text"
                placeholder={t('status.searchContacts')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {!sessionId ? null : loadingContacts ? (
            <div className="status-loading">
              <span className="status-spinner" />
            </div>
          ) : contactsError ? (
            <div className="status-error">{t('status.loadError')}</div>
          ) : contacts.length === 0 ? (
            <div className="status-empty">{t('status.noContacts')}</div>
          ) : (
            contacts.map((c) => (
              <button
                key={c.contactId}
                className={`status-contact-card${selectedContactId === c.contactId ? ' selected' : ''}`}
                onClick={() => setSelectedContactId(c.contactId)}
              >
                <div className="status-contact-avatar">
                  {c.profilePicUrl ? (
                    <img
                      src={c.profilePicUrl}
                      alt={contactDisplayName(c)}
                      className="status-contact-avatar-img"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <div className="status-contact-info">
                  <span className="status-contact-name">{contactDisplayName(c)}</span>
                  {c.pushName && c.name && c.name !== c.pushName && (
                    <span className="status-contact-push">{c.pushName}</span>
                  )}
                  <span className="status-contact-time">{formatTime(c.lastTimestamp)}</span>
                </div>
                <div className="status-contact-badges">
                  <span className="status-badge total">{c.totalCount}</span>
                  {c.unreadCount > 0 && (
                    <span className="status-badge unread">{c.unreadCount}</span>
                  )}
                  <button
                    className="status-contact-dl-all-btn"
                    disabled={downloadingAllContact === c.contactId}
                    title={t('status.downloadAllContact')}
                    onClick={(e) => { e.stopPropagation(); void handleDownloadAllContact(c.contactId); }}
                  >
                    {downloadingAllContact === c.contactId ? <RefreshCw size={12} className="spin" /> : <Archive size={12} />}
                  </button>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Right panel — items */}
        <div className="status-items-panel">
          {!selectedContactId ? (
            <div className="status-empty">{t('status.selectContact')}</div>
          ) : loadingItems ? (
            <div className="status-loading">
              <span className="status-spinner" />
            </div>
          ) : itemsError ? (
            <div className="status-error">{t('status.loadError')}</div>
          ) : items.length === 0 ? (
            <div className="status-empty">{t('status.noItems')}</div>
          ) : (
            <div className="status-items-grid">
              {items.map((item) => (
                <div key={item.messageId} className="status-item-card">
                  <div className="status-item-header">
                    <span className={`status-type-badge type-${item.type}`}>
                      {typeIcon(item.type)}
                      {typeLabel(item.type, t)}
                    </span>
                    <span className="status-item-time">{formatTime(item.timestamp)}</span>
                  </div>
                  {item.caption && <p className="status-item-caption">{item.caption}</p>}
                  {item.type === 'text' && item.text && (
                    <p className="status-item-text">{item.text}</p>
                  )}
                  {item.hasMedia && (
                    <div className="status-item-actions">
                      <button
                        className="status-preview-btn"
                        disabled={previewingId === item.messageId}
                        onClick={() => handlePreview(selectedContactId, item)}
                      >
                        <Eye size={14} />
                        {previewingId === item.messageId ? t('status.previewing') : t('status.preview')}
                      </button>
                      <button
                        className="status-download-btn"
                        disabled={downloadingId === item.messageId}
                        onClick={() => handleDownload(selectedContactId, item.messageId)}
                      >
                        <Download size={14} />
                        {downloadingId === item.messageId ? t('status.downloading') : t('status.download')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="status-preview-overlay" onClick={closePreview}>
          <div className="status-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button className="status-preview-close" onClick={closePreview} title={t('status.closePreview')}>
              <X size={20} />
            </button>
            {(preview.type === 'image' || preview.type === 'gif') && (
              <img src={preview.objectUrl} alt="" className="status-preview-media" />
            )}
            {preview.type === 'video' && (
              <video src={preview.objectUrl} controls autoPlay className="status-preview-media" />
            )}
            {preview.type === 'audio' && (
              <audio src={preview.objectUrl} controls autoPlay className="status-preview-audio" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
