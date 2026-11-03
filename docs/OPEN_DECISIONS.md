# Open Product Decisions

The following items were not answered conclusively during discovery. GPT Luna should not silently invent the owner's preference. Use the recommended default for implementation only when it is safe and reversible, and list it as provisional in `IMPLEMENTATION_STATUS.md`.

| Decision | Current state | Recommended provisional default |
|---|---|---|
| Meaning of 10–30 articles/day | Unclear: source briefs, total outputs, or per-domain outputs | Design capacity controls so these can be configured independently; ask owner before load/cost sizing |
| Dashboard user model | Unclear: one admin, admin + editors, or separate reviewer/publisher roles | Implement RBAC for OWNER, ADMIN, EDITOR, REVIEWER, PUBLISHER; initial seed may create one OWNER |
| Public frontend deployment | Unanswered after recommendation | Start with one multi-tenant Next.js app for all media domains; preserve adapter/API boundary for future split deployments |
| AI provider/model | Not selected | Build provider adapter; do not lock architecture to one vendor; choose provider after credentials, budget, language quality, and privacy review |
| Hosting provider | Not selected | Docker-portable deployment; select actual provider before production deployment |
| Domain DNS/TLS management | Not selected | Support manual domain registration/verification records first; integrate provider-specific automation later |
| Public site design system | Only broadly described | Start with one configurable responsive template; support theme, logo, typography, navigation, and category settings per media |
| Publisher disclosure wording | Not yet provided | Provide truthful owner/publisher disclosure fields and require owner to supply final wording |
| Byline policy | Not yet provided | Use real contributors/editors or an accurately labelled newsroom/byline; never invent people |
| Reference ingestion scope | URLs + supplied narrative confirmed; source-provider details unclear | Fetch only accessible public pages safely; allow manual narrative if extraction is unavailable |
| Image sourcing provider | Wants AI to find relevant images from internet; no provider selected | Do not scrape Google Images. Add approved/licensed image source adapters later; MVP supports manual licensed upload plus AI-generated illustration and Cloudinary storage |
| Cloudinary plan/limits | Cloudinary chosen; account/plan unknown | Use environment-based account setup; add a usage dashboard and configure upload limits once plan is known |
| Article format/editor | Not selected | Use structured rich text or sanitized Markdown; choose editor after UI prototype |
| Analytics source | Not selected | Start with operational/editorial analytics; add web traffic analytics only after source/privacy choice |
| Localization | Indonesian assumed | Build locale-aware fields; launch Indonesian first |

## Questions to confirm with the owner

1. Is 10–30/day the number of source briefs, total article outputs across all media, or output per domain?
2. Should the first release support only one owner/admin, or multiple editor/reviewer/publisher accounts?
3. Confirm one shared multi-tenant Next.js public app for all domains as the initial deployment model?
4. Which AI provider/model and monthly budget should be used?
5. Which hosting provider and domain DNS provider will be used?
6. Does the owner already have a Cloudinary account and what plan/limits apply?
7. Which licensed image source(s), if any, should be integrated? Until selected, do not automate arbitrary Google Images downloads.
8. What exact publisher/ownership disclosure and byline policy should each media site display?

## Provisional assumptions that can safely guide an MVP

- Indonesian user interface and Indonesian article generation initially.
- One owner account can be seeded in development.
- One multi-tenant Next.js public app for all domains.
- A separately runnable worker process in the same codebase.
- Manual review is required before any publication.
- Cloudinary stores all images managed by the platform.
- The first publishing adapter targets the shared multi-tenant Next.js app.
