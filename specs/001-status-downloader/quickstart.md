# Quickstart: Status Downloader

## Prerequisites
- Session in `ready` status with an active WhatsApp connection
- API key with at least `operator` role

## 1. List contacts with active statuses

```bash
curl http://localhost:2785/api/sessions/YOUR_SESSION_ID/status \
  -H "X-API-Key: YOUR_API_KEY"
```

Expected: JSON with `contacts` array. Each contact shows `totalCount` and `unreadCount`.

## 2. Get a contact's status items

```bash
curl http://localhost:2785/api/sessions/YOUR_SESSION_ID/status/96170394960@c.us \
  -H "X-API-Key: YOUR_API_KEY"
```

Expected: JSON with `items` array. Each item has `messageId`, `type`, `hasMedia`.

## 3. Download a media status

```bash
curl -OJ "http://localhost:2785/api/sessions/YOUR_SESSION_ID/status/96170394960@c.us/MESSAGE_ID/download" \
  -H "X-API-Key: YOUR_API_KEY"
```

Expected: File saved to current directory with correct extension.

## 4. Via Dashboard

1. Open dashboard → click **Status** in the sidebar
2. Select a session from the dropdown
3. A grid of contacts with active statuses appears
4. Click a contact → their status items appear on the right
5. Click **Download** on any image/video/audio/GIF item
6. File saves to your browser's download folder
