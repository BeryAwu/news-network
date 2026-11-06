# Database Model — Conceptual Specification

The application uses PostgreSQL and Prisma. This document is the conceptual domain-model reference; the implemented schema is `prisma/schema.prisma` and its committed migrations are authoritative for actual field names, relations, constraints, and deletion policies. Do not treat this conceptual list as a migration checklist without comparing it to the current schema.

## 1. Core entities

### User
- `id` (UUID/cuid)
- `name`, `email` (unique), `passwordHash` or auth-provider identity
- `status` (ACTIVE, INVITED, DISABLED)
- `createdAt`, `updatedAt`, `lastLoginAt`

### Role / Permission / UserRole
- Support roles: OWNER, ADMIN, EDITOR, REVIEWER, PUBLISHER.
- Allow user-to-media scope assignments.
- Permissions are explicit and checked on the server.

### MediaSite
- `id`
- `name`, `slug`, `displayName`, `description`
- `status` (DRAFT, ACTIVE, PAUSED, DISABLED)
- `defaultLocale`, `timezone`
- `logoAssetId` (optional relation to Asset)
- `themeConfig` (JSON for visual tokens, validated)
- `publisherDisclosure` / `ownershipDisclosure` configuration
- `createdAt`, `updatedAt`

### Domain
- `id`, `mediaSiteId`
- `hostname` (unique normalized hostname)
- `isCanonical`, `isActive`
- `verificationStatus`, `verificationMethod`, `verificationTokenHash`, `verifiedAt`
- `createdAt`, `updatedAt`

### MediaProfile
- `id`, `mediaSiteId` (unique per site)
- `niche`, `targetAudience`, `editorialMission`
- `toneGuidelines`, `styleGuidelines`, `headlineGuidelines`
- `language`, `preferredWordCountMin`, `preferredWordCountMax`
- `seoGuidelines`, `forbiddenClaims`, `requiredDisclosures`
- `updatedAt`

### Category
- `id`, `mediaSiteId`, `name`, `slug`, `description`, `isActive`, `sortOrder`
- Unique `(mediaSiteId, slug)`

### SourceBrief
- `id`, `createdById`
- `workingTitle` (required topic), `narrative` (optional; may be empty for topic-only drafting), `editorNotes`, `status`
- `sourceSummary` (optional)
- `createdAt`, `updatedAt`, `archivedAt`

### SourceReference
- `id`, `sourceBriefId`
- `url`, `canonicalUrl`, `title`, `publisherName`, `publishedAt`
- `retrievalStatus`, `retrievedAt`, `httpStatus`, `errorCode`
- `extractedText` or a safe stored excerpt/reference pointer, subject to retention policy
- `contentHash`, `createdAt`

### SourceFact / ClaimCheck (recommended)
- `id`, `sourceBriefId`, optional `sourceReferenceId`
- `claimText`, `claimType`, `supportStatus` (SUPPORTED, CONFLICTED, UNVERIFIED)
- `evidenceNote`, `createdAt`
- Used to track key facts and flag unsupported claims in drafts.

### Article
- `id`, `mediaSiteId`, `sourceBriefId`
- `categoryId`, `createdById`, `currentVersionId` (where practical)
- `title`, `slug`, `excerpt`, `body` (choose safe rich-text/MDX representation)
- `seoTitle`, `metaDescription`, `tags` (normalized relation or string array)
- `status` (editorial state)
- `featuredAssetId` (optional Asset relation)
- `approvedById`, `approvedAt`, `publishedAt`, `archivedAt`
- `createdAt`, `updatedAt`
- Unique `(mediaSiteId, slug)`

### ArticleVersion
- `id`, `articleId`, `versionNumber`
- `title`, `excerpt`, `body`, `seoTitle`, `metaDescription`, `categoryId`, `featuredAssetId`
- `changeType` (INITIAL_AI, MANUAL_EDIT, AI_REVISION, RESTORE, SYSTEM)
- `changeInstruction` (optional)
- `createdById` (nullable for system/AI)
- `aiProvider`, `aiModel`, `promptVersion` (nullable)
- `createdAt`
- Unique `(articleId, versionNumber)`

### EditorialReview
- `id`, `articleId`, `articleVersionId`, `reviewerId`
- `decision` (APPROVED, REJECTED, NEEDS_CHANGES)
- `notes`, `evidenceSnapshot`, `createdAt`
- `evidenceSnapshot` freezes the reviewed source-fact states and successfully retrieved reference metadata for the exact decision.

### Asset
- `id`, optional `mediaSiteId`
- `provider` fixed to `CLOUDINARY` for this project
- `cloudinaryPublicId`, `secureUrl`, `resourceType`, `format`
- `width`, `height`, `bytes`, `etag`, `version`
- `originalFilename`, `altText`, `caption`, `credit`
- `sourceUrl`, `sourcePublisher`, `licenseType`, `licenseUrl`, `attributionText`
- `isAiGenerated`, `generationPrompt` (optional), `createdById`, `createdAt`, `deletedAt`
- `cloudinaryPublicId` unique where appropriate

### PublicationTarget
- `id`, `articleId`, `mediaSiteId`, `articleVersionId`
- `status` (QUEUED, SCHEDULED, PUBLISHING, PUBLISHED, FAILED, CANCELLED)
- `scheduledAt`, `publishedAt`
- `remoteArticleId`, `remoteUrl`, `idempotencyKey` (unique)
- `lastErrorCode`, `lastErrorMessage`, `attemptCount`
- `createdById`, `createdAt`, `updatedAt`

### PublicationAttempt
- `id`, `publicationTargetId`, `attemptNumber`
- `startedAt`, `finishedAt`, `resultStatus`
- `httpStatus`, `responseSummary`, `errorCode`, `errorMessage`
- `queueJobId`, `correlationId`

### AiGenerationRun
- `id`, `sourceBriefId`, optional `articleId`, `mediaSiteId`
- `operation` (GENERATE_ARTICLE, REVISE_ARTICLE, SUMMARIZE_SOURCE, SUGGEST_IMAGE)
- `provider`, `model`, `promptVersion`, `status`
- `inputHash`, `outputSummary`, `inputTokens`, `outputTokens`, `estimatedCost`, `latencyMs`
- `errorCode`, `errorMessage`, `createdById`, `createdAt`, `completedAt`

### AuditLog
- `id`, `actorUserId`, `mediaSiteId` (nullable for global action)
- `action`, `entityType`, `entityId`, `metadata` (JSON, scrubbed)
- `ipHash` or approved request metadata if required by policy
- `createdAt`

### IntegrationSecret / IntegrationConfig
- Store references to secrets in a secret manager or encrypted values using a documented key-management strategy.
- Never store plaintext API secrets in normal settings JSON.
- Include integration type, scope, status, last tested timestamp, and non-secret configuration.

## 2. Relationship summary

- One `MediaSite` has many `Domain`, `Category`, `Article`, `Asset`, and `PublicationTarget` records.
- One `MediaSite` has one `MediaProfile`.
- One `SourceBrief` has many `SourceReference`, `SourceFact`, and `Article` records.
- One `Article` belongs to exactly one `MediaSite` and one `SourceBrief`.
- One `Article` has many `ArticleVersion`, `EditorialReview`, and `PublicationTarget` records.
- One `PublicationTarget` has many `PublicationAttempt` records.
- One `Asset` may be used by multiple articles; use an explicit join table if the product requires multiple usages/roles.
- One user can have multiple role assignments and media scopes.

## 3. Required indexes and constraints

- Unique normalized `Domain.hostname`.
- Unique `(MediaSiteId, Category.slug)`.
- Unique `(MediaSiteId, Article.slug)`.
- Unique `(ArticleId, ArticleVersion.versionNumber)`.
- Unique `PublicationTarget.idempotencyKey`.
- Index all tenant-owned tables by `mediaSiteId` plus common filter/sort columns.
- Index `Article.status`, `Article.createdAt`, `PublicationTarget.status`, `PublicationTarget.scheduledAt`, and `SourceBrief.createdAt`.
- Add foreign keys and delete policies intentionally. Prefer soft-delete/archive for editorial records.

## 4. Tenant safety

All queries on `Article`, `Category`, `Asset`, `PublicationTarget`, and media profile data must be scoped by authorized `mediaSiteId`. A media ID received from the client is not proof of access. Test cross-tenant read, update, delete, and publish attempts.

## 5. Implementation notes

- Use Prisma enums for finite states.
- Store dates as timezone-aware timestamps (PostgreSQL `timestamptz` semantics); display using the selected media timezone.
- Avoid oversized unbounded text in logs. Store a bounded summary and controlled source content.
- Use database transactions for state transitions that must be atomic (e.g., approval plus audit entry; creation of publication targets plus outbox/job records).
- Consider an outbox pattern so a committed publication intent is not lost if enqueueing fails.
