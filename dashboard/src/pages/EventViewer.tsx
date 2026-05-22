import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Pause, Play, Filter } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSessionsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './EventViewer.css';

const API_BASE = window.location.origin;

const EVENT_TYPES = [
  'message.received',
  'message.sent',
  'message.ack',
  'message.revoked',
  'session.status',
  'session.qr',
  'session.authenticated',
  'session.disconnected',
  'group.join',
  'group.leave',
  'group.update',
] as const;

interface LogEntry {
  id: number;
  ts: string;
  sessionId: string;
  event: string;
  payload: unknown;
}

let entryCounter = 0;

export function EventViewer() {
  const { t } = useTranslation();
  useDocumentTitle(t('eventViewer.title'));

  const { data: allSessions = [] } = useSessionsQuery();
  const [sessionFilter, setSessionFilter] = useState('*');
  const [eventFilter, setEventFilter] = useState<Set<string>>(new Set(['*']));
  const [paused, setPaused] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const pausedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  pausedRef.current = paused;

  const addEntry = useCallback((entry: LogEntry) => {
    if (pausedRef.current) return;
    setLog((prev) => {
      const next = [...prev, entry];
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });
  }, []);

  useEffect(() => {
    if (!bottomRef.current || paused) return;
    bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [log, paused]);

  useEffect(() => {
    const apiKey = sessionStorage.getItem('openwa_api_key') ?? '';

    const socket = io(`${API_BASE}/events`, {
      auth: { apiKey },
      query: { apiKey },
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('message', {
        type: 'subscribe',
        sessionId: '*',
        events: ['*'],
        requestId: 'ev-viewer-global',
      });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('message', (msg: { type: string; payload?: { event: string; sessionId: string; data: unknown } }) => {
      if (msg.type !== 'event' || !msg.payload) return;
      const { event, sessionId, data } = msg.payload;
      addEntry({ id: ++entryCounter, ts: new Date().toISOString(), sessionId, event, payload: data });
    });

    return () => { socket.disconnect(); };
  }, [addEntry]);

  const filteredLog = log.filter((e) => {
    if (sessionFilter !== '*' && e.sessionId !== sessionFilter) return false;
    if (!eventFilter.has('*') && !eventFilter.has(e.event)) return false;
    return true;
  });

  const toggleEventFilter = (ev: string) => {
    setEventFilter((prev) => {
      const next = new Set(prev);
      if (ev === '*') return new Set(['*']);
      next.delete('*');
      if (next.has(ev)) { next.delete(ev); if (next.size === 0) next.add('*'); }
      else next.add(ev);
      return next;
    });
  };

  return (
    <div className="ev-page">
      <PageHeader
        title={t('eventViewer.title')}
        actions={
          <div className="ev-header-actions">
            <span className={`ev-status-dot ${connected ? 'connected' : 'disconnected'}`} />
            <span className="ev-status-label">
              {connected ? t('eventViewer.connected') : t('eventViewer.disconnected')}
            </span>
            <button className="ev-icon-btn" onClick={() => setPaused((p) => !p)} title={paused ? t('eventViewer.resume') : t('eventViewer.pause')}>
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <button className="ev-icon-btn" onClick={() => setLog([])} title={t('eventViewer.clear')}>
              <Trash2 size={15} />
            </button>
          </div>
        }
      />

      <div className="ev-toolbar">
        <div className="ev-filter-group">
          <Filter size={13} />
          <select
            className="ev-select"
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
          >
            <option value="*">{t('eventViewer.allSessions')}</option>
            {allSessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="ev-event-chips">
          {(['*', ...EVENT_TYPES] as string[]).map((ev) => (
            <button
              key={ev}
              className={`ev-chip ${eventFilter.has(ev) ? 'active' : ''}`}
              onClick={() => toggleEventFilter(ev)}
            >
              {ev === '*' ? t('eventViewer.allEvents') : ev}
            </button>
          ))}
        </div>
      </div>

      <div className="ev-log">
        {filteredLog.length === 0 ? (
          <div className="ev-empty">{t('eventViewer.noEvents')}</div>
        ) : (
          filteredLog.map((entry) => (
            <div key={entry.id} className={`ev-row ev-row--${entry.event.split('.')[0]}`}>
              <span className="ev-ts">{new Date(entry.ts).toLocaleTimeString()}</span>
              <span className="ev-session">{entry.sessionId}</span>
              <span className={`ev-event-badge ev-event--${entry.event.replace('.', '-')}`}>{entry.event}</span>
              <span className="ev-payload">
                {entry.event === 'session.qr'
                  ? '[QR omitted]'
                  : JSON.stringify(entry.payload).slice(0, 200)}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
