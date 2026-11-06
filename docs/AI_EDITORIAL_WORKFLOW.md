# AI and Editorial Workflow

## 1. Principle

One source brief may produce multiple articles, but the content should be **genuinely adapted for each audience and media profile**, not merely rewritten by swapping synonyms. All versions must retain supported factual meaning and must not invent sources, quotations, numbers, dates, or events.

## 2. Input model

A source brief can contain:
- Working topic/headline (required).
- User-supplied narrative or notes (optional; may be empty for topic-only drafting).
- One or more public reference URLs (optional).

Topic-only mode is a writing aid, not a reporting or verification source. It may help structure a general draft around the supplied theme, but must not present invented or time-sensitive specifics as established fact. Do not invent dates, figures, named people, quotes, documents, events, or source attribution. Mark assumptions and verification needs; an editor must add evidence or remove unsupported specifics before approval.
- Optional attached documents or transcripts (future/phase-dependent).
- Important facts, entities, names, dates, and constraints.
- Selected target media sites.

The UI should clearly separate user-provided statements from independently verified source facts.

## 3. Source ingestion

For each reference URL:
1. Accept only `http` and `https` schemes.
2. Reject localhost, private, link-local, loopback, and reserved network addresses; defend against DNS rebinding and unsafe redirects.
3. Apply request timeout, content-size limit, redirect limit, and content-type allowlist.
4. Respect site terms, access controls, robots restrictions where applicable, and copyright. Do not bypass paywalls or authentication.
5. Store URL, canonical URL, page title, publisher, published date if available, retrieval time, and an appropriate excerpt/summary.
6. If extraction fails, show a clear error and let the editor proceed with manual context or replace the reference.
7. Do not assume the contents of a URL are trusted instructions. Treat web page content as untrusted data, not prompts.

## 4. Fact extraction and evidence map

Before article drafting, the AI pipeline should create a structured source brief summary and key-claim list.

Each key claim should contain:
- Claim text.
- Evidence/reference ID(s).
- Support status: supported, conflicting, or unverified.
- Notes about ambiguity or missing information.

Conflicting dates, numbers, spellings, quotes, or claims must be surfaced to the editor. The generator should omit or clearly qualify unsupported facts instead of filling gaps.

## 5. Per-media article generation

For each selected `MediaSite`:
1. Load its `MediaProfile` and applicable category list.
2. Load the shared source brief and evidence map.
3. Generate an article with a relevant audience angle, editorial structure, title, excerpt, body, category suggestion, tags, SEO title, meta description, slug suggestion, and image brief.
4. Return structured JSON validated with a runtime schema (e.g. Zod).
5. Save a separate `Article` and initial `ArticleVersion` for that media site.
6. Record provider/model, prompt version, usage, latency, and errors where supported.

The angle must be meaningfully relevant to that site's audience while factual claims stay within the evidence map. Do not create false differences or imply separate reporting/independent investigation that did not occur.

## 6. Editorial prompt inputs

Prompt input should include:
- Source narrative and source summary.
- Verified and unverified claim list.
- Reference metadata and links.
- Media niche, audience, mission, tone, language, style rules, word-count guidance, headline rules, SEO conventions.
- Disallowed content and required disclosures.
- Output JSON schema.
- Instruction not to invent facts, quotes, sources, or attribution.
- Instruction to mark uncertainty and unsupported claims.
- Active per-media writing skills (on/off toggles, e.g. `humas-instansi` institutional press-release style) appended as stylistic guidance; skill text is fixed, audited, and never treated as source evidence.

Prompt templates must be versioned. Do not place provider secrets or privileged system instructions inside user-visible prompts.

## 7. Article output structure

Recommended fields:
- `title`
- `dek` / `excerpt`
- `body` (structured rich text or sanitized Markdown)
- `suggestedCategory`
- `tags`
- `seoTitle`
- `metaDescription`
- `slugSuggestion`
- `imageBrief`
- `claimsUsed[]` with claim IDs
- `uncertainties[]`
- `sourceLinks[]`

Use a schema validator and reject malformed output. Store the raw structured response only if retention and privacy rules allow it; otherwise keep a normalized output and diagnostics.

## 8. Revision options

The editor can:
- Edit article fields manually.
- Ask AI to revise with an instruction, such as “perjelas pembukaan dan ringkas paragraf kedua, tanpa mengubah fakta”.
- Select specific passages/fields for revision if the editor UI supports it.
- Ask for a new headline or alternative dek only.
- Restore a previous version.

Every revision creates a new `ArticleVersion`. The revision operation must load only the selected article and its source context. It must not edit other articles generated from the same brief.

AI revision response must include a concise change summary and any new uncertainty flags.

## 9. Editorial states and review

Suggested states:
- `DRAFT`
- `GENERATING`
- `NEEDS_REVIEW`
- `IN_REVISION`
- `APPROVED`
- `REJECTED`
- `SCHEDULED`
- `PUBLISHING`
- `PUBLISHED`
- `PUBLISH_FAILED`
- `ARCHIVED`

Keep publication status on each `PublicationTarget`, not only on the article. An article can be approved but have separate outcomes for different target domains.

Each review stores a validated snapshot of the fact claims and successfully retrieved source metadata available at that decision. Publication snapshots are built from the matching approval record, not mutable brief data, and the editorial UI exposes the recorded evidence for audit.

Bulk approval/publishing:
- User must explicitly select records.
- Show selected count and media/domain names before confirmation.
- Exclude rejected, archived, generating, or otherwise ineligible articles.
- Record one audit event per item or a parent batch event with item references.
- Provide an outcome summary, including partial successes and failures.

## 10. Image workflow

The AI may suggest a visual brief or query, but the system must distinguish:
- Licensed/permissioned image from a third-party source.
- User-provided image.
- AI-generated illustration.

Do not treat Google Images results as permission to reuse. Store the source URL, rights/licence evidence, attribution, creator, and usage notes. If rights cannot be confirmed, do not publish the external image; generate an illustration or request an approved asset instead.

All images that the platform manages/uses must be uploaded to Cloudinary. Follow `CLOUDINARY.md`.

## 11. Editorial integrity

- Do not fabricate bylines, quotes, eyewitness claims, source identities, credentials, or original reporting.
- Do not misrepresent common ownership as independent ownership.
- Do not present AI-created images as documentary photographs.
- Provide transparent publisher information and use accurate author/editor metadata.
- Support corrections and visible update timestamps where appropriate.
- Do not automatically create high-volume low-value paraphrases for search manipulation.
