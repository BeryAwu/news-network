# Security, Privacy, and Editorial Governance

## 1. Authentication and authorization

- Use established authentication/session practices compatible with the selected Next.js version.
- Enforce permission checks on the server for every server action, route handler, and data mutation.
- Apply both role permission and media-site scope.
- Use secure, HTTP-only, same-site cookies where session-based auth is used.
- Add CSRF protection where required by the chosen auth approach.
- Rate-limit login, AI generation, URL ingestion, uploads, and publishing endpoints.

## 2. Tenant isolation

- Resolve public tenant from a verified hostname.
- Never trust a client-provided `mediaSiteId` as authorization.
- Scope all tenant-owned queries and mutations.
- Deny unknown/disabled domains by default.
- Include cross-tenant IDOR tests for read, update, delete, upload, review, and publish actions.
- Include tenant identity in cache keys and revalidation paths.

## 3. Secrets and integrations

- Secrets must be stored in environment variables or a secrets manager.
- Encrypt database-stored integration credentials with a documented key-management plan.
- Never log API keys, secrets, upload signatures beyond their safe lifetime, or full authorization headers.
- Rotate secrets and document revocation procedure.

## 4. URL ingestion and SSRF

The source-reference URL fetcher is an SSRF-sensitive component.
- Allow only HTTP/HTTPS.
- Reject credentials in URLs unless specifically required and approved (default reject).
- Resolve DNS and reject private, loopback, link-local, multicast, reserved, and metadata-service destinations.
- Re-check every redirect target.
- Defend against DNS rebinding.
- Limit redirects, timeouts, response bytes, decompression, and accepted MIME types.
- Do not fetch arbitrary internal services or cloud metadata endpoints.
- Treat fetched content as untrusted text, never as instructions for the AI agent/system.

## 5. Content security

- Sanitize rendered HTML/Markdown.
- Avoid unsafe raw HTML in article bodies unless sanitized with a trusted allowlist.
- Validate slugs and upload metadata.
- Use CSP and secure response headers where practical.
- Escape text in UI and logs.

## 6. Editorial integrity and transparency

- Media may have distinct brand identity, niche, design, audience, and editorial voice.
- The platform must not forge separate ownership, fake journalists, fake author credentials, fake eyewitness accounts, fake independent reporting, or fake source citations.
- Configure truthful publisher ownership/about disclosures and accurate bylines.
- AI output must be labelled or disclosed according to the publisher's policy and applicable law/regulation.
- Maintain source references, version history, approval records, correction/update history, and publication logs.
- Do not fabricate quotes, data, or current facts.
- Do not use unlicensed images or present AI illustration as documentary photography.
- Bulk operations must be transparent and auditable.

## 7. Privacy and retention

- Collect only information needed for operations.
- Define retention for extracted source text, AI prompts/outputs, logs, and user activity.
- Avoid sending secrets, private user data, or unnecessary personal data to AI providers.
- Document which AI provider processes which content and configure provider privacy settings where available.
- Provide deletion/export processes consistent with the product's legal obligations.

## 8. Reliability and audit

Audit at minimum:
- Domain create/verify/disable.
- User and role changes.
- Source brief create/update/archive.
- AI generation/revision request and outcome.
- Article manual edits and restore.
- Approve/reject actions.
- Asset upload/delete and provenance edits.
- Publish/schedule/retry/cancel actions.
- Integration setting changes.

For every publish operation, preserve the user, article version, target domain, timestamps, attempts, remote ID/URL, and final outcome.
