---
description: "Task list for WhatsApp Status Downloader"
---

# Tasks: WhatsApp Status Downloader

**Input**: Design documents from `specs/001-status-downloader/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story for independent implementation and testing.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New DTOs and interface extensions that all stories depend on.

- [x] T001 [P] Add `StatusContact` interface and extend `Status` interface (add `messageId`, `hasMedia`, `audio`/`gif` types) and add `MediaDownloadResult` interface and `downloadStatusMedia()` method signature to `src/engine/interfaces/whatsapp-engine.interface.ts`
- [x] T002 [P] Create `src/modules/status/dto/status-contact.dto.ts` with `StatusContactDto` and `StatusContactsResponseDto`
- [x] T003 [P] Create `src/modules/status/dto/status-item.dto.ts` with `StatusItemDto` and `StatusItemsResponseDto`

**Checkpoint**: Interface and DTOs ready — engine adapter and service work can begin.

---

## Phase 2: Foundational (Backend Engine — Blocks All Stories)

**Purpose**: Real engine implementations that replace the stubs. Must complete before any API or dashboard work.

- [x] T004 Implement `getContactStatuses()` in `src/engine/adapters/whatsapp-web-js.adapter.ts` — replace stub: call `this.client.getBroadcasts()`, map each `Broadcast` to `StatusContact` (contactId from `b.id._serialized`, name/pushName from contact, totalCount, unreadCount, lastTimestamp from `b.timestamp`)
- [x] T005 Implement `getContactStatus()` in `src/engine/adapters/whatsapp-web-js.adapter.ts` — replace stub: call `this.client.getBroadcastById(contactId)`, map each `Message` in `broadcast.msgs` to `Status` (messageId, type from msg.type mapped to text/image/video/audio/gif, hasMedia from msg.hasMedia, caption from msg.body, timestamp, expiresAt calculated as timestamp + 24h)
- [x] T006 Implement `downloadStatusMedia()` in `src/engine/adapters/whatsapp-web-js.adapter.ts` — call `getBroadcastById(contactId)`, find message by messageId in `broadcast.msgs`, call `message.downloadMedia()`, return `{ data, mimetype, filename, filesize }` — throw `NotFoundException` if broadcast/message not found, throw `NotFoundException` if `downloadMedia()` returns undefined (expired), wrap in try/catch with 30s timeout

**Checkpoint**: Engine methods implemented — API layer and dashboard can be built.

---

## Phase 3: User Story 1 — View All Contacts' Active Statuses (Priority: P1) 🎯 MVP

**Goal**: `GET /api/sessions/:sessionId/status` returns the list of contacts with active statuses.

**Independent Test**: `curl http://localhost:2785/api/sessions/SESSION_ID/status -H "X-API-Key: KEY"` returns `{ contacts: [...] }` with at least one entry when contacts have active statuses.

### Implementation for User Story 1

- [x] T007 [US1] Add `getStatusContacts()` method to `src/modules/status/status.service.ts` — call `engine.getContactStatuses()`, map results to `StatusContactDto[]`, add structured log entry
- [x] T008 [US1] Replace the existing `GET /` handler in `src/modules/status/status.controller.ts` — call `statusService.getStatusContacts(sessionId)`, return `StatusContactsResponseDto`, add `@ApiOperation`, `@ApiResponse`, `@ApiSecurity` decorators

**Checkpoint**: `GET /api/sessions/:sessionId/status` returns real data. US1 independently testable.

---

## Phase 4: User Story 2 — Preview Contact's Status Items (Priority: P2)

**Goal**: `GET /api/sessions/:sessionId/status/:contactId` returns individual status items.

**Independent Test**: `curl .../status/96170394960@c.us -H "X-API-Key: KEY"` returns `{ items: [...] }` with type, hasMedia, and timestamp for each item.

### Implementation for User Story 2

- [x] T009 [US2] Add `getStatusItems()` method to `src/modules/status/status.service.ts` — call `engine.getContactStatus(contactId)`, map to `StatusItemDto[]` (include `text` field for text-type items from `status.caption`), throw `NotFoundException` if empty array returned, add structured log entry
- [x] T010 [US2] Replace existing `GET /:contactId` handler in `src/modules/status/status.controller.ts` — call `statusService.getStatusItems(sessionId, contactId)`, return `StatusItemsResponseDto`, add `@ApiOperation`, `@ApiResponse`, `@ApiSecurity` decorators

**Checkpoint**: `GET /api/sessions/:sessionId/status/:contactId` returns real item list. US2 independently testable.

---

## Phase 5: User Story 3 — Download Status Media File (Priority: P3)

**Goal**: `GET /api/sessions/:sessionId/status/:contactId/:messageId/download` streams the media file.

**Independent Test**: `curl -OJ ".../status/CONTACT_ID/MESSAGE_ID/download" -H "X-API-Key: KEY"` saves a valid file locally.

### Implementation for User Story 3

- [x] T011 [US3] Add `downloadStatusMedia()` method to `src/modules/status/status.service.ts` — call `engine.downloadStatusMedia(contactId, messageId)`, return `MediaDownloadResult`, throw `BadRequestException` if `hasMedia` is false, add structured log entry
- [x] T012 [US3] Add `GET /:contactId/:messageId/download` handler to `src/modules/status/status.controller.ts` — inject `@Res() res: Response`, call `statusService.downloadStatusMedia()`, convert base64 to `Buffer.from(result.data, 'base64')`, set `Content-Type` header to `result.mimetype`, set `Content-Disposition: attachment; filename="status-CONTACT-TIMESTAMP.EXT"`, pipe buffer to response — add `@ApiOperation`, `@ApiResponse`, `@ApiSecurity` decorators

**Checkpoint**: Download endpoint streams binary file. All 3 API stories independently testable.

---

## Phase 6: Dashboard — Status Page

**Goal**: Full Status page in the React dashboard wiring all 3 API stories into a usable UI.

**Independent Test**: Open `http://localhost:5173/status` in browser — contact list renders, clicking a contact shows status items, clicking Download saves a file.

- [x] T013 [P] Add `statusApi` object to `dashboard/src/services/api.ts` with three methods: `listContacts(sessionId)` → `GET /sessions/:sessionId/status`, `listItems(sessionId, contactId)` → `GET /sessions/:sessionId/status/:contactId`, `getDownloadUrl(sessionId, contactId, messageId)` → returns the download URL string (not a fetch — used as `href` on anchor tag)
- [x] T014 [P] Add `status` key to `dashboard/src/i18n/locales/en.json` with strings: `title`, `selectSession`, `noContacts`, `noItems`, `selectContact`, `download`, `items`, `unread`, `typeImage`, `typeVideo`, `typeAudio`, `typeGif`, `typeText`, `expired`, `notConnected`, `loadError`
- [x] T015 [P] Add `status` key to `dashboard/src/i18n/locales/he.json` with the same keys translated to Hebrew (RTL-safe strings)
- [x] T016 Create `dashboard/src/pages/Status.tsx` — two-panel layout: left panel shows session selector dropdown (reuse `useSessionsQuery`) and contact card list (contact name, pushName, totalCount badge, unreadCount badge, lastTimestamp); right panel shows selected contact's status items as a responsive grid — each card shows type icon, timestamp, caption if any; image/video/gif/audio cards have a Download button rendered as `<a href={getDownloadUrl(...)} download>` with the API key appended as `?apiKey=KEY` query param; text cards show text inline with no download button; loading skeleton while fetching; empty state for no contacts/no items; error state for disconnected session
- [x] T017 Create `dashboard/src/pages/Status.css` — styles for the two-panel layout, contact cards, status item grid, type badges, download button
- [x] T018 Add `{ to: '/status', icon: CirclePlay, key: 'status', adminOnly: false }` to `allNavItems` array in `dashboard/src/components/Layout.tsx` and add `CirclePlay` to the lucide-react import
- [x] T019 Add `const Status = lazy(() => import('./pages/Status').then(m => ({ default: m.Status })))` import and `<Route path="status" element={<Status />} />` route to `dashboard/src/App.tsx`

**Checkpoint**: Full Status page works end-to-end in the browser.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T020 [P] Export `StatusContactDto`, `StatusItemDto`, `StatusContactsResponseDto`, `StatusItemsResponseDto` from `src/modules/status/dto/index.ts` (create if not exists)
- [x] T021 [P] Update `src/modules/status/status.service.ts` imports to use the new DTOs from the barrel export
- [x] T022 Verify `src/modules/status/status.module.ts` exports are correct and no module wiring is broken — run `npm run build` and confirm zero TypeScript errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately, all T001–T003 in parallel
- **Phase 2 (Foundational)**: Depends on T001 (interface must exist) — T004, T005, T006 run sequentially (same file)
- **Phase 3 (US1)**: Depends on T004 (getContactStatuses) — T007 then T008
- **Phase 4 (US2)**: Depends on T005 (getContactStatus) — T009 then T010
- **Phase 5 (US3)**: Depends on T006 (downloadStatusMedia) — T011 then T012
- **Phase 6 (Dashboard)**: Depends on Phases 3–5 (API must work) — T013–T015 parallel, then T016, T017, T018, T019
- **Phase 7 (Polish)**: Depends on all phases complete — T020–T021 parallel, then T022

### User Story Dependencies

- **US1 (P1)**: Depends only on T001 + T004 — can start after Phase 1 + T004
- **US2 (P2)**: Depends only on T001 + T005 — independent of US1
- **US3 (P3)**: Depends only on T001 + T006 — independent of US1 and US2

### Parallel Opportunities

```bash
# Phase 1 — all parallel:
T001  src/engine/interfaces/whatsapp-engine.interface.ts
T002  src/modules/status/dto/status-contact.dto.ts
T003  src/modules/status/dto/status-item.dto.ts

# Phase 6 — T013/T014/T015 parallel:
T013  dashboard/src/services/api.ts
T014  dashboard/src/i18n/locales/en.json
T015  dashboard/src/i18n/locales/he.json
```

---

## Implementation Strategy

### MVP First (US1 Only — 4 tasks)

1. T001 → T004 → T007 → T008
2. Test: `curl .../status` returns real contacts
3. Stop and validate before adding US2/US3

### Incremental Delivery

1. T001–T003 (setup) → T004–T006 (engine) → T007–T008 (US1 API) → validate
2. T009–T010 (US2 API) → validate
3. T011–T012 (US3 API) → validate
4. T013–T019 (dashboard) → validate full UI
5. T020–T022 (polish)

---

## Notes

- T006 (`downloadStatusMedia` adapter) is the most complex task — `getBroadcastById` returns
  the whole broadcast; iterate `broadcast.msgs` to find by `msg.id._serialized === messageId`
- The download endpoint uses `@Res()` (Express response injection) — do NOT use `@Res({ passthrough: true })`
  as we need direct `res.set()` / `res.send()` control for binary streaming
- Dashboard download uses `<a href download>` not `fetch()` — browser handles the file save dialog natively
- API key passed as `?apiKey=` query param on download URLs because `<a>` tags cannot set custom headers
