# Implementation Status

## Repository baseline

- Handoff documentation is under `docs/`; the root initially had no application source, package manifest, Git metadata, or existing database configuration.
- Available toolchain observed: Node.js `v24.16.0`, npm `11.17.0`; dependencies installed locally.
- Initial `git status` could not run because this directory is not a Git repository.

## Roadmap plan and status

| Roadmap phase | Implementation and evidence | Status |
|---|---|---|
| 0 — Discovery / baseline | Next.js App Router, strict TypeScript, env template, secret ignore rules, documented commands. | Complete |
| 1 — Foundation / auth / database | PostgreSQL + Prisma models and an initial migration, credential login, signed HTTP-only sessions, server-side RBAC/media scope, audit history, owner seed command, and responsive admin shell. A private local PostgreSQL 18 cluster runs at `127.0.0.1:5433`, migration is applied, and the local owner account is seeded; the pre-existing PostgreSQL cluster was left unchanged. | Live and verified locally |
| 2 — Media / domains | Media and profile editing, host mapping, manual verification state, hostname resolver, host-scoped public article routes. | Implemented; external DNS/TLS/control verification remains an operator action |
| 3 — Source briefs | Persisted narrative/reference workflow, bounded public HTTP(S) fetch with DNS pinning, private/reserved IP rejection, redirect/content/size/time limits, per-reference extraction status and edit controls. | Implemented |
| 4 — AI generation | Versioned structured-output adapter and Zod validation, profile-specific per-media drafts, auditable provider/model/prompt/usage, explicitly labelled development test adapter. OpenRouter uses its official API, JSON-mode parameters, routing restricted to listed non-collecting endpoints, and Qwen3 235B by default; Qwen3 32B remains the lower-cost option. A real OpenRouter JSON request succeeded with this environment's server-side key. | Live OpenRouter verified; key remains in ignored local `.env` |
| 5 — Editorial | Individual drafts, manual versioned edits, article-scoped AI revisions, individual and selected batch review, reviewer notes, restores and audit events. Review decisions now freeze validated facts and successful-reference metadata; the editorial history exposes the frozen snapshot, publishing requires approval for the exact current version, and public targets derive citations from that decision rather than mutable brief data. | Implemented |
| 6 — Cloudinary | Official server-side Node SDK streams MIME-sniffed upload bytes; provider response constraints checked; Cloudinary public ID and image/provenance metadata stored in PostgreSQL; no local/S3 fallback or client-exposed secret. | Cloudinary credentials passed an authenticated account ping; image upload still awaits a rights-cleared newsroom image |
| 7 — Publishing | Approved version snapshots, per-verified-domain target records, status/attempt history, BullMQ/exponential retry and inline mode, tenant/domain-scoped routes. | Implemented; Redis and production host/DNS setup required for queued/scheduled jobs |
| 8 — Monitoring | User/media-scoped database KPIs, 30-second dashboard refresh with visible errors and true last-check time, article pipeline, per-domain publication activity, and explicit credential-versus-worker readiness. | Implemented; visually checked at 320px, 390px, tablet, and desktop widths |
| 9 — Operations / usability | Role/media authorization, honest integration readiness, rate/size bounds, outbound SSRF controls, media and source-brief guided entry, Indonesian staff roles/status labels, rights evidence, responsive newsroom shell, database-backed dashboard polling, and private local Windows DB launcher. | Local database and live credential checks verified; hosted deployment and scheduled worker remain external |

## Provisional, reversible defaults

- Indonesian interface/article language initially; one multi-tenant Next.js application and an optional worker in this repository.
- Roles: OWNER, ADMIN, EDITOR, REVIEWER, PUBLISHER; seed creation is an explicit CLI operation, never an unauthenticated public bootstrap route.
- The 10–30/day target is not treated as a per-domain volume guarantee; provider/capacity configuration remains unset pending owner confirmation.
- AI is disabled in installs without a provider key. This local newsroom uses OpenRouter with Qwen3 235B; its existing API key remains in ignored `.env`. A deterministic test adapter is labeled test-only and cannot be mistaken for live AI.
- Publication uses the shared application's per-media host-resolved renderer. Each target is bound to an active verified domain and retains its exact approved version snapshot; this is not an external CMS integration.
- Cloudinary remains mandatory for all managed images. Missing credentials show setup status and block uploads; no local/S3 fallback.
- Domains remain pending until an administrator explicitly confirms control outside this system; the current UI confirmation is not automatic DNS validation.
- Publisher/ownership disclosure and newsroom byline are admin-entered truth fields, not fabricated identities.

## Verification log

- `npx prisma validate`: passed against the current schema.
- `npx prisma migrate deploy` and `npx prisma migrate status`: passed against the private local PostgreSQL 18 cluster at `127.0.0.1:5433`; schema is current. The original PostgreSQL service/config was not modified.
- Owner seed succeeded. Login was exercised in Chromium with the generated local owner account `owner@newsroom.local`; its password is held in ignored `.local/owner.secret`.
- OpenRouter key validation returned HTTP 200; an OpenRouter JSON-mode chat completion succeeded using Qwen3 235B. Credentials stayed server-side.
- Official Cloudinary SDK `api.ping()` returned `status: ok`. No image was uploaded because that requires a newsroom image with verified reuse rights.
- `npm run typecheck`, `npm run lint`, and `npm test` passed after the final changes; all 19 tests passed, including CC license, public-domain, AI-generated, and newsroom-owned image-evidence requirements.
- `npm run build`: final production build passed, including Prisma client generation and Next.js TypeScript/build steps.
- The local app is running at `http://localhost:3000`, started with `scripts/start-local.ps1`; authenticated login, dashboard, media, briefs, editorial, publication, assets, monitoring, staff, and settings routes were exercised.
- The dashboard API returned real counts from the migrated local database; all newsroom content counts are currently zero. Its 30-second refresh succeeds and reports real local timestamps.
- Chromium confirmed no document-level horizontal overflow at 320, 390, 768, or 1280 px across newsroom routes; the mobile menu exposes all destinations and closes on Escape while returning keyboard focus.
- Redis is not installed (no Redis service, Docker, or WSL distribution). Memurai Developer's development-only license has not been accepted; no scheduled worker readiness is claimed. Immediate publication remains available inline.
- No real newsroom media, articles, domains or public workflows were fabricated; DNS/domain and production hosting are still external setup.

## Outstanding external setup / production gates

- The local isolated PostgreSQL database and owner are ready. The unrelated pre-existing PostgreSQL configuration still has invalid credentials and was deliberately left untouched.
- Provide a rights-cleared newsroom image to validate a real Cloudinary upload and its stored license provenance.
- Set an OpenRouter account spend limit and review account/provider privacy and retention policies; the working API key remains only in the ignored local `.env`.
- For local scheduled-job testing, either approve installation and developer-only use of Memurai under its license or provide another Redis-compatible service. Production needs an independently operated Redis service and worker.
- Production hosting, DNS/TLS and externally verified domain ownership/control process.
- Owner-approved publisher ownership disclosure/byline wording and output language/content policy.
- Verify upstream reference terms, paywall/access restrictions, rate limits and permitted excerpt lengths before production source fetching.
- Configure backups, secret rotation, CDN cache-key tenant isolation, rate limiting, alerting, monitoring/log retention, capacity testing and recovery drills before production use.
