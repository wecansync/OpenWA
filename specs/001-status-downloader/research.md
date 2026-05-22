# Research: WhatsApp Status Downloader

## Decision 1 — Status Fetching via whatsapp-web.js

**Decision**: Use `client.getBroadcasts()` for listing all contacts' statuses and
`client.getBroadcastById(contactId)` for fetching a specific contact's status items.

**Rationale**: Both methods exist and are functional in whatsapp-web.js v1.34.7. The
`Broadcast` object returned contains a `msgs` array of `Message` instances — the same
`Message` type used for regular chat messages, which means `downloadMedia()` works
identically.

**Alternatives considered**:
- Custom `pupPage.evaluate()` injections via `WAWebCollections.Status` — more fragile,
  tightly coupled to WhatsApp Web internals, already abstracted by the library.

**Impact on existing code**: The engine adapter's `getContactStatuses()` and
`getContactStatus()` stubs will be replaced with real implementations. The existing
`Status` interface needs extension (see Decision 4).

---

## Decision 2 — Download Endpoint Approach

**Decision**: Dedicated `GET /sessions/:sessionId/status/:contactId/:messageId/download`
endpoint. Calls `downloadMedia()` on the status Message object, converts base64 to
Buffer, and streams with correct `Content-Type` and `Content-Disposition` headers.

**Rationale**: `downloadMedia()` returns `{ data: base64, mimetype, filename, filesize }`.
Converting base64 → Buffer → stream is standard Node.js and produces a true file download
in the browser without any client-side decoding.

**Alternatives considered**:
- Return base64 JSON — forces client-side decode, breaks native browser download dialog,
  doubles payload size due to base64 encoding overhead.
- Pre-download and cache on disk — violates Principle V (YAGNI), not requested.

---

## Decision 3 — Engine Interface Extension

**Decision**: Add `downloadStatusMedia(contactId: string, messageId: string): Promise<MediaDownloadResult>`
to `IWhatsAppEngine`. Add `MediaDownloadResult` interface: `{ data: string, mimetype: string, filename?: string, filesize?: number }`.

**Rationale**: Principle I mandates all engine access goes through the interface. The
status service must call `engine.downloadStatusMedia()`, not access whatsapp-web.js
directly.

**Implementation approach in adapter**: Use `getBroadcastById(contactId)` to get the
Broadcast, find the Message by messageId in `broadcast.msgs`, then call
`message.downloadMedia()`.

---

## Decision 4 — Status Interface Extension

**Decision**: Extend existing `Status` interface:
- Add `audio` to the type union: `'text' | 'image' | 'video' | 'audio' | 'gif'`
- Add `hasMedia: boolean` field
- Add `messageId` field (the WhatsApp message ID used for download)

Add new `StatusContact` interface for the contact-list view:
```
{
  contactId: string
  name?: string
  pushName?: string
  totalCount: number
  unreadCount: number
  lastTimestamp: Date
}
```

**Rationale**: The current interface was designed only for posting statuses (Phase 3
stub). Reading statuses requires the message ID for download routing, and the contact
list view needs a lighter summary object.

---

## Decision 5 — No Database Persistence

**Decision**: Status data is NOT stored in the database. All status fetching is
on-demand, proxied through the live WhatsApp engine.

**Rationale**: Statuses expire in 24 hours. Storing them creates stale data, requires
cleanup jobs, and adds DB schema complexity with no benefit — the spec explicitly states
no persistence is needed.

---

## Decision 6 — Dashboard Implementation Pattern

**Decision**: Follow the existing page pattern: functional React component with
`useState`/`useEffect`, `sessionApi`-style service calls via a new `statusApi` object
in `services/api.ts`, CSS module for styles.

**Two-panel layout**:
- Left: contact list (same pattern as Sessions page card grid)
- Right: status items grid for selected contact (same pattern as MessageTester)

**Download**: `<a>` tag with `href` pointing to the download endpoint + `download`
attribute. The API key is passed as a query param for browser-initiated downloads
(can't set headers on `<a>` tags).
