# News Network Management System

A Next.js modular-monolith newsroom workspace for multi-domain editorial workflows. Product and governance requirements are in [`docs/`](docs/); implementation progress and remaining external setup are tracked in [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md).

## Requirements

- Node.js 20.9 or newer (tested baseline: Node.js 24).
- PostgreSQL 14+.
- Cloudinary account credentials for real asset uploads (mandatory; no alternate storage provider).
- Optional: AI credentials; OpenRouter is supported natively and defaults to `qwen/qwen3-235b-a22b-2507`; choose `qwen/qwen3-32b` for a lower-cost option. Redis enables BullMQ and scheduled jobs.

## Local setup

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, a random `SESSION_SECRET` with at least 32 characters, owner seed credentials and the required Cloudinary credentials when using image uploads. Next.js and Prisma both load this ignored file. Never commit `.env`.
3. Create the development PostgreSQL database and apply schema: `npm run db:migrate -- --name initial`.
4. Set `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` (at least 14 characters), and optionally `SEED_OWNER_NAME` in `.env`, then run `npm run db:seed` once. The seed contains no default credentials.
5. Start Next.js: `npm run dev`. Open `http://localhost:3000/login`.
6. Add a media site, configure a domain, and explicitly confirm verification only after its control is established outside the application. For local host testing, resolve the verified hostname to the development app (hosts file / reverse proxy); unknown hostnames never select arbitrary media.
7. Optional production AI: for OpenRouter set `AI_PROVIDER=openrouter`, `AI_API_KEY` to a key from [OpenRouter](https://openrouter.ai/settings/keys), and optionally `AI_MODEL`. The default model is `qwen/qwen3-235b-a22b-2507`; choose `qwen/qwen3-32b` to reduce cost. OpenRouter uses `https://openrouter.ai/api/v1` by default, so leave `AI_BASE_URL` blank. Keep the key server-side and set an account spend limit. Requests set OpenRouter's `data_collection: deny` and require parameter support, which restricts routing to listed non-collecting endpoints; it does not guarantee Zero Data Retention, so review account privacy settings and applicable provider policies before sending sensitive content. The app does not claim the provider is live until a real request succeeds.
8. Optional background processing: set `REDIS_URL`, then run `npm run worker` beside the web application. Without Redis, immediate publishing runs inline; future schedules remain persisted but need the worker to execute.

## Current Windows development environment

This checkout has a private PostgreSQL 18 cluster in the ignored `.local/postgres-data` directory on `127.0.0.1:5433`; it is separate from any existing PostgreSQL installation. Its connection string and the generated session secret are held in the ignored `.env.local` file. The database has been migrated and seeded with one local owner account: `owner@newsroom.local`. The generated owner password is available only in the ignored `.local/owner.secret` file. Keep both ignored files private.

Start the local app (and restart the private database after a reboot) with `powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1`, then visit `http://localhost:3000/login`. The existing OpenRouter key passed a real JSON request and Cloudinary passed an authenticated ping; no image upload has been made. There is no local Redis service, so immediate publishing uses inline mode and scheduled jobs do not run. The database is intentionally empty; add only your newsroom's real media and domain details.

## Commands

- `npm run dev` — local web app.
- `npm run typecheck` — strict TypeScript check.
- `npm run lint` — ESLint.
- `npm test` — Vitest.
- `npm run build` — Prisma client generation and production build.
- `npm run db:generate` — Prisma client.
- `npm run db:migrate -- --name <name>` — development migration.
- `npm run db:deploy` — apply committed migrations to a deployment database.
- `npm run db:seed` — ensure the owner from `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` exists. The seed contains no default credentials; these keys are blank in `.env.example`.

## Environment variables

See [`.env.example`](.env.example). `SESSION_SECRET` must be a high-entropy secret; set `ADMIN_BASE_URL` to the dashboard host (it defaults to `http://localhost:3000`); database, Cloudinary and AI keys are server-only. Configure Cloudinary's `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`; image uploads remain blocked without them. `AI_TEST_ADAPTER=true` enables only a clearly labelled local deterministic test path and is ignored in production.

## Architecture and publication

- Single Next.js App Router application serves the dashboard and tenant-scoped public article routes. A public request resolves its incoming hostname only through an active, verified domain record.
- PostgreSQL via Prisma is the source of truth for users, media, references, article revisions, Cloudinary asset metadata, audit history and per-site publication outcomes.
- The shared-app publisher creates one target per verified hostname, stores an immutable approved article snapshot, and renders it at `/articles/{articleSlug}` only on that hostname. Separate media deployments need a separate publisher adapter/API per application; this project intentionally does not report external CMS delivery as successful.
- Images are streamed from the authenticated Next.js route through the official Cloudinary Node SDK. The browser never receives `CLOUDINARY_API_SECRET`. Magic bytes and file-size limits are verified server-side; the Cloudinary response is checked and the `public_id`, secure URL, and rights/provenance metadata are persisted in PostgreSQL.
- AI output is versioned, schema-validated and requires human approval. Editors can explicitly map factual claims to the brief's successfully retrieved references, record a supported/conflicted/unverified judgment, and add an evidence note. The generator receives those fact IDs; live model citations to unknown or unsupported facts are rejected. Each review stores a validated, immutable snapshot of the claims and successfully retrieved reference metadata that the reviewer saw; each per-domain publication snapshot and public citation is built from that approval record, so later brief edits do not rewrite published evidence. Test-adapter output is explicitly marked. Reference fetching respects robots.txt, revalidates redirects, and fails closed when policy cannot be established.

## Production deployment requirements

Deploy the web app and optional worker from this repository with persistent PostgreSQL, secure environment injection, Cloudinary credentials, HTTPS, and DNS/TLS configured for each hostname. Use Redis/BullMQ for asynchronous and scheduled execution. Set backups, log retention, secret rotation, rate-limits/WAF, CDN/cache keys including tenant identity, and a tested recovery process before production. Manual domain verification is an admin assertion, not an external DNS challenge integration. Configure publisher ownership wording and accurate byline policy before public launch.

## Product decisions still open

OpenRouter is the configured AI provider for this local newsroom, with Qwen3 235B as the default model and Qwen3 32B available for lower cost. The production spend limit and provider-retention policy, the 10–30 articles/day capacity target, hosting/DNS, Cloudinary plan limits, publisher disclosures/byline policy, and any image-license integrations remain owner decisions; none are silently asserted as verified.
