// API Service Layer for OpenWA Dashboard
// Centralized API client with TypeScript types

const API_BASE_URL = '/api';

// =============================================================================
// Types
// =============================================================================

export interface Session {
  id: string;
  name: string;
  status: 'created' | 'idle' | 'initializing' | 'connecting' | 'qr_ready' | 'ready' | 'disconnected';
  phone?: string;
  pushName?: string;
  lastActive?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionStats {
  total: number;
  active: number;
  ready: number;
  disconnected: number;
  byStatus: Record<string, number>;
  memoryUsage: { heapUsed: number; heapTotal: number; rss: number };
}

export interface Webhook {
  id: string;
  sessionId: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  role: 'admin' | 'user' | 'readonly';
  allowedIps?: string[];
  allowedSessions?: string[];
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  createdAt: string;
  apiKey?: string; // Only returned on creation
}

export interface AuditLog {
  id: string;
  action: string;
  severity: 'info' | 'warn' | 'error';
  apiKeyId?: string;
  apiKeyName?: string;
  sessionId?: string;
  sessionName?: string;
  ipAddress?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  errorMessage?: string;
  createdAt: string;
}

export interface MessageResponse {
  messageId: string;
  timestamp: number;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp?: string;
  details?: {
    database?: { status: string };
    redis?: { status: string };
    queue?: { status: string };
  };
}

export interface InfraStatus {
  database: { connected: boolean; type: string; host: string };
  redis: { connected: boolean; host: string; port: number };
  queue: {
    enabled: boolean;
    messages: { pending: number; completed: number; failed: number };
    webhooks: { pending: number; completed: number; failed: number };
  };
  storage: { type: 'local' | 's3'; path?: string; bucket?: string };
  engine: { type: string; headless: boolean };
}

export interface SaveConfigPayload {
  database?: {
    type: 'sqlite' | 'postgres';
    builtIn?: boolean;
    host?: string;
    port?: string;
    username?: string;
    password?: string;
    database?: string;
    poolSize?: number;
    sslEnabled?: boolean;
  };
  redis?: {
    enabled?: boolean;
    builtIn?: boolean;
    host?: string;
    port?: string;
    password?: string;
  };
  queue?: {
    enabled?: boolean;
  };
  storage?: {
    type: 'local' | 's3';
    builtIn?: boolean;
    localPath?: string;
    s3Bucket?: string;
    s3Region?: string;
    s3AccessKey?: string;
    s3SecretKey?: string;
    s3Endpoint?: string;
  };
  engine?: {
    headless?: boolean;
    sessionDataPath?: string;
    browserArgs?: string;
  };
}

export interface Settings {
  general: { apiBaseUrl: string; sessionTimeout: number; autoReconnect: boolean; debugMode: boolean };
  api: { rateLimit: number; rateLimitWindow: number; enableDocs: boolean };
  notifications: { emailEnabled: boolean; notificationEmail: string; webhookAlerts: boolean };
}

// =============================================================================
// API Client
// =============================================================================

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Get API key from sessionStorage for authentication
  const apiKey = sessionStorage.getItem('openwa_api_key');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// =============================================================================
// Session API
// =============================================================================

export const sessionApi = {
  list: () => request<Session[]>('/sessions'),
  get: (id: string) => request<Session>(`/sessions/${id}`),
  create: (name: string) =>
    request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  delete: (id: string) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),
  start: (id: string) => request<Session>(`/sessions/${id}/start`, { method: 'POST' }),
  stop: (id: string) => request<Session>(`/sessions/${id}/stop`, { method: 'POST' }),
  getQR: (id: string) => request<{ qrCode: string; status: string }>(`/sessions/${id}/qr`),
  getStats: () => request<SessionStats>('/sessions/stats/overview'),
  getGroups: (id: string) => request<{ id: string; name: string }[]>(`/sessions/${id}/groups`),
};

// =============================================================================
// Webhook API
// =============================================================================

export const webhookApi = {
  listBySession: (sessionId: string) => request<Webhook[]>(`/sessions/${sessionId}/webhooks`),
  listAll: () => request<Webhook[]>('/webhooks'),
  get: (sessionId: string, id: string) => request<Webhook>(`/sessions/${sessionId}/webhooks/${id}`),
  create: (sessionId: string, data: { url: string; events: string[] }) =>
    request<Webhook>(`/sessions/${sessionId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (sessionId: string, id: string, data: Partial<Webhook>) =>
    request<Webhook>(`/sessions/${sessionId}/webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (sessionId: string, id: string) =>
    request<void>(`/sessions/${sessionId}/webhooks/${id}`, { method: 'DELETE' }),
  test: (sessionId: string, id: string) =>
    request<{ success: boolean; statusCode?: number; error?: string }>(`/sessions/${sessionId}/webhooks/${id}/test`, {
      method: 'POST',
    }),
};

// =============================================================================
// API Key API
// =============================================================================

export const apiKeyApi = {
  list: () => request<ApiKey[]>('/auth/api-keys'),
  get: (id: string) => request<ApiKey>(`/auth/api-keys/${id}`),
  create: (data: {
    name: string;
    role: string;
    allowedIps?: string[];
    allowedSessions?: string[];
    expiresAt?: string;
  }) =>
    request<ApiKey>('/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<ApiKey>) =>
    request<ApiKey>(`/auth/api-keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request<void>(`/auth/api-keys/${id}`, { method: 'DELETE' }),
  revoke: (id: string) => request<ApiKey>(`/auth/api-keys/${id}/revoke`, { method: 'POST' }),
};

// =============================================================================
// Audit/Logs API
// =============================================================================

export const auditApi = {
  list: (params?: { action?: string; severity?: string; sessionId?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.sessionId) query.set('sessionId', params.sessionId);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryStr = query.toString();
    return request<{ data: AuditLog[]; total: number }>(`/audit${queryStr ? `?${queryStr}` : ''}`);
  },
};

// =============================================================================
// Message API
// =============================================================================

export const messageApi = {
  sendText: (sessionId: string, chatId: string, text: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-text`, {
      method: 'POST',
      body: JSON.stringify({ chatId, text }),
    }),
  sendImage: (sessionId: string, chatId: string, url: string, caption?: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-image`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url, caption }),
    }),
  sendVideo: (sessionId: string, chatId: string, url: string, caption?: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-video`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url, caption }),
    }),
  sendAudio: (sessionId: string, chatId: string, url: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-audio`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url }),
    }),
  sendDocument: (sessionId: string, chatId: string, url: string, filename?: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-document`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url, filename }),
    }),
  scheduleText: (sessionId: string, chatId: string, text: string, scheduledAt: string) =>
    request<{ jobId: string; scheduledAt: string }>(`/sessions/${sessionId}/messages/schedule-text`, {
      method: 'POST',
      body: JSON.stringify({ chatId, text, scheduledAt }),
    }),
  getScheduled: (sessionId: string) =>
    request<{ jobId: string; chatId: string; text: string; scheduledAt: string }[]>(
      `/sessions/${sessionId}/messages/scheduled`,
    ),
  cancelScheduled: (sessionId: string, jobId: string) =>
    request<void>(`/sessions/${sessionId}/messages/scheduled/${jobId}`, { method: 'DELETE' }),
};

// =============================================================================
// Health & Infrastructure API
// =============================================================================

export const healthApi = {
  check: () => request<HealthStatus>('/health'),
  ready: () => request<HealthStatus>('/health/ready'),
};

export const infraApi = {
  getStatus: () => request<InfraStatus>('/infra/status'),
  updateConfig: (config: Partial<InfraStatus>) =>
    request<InfraStatus>('/infra/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  saveConfig: (config: SaveConfigPayload) =>
    request<{ message: string; saved: boolean; envPath: string; profiles: string[] }>('/infra/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  restart: (profiles?: string[], profilesToRemove?: string[]) =>
    request<{
      message: string;
      restarting: boolean;
      profiles: string[];
      profilesToRemove: string[];
      estimatedTime: number;
    }>('/infra/restart', {
      method: 'POST',
      body: JSON.stringify({ profiles: profiles || [], profilesToRemove: profilesToRemove || [] }),
    }),
  healthCheck: () => request<{ status: string; timestamp: string }>('/infra/health'),
};

// =============================================================================
// Settings API
// =============================================================================

export const settingsApi = {
  get: () => request<Settings>('/settings'),
  update: (settings: Partial<Settings>) =>
    request<Settings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

// =============================================================================
// Plugin Types
// =============================================================================

export interface Plugin {
  id: string;
  name: string;
  version: string;
  type: 'engine' | 'storage' | 'queue' | 'auth' | 'extension';
  description?: string;
  author?: string;
  status: 'installed' | 'enabled' | 'disabled' | 'error';
  config: Record<string, unknown>;
  builtIn: boolean;
  provides: string[];
  loadedAt?: string;
  enabledAt?: string;
  error?: string;
}

export interface Engine {
  id: string;
  name: string;
  enabled: boolean;
  features: string[];
}

// =============================================================================
// Plugins API
// =============================================================================

// =============================================================================
// Status API
// =============================================================================

export interface StatusContact {
  contactId: string;
  name?: string;
  pushName?: string;
  profilePicUrl?: string;
  totalCount: number;
  unreadCount: number;
  lastTimestamp: string;
}

export interface StatusItem {
  messageId: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'gif';
  hasMedia: boolean;
  caption?: string;
  text?: string;
  timestamp: string;
  expiresAt: string;
}

async function fetchStatusBlob(sessionId: string, contactId: string, messageId: string): Promise<Response> {
  const apiKey = sessionStorage.getItem('openwa_api_key') ?? '';
  const url = `${API_BASE_URL}/sessions/${sessionId}/status/${encodeURIComponent(contactId)}/${encodeURIComponent(messageId)}/download`;
  const res = await fetch(url, { headers: { 'X-API-Key': apiKey } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message || `HTTP ${res.status}`);
  }
  return res;
}

export const statusApi = {
  listContacts: (sessionId: string) =>
    request<{ contacts: StatusContact[] }>(`/sessions/${sessionId}/status`),
  listItems: (sessionId: string, contactId: string) =>
    request<{ items: StatusItem[] }>(`/sessions/${sessionId}/status/${encodeURIComponent(contactId)}/items`),
  downloadMedia: async (sessionId: string, contactId: string, messageId: string): Promise<void> => {
    const res = await fetchStatusBlob(sessionId, contactId, messageId);
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `status-${messageId}.bin`;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  },
  previewMedia: async (sessionId: string, contactId: string, messageId: string): Promise<{ objectUrl: string; mimeType: string }> => {
    const res = await fetchStatusBlob(sessionId, contactId, messageId);
    const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';
    const blob = await res.blob();
    return { objectUrl: URL.createObjectURL(blob), mimeType };
  },
  downloadAllContactMedia: async (sessionId: string, contactId: string): Promise<void> => {
    const apiKey = sessionStorage.getItem('openwa_api_key') ?? '';
    const url = `${API_BASE_URL}/sessions/${sessionId}/status/${encodeURIComponent(contactId)}/download-all`;
    const res = await fetch(url, { headers: { 'X-API-Key': apiKey } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error((err as { message?: string }).message || `HTTP ${res.status}`);
    }
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `statuses-${contactId}.zip`;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  },
  downloadAllMedia: async (sessionId: string): Promise<void> => {
    const apiKey = sessionStorage.getItem('openwa_api_key') ?? '';
    const url = `${API_BASE_URL}/sessions/${sessionId}/status/download-all`;
    const res = await fetch(url, { headers: { 'X-API-Key': apiKey } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error((err as { message?: string }).message || `HTTP ${res.status}`);
    }
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `all-statuses-${sessionId}.zip`;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  },
};

// =============================================================================
// Plugins API
// =============================================================================

export const pluginsApi = {
  list: () => request<Plugin[]>('/plugins'),
  get: (id: string) => request<Plugin>(`/plugins/${id}`),
  enable: (id: string) =>
    request<{ success: boolean; message: string }>(`/plugins/${id}/enable`, {
      method: 'POST',
    }),
  disable: (id: string) =>
    request<{ success: boolean; message: string }>(`/plugins/${id}/disable`, {
      method: 'POST',
    }),
  updateConfig: (id: string, config: Record<string, unknown>) =>
    request<{ success: boolean; message: string }>(`/plugins/${id}/config`, {
      method: 'PUT',
      body: JSON.stringify({ config }),
    }),
  healthCheck: (id: string) => request<{ healthy: boolean; message?: string }>(`/plugins/${id}/health`),
  getEngines: () => request<Engine[]>('/infra/engines'),
  getCurrentEngine: () => request<{ engineType: string }>('/infra/engines/current'),
};

// =============================================================================
// Labels API (WhatsApp Business)
// =============================================================================

export interface Label {
  id: string;
  name: string;
  hexColor?: string;
}

export const labelsApi = {
  list: (sessionId: string) =>
    request<Label[]>(`/sessions/${sessionId}/labels`),
  getById: (sessionId: string, labelId: string) =>
    request<Label>(`/sessions/${sessionId}/labels/${encodeURIComponent(labelId)}`),
  addToChat: (sessionId: string, chatId: string, labelId: string) =>
    request<{ success: boolean }>(`/sessions/${sessionId}/labels/chat/${encodeURIComponent(chatId)}`, {
      method: 'POST',
      body: JSON.stringify({ labelId }),
    }),
  removeFromChat: (sessionId: string, chatId: string, labelId: string) =>
    request<{ success: boolean }>(`/sessions/${sessionId}/labels/chat/${encodeURIComponent(chatId)}/${encodeURIComponent(labelId)}`, {
      method: 'DELETE',
    }),
};

// =============================================================================
// Catalog API (WhatsApp Business)
// =============================================================================

export interface CatalogInfo {
  name?: string;
  description?: string;
}

export interface Product {
  id: string;
  name: string;
  imageUrl?: string;
  price?: string;
  currency?: string;
}

export const catalogApi = {
  getCatalog: (sessionId: string) =>
    request<CatalogInfo>(`/sessions/${sessionId}/catalog`),
  getProducts: (sessionId: string, page = 1, limit = 20) =>
    request<{ products: Product[]; hasMore: boolean }>(`/sessions/${sessionId}/catalog/products?page=${page}&limit=${limit}`),
  getProduct: (sessionId: string, productId: string) =>
    request<Product>(`/sessions/${sessionId}/catalog/products/${encodeURIComponent(productId)}`),
  sendProduct: (sessionId: string, chatId: string, productId: string, body?: string) =>
    request<{ messageId: string }>(`/sessions/${sessionId}/messages/send-product`, {
      method: 'POST',
      body: JSON.stringify({ chatId, productId, body }),
    }),
  sendCatalog: (sessionId: string, chatId: string, body?: string) =>
    request<{ messageId: string }>(`/sessions/${sessionId}/messages/send-catalog`, {
      method: 'POST',
      body: JSON.stringify({ chatId, body }),
    }),
};

// =============================================================================
// Groups API
// =============================================================================

export interface Group {
  id: string;
  name: string;
  description?: string;
  participants?: { id: string; name?: string }[];
}

// =============================================================================
// Stats API
// =============================================================================

export interface OverviewStats {
  sessions: { active: number; total: number; byStatus: Record<string, number> };
  messages: { sent: number; received: number; failed: number; today: { sent: number; received: number } };
}

export interface TimeSeriesPoint {
  timestamp: string;
  sent: number;
  received: number;
}

export interface MessageStats {
  timeSeries: TimeSeriesPoint[];
  byType: Record<string, number>;
  bySession: Array<{ sessionId: string; name: string; sent: number; received: number }>;
  topChats: Array<{ chatId: string; messageCount: number }>;
}

export const statsApi = {
  getOverview: () => request<OverviewStats>('/stats/overview'),
  getMessageStats: (period: '24h' | '7d' | '30d') =>
    request<MessageStats>(`/stats/messages?period=${period}`),
};

// =============================================================================
// Groups API
// =============================================================================

export const groupsApi = {
  list: (sessionId: string) =>
    request<Group[]>(`/sessions/${sessionId}/groups`),
  getById: (sessionId: string, groupId: string) =>
    request<Group>(`/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}`),
  create: (sessionId: string, name: string, participants: string[]) =>
    request<Group>(`/sessions/${sessionId}/groups`, {
      method: 'POST',
      body: JSON.stringify({ name, participants }),
    }),
  addParticipants: (sessionId: string, groupId: string, participants: string[]) =>
    request<{ success: boolean }>(`/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/participants`, {
      method: 'POST',
      body: JSON.stringify({ participants }),
    }),
  removeParticipants: (sessionId: string, groupId: string, participants: string[]) =>
    request<{ success: boolean }>(`/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/participants`, {
      method: 'DELETE',
      body: JSON.stringify({ participants }),
    }),
  updateSubject: (sessionId: string, groupId: string, subject: string) =>
    request<{ success: boolean }>(`/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/subject`, {
      method: 'PUT',
      body: JSON.stringify({ subject }),
    }),
  updateDescription: (sessionId: string, groupId: string, description: string) =>
    request<{ success: boolean }>(`/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/description`, {
      method: 'PUT',
      body: JSON.stringify({ description }),
    }),
  leave: (sessionId: string, groupId: string) =>
    request<{ success: boolean }>(`/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}/leave`, {
      method: 'POST',
    }),
};
