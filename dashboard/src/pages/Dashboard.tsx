import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Webhook, Activity, ArrowUpRight, ArrowDownRight, Loader2, BarChart2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSessionsQuery, useSessionStatsQuery, useWebhooksQuery, useStopSessionMutation } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import { statsApi } from '../services/api';
import './Dashboard.css';

type Period = '24h' | '7d' | '30d';

export function Dashboard() {
  const { t } = useTranslation();
  useDocumentTitle(t('dashboard.title'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('24h');
  const { data: sessions = [], isLoading: loadingSessions, error: sessionsError } = useSessionsQuery();
  const { data: stats } = useSessionStatsQuery();
  const { data: webhooks = [] } = useWebhooksQuery();
  const stopMutation = useStopSessionMutation();

  const { data: overview } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: statsApi.getOverview,
    staleTime: 60_000,
  });

  const { data: msgStats } = useQuery({
    queryKey: ['stats', 'messages', period],
    queryFn: () => statsApi.getMessageStats(period),
    staleTime: 60_000,
  });

  useEffect(() => {
    const id = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    }, 60_000);
    return () => clearInterval(id);
  }, [queryClient]);

  const loading = loadingSessions;
  const error = sessionsError instanceof Error
    ? sessionsError.message
    : sessionsError
      ? t('dashboard.loadError')
      : null;
  const webhookCount = webhooks.length;

  const handleDisconnect = async (id: string) => {
    try {
      await stopMutation.mutateAsync(id);
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const statsCards = [
    {
      label: t('dashboard.stats.activeSessions'),
      value: stats?.active ?? overview?.sessions?.active ?? 0,
      icon: MessageSquare,
      trend: stats?.ready != null ? `+${stats.ready}` : null,
      trendUp: true,
    },
    {
      label: t('dashboard.stats.messagesToday'),
      value: overview?.messages?.today?.sent ?? '—',
      icon: Send,
      trend: null,
      trendUp: null,
    },
    {
      label: t('dashboard.stats.webhooksConfigured'),
      value: webhookCount,
      icon: Webhook,
      trend: null,
      trendUp: null,
    },
    {
      label: t('dashboard.stats.totalMessages'),
      value: overview
        ? (overview.messages.sent + overview.messages.received).toLocaleString()
        : '—',
      icon: Activity,
      trend: null,
      trendUp: null,
    },
  ];

  const formatLastActive = (date?: string) => {
    if (!date) return t('common.never');
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return t('common.justNow');
    if (diff < 3600000) return t('common.minAgo', { count: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('common.hoursAgo', { count: Math.floor(diff / 3600000) });
    return new Date(date).toLocaleDateString();
  };

  const formatStatus = (status: string) => t(`sessionStatus.${status}`, { defaultValue: status });

  const formatChartLabel = (ts: string) => {
    if (!ts) return '';
    if (period === '24h') return ts.slice(11, 16);
    return ts.slice(5, 10);
  };

  if (loading) {
    return (
      <div
        className="dashboard"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard" style={{ padding: '2rem' }}>
        <div style={{ background: '#FEE2E2', padding: '1rem', borderRadius: '8px', color: '#DC2626' }}>
          {t('dashboard.errorPrefix', { message: error })}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        badge={
          <span className={`status-badge ${stats && stats.ready > 0 ? 'connected' : 'disconnected'}`}>
            {stats && stats.ready > 0 ? t('common.connected') : t('common.disconnected')}
          </span>
        }
      />

      <div className="stats-grid">
        {statsCards.map(({ label, value, icon: Icon, trend, trendUp }) => (
          <div key={label} className="stat-card">
            <Icon className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">{label}</span>
              <Icon size={20} className="stat-icon" />
            </div>
            <div className="stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            {trend && (
              <div className={`stat-trend ${trendUp ? 'up' : 'down'}`}>
                {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {trend}
              </div>
            )}
          </div>
        ))}
      </div>

      <section className="chart-section">
        <div className="section-header">
          <div className="section-title-row">
            <BarChart2 size={18} />
            <h2>{t('dashboard.chart.title')}</h2>
          </div>
          <div className="period-selector">
            {(['24h', '7d', '30d'] as Period[]).map(p => (
              <button
                key={p}
                className={`period-btn ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {t(`dashboard.chart.period.${p}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="chart-container">
          {msgStats?.timeSeries && msgStats.timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={msgStats.timeSeries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatChartLabel}
                  tick={{ fontSize: 11, fill: 'var(--text-secondary, #718096)' }}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary, #718096)' }} />
                <Tooltip
                  labelFormatter={v => String(v)}
                  contentStyle={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color)', fontSize: 12 }}
                />
                <Legend />
                <Line type="monotone" dataKey="sent" stroke="#3182ce" strokeWidth={2} dot={false} name={t('dashboard.chart.sent')} />
                <Line type="monotone" dataKey="received" stroke="#38a169" strokeWidth={2} dot={false} name={t('dashboard.chart.received')} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">
              <BarChart2 size={40} strokeWidth={1} />
              <p>{t('dashboard.chart.noData')}</p>
            </div>
          )}
        </div>

        {msgStats?.bySession && msgStats.bySession.length > 0 && (
          <div className="session-breakdown">
            <h3 className="breakdown-title">{t('dashboard.chart.bySession')}</h3>
            <div className="breakdown-table">
              <div className="breakdown-header">
                <span>{t('dashboard.columns.sessionId')}</span>
                <span>{t('dashboard.chart.sent')}</span>
                <span>{t('dashboard.chart.received')}</span>
              </div>
              {msgStats.bySession.map(row => (
                <div key={row.sessionId} className="breakdown-row">
                  <span className="breakdown-session">{row.name || row.sessionId.slice(0, 12)}</span>
                  <span>{row.sent.toLocaleString()}</span>
                  <span>{row.received.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="sessions-section">
        <div className="section-header">
          <h2>{t('dashboard.sessionsOverview')}</h2>
          <span className="section-subtitle">
            {t('dashboard.showingSessions', { shown: sessions.length, total: stats?.total ?? 0 })}
          </span>
        </div>

        <div className="sessions-table">
          <div className="table-header">
            <span>{t('dashboard.columns.sessionId')}</span>
            <span>{t('dashboard.columns.phone')}</span>
            <span>{t('dashboard.columns.status')}</span>
            <span>{t('dashboard.columns.lastActive')}</span>
            <span>{t('dashboard.columns.actions')}</span>
          </div>
          {sessions.length === 0 ? (
            <div className="table-row" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
              {t('dashboard.noSessions')}
            </div>
          ) : (
            sessions.map(session => (
              <div key={session.id} className="table-row">
                <div className="session-info-cell">
                  <span className="session-id">{session.id.substring(0, 12)}</span>
                  <span className="session-name" title={session.name}>
                    {session.name}
                  </span>
                </div>
                <span className="phone">{session.phone || '—'}</span>
                <span className={`status-pill ${session.status}`}>{formatStatus(session.status)}</span>
                <span className="last-active">{formatLastActive(session.lastActive)}</span>
                <div className="actions">
                  <button className="btn-sm" onClick={() => navigate('/sessions')}>
                    {t('dashboard.view')}
                  </button>
                  {['ready', 'initializing', 'connecting', 'qr_ready'].includes(session.status) && (
                    <button className="btn-sm danger" onClick={() => handleDisconnect(session.id)}>
                      {t('dashboard.disconnect')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
