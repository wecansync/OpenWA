# Plan: Download Source Image/Video from Status

**Feature:** Allow downloading the original (decrypted) image or video file from a WhatsApp status to disk via the API and dashboard.
**Branch:** `001-status-downloader`
**Date:** 2026-05-20

---

## 1. Goal

Today `GET /status/contacts/:contactId/items/:messageId/media` returns the media as a base64 string inside a JSON envelope (`{ data, mimetype, filename, filesize }`). The dashboard cannot trigger a true browser file download from that response without extra client-side decoding, and large videos are inefficient over JSON.

We want to:

1. Stream the **decrypted binary source file** directly to the HTTP response with proper `Content-Type`, `Content-Disposition: attachment`, and `Content-Length` headers so the browser saves the file natively.
2. Add a **Download** button on the dashboard Status page that calls the new endpoint and saves the file (`status-<contactId>-<timestamp>.<ext>`).
3. Keep the existing base64 endpoint for backwards compatibility (used by preview rendering).

---

## 2. Current State (Code References)

- Service: [status.service.ts:58-70](../../../src/modules/status/status.service.ts#L58-L70) — `downloadStatusMedia` returns `MediaDownloadResult` (base64).
- Controller: [status.controller.ts](../../../src/modules/status/status.controller.ts) — currently returns JSON.
- Engine adapter: [whatsapp-web-js.adapter.ts:892-931](../../../src/engine/adapters/whatsapp-web-js.adapter.ts#L892-L931) — calls `msg.downloadMedia()` from whatsapp-web.js, which already decrypts the WA media using the underlying `decryptMedia` flow.
- Engine interface: [whatsapp-engine.interface.ts](../../../src/engine/interfaces/whatsapp-engine.interface.ts) — defines `MediaDownloadResult`.
- Dashboard page: [Status.tsx](../../../dashboard/src/pages/Status.tsx) — renders status items.

The decryption is already happening; we just need a binary-streaming pathway.

---

## 3. Approach

### 3.1 Backend — new streaming endpoint

Add a sibling route that returns a raw binary stream instead of JSON:

```
GET /status/contacts/:contactId/items/:messageId/media/file
```

- Reuses `StatusService.downloadStatusMedia()` to fetch the decrypted payload.
- Converts the base64 `data` to a `Buffer`.
- Returns a NestJS `StreamableFile` with headers:
  - `Content-Type: <mimetype>`
  - `Content-Length: <buffer.length>`
  - `Content-Disposition: attachment; filename="status-<shortId>.<ext>"`
- Extension derived from mimetype (`image/jpeg` → `.jpg`, `video/mp4` → `.mp4`, `image/webp` → `.webp`, fallback `.bin`).
- Same `ApiKeyGuard` as other status routes.

No engine-adapter changes required — `downloadMedia()` already returns decrypted bytes.

### 3.2 Dashboard — Download button

In [Status.tsx](../../../dashboard/src/pages/Status.tsx), for each status item where `hasMedia === true`:

1. Add a Download icon button next to the existing preview.
2. On click, call `api.get('/status/contacts/:id/items/:mid/media/file', { responseType: 'blob' })`.
3. Use `URL.createObjectURL(blob)` + a synthetic `<a download="...">` click to save.
4. Show spinner while in-flight; toast on error (timeout / expired).

Add a method `downloadStatusMediaFile(contactId, messageId)` in [services/api.ts](../../../dashboard/src/services/api.ts).

### 3.3 i18n

Add `status.download` / `status.downloading` / `status.downloadFailed` keys to both `en.json` and `he.json`.

---

## 4. File Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/modules/status/status.controller.ts` | Add `GET .../media/file` returning `StreamableFile` |
| 2 | `src/modules/status/status.service.ts` | (optional) helper `buildDownloadStream()` that returns `{ buffer, mimetype, filename }` to keep controller thin |
| 3 | `dashboard/src/services/api.ts` | Add `downloadStatusMediaFile(contactId, messageId)` returning a Blob |
| 4 | `dashboard/src/pages/Status.tsx` | Render Download button; wire blob → file save |
| 5 | `dashboard/src/pages/Status.css` | Style the new button |
| 6 | `dashboard/src/i18n/locales/en.json` + `he.json` | New translation keys |

---

## 5. Edge Cases / Error Handling

- **Status expired** (>24h): adapter already throws `NotFoundException` → propagate as 404; dashboard shows "Status no longer available".
- **No media on item** (text-only status): existing `BadRequestException` 400 → dashboard hides button when `hasMedia === false`.
- **Slow download / timeout**: adapter has a 30s race; surface as 408 → dashboard shows "Download timed out, try again".
- **Large video memory pressure**: acceptable for now (status media is capped by WA at ~16MB). A real streaming pipe from puppeteer is out of scope.
- **Unknown mimetype**: fall back to `application/octet-stream` and `.bin` extension.

---

## 6. Testing

1. **Manual**:
   - Image status → click Download → file opens in default image viewer.
   - Video status → click Download → file plays in default video player.
   - Text status → no Download button visible.
   - Expired status → toast shows expected error.
2. **Smoke**: `curl -H "x-api-key: $KEY" -OJ http://localhost:3000/status/contacts/<id>/items/<mid>/media/file` saves the file with the correct extension.
3. **Type-check**: `npm run build` for both `src/` and `dashboard/`.

---

## 7. Out of Scope

- Bulk "download all from contact" (could be follow-up).
- Persisting downloads server-side / status archive.
- Re-encoding or thumbnail generation.

---

## 8. Estimated Effort

- Backend endpoint + helper: ~30 min
- Dashboard button + blob save + i18n: ~45 min
- Manual QA: ~15 min
- **Total: ~1.5 hours**
