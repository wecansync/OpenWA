# Feature Specification: WhatsApp Status Downloader

**Feature Branch**: `001-status-downloader`

**Created**: 2026-05-19

**Status**: Draft

---

## User Scenarios & Testing

### User Story 1 — View All Contacts' Active Statuses (Priority: P1)

A session owner opens the Status page in the dashboard and sees a list of all contacts
who currently have active status updates visible to their WhatsApp number — the same
contacts they would see in the WhatsApp app's Status tab.

**Why this priority**: This is the entry point. Without it, no download is possible.
It delivers immediate value by surfacing who has statuses without needing the phone.

**Independent Test**: Navigate to the Status page with a connected session — a list of
contacts with status count and last-updated timestamp renders. No download needed to
validate this story.

**Acceptance Scenarios**:

1. **Given** a connected session, **When** the user opens the Status page, **Then** a
   list of contacts with active statuses is displayed, showing contact name, number of
   status items, and time of last status.
2. **Given** no contacts have active statuses, **When** the user opens the Status page,
   **Then** an empty state message is shown ("No status updates available").
3. **Given** a contact set their status to "My Contacts" and the session number is not
   in their contacts, **When** the user opens the Status page, **Then** that contact
   does not appear in the list.

---

### User Story 2 — Preview a Contact's Individual Status Items (Priority: P2)

After selecting a contact from the status list, the user sees all individual status
items from that contact — images shown as thumbnails, videos with a play indicator,
text statuses displayed inline, and GIFs animated.

**Why this priority**: Previewing allows the user to identify which items they want to
download before committing to a download.

**Independent Test**: Click a contact in the list — their individual status items render
as a grid/list with type indicators and timestamps.

**Acceptance Scenarios**:

1. **Given** a contact with multiple status items, **When** the user selects that
   contact, **Then** all their status items are displayed with type (image/video/text/gif),
   caption if any, and posting timestamp.
2. **Given** a contact with a text-only status, **When** the user selects that contact,
   **Then** the text content is displayed directly without a download option.
3. **Given** a contact with an expired status (>24 hours), **When** the user selects
   that contact, **Then** the expired item is not shown.

---

### User Story 3 — Download a Status Media File (Priority: P3)

The user clicks a download button on any image, video, audio, or GIF status item and
the file is saved to their device in its original format and quality.

**Why this priority**: The core monetizable action. Everything else leads to this.

**Independent Test**: Click download on an image status — a file download begins in the
browser and the saved file opens correctly in an image viewer.

**Acceptance Scenarios**:

1. **Given** an image status item, **When** the user clicks Download, **Then** the
   image file is downloaded to the browser's default download location in its original
   format (jpg/png/webp).
2. **Given** a video status item, **When** the user clicks Download, **Then** the video
   file is downloaded in its original format (mp4) with audio intact.
3. **Given** a GIF status item, **When** the user clicks Download, **Then** the
   animated GIF file is downloaded.
4. **Given** a text-only status, **When** the user views it, **Then** no download
   button is shown (text is already visible inline).
5. **Given** the session is disconnected, **When** the user attempts to download,
   **Then** a clear error message is shown: "Session is not connected."

---

### Edge Cases

- What happens when a status expires between listing and downloading? → API returns a
  graceful error; dashboard shows "This status has expired."
- What if the session loses connection mid-download? → Partial download is discarded;
  error shown to user.
- What if a contact has 30 status items (WhatsApp max)? → All 30 are listed; no
  pagination needed within a single contact's statuses.
- What if media download from WhatsApp servers times out? → Error shown after 30s;
  user can retry.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST expose an API endpoint that returns all contacts with active
  status updates visible to the given session.
- **FR-002**: System MUST expose an API endpoint that returns all individual status
  items for a specific contact, including type, caption, and timestamp.
- **FR-003**: System MUST expose an API endpoint that downloads the media file for a
  specific status item and returns it as a binary file stream with correct MIME type.
- **FR-004**: System MUST return a structured error when a status item no longer exists
  (expired or deleted) rather than crashing.
- **FR-005**: System MUST only return statuses visible to the session's WhatsApp number,
  respecting the contact's privacy settings (Everyone / My Contacts / My Contacts Except).
- **FR-006**: Dashboard MUST display the Status page with a contact list, per-contact
  status item grid, and download buttons for media items.
- **FR-007**: Dashboard MUST show text status content inline without a download button.
- **FR-008**: Dashboard MUST display the correct file type indicator for each status item
  (image / video / audio / gif / text).

### Key Entities

- **Broadcast**: A contact's status channel — has contact ID, total count, unread count,
  and a list of status messages.
- **StatusItem**: An individual status post — has message ID, type, caption, timestamp,
  and downloadable media flag.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can go from opening the Status page to downloading a media file in
  under 3 clicks.
- **SC-002**: The status list loads within 5 seconds for sessions with up to 200 contacts
  with active statuses.
- **SC-003**: Downloaded files are identical in quality to the original (lossless — no
  re-encoding or compression added by the platform).
- **SC-004**: 100% of status items respect the contact's privacy settings — no status
  is shown that would not be visible on the phone.
- **SC-005**: All error states (expired, disconnected, timeout) surface a human-readable
  message; zero raw 500 errors reach the user.

---

## Assumptions

- The session must be in `ready` status for status fetching to work — the dashboard will
  show a "Session not connected" state otherwise.
- Status data is fetched on-demand (when the user opens the page), not cached or polled
  in the background.
- No persistent storage of downloaded statuses is needed — files are downloaded directly
  to the user's browser.
- Audio statuses are treated the same as video for download purposes.
- The feature is scoped to viewing and downloading contacts' statuses only — posting or
  deleting own statuses is out of scope for this feature.
- Multi-session support: the Status page works per-session; users select which session
  to browse statuses from.
