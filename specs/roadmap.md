# OpenWA Feature Roadmap

**Created**: 2026-05-21 | **Branch convention**: `NNN-feature-name`

This document covers 10 planned features across three priority tiers. Each feature
maps to its own branch, spec, plan, and tasks following the existing Speckit workflow.

---

## Tier overview

| # | Feature | Branch | Backend work | Frontend work | Effort |
|---|---------|--------|--------------|---------------|--------|
| P1.1 | Bulk Status Download | `002-bulk-status-download` | Medium | Low | S |
| P1.2 | Scheduled Auto-Save | `003-status-auto-save` | Medium | Medium | M |
| P1.3 | Message Scheduling | `004-message-scheduling` | Medium | Medium | M |
| P2.1 | Webhook Event Viewer | `005-webhook-event-viewer` | None | Medium | S |
| P2.2 | Contact Labels UI | `006-labels-ui` | None | Small | XS |
| P2.3 | Catalog / Templates UI | `007-catalog-ui` | None | Medium | S |
| P2.4 | Group Management Page | `008-group-management-ui` | None | Medium | S |
| P3.1 | Audit Log Page | `009-audit-log-ui` | None | Small | XS |
| P3.2 | Plugin Enhancements | `010-plugin-enhancements` | Small | Medium | S |
| P3.3 | Per-Session Stats Dashboard | `011-stats-dashboard` | None | Medium | S |

**Effort key**: XS < 1 day · S 1–2 days · M 3–5 days

---

## P1.1 — Bulk Status Download (`002-bulk-status-download`)

### Goal
Allow the user to download all media statuses from one contact (or all contacts) as a
single ZIP file, rather than one-by-one.

### Why now
Directly extends the in-progress status downloader (branch `001-status-downloader`)
while the code is fresh. Delivers the most-requested workflow: "save everything before
it expires."

### Backend changes
- **New endpoint**: `GET /api/sessions/:sessionId/status/:contactId/download-all`
  — streams a ZIP archive of all media items for that contact.
- **New endpoint**: `GET /api/sessions/:sessionId/status/download-all`
  — streams a ZIP of every contact's media (paginated internally, max 200 items).
- Uses Node.js `archiver` (or `jszip`) — pick whichever is already a transitive dep;
  otherwise `archiver` is preferred for streaming.
- Reuses `downloadStatusMedia()` from `status.service.ts` for each item.
- File names inside ZIP: `{contactName}_{timestamp}_{messageId}.{ext}`.

### Frontend changes
- Add "Download All" button to the contact row in `Status.tsx`.
- Add "Download All Sessions" button in the page header.
- Trigger a normal browser download (`window.location.href` with the API URL +
  `X-API-Key` as a query param, or a hidden `<a>` with the auth header via `fetch` +
  `URL.createObjectURL`).

### Constraints
- No new npm packages if `archiver` is already available transitively; check first.
- ZIP must stream — do not buffer the entire archive in memory.
- Respect the existing `ApiKeyGuard` on the new endpoints.

---

## P1.2 — Scheduled Auto-Save (`003-status-auto-save`)

### Goal
A background cron job that polls for new statuses at a configurable interval and saves
media to disk before the 24-hour expiry window closes.

### Why now
Statuses expire — the only way to guarantee nothing is missed is automatic polling.
Depends on P1.1 being complete (re-uses the download logic).

### Backend changes
- **New queue processor**: `src/modules/queue/processors/status-auto-save.processor.ts`
  — registers on a new queue `status-auto-save` in `QUEUE_NAMES`.
- **New settings keys** (extend existing settings module):
  ```
  status.autoSave.enabled        boolean  default: false
  status.autoSave.intervalMinutes number  default: 60
  status.autoSave.savePath        string  default: ./data/statuses
  status.autoSave.sessions        string[] default: [] (empty = all active sessions)
  ```
- **New endpoint**: `POST /api/settings/status-auto-save` — update the config.
- **New endpoint**: `GET /api/settings/status-auto-save` — read current config.
- On each tick: call `getContactStatuses()` per configured session, diff against a
  persisted seen-set (a simple JSON file under `savePath`), download unseen media.
- Log each save with the existing `AuditService` (`AuditAction.STATUS_SAVED`).

### Frontend changes
- New section in the `Settings` page (or a new `AutoSave.tsx` page): toggle switch,
  interval picker, save path input, per-session multi-select.
- Show "last run" and "files saved this run" from the settings GET response.

### Constraints
- `savePath` must be validated to prevent path traversal before use.
- The seen-set file must be written atomically (write-then-rename pattern).

---

## P1.3 — Message Scheduling (`004-message-scheduling`)

### Goal
Allow the user to compose a message in the dashboard and schedule it to be sent at a
specific future date and time.

### Why now
The `message-queue` (`QUEUE_NAMES.MESSAGE`) already exists in Bull. This feature adds
a `delay` to existing job creation rather than building new infrastructure.

### Backend changes
- **Extend `MessageService`** (or its controller): accept optional `scheduledAt` ISO
  timestamp in the send-message DTO.
- When `scheduledAt` is set, calculate `delay = scheduledAt - Date.now()` and pass it
  to `Bull.add(job, { delay })`.
- **New endpoint**: `GET /api/sessions/:sessionId/messages/scheduled`
  — lists pending Bull jobs for this session (use `queue.getDelayed()`).
- **New endpoint**: `DELETE /api/sessions/:sessionId/messages/scheduled/:jobId`
  — cancels a scheduled job (`job.remove()`).

### Frontend changes
- Extend `MessageTester.tsx`: add a "Schedule for later" toggle that reveals a
  `<input type="datetime-local">` field.
- New `ScheduledMessages.tsx` page (or a tab on MessageTester): table of pending
  scheduled messages with cancel button.

### Constraints
- Scheduled time must be at least 60 seconds in the future (validate on both client
  and server).
- Jobs survive a server restart because Bull persists to Redis — make this clear in the
  UI ("scheduled messages persist across restarts").

---

## P2.1 — Webhook Event Viewer (`005-webhook-event-viewer`)

### Goal
A real-time dashboard panel that shows incoming WhatsApp events (messages received,
session status changes, QR codes) as they happen, using the existing WebSocket gateway.

### Why now
The `EventsGateway` (`/events` namespace, socket.io) is fully implemented. This is a
pure frontend feature — zero backend changes.

### Backend changes
None. `EventsGateway` already emits `message.received`, `message.sent`, `message.ack`,
`session.status`, `session.qr`, and `webhook:delivery`.

### Frontend changes
- **New page**: `dashboard/src/pages/EventViewer.tsx` + `EventViewer.css`.
- Use `socket.io-client` (already a transitive dep via the existing dashboard) to
  connect to `ws://<host>/events` with `{ auth: { apiKey } }`.
- On mount: send `subscribe` message for `{ sessionId: '*', events: ['*'] }`.
- Render a scrollable, auto-updating log of events. Each row: timestamp, session,
  event type, truncated payload.
- Controls: session filter dropdown, event-type filter checkboxes, pause/resume toggle,
  clear button.
- Cap the in-memory log at 500 entries (drop oldest).

### Constraints
- Reconnect automatically on disconnect (socket.io handles this with `reconnection: true`).
- Do not log the full `qr` payload (it's a large base64 string) — show `[QR omitted]`
  and a "Show QR" expand button instead.

---

## P2.2 — Contact Labels UI (`006-labels-ui`)

### Goal
A dashboard page to view all WhatsApp Business labels and assign/remove them on chats,
surfacing the fully-implemented `LabelController` API.

### Why now
Zero backend work. The API is complete. This is the fastest feature on the list.

### Backend changes
None. All endpoints already exist under `/api/sessions/:sessionId/labels`.

### Frontend changes
- **New page**: `dashboard/src/pages/Labels.tsx` + `Labels.css`.
- Left panel: list of all labels (GET `/labels`) with colour chip.
- Right panel: clicking a label shows all chats with that label (GET `/labels/chat/:chatId`
  used in reverse — requires fetching all chats and filtering; or use the label's own
  `chats` array if the API returns it).
- Per-chat row: "Remove label" button → DELETE `/labels/chat/:chatId/:labelId`.
- "Add label to chat" form: chat ID input + label picker → POST `/labels/chat/:chatId`.
- Note: WhatsApp Business accounts only — show a banner when the session is not a
  Business account (detect via 400 response).

---

## P2.3 — Catalog / Templates UI (`007-catalog-ui`)

### Goal
A dashboard page to browse the WhatsApp Business product catalog and send product or
catalog messages to any chat.

### Why now
`CatalogController` + `CatalogService` are fully implemented. Pure frontend work.

### Backend changes
None. All endpoints exist under `/api/sessions/:sessionId/catalog`.

### Frontend changes
- **New page**: `dashboard/src/pages/Catalog.tsx` + `Catalog.css`.
- Header: catalog info card (GET `/catalog`) — business name, description, website.
- Product grid (GET `/catalog/products` with pagination): product image, name, price,
  currency. Click product → detail drawer.
- Each product: "Send to chat" button → opens a modal with chat ID input → POST
  `/messages/send-product`.
- "Send full catalog" button in header → chat ID input → POST `/messages/send-catalog`.
- Note: WhatsApp Business only — same banner pattern as Labels UI.

---

## P2.4 — Group Management Page (`008-group-management-ui`)

### Goal
A dashboard page to list all groups, view members, create new groups, add/remove
participants, and update group subject/description.

### Why now
`GroupController` has all CRUD endpoints. Pure frontend work.

### Backend changes
None. Endpoints exist under `/api/sessions/:sessionId/groups`.

### Frontend changes
- **New page**: `dashboard/src/pages/Groups.tsx` + `Groups.css`.
- Groups list (GET `/groups`): name, participant count, creation date.
- Group detail panel (GET `/groups/:groupId`): participant list with phone + name.
- Actions:
  - "Create group" button → modal: name field + participants textarea (comma-separated
    numbers) → POST `/groups`.
  - "Add participants" → POST `/groups/:groupId/participants`.
  - Per-participant "Remove" → DELETE `/groups/:groupId/participants`.
  - "Update subject" inline edit → PUT `/groups/:groupId/subject`.
  - "Update description" → PUT `/groups/:groupId/description`.

---

## P3.1 — Audit Log Page (`009-audit-log-ui`)

### Goal
A searchable, filterable timeline of all API actions taken, surfacing the existing
`AuditController` API.

### Why now
Zero backend work. `AuditService.findAll()` supports action, severity, sessionId,
apiKeyId, limit, and offset filters already.

### Backend changes
None. Endpoint exists at `GET /api/audit`.

### Frontend changes
- **New page**: `dashboard/src/pages/AuditLog.tsx` + `AuditLog.css`.
- Table with columns: timestamp, action, severity badge, session, API key name, details.
- Filter bar: action dropdown, severity dropdown, session filter, date range picker.
- Pagination (use `limit` + `offset` query params from the API).
- Severity colour coding: INFO → blue, WARN → yellow, ERROR → red.
- "Export CSV" button (client-side: serialise current page to CSV blob + download).

---

## P3.2 — Plugin Enhancements (`010-plugin-enhancements`)

### Goal
Extend the existing `Plugins.tsx` page with install-from-URL, per-plugin enable/disable
toggles, and runtime configuration editing.

### Why now
The plugin page exists but is minimal. Understanding the plugin module's API first is
required — read `src/modules/plugins/` before implementing.

### Backend changes (small)
- Verify the plugin API supports: install-by-URL, enable/disable toggle, config update.
  If any of these are missing, add the endpoint(s).
- Expected additions (if not already present):
  - `POST /api/plugins/install` `{ url: string }` — install from URL.
  - `PATCH /api/plugins/:pluginId/enabled` `{ enabled: boolean }` — toggle.
  - `PATCH /api/plugins/:pluginId/config` `{ config: Record<string,unknown> }` — update.

### Frontend changes
- Extend `Plugins.tsx`:
  - "Install from URL" form at the top (URL input + Install button).
  - Enable/disable toggle switch on each plugin card.
  - "Config" button → JSON editor drawer (use a `<textarea>` with JSON validation; no
    new npm packages).

### Constraints
- Validate that the URL is HTTPS before sending to the backend.
- Config editor must show a parse error inline rather than submitting invalid JSON.

---

## P3.3 — Per-Session Stats Dashboard (`011-stats-dashboard`)

### Goal
Replace the mostly-empty `Dashboard.tsx` homepage with real charts: message volume over
time, active sessions, and per-session breakdown.

### Why now
`StatsController` exposes `/stats/overview`, `/stats/messages?period=`, and
`/stats/sessions/:sessionId` — all the data needed is available.

### Backend changes
None. All endpoints exist.

### Frontend changes
- Extend `Dashboard.tsx` (or create a `Stats.tsx` page linked from it).
- Use `recharts` (check if already installed; if not, it is acceptable as the one new
  dependency for this feature since charting without a library is impractical).
- Charts:
  1. **Message volume**: line chart over 24h / 7d / 30d (period toggle).
  2. **Sessions summary**: status cards (connected / disconnected / initialising).
  3. **Per-session breakdown**: bar chart or table — messages sent/received per session.
- Auto-refresh every 60 seconds (use `setInterval` + cleanup in `useEffect`).

---

## Implementation order

Follow this sequence to maximise code reuse and avoid merge conflicts:

```
001  ← in progress (status downloader)
002  ← start when 001 merges (shares status module)
003  ← start after 002 (reuses download logic)
004  ← independent, can start any time
005  ← independent, can start any time
006, 007, 008, 009, 011  ← all independent pure-frontend, can run in parallel
010  ← after reading plugin module source
```

---

## Shared patterns (apply to every feature)

- **Auth**: all backend endpoints must use `ApiKeyGuard`.
- **Error handling**: follow NestJS `HttpException` pattern — no raw 500s.
- **Dashboard nav**: add each new page to `Layout.tsx` sidebar nav with an icon.
- **i18n**: add English keys to `en.json` and Hebrew keys to `he.json` for every new
  UI string.
- **CSS**: each new page gets its own `PageName.css` co-located with the component.
- **No new npm packages** unless explicitly noted above.
