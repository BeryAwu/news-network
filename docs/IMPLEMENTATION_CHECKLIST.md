# Implementation Checklist

This checklist summarizes the current code state, not production acceptance. `IMPLEMENTATION_STATUS.md` is the authoritative evidence record. A checked implementation item means code exists; it does not mean every route or external integration has passed production testing.

## Implemented in the application

- [x] Next.js App Router, TypeScript, PostgreSQL/Prisma schema and committed migration.
- [x] Environment template, ignored local secrets, local owner seed flow, and private Windows database launcher.
- [x] Signed HTTP-only sessions, roles, media scopes, same-origin mutation checks, audit helper, and rate limits.
- [x] Media profiles, category management, hostname mapping, manual domain verification state, and public tenant routes.
- [x] Source briefs with optional narrative/references, safe bounded reference ingestion, source facts, and evidence status.
- [x] OpenRouter structured-output adapter, versioned prompts, media-specific draft generation, topic-only draft mode, revisions, and generation metadata.
- [x] Editorial review decisions, immutable evidence snapshots, manual/AI revisions, version history, restore, and bulk approval.
- [x] Cloudinary server-side upload integration code, provenance/license checks, asset selection, and publication snapshot metadata.
- [x] Per-domain publication targets, immutable approved snapshots, attempt records, inline immediate publication, idempotency/state guards, and optional BullMQ worker code.
- [x] Dashboard/monitoring/settings surfaces, bounded list APIs, editorial pagination, responsive shell, and security headers.

## Verification still required before production

- [ ] Real Cloudinary image upload using an image whose reuse rights are confirmed; verify saved asset metadata and rendered image.
- [ ] Redis-compatible service and worker execution; verify scheduled jobs, retries, and recovery after worker restart.
- [ ] Two real/test hostnames on active media with end-to-end tenant-isolation checks and public rendering.
- [ ] Route/integration tests for authorization, IDOR, editorial transitions, upload/finalize, publish concurrency/retry, and tenant rendering.
- [ ] Production hosting, HTTPS/TLS, DNS and independently verified domain ownership.
- [ ] Backup/restore drill, CDN tenant-aware cache configuration, monitoring/alerts, secret rotation, and capacity/recovery checks.
- [ ] Owner-approved publisher disclosures, byline policy, AI budget, and provider privacy/retention review.

## Current automated verification

At the last recorded run, typecheck, lint, production build, and the 20-test Vitest suite passed. See `IMPLEMENTATION_STATUS.md` for the latest observed results and local smoke-test scope. These checks do not replace the external and route-level verification items above.
