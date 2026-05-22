# Data Model: WhatsApp Status Downloader

> No new database tables. All data is ephemeral, fetched live from the WhatsApp engine.

---

## Engine Interface Types (src/engine/interfaces/whatsapp-engine.interface.ts)

### StatusContact *(new)*
Contact summary for the status list view.

| Field | Type | Description |
|---|---|---|
| `contactId` | `string` | WhatsApp contact ID (e.g. `96176135165@c.us`) |
| `name` | `string \| undefined` | Contact's saved name |
| `pushName` | `string \| undefined` | Contact's WhatsApp display name |
| `totalCount` | `number` | Total number of active status items |
| `unreadCount` | `number` | Number of statuses not yet viewed |
| `lastTimestamp` | `Date` | Timestamp of most recent status item |

### Status *(extended)*
Individual status item.

| Field | Type | Change |
|---|---|---|
| `id` | `string` | Existing — WhatsApp message ID |
| `messageId` | `string` | **NEW** — same as id, explicit for download routing |
| `contact` | `{ id, name?, pushName? }` | Existing |
| `type` | `'text' \| 'image' \| 'video' \| 'audio' \| 'gif'` | **EXTENDED** — added audio, gif |
| `hasMedia` | `boolean` | **NEW** — true for image/video/audio/gif |
| `caption` | `string \| undefined` | Existing |
| `mediaUrl` | `string \| undefined` | Existing |
| `backgroundColor` | `string \| undefined` | Existing |
| `font` | `number \| undefined` | Existing |
| `timestamp` | `Date` | Existing |
| `expiresAt` | `Date` | Existing |

### MediaDownloadResult *(new)*
Return type for `downloadStatusMedia()`.

| Field | Type | Description |
|---|---|---|
| `data` | `string` | Base64-encoded file content |
| `mimetype` | `string` | MIME type (e.g. `image/jpeg`, `video/mp4`) |
| `filename` | `string \| undefined` | Original filename if available |
| `filesize` | `number \| undefined` | File size in bytes |

---

## New Engine Interface Methods

```
getContactStatuses(): Promise<StatusContact[]>    // was: Promise<Status[]>
getContactStatus(contactId: string): Promise<Status[]>
downloadStatusMedia(contactId: string, messageId: string): Promise<MediaDownloadResult>
```

---

## API Response DTOs (src/modules/status/dto/)

### StatusContactDto
```
{
  contactId: string
  name?: string
  pushName?: string
  totalCount: number
  unreadCount: number
  lastTimestamp: string   // ISO date
}
```

### StatusItemDto
```
{
  messageId: string
  type: 'text' | 'image' | 'video' | 'audio' | 'gif'
  hasMedia: boolean
  caption?: string
  text?: string           // for text-type statuses
  timestamp: string       // ISO date
  expiresAt: string       // ISO date
}
```
