# Technical Architecture

## 1. Architecture decision

Use a **modular monolith** with a **multi-tenant Next.js public frontend** as the default architecture. One application can serve multiple verified media domains by resolving the request hostname to a `MediaSite` record. The central dashboard is an authenticated application surface and can be deployed in the same Next.js codebase initially, for example on a dedicated admin hostname.

Keep publishing APIs and site rendering boundaries modular so that a media site can later move to a separate frontend deployment without rewriting editorial, AI, and database logic.

## 2. Logical components

```text
                         ┌───────────────────────────────┐
                         │       Central Dashboard       │
                         │  Admin / Editor / Reviewer    │
                         └──────────────┬────────────────┘
                                        │ HTTPS / Auth
                         ┌──────────────▼────────────────┐
                         │         Next.js App            │
                         │ Dashboard + API + Public Sites│
                         ├───────────────────────────────┤
                         │ Auth / RBAC / Tenant Resolver │
                         │ Source Briefs / Editorial     │
                         │ AI Orchestrator / Publishing  │
                         │ Cloudinary Asset Service      │
                         └───────┬────────┬────────┬──────┘
                                 │        │        │
                       ┌─────────▼─┐  ┌───▼────┐ ┌─▼──────────────┐
                       │PostgreSQL │  │ Redis  │ │   Cloudinary   │
                       │ + Prisma  │  │BullMQ  │ │ image storage  │
                       └───────────┘  └───┬────┘ └────────────────┘
                                         │
                                 ┌───────▼────────┐
                                 │ Worker Process │
                                 │ AI / Publish    │
                                 └───────┬────────┘
                                         │
                             ┌───────────▼────────────┐
                             │ Per-site publish APIs  │
                             │ / media domains        │
                             └────────────────────────┘
```

## 3. Request and tenant resolution

1. Read the request hostname from trusted request headers at the server boundary.
2. Normalize it (lowercase, remove port, normalize trailing dot, handle `www` aliases explicitly).
3. Look up an active, verified `Domain` record and its `MediaSite`.
4. Resolve the request to the media site's public route context.
5. Every tenant-owned content query must include the resolved `mediaSiteId`.
6. Unknown, disabled, pending-verification, or unmapped domains return a neutral 404/maintenance page. Never default to another site's content.
7. Do not trust a tenant ID supplied by a browser form or query string. Derive it from authenticated permissions or trusted hostname resolution.

Use current Next.js multi-tenant routing guidance as a reference, but confirm behavior against the installed Next.js version. Avoid depending on deprecated middleware conventions if the installed version uses a different request interception model.

## 4. Domain model and custom domains

- A `MediaSite` can have one canonical domain and optional aliases.
- A `Domain` record tracks hostname, canonical flag, verification method/status, active status, and timestamps.
- Domain activation requires proof of control (e.g., DNS TXT challenge or deployment/provider verification). Exact provider flow depends on hosting choice.
- Admin hostname must not be confused with a public media hostname.
- Redirect non-canonical aliases to the canonical domain where configured.
- Enforce HTTPS in production.

## 5. Data boundaries

- Global/system data: users, roles, AI provider configs (secret references only), global prompt templates, audit records.
- Media-scoped data: media profile, categories, articles, source assignments, media assets, publication targets/logs.
- Source briefs may be global to a newsroom workspace but article outputs and media-specific assignments are explicitly related to selected media.
- Every tenant-scoped service accepts a trusted `mediaSiteId`/authorized scope and applies it in database access.
- Consider PostgreSQL Row-Level Security as defense in depth in a later hardening phase; application-layer tenant scoping is still mandatory.

## 6. Background jobs

Use Redis + BullMQ as the default job layer if a managed Redis-compatible service is available.

Suggested queues:
- `source-ingestion`
- `article-generation`
- `article-revision`
- `image-processing` (only where needed)
- `publishing`
- `domain-health-check`

Suggested job design:
- Keep a job small and atomic.
- Give each job a deterministic idempotency key, such as publication target + article revision/version.
- One publication job per article per target domain.
- Persist job intent and status in PostgreSQL; Redis queue state is not the only source of truth.
- Use bounded retries with exponential backoff and jitter for transient failures.
- Classify retryable errors (network, 429, 5xx) vs permanent errors (validation, auth, unsupported schema).
- Never automatically retry a permanent error indefinitely.
- Ensure an at-least-once worker execution cannot create duplicate public content.
- Store job IDs and correlation IDs in logs.

## 7. Publishing adapter pattern

Define a TypeScript interface such as:

```ts
interface MediaPublisher {
  createOrUpdateArticle(input: PublishArticleInput): Promise<PublishArticleResult>;
  getArticleStatus?(remoteId: string): Promise<RemoteArticleStatus>;
  healthCheck(): Promise<PublisherHealthResult>;
}
```

Initial implementation may use an authenticated internal publishing API for the shared multi-tenant Next.js app. A future separate media app implements the same interface. Never store a media site's API secret in plaintext in a normal settings table; use encrypted secret storage or environment/secret-manager references.

## 8. AI provider adapter

Define a provider-neutral interface for text generation. Provider credentials remain server-side. Persist provider/model metadata and prompt version. Add per-provider timeout, usage tracking, rate limit, retry policy, and cost guardrails. Do not hard-wire UI directly to one provider.

## 9. Cloudinary integration

Cloudinary is the required asset store. `AssetService` owns upload signatures, server uploads, deletion, transformation URL construction, and database metadata. See `CLOUDINARY.md` for full requirements.

## 10. Caching and revalidation

- Cache public media pages where safe.
- Invalidate/revalidate only the affected media/article paths after publish or update.
- Avoid cross-tenant cache keys. Cache key must include media identity/host and relevant content version.
- Do not cache authenticated dashboard responses in shared public caches.

## 11. Deployment shape

Recommended initial production shape:
- Next.js web app (dashboard and multi-tenant public sites).
- Separate worker process using the same repository/build artifact where appropriate.
- PostgreSQL managed database.
- Redis-compatible managed service for BullMQ.
- Cloudinary account for all image assets.
- DNS and TLS for each custom domain.

The exact hosting provider remains an open decision. Keep deployment config portable through Docker and environment variables.

## 12. Observability

Every operation should include correlation identifiers:
`sourceBriefId`, `articleId`, `mediaSiteId`, `publicationJobId`, `userId`, `requestId`.

Record structured logs for generation, revision, asset upload/delete, domain resolution failures, approval, publish attempts, and retry events. Do not log secrets, full credentials, or unnecessary sensitive content.
