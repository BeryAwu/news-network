# Product Requirements Document (PRD)

## 1. Product overview

**Working name:** News Network Management System (NNMS)  
**Product type:** Centralized multi-domain news publishing and editorial management platform  
**Primary users:** Owner/Admin, Editor, Reviewer, Publisher/Operator  
**Public surfaces:** Multiple Next.js news websites on different domains  
**Primary language:** Indonesian initially; architecture should permit additional languages later.

NNMS centralizes the management of a network of news websites. Operators create source briefs, add reference URLs and supplied narratives, generate distinct article drafts for selected media profiles with AI, review/revise the drafts, and publish selected approved articles to the relevant domains. The dashboard monitors each media site and each publication job independently.

## 2. Problem statement

Managing multiple news domains independently creates repetitive work: entering the same source context, adapting tone and audience, editing content, uploading images, publishing, and checking whether each site succeeded. NNMS should centralize those workflows without losing media-specific editorial identity or editorial control.

## 3. Target and scale

- Initial network: 10–20 domains.
- Long-term target: 50–100 domains.
- Estimated production: 10–30 articles/day across the network is a provisional range; the precise meaning is unresolved and documented in `OPEN_DECISIONS.md`.
- A source brief may produce one article per selected media site. This means total article outputs may be higher than source briefs.

## 4. Goals

1. Manage many domains from one authenticated dashboard.
2. Maintain a distinct, truthful media profile for each site.
3. Turn supplied narratives and reference URLs into source-grounded article drafts, and support topic-only drafting as an explicitly unverified writing aid that requires evidence and human fact-checking before approval.
4. Generate genuinely differentiated articles based on relevant audience angles and editorial profiles.
5. Support both manual editing and AI-assisted revision.
6. Support individual review and bulk approval of explicitly selected articles.
7. Publish each article to its target domain reliably and independently.
8. Store all managed image assets in Cloudinary.
9. Provide clear statuses, logs, and audit trails.
10. Keep architecture maintainable at 10–20 domains and scalable toward 50–100.

## 5. Non-goals for initial MVP

- Replacing every media website with a bespoke separate codebase.
- Fully autonomous publication without human approval.
- Scraping arbitrary websites or bypassing paywalls/robots/access controls.
- Automatically copying copyrighted images from Google Images.
- Fake journalist profiles, invented bylines, false publisher independence, or mechanisms to conceal common ownership in order to mislead readers.
- A complex ad-sales, subscription, CRM, or newsroom assignment system unless added in a later phase.
- Advanced audience analytics that require external analytics credentials; basic operational analytics come first.

## 6. Personas and permissions

| Role | Main capabilities |
|---|---|
| Owner / Super Admin | Manage all media, domains, users, settings, integrations, and audit logs |
| Admin | Manage assigned media, source briefs, articles, and operational settings within permission scope |
| Editor | Create source briefs, generate drafts, edit, request AI revisions, and submit for approval |
| Reviewer | Review content, leave notes, approve or reject assigned articles |
| Publisher / Operator | Publish approved articles, schedule, retry failed jobs, and monitor publishing |

Role assignments and media scope are enforced server-side. The current implementation uses OWNER, ADMIN, EDITOR, REVIEWER, and PUBLISHER; changes to this role model remain a product decision.

## 7. Core user journeys

### 7.1 Add a media site
1. Admin creates a media record.
2. Admin defines name, canonical domain, display name, logo, theme, language, niche, audience, editorial tone, categories, article length, SEO guidance, and truthful publisher/byline configuration.
3. Admin proves domain ownership or controls DNS/hosting and activates the domain mapping.
4. System tests hostname routing and displays connection status.

### 7.2 Create a source brief and generate articles
1. Editor enters a topic/headline, with optional narrative/context, notes, and reference URLs. Narrative and references may be omitted when starting a topic-only draft; that mode creates an unverified editorial writing draft, not independently reported or fact-verified news. Specific current facts, dates, numbers, quotations, named sources, and attributions still require supplied evidence and human verification.
2. When references are supplied, the system validates and fetches permitted public references and records their metadata/status. Reference retrieval does not itself verify the truth of claims.
3. Editor selects target media sites.
4. AI creates one distinct draft per selected media profile, grounded in the same verified source facts.
5. Each output is independently saved with its source brief, selected media, generation metadata, and status.

### 7.3 Review and revise
1. Editor opens the editorial queue and filters by media, status, date, author/editor, or source brief.
2. Editor previews headline, body, category, SEO metadata, image, and source references.
3. Editor can edit fields manually or ask AI to revise with an instruction.
4. AI revision creates a new version and never mutates sibling media articles.
5. Reviewer approves or rejects an article and may leave revision notes.
6. Batch actions apply only to explicitly selected eligible records; the UI displays the number and identity of selected articles before execution.

### 7.4 Publish
1. Publisher selects approved articles and immediate or scheduled publication time.
2. System creates one independent publication job per article/site target.
3. Worker publishes via the site's publishing adapter/API. **Current implementation:** immediate publishing runs inline in the request path; the Redis/BullMQ worker entry point exists but has not been verified in the local environment, so scheduled/background execution is not yet operational there.
4. System records request ID, attempts, timestamps, response, remote article ID/URL, and outcome.
5. Failed jobs may be retried safely without creating duplicate public articles.

### 7.5 Manage image assets
1. User uploads or selects a properly licensed image, or requests an AI-generated illustration.
2. Image is stored in Cloudinary.
3. Metadata/provenance is stored in PostgreSQL.
4. User chooses alt text, caption, credit, licence, and article usage.

## 8. Functional requirements

### FR-01 Authentication and access control (P0)
- Secure login and session handling.
- Role-based permissions and media assignment scopes.
- Server-side authorization on every protected action.
- User invitation/deactivation and audit log.

### FR-02 Media/domain management (P0)
- CRUD media sites and domain aliases.
- Domain verification/status, canonical host, SSL/deployment notes.
- Media profile: niche, audience, editorial tone, style rules, language, categories, preferred length, SEO settings, visual theme, truthful publisher/byline settings.
- Enable/disable site and mark maintenance state.

### FR-03 Multi-tenant public rendering (P0)
- Resolve incoming hostname to an active media site.
- Render the correct site's branding and content.
- Enforce tenant filters on every public query.
- Unknown/unverified hostname must not fall through to another tenant's content.

### FR-04 Source brief management (P0)
- Create, edit, archive source briefs.
- Store narrative/context, notes, source URLs, attachments metadata, timestamps, and author.
- Validate URL schemes and block internal/private network destinations.
- Track source extraction status and errors.

### FR-05 AI article generation (P0)
- Select one or many target media profiles.
- Generate a distinct article draft for each selected profile.
- Store headline, dek/summary, article body, excerpt, suggested category, tags, SEO title, meta description, slug suggestion, image suggestion, and source/claim notes.
- Preserve source facts and flag unknown or conflicting information.
- Log provider/model, prompt version, status, latency, token/cost usage when available.
- Support regeneration of one selected article without affecting others.

### FR-06 Editorial and revision (P0)
- Editorial list, filters, bulk selection, and article preview.
- Manual editing of title/body/category/SEO/image metadata.
- AI-assisted revision by natural-language instruction.
- Version history, diff/restore, revision notes, reviewer decision.
- Status transitions and validation before approval.

### FR-07 Approval and publishing (P0)
- Individual approval/rejection.
- Bulk approval for selected eligible articles with explicit confirmation.
- Individual publishing and bulk publishing of approved articles.
- Immediate and scheduled publishing.
- Independent job per site/article.
- Retry/backoff, idempotency, cancellation where safe, and clear failure reasons.

### FR-08 Cloudinary assets (P0)
- Cloudinary is the required image/file media store.
- Secure server-side upload/signing and deletion.
- Asset library with tenant/media association and article usage.
- Persist Cloudinary identifiers and image provenance/licence metadata.
- Transform/optimize delivery images via Cloudinary URLs.

### FR-09 Monitoring (P1)
- Current health/connection state for media sites.
- Queue counts and job statuses.
- Failed jobs and retry actions.
- Per-site publication history.
- Alerts for repeated failures or domain health checks.

### FR-10 Basic analytics (P2)
- Articles drafted/approved/published per site and date range.
- Publication success rate and AI generation usage/cost where available.
- Traffic analytics only after a privacy-compliant analytics source is selected.

### FR-11 System settings (P1)
- AI provider/model settings without exposing secrets.
- Cloudinary connection status.
- Queue/worker health.
- Content defaults, prompt versions, timezone, retention policies.

## 9. Key editorial statuses

Suggested article statuses:
`DRAFT` → `GENERATING` → `NEEDS_REVIEW` → `IN_REVISION` → `APPROVED` → `SCHEDULED` → `PUBLISHING` → `PUBLISHED`.
Additional terminal/exception states: `REJECTED`, `PUBLISH_FAILED`, `ARCHIVED`.

Keep generation status, editorial status, and publication-job status separate where appropriate. One article may be approved while a scheduled publication job is waiting.

## 10. Quality attributes

- Tenant data isolation is mandatory.
- No silent loss of drafts or revision history.
- Publishing failure on one domain must not block another.
- All sensitive operations are auditable.
- All public pages must be responsive, accessible, and performant.
- Background tasks must not depend on a browser tab remaining open.
- AI and publishing operations must have timeouts, retry policies, cost/usage controls, and observability.
- Support safe backup/restore and database migrations.

## 11. MVP success criteria

MVP is successful when a verified admin can configure at least two test domains, create one source brief, generate distinct drafts for two media profiles, review/revise them independently, upload images to Cloudinary, approve one/both, publish through real adapters to the test domains, and inspect success/failure logs from the central dashboard.
