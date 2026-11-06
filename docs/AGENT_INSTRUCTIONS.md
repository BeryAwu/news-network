# Instructions for GPT Luna / Coding Agent

You are the lead product engineer responsible for implementing the **News Network Management System (NNMS)** described in this package. Treat these files as the source of truth. Your objective is to build a working, tested application—not merely produce a plan or mockup.

## Mandatory reading order

1. `README.md`
2. `PRD.md`
3. `OPEN_DECISIONS.md`
4. `ARCHITECTURE.md`
5. `DATA_MODEL.md`
6. `AI_EDITORIAL_WORKFLOW.md`
7. `CLOUDINARY.md`
8. `SECURITY_AND_GOVERNANCE.md`
9. `ROADMAP.md`
10. `ACCEPTANCE_CRITERIA.md` and `IMPLEMENTATION_CHECKLIST.md`

## How to work

Before planning changes, read the current `IMPLEMENTATION_STATUS.md` and relevant code. These handoff documents describe product requirements and future targets; they are not proof that each feature is still unimplemented or production-verified. Keep implementation, local smoke evidence, and external production gates distinct when updating status.

1. Inspect the existing repository before changing anything. Identify framework version, package manager, scripts, existing components, database state, and deployment assumptions.
2. Do not overwrite working code, configuration, or user data without understanding the impact. Preserve existing conventions when reasonable.
3. If no repository exists, scaffold the project with the chosen stack and document all setup commands.
4. Create a concise implementation plan tied to the roadmap. Then begin implementation; do not stop after writing another plan.
5. Implement in small, coherent phases. After each phase, run type checks, lint, tests, and production build where available. Fix errors before moving on.
6. Keep documentation, Prisma schema, API contracts, and implementation aligned. Update the docs when an intentional design decision changes.
7. Use strict TypeScript, runtime validation for untrusted input, clear error handling, and accessible UI patterns.
8. Never hardcode secrets. Provide `.env.example`; ensure `.env*` secrets are gitignored.
9. Use migrations for database changes. Do not use destructive schema resets against data that may matter.
10. Build real working actions. Do not leave decorative buttons, fake metrics, hardcoded “published” states, or mock data presented as real production data.
11. For integrations without credentials, implement a clear configuration state and a testable adapter/mock for development. Do not claim the live integration works until credentials and a real test confirm it.
12. Record completed tasks, commands run, tests, known failures, and remaining blockers in `IMPLEMENTATION_STATUS.md`.

## Product rules that must not be changed silently

- The image storage provider is **Cloudinary**. It is mandatory. Never replace it with S3, local filesystem storage, Firebase Storage, or another provider without explicit approval from the project owner.
- Public media sites use Next.js.
- Preferred core stack: Next.js + TypeScript + PostgreSQL + Prisma + Tailwind CSS + shadcn/ui.
- The recommended default is one multi-tenant Next.js application serving the authenticated central dashboard and the verified public media domains. Keep the media frontend separable behind APIs/adapters if a future site needs its own deployment.
- Initial target is 10–20 domains; the design should be able to scale toward 50–100 domains.
- Article production target is still ambiguous; do not assume it means per domain. Ask or record a provisional capacity assumption.
- One source brief can produce distinct drafts for selected media profiles. Keep source facts consistent. Do not generate superficial paraphrase variants just to evade duplicate detection or search policies.
- Manual editing and AI revision are both required. Review can happen per article and via bulk selection. Bulk approval must never include unreviewed or rejected articles by accident.
- Publishing must be per-site and independently retriable. Failure on one domain must not block other domains.
- All public publishing actions must be auditable.
- Do not implement deceptive ownership concealment, fake bylines, fake journalist identities, fabricated sources, or false claims of editorial independence. Brand presentation can differ, but publisher and authorship metadata must be truthful.

## AI implementation requirements

- Create provider adapters rather than coupling the product to one LLM vendor. The initial provider/model is an unresolved decision in `OPEN_DECISIONS.md`.
- Keep prompts/templates versioned and stored or traceable.
- Save source brief, source URLs, prompt/template version, model/provider, token/cost metadata when available, output, and generation status.
- Use structured output validation. Reject or flag incomplete/invalid model responses.
- AI may summarize and synthesize source material, but unsupported claims, quotes, figures, dates, and attributions must be flagged—not invented.
- Preserve per-article isolation during revision. Revising one media's article must not mutate sibling article drafts.
- Require a human editor to approve each article before publishing. A user may bulk-approve only selected articles after reviewing the batch.
- Provide source links and claim-checking notes in the editorial interface.

## Cloudinary rules

- Read `CLOUDINARY.md` before building image functionality.
- Use the official Cloudinary Node.js SDK from server-side code for signed uploads and server operations.
- Keep `CLOUDINARY_API_SECRET` on the server only. Never prefix it with `NEXT_PUBLIC_`, return it to the browser, log it, or commit it.
- Store Cloudinary `public_id`, `secure_url`, resource type, format, dimensions, bytes, and relevant provenance/licence metadata in PostgreSQL.
- Use tenant/media-scoped folder conventions and safe public IDs.
- The application database is the source of truth for the relationship between media, articles, and assets; Cloudinary stores the binary assets.

## Recommended architecture

Start as a modular monolith. Avoid premature microservices. Separate modules/services for:
- Authentication and RBAC
- Media/domain management and hostname resolution
- Source briefs and references
- AI generation and revision
- Editorial review and version history
- Asset management (Cloudinary)
- Publishing adapters and job orchestration
- Monitoring, analytics, and audit logging

Use Redis + BullMQ for non-blocking AI and publishing jobs when the deployment environment supports a persistent Redis-compatible service. Design jobs to be idempotent because retries can execute a job more than once. Each target media publication should be an independent job.

## UI expectations

The dashboard should be a professional, responsive admin product, not a landing page. Use a consistent information architecture, loading/empty/error states, forms with validation, confirmation for destructive actions, accessible keyboard interactions, and clear publication states. Prioritize desktop workflows but ensure mobile usability.

Required main areas:
1. Overview
2. Media / Domains
3. Source Briefs
4. AI News Generator
5. Editorial Review
6. Publishing Center / Calendar
7. Assets / Image Library
8. Monitoring / Logs
9. Analytics (after core publishing works)
10. Users / Roles
11. Settings / AI Providers / Integrations

## Completion standard

Do not report a phase as complete unless:
- The UI is connected to real persisted data for the phase.
- Authorization and tenant boundaries are enforced server-side.
- Validation and error states exist.
- Automated tests cover critical logic.
- `typecheck`, lint, relevant tests, and production build pass—or failures are explicitly documented with reasons.
- The acceptance criteria for that phase are met.

At the end, provide:
- What is implemented
- Local setup instructions
- Required environment variables
- Database migration/seed commands
- Test and build results
- Deployment requirements
- Outstanding decisions/blockers
- Known limitations

Do not claim “finished” while core flows are mocked, tests are failing, credentials are missing for a claimed live integration, or critical acceptance criteria are unmet.
