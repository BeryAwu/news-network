# Implementation Roadmap

Build the platform as a modular monolith first. Do not start by splitting every module into a microservice. Each phase must be demonstrably working before the next phase is considered complete.

## Phase 0 — Repository discovery and technical baseline

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
