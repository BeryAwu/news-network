# Open Product Decisions

The following items were not answered conclusively during discovery. GPT Luna should not silently invent the owner's preference. Use the recommended default for implementation only when it is safe and reversible, and list it as provisional in `IMPLEMENTATION_STATUS.md`.

| Decision | Current state | Recommended provisional default |
|---|---|---|
| Meaning of 10–30 articles/day | Unclear: source briefs, total outputs, or per-domain outputs | Design capacity controls so these can be configured independently; ask owner before load/cost sizing |
| Dashboard user model | RBAC for OWNER, ADMIN, EDITOR, REVIEWER, PUBLISHER is implemented with media scopes and an initial owner seed. Production user policy (how many accounts, who manages them) still needs owner confirmation | Keep the implemented roles unless the owner changes the policy |
| Public frontend deployment | Current implementation uses one multi-tenant Next.js app for dashboard and public tenant rendering. Production hosting is not selected. | Keep the current shared-app model initially; preserve an adapter/API boundary for any future split deployments |
| AI provider/model | OpenRouter with Qwen3 235B is configured for the current local environment; Qwen3 32B is an optional lower-cost model. This does not constitute a production privacy/budget approval. | Keep the provider adapter; production owner must confirm model, spend limit, and privacy/retention policy before deployment |
| Hosting provider | Not selected | Docker-portable deployment; select actual provider before production deployment |
| Domain DNS/TLS management | Not selected | Support manual domain registration/verification records first; integrate provider-specific automation later |
| Public site design system | Only broadly described | Start with one configurable responsive template; support theme, logo, typography, navigation, and category settings per media |
| Publisher disclosure wording | Not yet provided | Provide truthful owner/publisher disclosure fields and require owner to supply final wording |
| Byline policy | Not yet provided | Use real contributors/editors or an accurately labelled newsroom/byline; never invent people |
| Reference ingestion scope | Implemented brief accepts a topic with optional user narrative and optional reference URLs. Safe public URL ingestion exists; production terms/rate limits still require review. | Use topic-only mode for an unverified writing draft; use supplied evidence for factual verification. Fetch only accessible public pages safely |
| Image sourcing provider | Current implementation supports manual licensed upload and AI-generated illustration with provenance fields. External image-source selection is not integrated | Do not scrape Google Images. Add approved/licensed image source adapters later |
| Cloudinary plan/limits | Cloudinary chosen; account/plan unknown | Use environment-based account setup; add a usage dashboard and configure upload limits once plan is known |
| Article format/editor | Current implementation edits and stores article title/excerpt/body/SEO/metadata as structured text fields with a plain-text primary body. A rich-text/Markdown editor and formatting model remain a product choice | Choose editor/format after UI prototype; preserve sanitization and snapshot compatibility |
| Analytics source | Operational/editorial analytics are implemented (persisted counts, publication status). Web traffic analytics and provider/consent choices remain open | Add web traffic analytics only after source/privacy choice |
| Localization | Indonesian assumed | Build locale-aware fields; launch Indonesian first |

## Questions to confirm with the owner

1. Is 10–30/day the number of source briefs, total article outputs across all media, or output per domain?
2. Should the first release support only one owner/admin, or multiple editor/reviewer/publisher accounts?
3. Confirm one shared multi-tenant Next.js public app for all domains as the initial deployment model?
4. Confirm the production AI provider/model and monthly budget. The local implementation uses OpenRouter/Qwen3 by default, but production cost and privacy approval remain open.
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
