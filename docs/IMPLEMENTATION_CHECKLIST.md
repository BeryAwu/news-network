# Implementation Checklist

## Repository and baseline
- [ ] Inspect repo and write `IMPLEMENTATION_STATUS.md`.
- [ ] Confirm Node/package manager/Next.js version and scripts.
- [ ] Set TypeScript strict mode and lint/test commands.
- [ ] Add `.env.example` and `.gitignore` secret patterns.
- [ ] Add app shell, error boundary, not-found, loading patterns.

## Database and auth
- [ ] Add Prisma and PostgreSQL configuration.
- [ ] Implement schema and migrations from `DATA_MODEL.md`.
- [ ] Add seed script for dev owner and sample sites only.
- [ ] Implement authentication.
- [ ] Implement roles, permissions, and media scopes.
- [ ] Add audit helper and tests.

## Media/domain management
- [ ] Create/list/edit/archive media sites.
- [ ] Create/list/verify/disable domains.
- [ ] Implement hostname normalization/resolution.
- [ ] Implement cross-tenant query helpers.
- [ ] Build public site routes and configurable theme.
- [ ] Test two domains and unknown-domain behavior.

## Source ingestion and AI
- [ ] Source brief CRUD.
- [ ] Safe URL fetcher and SSRF protections.
- [ ] Source reference metadata persistence.
- [ ] Provider-neutral AI adapter.
- [ ] Prompt versioning.
- [ ] Structured output schema validation.
- [ ] Claim/evidence mapping and uncertainty flags.
- [ ] Generate one draft per selected media site.
- [ ] Persist AI run logs and usage where available.

## Editorial workflow
- [ ] Editorial list and filters.
- [ ] Article preview and manual editor.
- [ ] Article version snapshots.
- [ ] AI revision with instruction.
- [ ] Diff/restore.
- [ ] Reviewer decision and notes.
- [ ] Individual and bulk approval with eligibility checks.

## Cloudinary
- [ ] Install official Cloudinary Node SDK.
- [ ] Add server-side configuration and health check.
- [ ] Implement signed upload/server upload.
- [ ] Validate file content/size and user scope.
- [ ] Save Cloudinary identifiers and metadata in PostgreSQL.
- [ ] Implement asset picker and image selection for articles.
- [ ] Add provenance/licence/credit/AI-image fields.
- [ ] Implement safe deletion and audit.

## Publishing and queues
- [ ] Add Redis/BullMQ connection and worker process.
- [ ] Persist publication target before enqueueing (consider outbox).
- [ ] Implement publisher adapter interface.
- [ ] Implement shared Next.js media publisher.
- [ ] Add idempotency and duplicate prevention.
- [ ] Add retry/backoff and permanent/transient error classification.
- [ ] Add scheduled publishing.
- [ ] Add publication attempts and result logs.
- [ ] Add monitoring/retry UI.

## Final hardening
- [ ] Cross-tenant security tests.
- [ ] Authentication/RBAC tests.
- [ ] AI output validation and unsupported-claim tests.
- [ ] Cloudinary credential leakage tests/review.
- [ ] Publishing retry/idempotency tests.
- [ ] Responsive/accessibility pass.
- [ ] Production build and deployment runbook.
- [ ] Backup/restore drill.
- [ ] Complete `ACCEPTANCE_CRITERIA.md`.
- [ ] Update `IMPLEMENTATION_STATUS.md` with truthful test results and remaining work.
