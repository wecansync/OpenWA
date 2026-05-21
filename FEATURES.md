# OpenWA Feature Log

All features shipped, ordered by implementation date.

---

## P1.1 — Bulk Status Download
**Branch**: `001-status-downloader` (extended)

Download all status media from one contact or all contacts as a streaming ZIP archive.

**Backend**
- `GET /api/sessions/:sessionId/status/:contactId/download-all` — ZIP of one contact's media
- `GET /api/sessions/:sessionId/status/download-all` — ZIP of every contact's media
- Streaming via `archiver`; files named `{contact}_{timestamp}_{id}.{ext}`; skips failed items gracefully

**Frontend**
- Archive icon button on each contact card in the Status page → downloads that contact's ZIP
- "Download All" button in the Status page header → downloads all contacts' ZIP
- i18n: `en` + `he`

---

## P1.2 — Status Auto-Save
**Branch**: `001-status-downloader` (extended)

Background cron job that polls WhatsApp for new statuses and saves media to disk before the 24-hour expiry window closes.

**Backend**
- `StatusAutoSaveService` — in-memory config, per-session seen-set (atomic JSON file), downloads unseen media to configurable path
- BullMQ processor `status-auto-save` queue
- `GET /api/settings/status-auto-save` — read current config
- `PUT /api/settings/status-auto-save` — update config and reschedule the repeatable Bull job
- `PUT /api/settings/status-auto-save/run-now` — trigger an immediate run
- `SessionService.getActiveSessionIds()` added

**Frontend**
- New page `/auto-save` — toggle switch, interval picker, save path input, sessions filter
- "Run Now" button triggers an immediate save cycle
- Sidebar nav entry (Archive icon)
- i18n: `en` + `he`

---

## P1.3 — Message Scheduling
**Branch**: `001-status-downloader` (extended)

Queue a text message to be sent at a specific future date and time; jobs survive server restarts via BullMQ/Redis.

**Backend**
- `SCHEDULED_MESSAGE` BullMQ queue registered in `MessageModule`
- `ScheduledMessageProcessor` — executes the send when the job fires
- `SendTextMessageDto.scheduledAt` — optional ISO 8601 field
- `MessageService.scheduleText()` — validates ≥60s delay, enqueues with `delay`
- `MessageService.getScheduledMessages()` — lists pending delayed jobs filtered by sessionId
- `MessageService.cancelScheduledMessage()` — removes a job by ID
- `POST /api/sessions/:sessionId/messages/schedule-text`
- `GET /api/sessions/:sessionId/messages/scheduled`
- `DELETE /api/sessions/:sessionId/messages/scheduled/:jobId`

**Frontend**
- "Schedule for later" checkbox in Message Tester (text type only)
- `datetime-local` picker appears when checkbox is checked; min value enforced to 61s from now
- Send button routes to `scheduleText()` API when scheduling is active
- i18n: `en` + `he`

---

---

## P2.1 — Webhook Event Viewer
**Route**: `/event-viewer`

Real-time dashboard panel streaming all WhatsApp events via the existing `EventsGateway` WebSocket.

- Connects to `/events` namespace using `socket.io-client` with API key auth
- Subscribes to `*` on all sessions; filters by session and event type client-side
- Event type chips for quick filtering; session dropdown
- Pause/resume toggle; auto-scroll to bottom; log capped at 500 entries
- QR payloads shown as `[QR omitted]` to avoid filling the log
- Connection status indicator with pulse animation on disconnect
- i18n: `en` + `he`

---

## P2.2 — Contact Labels UI
**Route**: `/labels`

Browse and manage WhatsApp Business contact labels — assign or remove labels from chats.

- Lists all labels with colour dots (GET `/labels`)
- Click a label → shows all chats tagged with it (GET `/labels/:id`)
- Add a label to a chat via chat ID input (POST `/labels/chat/:chatId`)
- Remove a label from a chat (DELETE `/labels/chat/:chatId/:labelId`)
- Business-only banner shown on 400 errors
- i18n: `en` + `he`

---

## P2.3 — Catalog / Templates UI
**Route**: `/catalog`

Browse the WhatsApp Business product catalog and send product or full-catalog messages to any chat.

- Shows business info card (name, description) from GET `/catalog`
- Paginated product grid with image, name, price (GET `/catalog/products?page=&limit=`)
- Click product to select; send panel with chat ID + caption inputs
- "Send Product" → POST `/messages/send-product`
- "Send Catalog" → POST `/messages/send-catalog`
- Business-only banner for non-Business sessions
- i18n: `en` + `he`

---

## P2.4 — Group Management
**Route**: `/groups`

Full group CRUD from the dashboard — list, create, manage participants, update metadata, leave.

- Group list panel (GET `/groups`)
- Group detail panel (GET `/groups/:groupId`) — subject, description, participants
- Inline subject/description editing (PUT `/subject`, PUT `/description`)
- Add participants (POST `/participants`) and remove per-participant (DELETE `/participants`)
- Create group modal (POST `/groups`) — name + comma-separated numbers
- Leave group with confirmation (POST `/groups/:id/leave`)
- i18n: `en` + `he`

---

## P3.1 — Audit Log Enhancements
**Route**: `/logs` (existing page extended)

Extended the existing Logs page with full filter capabilities and a working CSV export.

- **Action filter** dropdown (all 18 audit action types from the `AuditAction` enum)
- **Session ID filter** text input — passes `sessionId` to `GET /api/audit`
- **CSV export** button now generates and downloads a real CSV file (timestamp, action, severity, session, API key, IP, path, status code)
- `auditApi.list()` updated to support `sessionId` query param
- `useLogsQuery` / `queryKeys.logs` updated to include `action` and `sessionId`

---

## P3.2 — Plugin Config Editor
**Route**: `/plugins` (extended)

Wired up the previously non-functional config modal and added a JSON editor for non-engine plugins.

- **Engine plugins**: config form now calls `pluginsApi.updateConfig()` on save
- **All other plugins**: JSON textarea pre-populated from `plugin.config`; validates JSON before save; calls `pluginsApi.updateConfig()` on success
- Save button shown for all plugin types (was engine-only before)
- i18n: `en` + `he`

---

## P3.3 — Per-Session Stats Dashboard
**Route**: `/` (Dashboard extended)

Replaced placeholder stats with live data and added a message-volume chart.

**Backend**: No changes — uses `GET /api/stats/overview` and `GET /api/stats/messages?period=` (already implemented)

**Frontend**
- `statsApi` added to `api.ts` (`getOverview`, `getMessageStats`)
- "API Calls (24h)" stat card replaced with "Total Messages" (real data from overview)
- "Messages Today" stat card shows real `today.sent` count
- **Line chart**: sent vs received over 24h / 7d / 30d (period toggle buttons)
- **Per-session breakdown table** below the chart
- Auto-refreshes every 60 seconds via `queryClient.invalidateQueries`
- recharts 3.x added as the one accepted charting dependency
- i18n: `en` + `he`
