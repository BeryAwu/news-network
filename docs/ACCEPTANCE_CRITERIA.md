# Acceptance Criteria / Definition of Done

These are product acceptance targets, not a declaration that all are currently met. Checked items are satisfied by observed local implementation/smoke evidence; unchecked items still require live/external verification. `IMPLEMENTATION_STATUS.md` is the authoritative evidence record.

## A. Setup and quality baseline

- [x] A new developer can install dependencies, configure env vars, run migrations, seed a local admin, and start the app using documented commands (local launcher uses a private PostgreSQL cluster and ignored secrets).
- [x] `.env.example` contains placeholders only; secret files are gitignored.
- [x] TypeScript strict checks, lint, automated tests, and production build pass at the last recorded run (typecheck, lint, 20 tests, build).

## B. Authentication and roles

- [x] Unauthenticated user cannot access dashboard pages or protected APIs (guarded server-side; unauthenticated API/sign requests return 401).
- [x] Role permissions are checked server-side.
- [ ] A user assigned only to Media A cannot read or mutate Media B records, even by changing request IDs (scope checks exist; full route-level test coverage is pending).
- [x] User/role changes appear in audit logs.

## C. Multi-domain media sites

- [x] Admin can create multiple media sites with different profiles and domains (implemented; local records exist).
- [x] Hostname resolution chooses the configured media by verified host (implemented; unknown/unverified hosts resolve to a 404/holding page).
- [ ] Public pages display the correct brand, categories, articles, logo, and theme on two live verified domains (public routing implemented; live multi-domain acceptance not completed).
- [ ] Domain A never displays Domain B's content (architecture prevents cross-tenant public data; end-to-end two-domain test pending).
- [x] Unknown/unverified domains return a safe 404/holding page (observed locally).

## D. Source briefs and references

- [x] Editor can create a source brief with a topic, optional narrative, and optional reference URLs (topic-only mode included).
- [x] Valid public references are ingested or a useful extraction/block error is shown.
- [x] Internal/private/metadata URLs are blocked (DNS/IP validation implemented and unit-tested).
- [x] Reference metadata and per-reference status are persisted and visible in the editorial UI.

## E. AI generation

- [x] Editor can select at least two media sites for one source brief.
- [x] The system creates separate drafts for selected sites.
- [x] Drafts preserve audience/media profile differentiation and share the supported factual base; unsupported claims are flagged, omitted, or rejected by evidence validation.
- [x] A generation error on one media does not erase successful drafts for other media.
- [x] Provider/model/prompt version and available usage metrics are recorded when provided.
- [x] Regenerating one media article does not modify another media article.
- [ ] Generation job queue and queued/background-state UI are present (inline request-path generation is the current implementation; background queue is pending).

## F. Editorial and revisions

- [x] Editorial list supports filtering by media and status, plus bounded pagination.
- [x] Editor can preview full article and source references.
- [x] Manual edit creates a tracked version.
- [x] AI revision creates a separate version and records the instruction/change summary.
- [x] Revisions are isolated to the selected article.
- [x] Previous version can be viewed and restored; repeated restore of identical content does not duplicate versions.
- [x] Reviewer can approve, reject, or request changes with notes.
- [x] Bulk approval shows the selected count and applies only to eligible selected articles.
- [x] Rejected/unapproved articles cannot be published.

## G. Cloudinary

- [ ] Authenticated upload reaches a real Cloudinary account with a rights-cleared image (SDK integration and ping verified; real upload pending).
- [ ] `public_id`, `secure_url`, format, dimensions, bytes, and provenance metadata are stored after a real upload (schema and flow implemented; live upload not executed).
- [x] API secret remains server-side and is not exposed in browser bundles or responses.
- [x] Invalid or oversized uploads are rejected (bounded parser and content checks; error mappings verified).
- [ ] Article image renders from Cloudinary with suitable responsive behavior after a real upload.
- [ ] Asset deletion checks references and records an audit event (guard implemented; safe-deletion acceptance with real assets pending).

## H. Publishing

- [ ] Approved article publishes to a configured test media site (implementation and state machine exist; live domain publication not completed).
- [x] Bulk publish creates independent targets per selected article/site.
- [ ] A failed target does not block other targets (per-target isolation implemented; failure-path live acceptance pending).
- [ ] Retry does not create duplicate public articles (idempotency implemented; retry acceptance with a live target pending).
- [ ] Scheduling respects the configured timezone (scheduling code exists with Redis; worker/timezone acceptance pending).
- [x] Publication result stores remote/status data, attempts, timestamps, and status (schema/UI implemented; no real remote publication yet).
- [x] Dashboard clearly distinguishes queued, scheduled, publishing, published, and failed states.

## I. Monitoring and operations

- [x] Admin can inspect failed publication attempts and see a useful error summary.
- [x] Authorized user can retry a retryable failure.
- [ ] Logs include correlation IDs but no secrets (structured audit logs exist; correlation IDs and production logging not finalized).
- [x] Dashboard counts are derived from persisted data, not hardcoded values.

## J. Editorial transparency

- [x] Each media site has truthful publisher/byline configuration fields.
- [x] Source references are accessible from the review interface.
- [x] AI-generated images can be identified via provenance fields.
- [x] External image rights/credit metadata is retained.
- [x] No feature creates fake independence, fake journalists, fake citations, or fabricated reporting claims (prompt/evidence policy and disclosure field guard the workflow).
