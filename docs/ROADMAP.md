# Implementation Roadmap

Build the platform as a modular monolith first. Do not start by splitting every module into a microservice. Each phase must be demonstrably working before the next phase is considered complete.

## Current implementation status

This roadmap describes the intended product sequence. The implementation is substantially present; do not infer production acceptance from code presence. `IMPLEMENTATION_STATUS.md` is the current evidence record. Locally implemented areas include foundation/auth, media and host routing, briefs and bounded reference fetching, AI generation/revision, editorial snapshots/versioning, Cloudinary integration code, per-domain publication, monitoring, rate limits, and bounded pagination. Remaining verification gates include a real Cloudinary upload, production DNS/TLS/hosting, and Redis-backed scheduled/worker execution. AI generation currently runs in the request path; background AI jobs are not verified as implemented.

## Phase 0 — Repository discovery and technical baseline

**Current status:** Implemented and locally verified (typecheck, lint, test suite, production build). See `IMPLEMENTATION_STATUS.md` for the latest observed run.

**Deliverables**
- Inspect current repository and runtime.
- Confirm package manager, Node version, Next.js version, App Router, TypeScript, lint/test scripts.
- Confirm PostgreSQL availability and development workflow.
- Establish code conventions, folder structure, env handling, and CI checks.
- Record unresolved product decisions from `OPEN_DECISIONS.md`.

**Exit criteria**
- App runs locally.
- Typecheck, lint, and production build work or existing failures are documented.
- `.env.example` exists and secrets are ignored by Git.

## Phase 1 — Foundation, authentication, and database

**Current status:** Implemented locally; migration, seed, login, sessions, roles/media scopes, audit records, and responsive shell are present. Unauthenticated dashboard access is guarded; broader route-level authorization tests are still pending.

**Deliverables**
- PostgreSQL + Prisma schema and initial migration.
- Authentication and secure sessions.
- Roles/permissions and server-side authorization helpers.
- User management basics.
- Audit log foundation.
- Application shell and responsive navigation.

**Exit criteria**
- Unauthorized users cannot access dashboard APIs/pages.
- Role checks are tested on server actions/API handlers.
- Database migration and seed workflow are reproducible.

## Phase 2 — Media and domain management

**Current status:** Media CRUD/profiles, categories, domain records, hostname resolution, and public route skeleton are implemented. Two live verified domains and cross-tenant integration tests remain pending.

**Deliverables**
- Media site CRUD.
- Media editorial profiles and branding settings.
- Domain mapping and verification status.
- Hostname-to-tenant resolver for public Next.js routes.
- Two local/test hostnames or equivalent integration tests.
- Public media homepage, article list, article detail, category page, and 404/unknown-host behavior.

**Exit criteria**
- Two domains show distinct media branding and only their own data.
- Unknown domain cannot see another media site's content.

## Phase 3 — Source briefs and reference ingestion

**Current status:** Brief create/edit/archive with optional narrative/references is implemented. Safe bounded URL fetching, SSRF/IP protections, robots check, and failure states are implemented and covered by unit tests. Production source-provider terms remain to be reviewed.

**Deliverables**
- Source brief create/edit/archive.
- Reference URL management.
- Safe URL fetch service (no private/internal IP access, bounded redirects/timeouts/size).
- Extracted page metadata and readable text where permitted.
- Source summary and extraction error states.

**Exit criteria**
- User can submit narrative plus references.
- Failed or blocked URLs are visible and do not crash the workflow.
- Source/reference metadata persists.

## Phase 4 — AI News Generator

**Current status:** OpenRouter adapter, prompt/version tracking, multi-media selection, structured-output validation, evidence-claim checks, AI run metadata, and topic-only drafting are implemented. Generation runs inline in the request path; the background generation queue and UI states for queued/background jobs remain pending.

**Deliverables**
- Pluggable AI provider interface.
- Versioned prompt templates.
- Generation job queue.
- Multi-media selection.
- One article draft per selected media profile.
- Structured output validation and fact/source notes.
- Token/cost/provider/model logs when available.

**Exit criteria**
- One source brief generates at least two different drafts for two profiles.
- Main factual claims are traceable to supplied references/context or flagged as unsupported.
- Regenerating one draft does not change another draft.
- UI shows pending, completed, and failed generation states.

## Phase 5 — Editorial workspace and revision system

**Current status:** Editorial list/filters, editing, AI revision, version snapshots, restore with idempotent restore, reviewer notes, approve/reject/needs-changes, bulk approval, and publication eligibility guards are implemented. Diff UI and broader route-level integration tests remain pending.

**Deliverables**
- Editorial table/list with filters.
- Preview/editor UI.
- Manual article editing.
- AI revision instructions and regenerated versions.
- Version history and restore/diff.
- Reviewer notes and approve/reject actions.
- Safe bulk selection and confirmation.

**Exit criteria**
- Manual edit saves a new version or a tracked revision.
- AI revision changes only the selected article.
- Bulk approval affects only selected eligible articles.
- Rejected articles cannot be published.

## Phase 6 — Cloudinary asset library

**Current status:** Official SDK integration, server-side upload handling, asset metadata/provenance fields, picker, featured-image assignment, and safe-reference checks are implemented. A real Cloudinary upload has not been tested yet; this acceptance item stays open.

**Deliverables**
- Official Cloudinary Node SDK integration.
- Server-side signed upload endpoint/action.
- Cloudinary folders by media/article.
- Asset metadata persistence.
- Asset picker and article featured-image assignment.
- Image source/licence/credit/AI-generated provenance fields.
- Delete/archive flow with safe reference checks.

**Exit criteria**
- Real test image uploads to Cloudinary and returns a `secure_url` plus `public_id`.
- DB stores asset metadata.
- Browser and server logs never expose API secret.
- Images render using Cloudinary delivery URLs and responsive transformations.

## Phase 7 — Publishing adapters and background jobs

**Current status:** Per-domain publication targets, approved-version snapshots, idempotency, state guards, attempt history, inline immediate publishing, and optional BullMQ worker code are implemented. Redis-backed scheduling/retries and a real published test domain have not been verified yet.

**Deliverables**
- Per-site publishing adapter interface.
- Initial adapter for the selected multi-tenant Next.js publishing API.
- Redis + BullMQ queue/worker, or a documented equivalent if Redis deployment is unavailable.
- One independent publication job per article/site.
- Scheduled publishing.
- Retry/backoff and idempotency protection.
- Publication logs and remote URL/article ID.

**Exit criteria**
- Approved article publishes to a test domain.
- One failed domain does not block successful domains.
- Retrying a job does not create duplicate public articles.
- Scheduled article publishes at the configured timezone/time.

## Phase 8 — Monitoring and operations

**Current status:** Dashboard, media/article/asset/publication state views, and manual retry/cancel actions are implemented and use real database data. Queue/worker health, structured operational alerts, and deployment monitoring are not yet configured.

**Deliverables**
- Central overview dashboard backed by real data.
- Per-site status and last successful publication.
- Queue/worker health and failed-job view.
- Manual retry and safe cancel operations.
- Structured logging and operational alerts.

**Exit criteria**
- Admin can identify which domain/job failed and why.
- Logs correlate source brief → generated article → publication job.

## Phase 9 — Basic analytics and production hardening

**Current status:** Article/publication metrics, rate limits, bounded pagination, and security headers are implemented. Backup/restore drill, load testing based on actual production volume, secret rotation, and a deployment runbook remain pending.

**Deliverables**
- Article counts and publication success metrics.
- AI usage/cost metrics if provider supports it.
- Rate limits and quotas.
- Backups and restore procedure.
- Load tests based on confirmed production volume.
- Security review and deployment runbook.

**Exit criteria**
- Acceptance criteria pass.
- Backup/restore is tested in a non-production environment.
- Deployment, rollback, monitoring, and secret rotation procedures are documented.

## Suggested order of delivery

Do not build analytics before reliable publishing. Do not polish the public website before multi-tenant isolation and publishing are correct. Prioritize the complete workflow from source brief to approved article to Cloudinary image to publication to logs.
