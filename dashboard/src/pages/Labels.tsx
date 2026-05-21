import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Plus, X } from 'lucide-react';
import { labelsApi, type Label } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSessionsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './Labels.css';

export function Labels() {
  const { t } = useTranslation();
  useDocumentTitle(t('labels.title'));
  const queryClient = useQueryClient();

  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const sessions = allSessions.filter((s) => s.status === 'ready');
  const [sessionId, setSessionId] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);
  const [addChatId, setAddChatId] = useState('');
  const [addError, setAddError] = useState('');

  const { data: labels = [], isLoading: loadingLabels, error: labelsError } = useQuery({
    queryKey: ['labels', sessionId],
    queryFn: () => labelsApi.list(sessionId),
    enabled: !!sessionId,
  });

  const removeMutation = useMutation({
    mutationFn: ({ chatId, labelId }: { chatId: string; labelId: string }) =>
      labelsApi.removeFromChat(sessionId, chatId, labelId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['label-chats', sessionId, selectedLabel?.id] }),
  });

  const addMutation = useMutation({
    mutationFn: ({ chatId, labelId }: { chatId: string; labelId: string }) =>
      labelsApi.addToChat(sessionId, chatId, labelId),
    onSuccess: () => {
      setAddChatId('');
      setAddError('');
      void queryClient.invalidateQueries({ queryKey: ['label-chats', sessionId, selectedLabel?.id] });
    },
    onError: (err: Error) => setAddError(err.message),
  });

  const handleAdd = () => {
    if (!selectedLabel || !addChatId.trim()) return;
    addMutation.mutate({ chatId: addChatId.trim(), labelId: selectedLabel.id });
  };

  return (
    <div className="labels-page">
      <PageHeader title={t('labels.title')} />

      <div className="labels-session-bar">
        <select
          className="labels-select"
          value={sessionId}
          onChange={(e) => { setSessionId(e.target.value); setSelectedLabel(null); }}
          disabled={loadingSessions}
        >
          <option value="">{t('labels.selectSession')}</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {sessionId && (
        <div className="labels-layout">
          {/* Left — label list */}
          <div className="labels-list-panel">
            <h3 className="labels-panel-title">{t('labels.allLabels')}</h3>
            {loadingLabels ? (
              <div className="labels-loading"><span className="labels-spinner" /></div>
            ) : labelsError ? (
              <div className="labels-error">{t('labels.businessOnly')}</div>
            ) : labels.length === 0 ? (
              <div className="labels-empty">{t('labels.noLabels')}</div>
            ) : (
              labels.map((label) => (
                <button
                  key={label.id}
                  className={`labels-label-item${selectedLabel?.id === label.id ? ' selected' : ''}`}
                  onClick={() => setSelectedLabel(label)}
                >
                  <span
                    className="labels-color-dot"
                    style={{ background: label.hexColor ?? '#cbd5e0' }}
                  />
                  <span className="labels-label-name">{label.name}</span>
                  <Tag size={13} className="labels-tag-icon" />
                </button>
              ))
            )}
          </div>

          {/* Right — chats with selected label */}
          <div className="labels-chats-panel">
            {!selectedLabel ? (
              <div className="labels-empty">{t('labels.selectLabel')}</div>
            ) : (
              <>
                <h3 className="labels-panel-title">
                  <span className="labels-color-dot" style={{ background: selectedLabel.hexColor ?? '#cbd5e0' }} />
                  {selectedLabel.name}
                </h3>

                <div className="labels-add-row">
                  <input
                    type="text"
                    className="labels-input"
                    placeholder={t('labels.chatIdPlaceholder')}
                    value={addChatId}
                    onChange={(e) => setAddChatId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                  />
                  <button
                    className="labels-add-btn"
                    onClick={handleAdd}
                    disabled={!addChatId.trim() || addMutation.isPending}
                  >
                    <Plus size={14} />
                    {t('labels.addChat')}
                  </button>
                </div>
                {addError && <div className="labels-error">{addError}</div>}

                <LabelChats
                  sessionId={sessionId}
                  label={selectedLabel}
                  onRemove={(chatId) => removeMutation.mutate({ chatId, labelId: selectedLabel.id })}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LabelChats({
  sessionId, label, onRemove,
}: { sessionId: string; label: Label; onRemove: (chatId: string) => void }) {
  const { t } = useTranslation();

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ['label-chats', sessionId, label.id],
    queryFn: async () => {
      // API returns label by ID which includes its chats array
      const full = await labelsApi.getById(sessionId, label.id);
      return (full as { chats?: string[] }).chats ?? [];
    },
    enabled: !!sessionId && !!label.id,
  });

  if (isLoading) return <div className="labels-loading"><span className="labels-spinner" /></div>;
  if (chats.length === 0) return <div className="labels-empty">{t('labels.noChats')}</div>;

  return (
    <ul className="labels-chat-list">
      {chats.map((chatId: string) => (
        <li key={chatId} className="labels-chat-item">
          <span className="labels-chat-id">{chatId}</span>
          <button
            className="labels-remove-btn"
            onClick={() => onRemove(chatId)}
            title={t('labels.removeLabel')}
          >
            <X size={13} />
          </button>
        </li>
      ))}
    </ul>
  );
}
