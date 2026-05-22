# API Contracts: WhatsApp Status Downloader

Base path: `/api/sessions/:sessionId/status`
Auth: `X-API-Key` header required on all endpoints.

---

## GET /api/sessions/:sessionId/status

List all contacts with active status updates visible to this session.

**Response 200**
```json
{
  "contacts": [
    {
      "contactId": "96176135165@c.us",
      "name": "Ahmad",
      "pushName": "Ahmad Sarraj",
      "totalCount": 3,
      "unreadCount": 2,
      "lastTimestamp": "2026-05-19T08:00:00.000Z"
    }
  ]
}
```

**Response 400** — Session not connected
```json
{ "statusCode": 400, "message": "Session 'support' is not active. Start the session first.", "error": "Bad Request" }
```

**Response 404** — Session not found
```json
{ "statusCode": 404, "message": "Session <id> not found or not connected", "error": "Not Found" }
```

---

## GET /api/sessions/:sessionId/status/:contactId

Get individual status items for a specific contact.

**Params**: `contactId` — WhatsApp ID (e.g. `96176135165@c.us`)

**Response 200**
```json
{
  "items": [
    {
      "messageId": "true_96176135165@c.us_3EB0A1234567",
      "type": "image",
      "hasMedia": true,
      "caption": "Good morning!",
      "timestamp": "2026-05-19T06:00:00.000Z",
      "expiresAt": "2026-05-20T06:00:00.000Z"
    },
    {
      "messageId": "true_96176135165@c.us_3EB0B9876543",
      "type": "text",
      "hasMedia": false,
      "text": "Have a great day everyone",
      "timestamp": "2026-05-19T07:30:00.000Z",
      "expiresAt": "2026-05-20T07:30:00.000Z"
    }
  ]
}
```

**Response 404** — Contact has no active statuses or not found
```json
{ "statusCode": 404, "message": "No active statuses found for contact <contactId>", "error": "Not Found" }
```

---

## GET /api/sessions/:sessionId/status/:contactId/:messageId/download

Download the media file for a specific status item.

**Params**:
- `contactId` — WhatsApp contact ID
- `messageId` — Status message ID from the items list

**Response 200** — Binary file stream
```
Content-Type: image/jpeg
Content-Disposition: attachment; filename="status-96176135165-1716105600.jpg"
[binary data]
```

**Response 404** — Status expired or not found
```json
{ "statusCode": 404, "message": "Status media not found or has expired", "error": "Not Found" }
```

**Response 400** — Text status has no media
```json
{ "statusCode": 400, "message": "This status item has no downloadable media", "error": "Bad Request" }
```

**Response 408** — Download timeout
```json
{ "statusCode": 408, "message": "Media download timed out. Please try again.", "error": "Request Timeout" }
```

---

## Unchanged endpoints (existing, no modification)

- `POST /api/sessions/:sessionId/status/send-text` — post own text status
- `POST /api/sessions/:sessionId/status/send-image` — post own image status
- `POST /api/sessions/:sessionId/status/send-video` — post own video status
- `DELETE /api/sessions/:sessionId/status/:statusId` — delete own status
