-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'REVIEWER', 'PUBLISHER');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RetrievalStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('SUPPORTED', 'CONFLICTED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'GENERATING', 'NEEDS_REVIEW', 'IN_REVISION', 'APPROVED', 'REJECTED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PUBLISH_FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VersionChange" AS ENUM ('INITIAL_AI', 'MANUAL_EDIT', 'AI_REVISION', 'RESTORE');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'REJECTED', 'NEEDS_CHANGES');

-- CreateEnum
CREATE TYPE "AssetProvider" AS ENUM ('CLOUDINARY');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('USER_PROVIDED', 'CC0', 'CC_BY', 'CC_BY_SA', 'PUBLIC_DOMAIN', 'AI_GENERATED', 'OTHER');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('QUEUED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiOperation" AS ENUM ('GENERATE_ARTICLE', 'REVISE_ARTICLE', 'SUMMARIZE_SOURCE');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "MediaAccess" (
    "userId" TEXT NOT NULL,
    "mediaSiteId" TEXT NOT NULL,

    CONSTRAINT "MediaAccess_pkey" PRIMARY KEY ("userId","mediaSiteId")
);

-- CreateTable
CREATE TABLE "MediaSite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "MediaStatus" NOT NULL DEFAULT 'DRAFT',
    "defaultLocale" TEXT NOT NULL DEFAULT 'id-ID',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "themeConfig" JSONB NOT NULL DEFAULT '{}',
    "publisherDisclosure" TEXT NOT NULL DEFAULT '',
    "ownershipDisclosure" TEXT NOT NULL DEFAULT '',
    "newsroomByline" TEXT NOT NULL DEFAULT 'Redaksi',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MediaSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "mediaSiteId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "isCanonical" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationMethod" TEXT NOT NULL DEFAULT 'manual',
    "verificationTokenHash" TEXT,
    "verifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaProfile" (
    "id" TEXT NOT NULL,
    "mediaSiteId" TEXT NOT NULL,
    "niche" TEXT NOT NULL DEFAULT '',
    "targetAudience" TEXT NOT NULL DEFAULT '',
    "editorialMission" TEXT NOT NULL DEFAULT '',
    "toneGuidelines" TEXT NOT NULL DEFAULT '',
    "styleGuidelines" TEXT NOT NULL DEFAULT '',
    "headlineGuidelines" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'Indonesian',
    "preferredWordCountMin" INTEGER NOT NULL DEFAULT 350,
    "preferredWordCountMax" INTEGER NOT NULL DEFAULT 700,
    "seoGuidelines" TEXT NOT NULL DEFAULT '',
    "forbiddenClaims" TEXT NOT NULL DEFAULT '',
    "requiredDisclosures" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MediaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "mediaSiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceBrief" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "workingTitle" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "editorNotes" TEXT NOT NULL DEFAULT '',
    "status" "BriefStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceSummary" TEXT,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SourceBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceBriefMedia" (
    "sourceBriefId" TEXT NOT NULL,
    "mediaSiteId" TEXT NOT NULL,

    CONSTRAINT "SourceBriefMedia_pkey" PRIMARY KEY ("sourceBriefId","mediaSiteId")
);

-- CreateTable
CREATE TABLE "SourceReference" (
    "id" TEXT NOT NULL,
    "sourceBriefId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "publisherName" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMPTZ(3),
    "retrievalStatus" "RetrievalStatus" NOT NULL DEFAULT 'PENDING',
    "retrievedAt" TIMESTAMPTZ(3),
    "httpStatus" INTEGER,
    "errorCode" TEXT,
    "excerpt" TEXT,
    "contentHash" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFact" (
    "id" TEXT NOT NULL,
    "sourceBriefId" TEXT NOT NULL,
    "sourceReferenceId" TEXT,
    "claimText" TEXT NOT NULL,
    "supportStatus" "SupportStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "evidenceNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "mediaSiteId" TEXT NOT NULL,
    "sourceBriefId" TEXT NOT NULL,
    "categoryId" TEXT,
    "createdById" TEXT NOT NULL,
    "featuredAssetId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "metaDescription" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageBrief" TEXT NOT NULL DEFAULT '',
    "claimsUsed" JSONB NOT NULL DEFAULT '[]',
    "uncertainties" JSONB NOT NULL DEFAULT '[]',
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "seoTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageBrief" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT,
    "featuredAssetId" TEXT,
    "changeType" "VersionChange" NOT NULL,
    "changeInstruction" TEXT,
    "createdById" TEXT,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "promptVersion" TEXT,
    "changeSummary" TEXT NOT NULL DEFAULT '',
    "claimsUsed" JSONB NOT NULL DEFAULT '[]',
    "uncertainties" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialReview" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "articleVersionId" TEXT,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "evidenceSnapshot" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorialReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "mediaSiteId" TEXT,
    "provider" "AssetProvider" NOT NULL DEFAULT 'CLOUDINARY',
    "cloudinaryPublicId" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "etag" TEXT,
    "cloudinaryVersion" INTEGER,
    "originalFilename" TEXT NOT NULL,
    "altText" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "credit" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT,
    "sourcePublisher" TEXT NOT NULL DEFAULT '',
    "licenseType" "LicenseType" NOT NULL DEFAULT 'USER_PROVIDED',
    "licenseUrl" TEXT,
    "attributionText" TEXT NOT NULL DEFAULT '',
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "generationPrompt" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationTarget" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "mediaSiteId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "articleVersionId" TEXT NOT NULL,
    "approvedSnapshot" JSONB NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledAt" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "remoteArticleId" TEXT,
    "remoteUrl" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PublicationTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationAsset" (
    "publicationTargetId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'FEATURED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationAsset_pkey" PRIMARY KEY ("publicationTargetId","assetId","role")
);

-- CreateTable
CREATE TABLE "PublicationAttempt" (
    "id" TEXT NOT NULL,
    "publicationTargetId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "resultStatus" "AttemptStatus" NOT NULL,
    "httpStatus" INTEGER,
    "responseSummary" TEXT NOT NULL DEFAULT '',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "correlationId" TEXT NOT NULL,

    CONSTRAINT "PublicationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGenerationRun" (
    "id" TEXT NOT NULL,
    "sourceBriefId" TEXT NOT NULL,
    "articleId" TEXT,
    "mediaSiteId" TEXT,
    "operation" "AiOperation" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "inputHash" TEXT NOT NULL,
    "outputSummary" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCost" DECIMAL(12,6),
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AiGenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "mediaSiteId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserRole_role_idx" ON "UserRole"("role");

-- CreateIndex
CREATE INDEX "MediaAccess_mediaSiteId_idx" ON "MediaAccess"("mediaSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaSite_slug_key" ON "MediaSite"("slug");

-- CreateIndex
CREATE INDEX "MediaSite_status_createdAt_idx" ON "MediaSite"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_hostname_key" ON "Domain"("hostname");

-- CreateIndex
CREATE INDEX "Domain_mediaSiteId_isActive_verificationStatus_idx" ON "Domain"("mediaSiteId", "isActive", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MediaProfile_mediaSiteId_key" ON "MediaProfile"("mediaSiteId");

-- CreateIndex
CREATE INDEX "Category_mediaSiteId_isActive_sortOrder_idx" ON "Category"("mediaSiteId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Category_mediaSiteId_slug_key" ON "Category"("mediaSiteId", "slug");

-- CreateIndex
CREATE INDEX "SourceBrief_createdAt_status_idx" ON "SourceBrief"("createdAt", "status");

-- CreateIndex
CREATE INDEX "SourceBriefMedia_mediaSiteId_idx" ON "SourceBriefMedia"("mediaSiteId");

-- CreateIndex
CREATE INDEX "SourceReference_sourceBriefId_retrievalStatus_idx" ON "SourceReference"("sourceBriefId", "retrievalStatus");

-- CreateIndex
CREATE INDEX "SourceFact_sourceBriefId_supportStatus_idx" ON "SourceFact"("sourceBriefId", "supportStatus");

-- CreateIndex
CREATE INDEX "Article_mediaSiteId_status_createdAt_idx" ON "Article"("mediaSiteId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Article_sourceBriefId_idx" ON "Article"("sourceBriefId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_mediaSiteId_slug_key" ON "Article"("mediaSiteId", "slug");

-- CreateIndex
CREATE INDEX "ArticleVersion_articleId_createdAt_idx" ON "ArticleVersion"("articleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleVersion_articleId_versionNumber_key" ON "ArticleVersion"("articleId", "versionNumber");

-- CreateIndex
CREATE INDEX "EditorialReview_articleId_createdAt_idx" ON "EditorialReview"("articleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_cloudinaryPublicId_key" ON "Asset"("cloudinaryPublicId");

-- CreateIndex
CREATE INDEX "Asset_mediaSiteId_deletedAt_createdAt_idx" ON "Asset"("mediaSiteId", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationTarget_idempotencyKey_key" ON "PublicationTarget"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PublicationTarget_mediaSiteId_status_scheduledAt_idx" ON "PublicationTarget"("mediaSiteId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "PublicationTarget_articleId_createdAt_idx" ON "PublicationTarget"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "PublicationAsset_assetId_idx" ON "PublicationAsset"("assetId");

-- CreateIndex
CREATE INDEX "PublicationAttempt_publicationTargetId_startedAt_idx" ON "PublicationAttempt"("publicationTargetId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationAttempt_publicationTargetId_attemptNumber_key" ON "PublicationAttempt"("publicationTargetId", "attemptNumber");

-- CreateIndex
CREATE INDEX "AiGenerationRun_sourceBriefId_createdAt_idx" ON "AiGenerationRun"("sourceBriefId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_mediaSiteId_createdAt_idx" ON "AuditLog"("mediaSiteId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAccess" ADD CONSTRAINT "MediaAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAccess" ADD CONSTRAINT "MediaAccess_mediaSiteId_fkey" FOREIGN KEY ("mediaSiteId") REFERENCES "MediaSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_mediaSiteId_fkey" FOREIGN KEY ("mediaSiteId") REFERENCES "MediaSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaProfile" ADD CONSTRAINT "MediaProfile_mediaSiteId_fkey" FOREIGN KEY ("mediaSiteId") REFERENCES "MediaSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_mediaSiteId_fkey" FOREIGN KEY ("mediaSiteId") REFERENCES "MediaSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceBrief" ADD CONSTRAINT "SourceBrief_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceBriefMedia" ADD CONSTRAINT "SourceBriefMedia_sourceBriefId_fkey" FOREIGN KEY ("sourceBriefId") REFERENCES "SourceBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceBriefMedia" ADD CONSTRAINT "SourceBriefMedia_mediaSiteId_fkey" FOREIGN KEY ("mediaSiteId") REFERENCES "MediaSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceReference" ADD CONSTRAINT "SourceReference_sourceBriefId_fkey" FOREIGN KEY ("sourceBriefId") REFERENCES "SourceBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFact" ADD CONSTRAINT "SourceFact_sourceBriefId_fkey" FOREIGN KEY ("sourceBriefId") REFERENCES "SourceBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFact" ADD CONSTRAINT "SourceFact_sourceReferenceId_fkey" FOREIGN KEY ("sourceReferenceId") REFERENCES "SourceReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_mediaSiteId_fkey" FOREIGN KEY ("mediaSiteId") REFERENCES "MediaSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_sourceBriefId_fkey" FOREIGN KEY ("sourceBriefId") REFERENCES "SourceBrief"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_featuredAssetId_fkey" FOREIGN KEY ("featuredAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleVersion" ADD CONSTRAINT "ArticleVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleVersion" ADD CONSTRAINT "ArticleVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialReview" ADD CONSTRAINT "EditorialReview_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialReview" ADD CONSTRAINT "EditorialReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_mediaSiteId_fkey" FOREIGN KEY ("mediaSiteId") REFERENCES "MediaSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationTarget" ADD CONSTRAINT "PublicationTarget_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationTarget" ADD CONSTRAINT "PublicationTarget_mediaSiteId_fkey" FOREIGN KEY ("mediaSiteId") REFERENCES "MediaSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationTarget" ADD CONSTRAINT "PublicationTarget_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationTarget" ADD CONSTRAINT "PublicationTarget_articleVersionId_fkey" FOREIGN KEY ("articleVersionId") REFERENCES "ArticleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationTarget" ADD CONSTRAINT "PublicationTarget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationAsset" ADD CONSTRAINT "PublicationAsset_publicationTargetId_fkey" FOREIGN KEY ("publicationTargetId") REFERENCES "PublicationTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationAsset" ADD CONSTRAINT "PublicationAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationAttempt" ADD CONSTRAINT "PublicationAttempt_publicationTargetId_fkey" FOREIGN KEY ("publicationTargetId") REFERENCES "PublicationTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGenerationRun" ADD CONSTRAINT "AiGenerationRun_sourceBriefId_fkey" FOREIGN KEY ("sourceBriefId") REFERENCES "SourceBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGenerationRun" ADD CONSTRAINT "AiGenerationRun_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_mediaSiteId_fkey" FOREIGN KEY ("mediaSiteId") REFERENCES "MediaSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

