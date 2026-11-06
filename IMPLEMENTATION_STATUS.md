# Implementation Status

This file records the current implementation and its evidence. Product requirements and planned capabilities remain in `docs/`; a requirement is not considered delivered unless this status or a verification record says so.

## Current application

- Next.js App Router, TypeScript, PostgreSQL, and Prisma modular monolith with authenticated dashboard and host-resolved public media/article routes.
- Local private PostgreSQL 18 cluster is configured at `127.0.0.1:5433`; use `scripts/start-local.ps1` to start/reuse it and run the local app at `http://localhost:3000/login`.
- Local owner account is `owner@newsroom.local`. The password and all API/database secrets remain in ignored local files; never copy them into documentation or Git.
- The local database contains test records made during workflow debugging. Do not treat them as real newsroom content or a clean empty database. Reset only after confirming local test data is disposable.

## Implemented capabilities

- Authentication with signed HTTP-only sessions, server-side role/media-scope checks, same-origin mutation checks, audit records, and in-memory rate limits for login, AI actions, source ingestion, uploads, and publishing.
- Media profiles, categories, domains, role/user management, and host-based tenant resolution. Domain verification is an admin record of an external ownership check; the app does not perform DNS verification.
- Source briefs with optional narrative and optional references. A topic alone can be used to request an AI-authored draft; supplied facts/references remain evidence inputs and unsupported specifics must not be presented as verified.
- Bounded public HTTP(S) reference retrieval with DNS/public-IP validation, pinned requests, redirect checks, robots policy, size/time/content bounds, and per-reference status.
- OpenRouter integration with structured-output validation, Qwen3 235B configured as the local default, Qwen3 32B as an optional lower-cost model, and a development-only deterministic test adapter. Generation is versioned per media; invalid/unsupported source-fact citations are rejected.
- Editorial workflow: manual edit, AI revision, approval/rejection/needs-changes, individual and bulk review, immutable evidence snapshots, version history, restore, and compare-and-set protections for concurrent writes. Repeated restore of identical content does not create duplicate versions.
- Mandatory Cloudinary asset handling using the official server-side SDK, upload validation, provenance/license metadata, media scope checks, and publication-time featured-image snapshots. No real image upload has been completed yet.
- Per-domain publication targets with immutable approved-version snapshots, attempt history, idempotency, state guards, inline immediate publication, and optional BullMQ/Redis worker support. Scheduled execution and worker retry have not been verified locally because Redis is unavailable.
- Dashboard, monitoring, integrations/setup surfaces, responsive navigation, paged list APIs, editorial queue pagination, CSP/security headers, and safe generic server errors.
- Writing skills: per-media on/off guidance blocks that inject a fixed narrative style into AI drafting and revision prompts (seeded skill `humas-instansi`, derived from public-service/police press-release style). Skill state lives in `WritingSkill`/`MediaWritingSkill` tables, is audited, and is toggleable both from the media edit card and from a "Gaya penulisan AI" section on every editorial article card.
- AI readiness is reported honestly in the editorial UI: the revision section states whether a real provider or the deterministic test adapter is active, generation is blocked while the test adapter is on, and a revision that fails keeps the previous article version untouched while returning an actionable 502 message instead of a generic internal error.

## Verification recorded

The following results were observed in the current development checkout:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 24 tests passed.
- `npm run build`: passed after stopping the dev process that had locked the Prisma Windows DLL.
- OpenRouter JSON request and a topic-only draft generation succeeded.
- A real AI revision succeeded end to end with `AI_TEST_ADAPTER=false`: the editorial UI showed the active skill toggle turn on, the revision section reported "AI tersedia · openrouter · qwen/qwen3-235b-a22b-2507", the article advanced to version 2 with institution-style prose, and `AiGenerationRun` recorded provider `openrouter`, model `qwen/qwen3-32b` (the corrective fallback attempt), 1595/1278 tokens, prompt version `news-draft-id-v2`.
- Evidence validation now reports which `claimsUsed` entry was rejected and why, and a first rejection is retried once with that corrective feedback instead of surfacing a generic 500. A revision failure leaves the previous article version unchanged and returns an actionable 502 message.
- Cloudinary SDK account ping succeeded; a real upload remains untested.
- Authenticated smoke checks returned 200 for dashboard pages and selected API routes. Selected edge cases were exercised: malformed JSON returns 400, invalid upload content type returns 400, extreme pagination input is bounded, duplicate media slug returns 409, unauthenticated sign-status request returns 401, and login throttling returns 429.
- Dashboard routes exercised locally: dashboard, media, briefs, editorial, publishing, assets, monitoring, users, and settings. This is not a full end-to-end production acceptance test.

## Not yet verified / external gates

- Real Cloudinary image upload using an image whose reuse rights have been confirmed.
- Redis-compatible service and worker startup; scheduled publication and background retry.
- Production hosting, HTTPS/TLS, DNS, domain ownership verification, backups/restore, CDN tenant cache isolation, alerting, and production load/capacity.
- Public rendering against a real active media domain and a production tenant dataset.
- Route-level/integration coverage for every authorization, state transition, publish race, and external integration. The 20-test Vitest suite is not comprehensive system proof.
- Production AI budget/spend controls and provider privacy/retention review.
- Final owner-approved publisher disclosures and byline/content policy.

## Documentation policy

Keep this file current when code behavior, test results, local data state, or external gates change. Distinguish implemented, locally smoke-tested, and production-verified behavior; do not claim that an untested external integration works.
