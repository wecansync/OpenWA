<!--
SYNC IMPACT REPORT
==================
Version change: [unversioned] → 1.0.0
Added sections: Core Principles (I–V), Security Standards, Development Workflow, Governance
Removed sections: None (initial population)
Templates requiring updates:
  ✅ plan-template.md    — Constitution Check gates align with principles below
  ✅ spec-template.md    — Scope/requirements align with FR and security constraints
  ✅ tasks-template.md   — Task categories reflect observability, security, and test discipline
Deferred items: None
-->

# OpenWA Constitution

## Core Principles

### I. Pluggable Architecture (NON-NEGOTIABLE)

Every external dependency — database, storage, cache, and WhatsApp engine — MUST be accessed
through an interface/adapter, never directly from business logic. Swapping any backend
(e.g., SQLite → PostgreSQL, local → S3, memory → Redis) MUST require only configuration
changes, not code changes. New engine adapters MUST implement `IWhatsAppEngine` fully before
being wired into any module.

**Rationale**: The entire value proposition of OpenWA is vendor-neutral self-hosting. Tight
coupling to any specific backend destroys that promise and creates hidden migration costs.

### II. Security First

All API endpoints MUST be protected by the API key guard. API keys MUST be validated for
expiry at every request. Role-based access (admin/operator/readonly) MUST be enforced at
the controller level with explicit `@RequiredRole` decorators. No secrets (keys, passwords,
tokens) MUST appear in logs, responses, or client-side storage beyond `sessionStorage`.
IP whitelisting MUST support full CIDR notation, not only exact matches.

**Rationale**: OpenWA runs on user-owned infrastructure handling real communication data.
A compromised instance affects the phone numbers of real people.

### III. Graceful Degradation Over Silent Failure

Every unimplemented or unsupported engine feature MUST return a structured
`501 Not Implemented` response with a descriptive message. Silent empty returns (`null`,
`[]`) for broken features are FORBIDDEN. All error paths MUST be caught and re-thrown as
typed NestJS exceptions (`BadRequestException`, `NotFoundException`, etc.) — raw engine
errors MUST NOT propagate as 500s.

**Rationale**: Developers integrating OpenWA depend on predictable error contracts.
Silent failures cause data loss and are harder to debug than explicit errors.

### IV. Observability by Default

Every significant operation (session lifecycle, message send/receive, webhook dispatch,
auth event) MUST emit a structured log entry and an audit record. WebSocket events MUST
be scoped to per-session rooms — broadcasting all events to all clients is FORBIDDEN.
Plugin hooks MUST exist for every major operation type: message send, receive, edit,
delete, reaction, session connect/disconnect, group changes.

**Rationale**: OpenWA is infrastructure. Operators MUST be able to trace what happened,
when, and why — without reading source code.

### V. Simplicity and Incrementalism

No abstraction, pattern, or dependency MUST be introduced unless it solves a problem
present in the current codebase. YAGNI (You Aren't Gonna Need It) applies strictly.
Batch and bulk operations MUST be queued through BullMQ when `REDIS_ENABLED=true` and
MUST fall back to synchronous processing when Redis is disabled — never the reverse.
Database migrations MUST be explicit and reversible; `DATABASE_SYNCHRONIZE` MUST be
`false` in all production configurations.

**Rationale**: OpenWA is self-hosted by developers of varying skill levels. Complexity
without justification increases maintenance burden and discourages contribution.

## Security Standards

- Passwords and secrets MUST be stored hashed (bcrypt or equivalent); never plaintext.
- S3/MinIO credentials shown in the dashboard MUST be masked (input type=password).
- Session authentication state (role, key) MUST use `sessionStorage`, never `localStorage`.
- All webhook URLs MUST be validated as proper HTTP/HTTPS URLs before persistence.
- `chatId` values MUST be validated against WhatsApp format (`digits@c.us` or `digits@g.us`)
  at the DTO layer before reaching engine adapters.
- Bulk message batches MUST enforce a maximum size (configurable, default 1000 recipients)
  to prevent memory exhaustion.
- Session start/stop/restart operations MUST use optimistic locking or a per-session mutex
  to prevent concurrent state corruption.

## Development Workflow

- All features MUST follow the Spec → Plan → Tasks → Implement cycle via Spec Kit.
- Every task MUST reference the spec user story it belongs to (e.g., `[US1]`).
- Dashboard UI changes MUST include error states and loading states — no silent failures.
- All new API endpoints MUST have Swagger `@ApiOperation`, `@ApiResponse`, and `@ApiSecurity`
  decorators.
- Tests are OPTIONAL unless explicitly requested in the feature spec; when requested,
  they MUST be written before implementation (Red-Green-Refactor).
- Commits MUST be conventional (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).

## Governance

This constitution supersedes all other practices and style guides. Any amendment MUST:

1. Increment the version according to semver (MAJOR: principle removal/redefinition,
   MINOR: new principle or section, PATCH: clarification or wording fix).
2. Update the Sync Impact Report comment at the top of this file.
3. Propagate changes to all affected templates under `.specify/templates/`.
4. Be committed with message: `docs: amend constitution to vX.Y.Z (<summary>)`.

All spec reviews and PRs MUST verify compliance with the principles above before merge.
Complexity violations MUST be documented in the plan's Complexity Tracking table with
explicit justification.

**Version**: 1.0.0 | **Ratified**: 2026-05-19 | **Last Amended**: 2026-05-19
