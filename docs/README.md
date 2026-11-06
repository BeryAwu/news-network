# News Network Management System (NNMS)

**Project documentation package for the News Network Management System**  
Prepared: 3 November 2026  
Status: Product and governance reference. The application is implemented; see [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md) for current code, verification, test data, and external blockers.

## Start here

1. Read `AGENT_INSTRUCTIONS.md` first. It is the operating brief for the coding agent.
2. Read `PRD.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `AI_EDITORIAL_WORKFLOW.md`, and `CLOUDINARY.md`.
3. Review `OPEN_DECISIONS.md`. Do not silently invent answers to unresolved product decisions.
4. Execute `ROADMAP.md` phase by phase and use `ACCEPTANCE_CRITERIA.md` as the completion checklist.
5. Copy `.env.example` to `.env.local` and fill credentials locally. Never commit real secrets.

## What the application currently implements

A centralized platform to manage multiple media profiles and verified-host public rendering. The authenticated dashboard manages media/domains, briefs, source references and fact records, AI-assisted drafts (from supplied material or a topic-only starting point), human editorial review and version history, Cloudinary asset metadata, per-domain publication targets, and monitoring. Current implementation evidence and production blockers are tracked in [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md); this package remains the product/governance reference, not a claim that every planned capability is production-ready.

A single source brief can produce distinct, fact-consistent article drafts for selected media profiles. An editor can revise each article manually or ask AI to revise it, review individual items, approve selected items in bulk, and publish only the selected approved articles.

## Confirmed product decisions

- The central dashboard manages many news media websites/domains.
- The managed sites use Next.js.
- Initial target: **10–20 domains**.
- Long-term target: **50–100 domains**.
- Estimated production target: **10–30 articles per day**, but it is not yet clear whether this means 10–30 source briefs, total article versions, or articles per domain. See `OPEN_DECISIONS.md`.
- One source context may generate a unique article for each selected media site. The articles must retain the same verified underlying facts while using genuinely relevant angles, structure, and editorial tone—not superficial synonym spinning.
- Each media site has a stored editorial profile (niche, audience, language, tone, style, categories, length guidance, SEO conventions, etc.).
- Editorial workflow combines individual review and bulk approval/publishing.
- Revision workflow combines manual editing and AI-assisted revision.
- News images must be stored in **Cloudinary**. Cloudinary is mandatory for the project; do not substitute S3, local disk, or another provider unless the project owner explicitly changes this requirement.
- Preferred stack: Next.js, PostgreSQL, Prisma, Tailwind CSS, shadcn/ui; Redis + BullMQ for background jobs is the recommended starting point.

## Important governance boundary

Different media may have different branding, audience focus, layouts, and editorial voices. The platform must not create fake authors, fabricate editorial independence, or hide common ownership/management in order to mislead readers. Provide transparent publisher/about/ownership configuration and accurate bylines. AI-generated or AI-assisted content must undergo editorial review and must not invent facts, quotes, sources, or image provenance.

## Package contents

| File | Purpose |
|---|---|
| `AGENT_INSTRUCTIONS.md` | Main instructions / master operating prompt for GPT Luna |
| `PRD.md` | Product requirements and functional scope |
| `ROADMAP.md` | Implementation phases, tasks, and phase exit criteria |
| `ARCHITECTURE.md` | Application, multi-domain, service, queue, and deployment architecture |
| `DATA_MODEL.md` | Core database entities and relationships |
| `AI_EDITORIAL_WORKFLOW.md` | AI writing, source handling, revisions, image selection, and review workflow |
| `CLOUDINARY.md` | Required image storage and integration rules |
| `SECURITY_AND_GOVERNANCE.md` | Security, tenant isolation, editorial integrity, and compliance safeguards |
| `ACCEPTANCE_CRITERIA.md` | Definition of done and end-to-end acceptance tests |
| `OPEN_DECISIONS.md` | Unresolved decisions and recommended defaults |
| `IMPLEMENTATION_CHECKLIST.md` | Granular checklist for the coding agent |
| `.env.example` | Environment variable template with placeholders only |
| `LUNA_START_PROMPT.txt` | Short prompt to paste into GPT Luna after attaching this package |

## Product name

`News Network Management System` is a working name only. The project owner can rename it later without affecting the architecture.
