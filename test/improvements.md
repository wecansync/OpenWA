# OpenWA — Fixes & Features Backlog

## Bugs to Fix

### Security
- [ ] API key expiry (`expiresAt`) not checked at request time — expired keys still work
- [ ] User role stored in `localStorage`, API key in `sessionStorage` — role persists after logout and can be spoofed
- [ ] IP whitelist only does exact match — CIDR notation (e.g. `192.168.1.0/24`) not implemented despite being documented

### API / Backend
- [ ] Status/Stories endpoints throw raw 500 errors instead of a clean "not supported" response
- [ ] Catalog API (`getCatalog`, `sendProduct`, etc.) silently returns empty data — listed as implemented in v0.1.0 but broken
- [ ] `chatId` format not validated — invalid IDs accepted and fail deep in the engine
- [ ] No maximum batch size on bulk messaging — a huge batch can exhaust memory
- [ ] Session start/stop/restart has no locking — rapid calls can leave the engine map out of sync with the DB

### Dashboard
- [ ] Session errors (create/delete/start fail) only logged to console, no UI feedback shown
- [ ] Infrastructure page save failures are silent — no error toast
- [ ] Webhook test result shows no HTTP status code, response time, or error detail
- [ ] Login page shows generic error on auth failure — no way to troubleshoot

---

## Missing Features

### Messaging
- [ ] Bulk message progress not pushed via WebSocket — can't watch a batch run in real time
- [ ] No `message:edit` or `message:delete` hooks for plugins
- [ ] Message reactions have no plugin hooks

### Sessions
- [ ] No auto-restore on server restart — sessions marked `ready` in DB must be manually restarted after reboot

### Webhooks
- [ ] No exponential backoff on retries — all retries fire at fixed intervals causing retry storms

### Queue
- [ ] Message queue processor missing — bulk messages run synchronously, not queued through BullMQ

### Dashboard UX
- [ ] No skeleton loaders — pages flash a spinner then jump to content
- [ ] No real-time chatId format validation in message tester
- [ ] S3 secret key shown in plaintext in Infrastructure form

### Plugin System
- [ ] Group operation hooks missing
- [ ] No hooks for contact or label changes

---

## Performance

- [ ] Session stats hit the database on every request — no caching
- [ ] WebSocket gateway broadcasts all events to all clients — no per-session room filtering
- [ ] Message history has no default limit — querying a large chat can strain the DB
