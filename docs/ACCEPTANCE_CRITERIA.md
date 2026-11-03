# Acceptance Criteria / Definition of Done

## A. Setup and quality baseline
- [ ] A new developer can install dependencies, configure env vars, run migrations, seed a local admin, and start the app using documented commands.
- [ ] `.env.example` contains placeholders only; secret files are gitignored.
- [ ] TypeScript strict checks, lint, automated tests, and production build pass.

## B. Authentication and roles
- [ ] Unauthenticated user cannot access dashboard pages or protected APIs.
- [ ] Role permissions are checked server-side.
- [ ] A user assigned only to Media A cannot read or mutate Media B records, even by changing request IDs.
- [ ] User/role changes appear in audit logs.

## C. Multi-domain media sites
- [ ] Admin can create at least two media sites with different profiles and domains.
- [ ] Hostname resolution chooses the correct media configuration.
- [ ] Public pages display the correct brand, categories, articles, logo, and theme.
- [ ] Domain A never displays Domain B's content.
- [ ] Unknown/unverified domains return a safe 404/holding page.

## D. Source briefs and references
- [ ] Editor can create a source brief with narrative and multiple reference URLs.
- [ ] Valid public references are ingested or a useful extraction error is shown.
- [ ] Internal/private/metadata URLs are blocked.
- [ ] Reference metadata is persisted and visible in the editorial UI.

## E. AI generation
- [ ] Editor can select at least two media sites for one source brief.
- [ ] The system creates separate article drafts for each selected site.
- [ ] The drafts reflect the respective media profiles and have meaningful audience-relevant differences.
- [ ] The drafts share the same supported factual base; unsupported claims are flagged or omitted.
- [ ] A generation error on one media does not erase successful drafts for other media.
- [ ] Provider/model/prompt version and available usage metrics are recorded.
- [ ] Regenerating one media article does not modify another media article.

## F. Editorial and revisions
- [ ] Editorial list supports filtering by media and status.
- [ ] Editor can preview full article and source references.
- [ ] Manual edit creates a tracked version.
- [ ] AI revision creates a separate version and records the instruction/change summary.
- [ ] Revisions are isolated to the selected article.
- [ ] Previous version can be viewed and restored.
- [ ] Reviewer can approve, reject, or request changes with notes.
- [ ] Bulk approval shows the selected count and applies only to eligible selected articles.
- [ ] Rejected/unapproved articles cannot be published.

## G. Cloudinary
- [ ] Authenticated image upload reaches a real Cloudinary account.
- [ ] `public_id`, `secure_url`, format, dimensions, bytes, and provenance metadata are stored.
- [ ] API secret remains server-side and is not exposed in browser bundles or responses.
- [ ] Invalid or oversized uploads are rejected.
- [ ] Article image renders from Cloudinary with suitable responsive behavior.
- [ ] Asset deletion checks references and records an audit event.

## H. Publishing
- [ ] Approved article can be published to a configured test media site.
- [ ] Bulk publish creates independent jobs per selected article/site.
- [ ] A failed target does not block other targets.
- [ ] Retry does not create duplicate public articles.
- [ ] Scheduling respects the configured timezone.
- [ ] Publication result stores remote ID/URL, attempts, timestamps, and status.
- [ ] Dashboard clearly distinguishes queued, scheduled, publishing, published, and failed.

## I. Monitoring and operations
- [ ] Admin can inspect failed jobs and see a useful error summary.
- [ ] Authorized user can retry a retryable failure.
- [ ] Logs include correlation IDs but no secrets.
- [ ] Dashboard counts are derived from persisted data, not hardcoded values.

## J. Editorial transparency
- [ ] Each media site has truthful publisher/byline metadata.
- [ ] Source references are accessible from the review interface.
- [ ] AI-generated illustrations can be identified as such.
- [ ] External image rights/credit metadata is retained.
- [ ] No feature creates fake independence, fake journalists, fake citations, or fabricated reporting claims.
