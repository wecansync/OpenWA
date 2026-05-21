import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, UserMinus, UserPlus, LogOut, ChevronRight } from 'lucide-react';
import { groupsApi, type Group } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSessionsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './Groups.css';

export function Groups() {
  const { t } = useTranslation();
  useDocumentTitle(t('groups.title'));
  const queryClient = useQueryClient();

  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const sessions = allSessions.filter((s) => s.status === 'ready');
  const [sessionId, setSessionId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createParticipants, setCreateParticipants] = useState('');
  const [addParticipantsInput, setAddParticipantsInput] = useState('');
  const [editSubject, setEditSubject] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const invalidateGroups = () => {
    void queryClient.invalidateQueries({ queryKey: ['groups', sessionId] });
    void queryClient.invalidateQueries({ queryKey: ['group-detail', sessionId, selectedGroupId] });
  };

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['groups', sessionId],
    queryFn: () => groupsApi.list(sessionId),
    enabled: !!sessionId,
  });

  const { data: groupDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['group-detail', sessionId, selectedGroupId],
    queryFn: () => groupsApi.getById(sessionId, selectedGroupId!),
    enabled: !!sessionId && !!selectedGroupId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      groupsApi.create(sessionId, createName, createParticipants.split(',').map((s) => s.trim()).filter(Boolean)),
    onSuccess: () => {
      setShowCreate(false);
      setCreateName('');
      setCreateParticipants('');
      invalidateGroups();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const addParticipantsMutation = useMutation({
    mutationFn: (participants: string[]) => groupsApi.addParticipants(sessionId, selectedGroupId!, participants),
    onSuccess: () => { setAddParticipantsInput(''); invalidateGroups(); },
    onError: (err: Error) => setActionError(err.message),
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (participant: string) => groupsApi.removeParticipants(sessionId, selectedGroupId!, [participant]),
    onSuccess: invalidateGroups,
    onError: (err: Error) => setActionError(err.message),
  });

  const updateSubjectMutation = useMutation({
    mutationFn: (subject: string) => groupsApi.updateSubject(sessionId, selectedGroupId!, subject),
    onSuccess: () => { setEditSubject(null); invalidateGroups(); },
    onError: (err: Error) => setActionError(err.message),
  });

  const updateDescMutation = useMutation({
    mutationFn: (description: string) => groupsApi.updateDescription(sessionId, selectedGroupId!, description),
    onSuccess: () => { setEditDesc(null); invalidateGroups(); },
    onError: (err: Error) => setActionError(err.message),
  });

  const leaveGroupMutation = useMutation({
    mutationFn: () => groupsApi.leave(sessionId, selectedGroupId!),
    onSuccess: () => { setSelectedGroupId(null); invalidateGroups(); },
    onError: (err: Error) => setActionError(err.message),
  });

  const detail = groupDetail as (Group & { participants?: { id: string; name?: string }[] }) | undefined;

  return (
    <div className="groups-page">
      <PageHeader
        title={t('groups.title')}
        actions={
          sessionId ? (
            <button className="groups-create-btn" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              {t('groups.createGroup')}
            </button>
          ) : undefined
        }
      />

      {/* Create group modal */}
      {showCreate && (
        <div className="groups-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="groups-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="groups-modal-title">{t('groups.createGroup')}</h3>
            <input
              className="groups-input"
              placeholder={t('groups.groupName')}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
            <textarea
              className="groups-textarea"
              placeholder={t('groups.participantsPlaceholder')}
              value={createParticipants}
              onChange={(e) => setCreateParticipants(e.target.value)}
              rows={3}
            />
            <div className="groups-modal-actions">
              <button
                className="groups-btn-primary"
                disabled={!createName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {t('groups.create')}
              </button>
              <button className="groups-btn-secondary" onClick={() => setShowCreate(false)}>
                {t('groups.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="groups-session-bar">
        <select
          className="groups-select"
          value={sessionId}
          onChange={(e) => { setSessionId(e.target.value); setSelectedGroupId(null); }}
          disabled={loadingSessions}
        >
          <option value="">{t('groups.selectSession')}</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {sessionId && (
        <div className="groups-layout">
          {/* Groups list */}
          <div className="groups-list-panel">
            {loadingGroups ? (
              <div className="groups-loading"><span className="groups-spinner" /></div>
            ) : groups.length === 0 ? (
              <div className="groups-empty">{t('groups.noGroups')}</div>
            ) : (
              (groups as Group[]).map((g) => (
                <button
                  key={g.id}
                  className={`groups-list-item${selectedGroupId === g.id ? ' selected' : ''}`}
                  onClick={() => { setSelectedGroupId(g.id); setActionError(''); setEditSubject(null); setEditDesc(null); }}
                >
                  <div className="groups-list-icon"><Users size={16} /></div>
                  <div className="groups-list-info">
                    <span className="groups-list-name">{g.name}</span>
                  </div>
                  <ChevronRight size={14} className="groups-list-arrow" />
                </button>
              ))
            )}
          </div>

          {/* Group detail */}
          <div className="groups-detail-panel">
            {!selectedGroupId ? (
              <div className="groups-empty">{t('groups.selectGroup')}</div>
            ) : loadingDetail ? (
              <div className="groups-loading"><span className="groups-spinner" /></div>
            ) : !detail ? (
              <div className="groups-empty">{t('groups.notFound')}</div>
            ) : (
              <>
                {actionError && <div className="groups-error">{actionError}</div>}

                {/* Subject */}
                <div className="groups-detail-field">
                  <label className="groups-detail-label">{t('groups.subject')}</label>
                  {editSubject !== null ? (
                    <div className="groups-edit-row">
                      <input
                        className="groups-input"
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                      />
                      <button
                        className="groups-btn-primary groups-btn-sm"
                        onClick={() => updateSubjectMutation.mutate(editSubject)}
                        disabled={updateSubjectMutation.isPending}
                      >{t('groups.save')}</button>
                      <button className="groups-btn-secondary groups-btn-sm" onClick={() => setEditSubject(null)}>{t('groups.cancel')}</button>
                    </div>
                  ) : (
                    <div className="groups-edit-row">
                      <span className="groups-detail-value">{detail.name}</span>
                      <button className="groups-btn-ghost" onClick={() => setEditSubject(detail.name ?? '')}>{t('groups.edit')}</button>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="groups-detail-field">
                  <label className="groups-detail-label">{t('groups.description')}</label>
                  {editDesc !== null ? (
                    <div className="groups-edit-row">
                      <input
                        className="groups-input"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                      <button
                        className="groups-btn-primary groups-btn-sm"
                        onClick={() => updateDescMutation.mutate(editDesc)}
                        disabled={updateDescMutation.isPending}
                      >{t('groups.save')}</button>
                      <button className="groups-btn-secondary groups-btn-sm" onClick={() => setEditDesc(null)}>{t('groups.cancel')}</button>
                    </div>
                  ) : (
                    <div className="groups-edit-row">
                      <span className="groups-detail-value">{(detail as { description?: string }).description ?? '—'}</span>
                      <button className="groups-btn-ghost" onClick={() => setEditDesc((detail as { description?: string }).description ?? '')}>{t('groups.edit')}</button>
                    </div>
                  )}
                </div>

                {/* Participants */}
                <div className="groups-detail-field">
                  <label className="groups-detail-label">{t('groups.participants')}</label>
                  <div className="groups-add-row">
                    <input
                      className="groups-input"
                      placeholder={t('groups.addParticipantsPlaceholder')}
                      value={addParticipantsInput}
                      onChange={(e) => setAddParticipantsInput(e.target.value)}
                    />
                    <button
                      className="groups-btn-primary groups-btn-sm"
                      disabled={!addParticipantsInput.trim() || addParticipantsMutation.isPending}
                      onClick={() =>
                        addParticipantsMutation.mutate(
                          addParticipantsInput.split(',').map((s) => s.trim()).filter(Boolean)
                        )
                      }
                    >
                      <UserPlus size={13} />
                    </button>
                  </div>
                  <ul className="groups-participants-list">
                    {(detail.participants ?? []).map((p) => (
                      <li key={p.id} className="groups-participant-item">
                        <span className="groups-participant-id">{p.name ?? p.id}</span>
                        <span className="groups-participant-sub">{p.name ? p.id : ''}</span>
                        <button
                          className="groups-remove-btn"
                          onClick={() => removeParticipantMutation.mutate(p.id)}
                          title={t('groups.removeParticipant')}
                        >
                          <UserMinus size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Leave */}
                <div className="groups-danger-zone">
                  <button
                    className="groups-leave-btn"
                    onClick={() => { if (window.confirm(t('groups.leaveConfirm'))) leaveGroupMutation.mutate(); }}
                    disabled={leaveGroupMutation.isPending}
                  >
                    <LogOut size={14} />
                    {t('groups.leaveGroup')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
