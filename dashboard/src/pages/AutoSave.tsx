import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Save } from 'lucide-react';
import { autoSaveApi, type AutoSaveConfig } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import './AutoSave.css';

export function AutoSave() {
  const { t } = useTranslation();
  useDocumentTitle(t('autoSave.title'));
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['auto-save-config'],
    queryFn: () => autoSaveApi.getConfig(),
  });

  const [form, setForm] = useState<AutoSaveConfig | null>(null);
  const current = form ?? config ?? { enabled: false, intervalMinutes: 60, savePath: './data/statuses', sessions: [] };

  const saveMutation = useMutation({
    mutationFn: (cfg: Partial<AutoSaveConfig>) => autoSaveApi.updateConfig(cfg),
    onSuccess: (updated) => {
      void queryClient.setQueryData(['auto-save-config'], updated);
      setForm(null);
    },
  });

  const runMutation = useMutation({
    mutationFn: () => autoSaveApi.runNow(),
  });

  const isDirty = form !== null;

  return (
    <div className="autosave-page">
      <PageHeader
        title={t('autoSave.title')}
        actions={
          <button
            className="autosave-run-btn"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            <Play size={15} />
            {runMutation.isPending ? t('autoSave.running') : t('autoSave.runNow')}
          </button>
        }
      />

      {runMutation.isSuccess && (
        <div className="autosave-toast success">{t('autoSave.jobQueued')}</div>
      )}

      {isLoading ? (
        <div className="autosave-loading"><span className="autosave-spinner" /></div>
      ) : (
        <div className="autosave-card">
          <div className="autosave-field autosave-field--toggle">
            <label className="autosave-label">{t('autoSave.enabled')}</label>
            <label className="autosave-toggle">
              <input
                type="checkbox"
                checked={current.enabled}
                onChange={(e) => setForm({ ...current, enabled: e.target.checked })}
              />
              <span className="autosave-toggle-slider" />
            </label>
          </div>

          <div className="autosave-field">
            <label className="autosave-label">{t('autoSave.intervalMinutes')}</label>
            <input
              type="number"
              className="autosave-input"
              min={5}
              max={1440}
              value={current.intervalMinutes}
              onChange={(e) => setForm({ ...current, intervalMinutes: parseInt(e.target.value, 10) || 60 })}
            />
            <span className="autosave-hint">{t('autoSave.intervalHint')}</span>
          </div>

          <div className="autosave-field">
            <label className="autosave-label">{t('autoSave.savePath')}</label>
            <input
              type="text"
              className="autosave-input"
              value={current.savePath}
              onChange={(e) => setForm({ ...current, savePath: e.target.value })}
            />
            <span className="autosave-hint">{t('autoSave.savePathHint')}</span>
          </div>

          <div className="autosave-field">
            <label className="autosave-label">{t('autoSave.sessions')}</label>
            <input
              type="text"
              className="autosave-input"
              placeholder={t('autoSave.sessionsPlaceholder')}
              value={current.sessions.join(', ')}
              onChange={(e) =>
                setForm({
                  ...current,
                  sessions: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
            <span className="autosave-hint">{t('autoSave.sessionsHint')}</span>
          </div>

          {isDirty && (
            <div className="autosave-actions">
              <button
                className="autosave-save-btn"
                onClick={() => saveMutation.mutate(current)}
                disabled={saveMutation.isPending}
              >
                <Save size={15} />
                {saveMutation.isPending ? t('autoSave.saving') : t('autoSave.save')}
              </button>
              <button className="autosave-cancel-btn" onClick={() => setForm(null)}>
                {t('autoSave.cancel')}
              </button>
            </div>
          )}

          {saveMutation.isError && (
            <div className="autosave-toast error">
              {(saveMutation.error as Error).message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
