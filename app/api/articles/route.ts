import { z } from "zod";
import { db } from "@/lib/db";
import { hasNetworkWideScope, requireMediaAccess, requireRole, requireSameOrigin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { generateDraft, IntegrationNotConfigured } from "@/lib/ai";
import { slugify } from "@/lib/security";
import { createEditorialEvidenceSnapshot } from "@/lib/editorial-evidence";

const statusSchema = z.enum(["DRAFT", "GENERATING", "NEEDS_REVIEW", "IN_REVISION", "APPROVED", "REJECTED", "SCHEDULED", "PUBLISHING", "PUBLISHED", "PUBLISH_FAILED", "ARCHIVED"]);
const savedArticleFacts = z.object({ claimsUsed: z.array(z.object({ claimText: z.string().min(1), sourceFactIds: z.array(z.string()) })), uncertainties: z.array(z.string()) });
function persistedFacts(claimsUsed: unknown, uncertainties: unknown) {
  const parsed = savedArticleFacts.safeParse({ claimsUsed, uncertainties });
  return parsed.success ? { claimsUsed: parsed.data.claimsUsed, uncertainties: parsed.data.uncertainties } : { claimsUsed: [] as string[], uncertainties: [] as string[] };
}
const generationAction = z.object({ action: z.literal("generate"), sourceBriefId: z.string().min(1) });
const reviewAction = z.object({ action: z.literal("review"), articleId: z.string().min(1), decision: z.enum(["APPROVED", "REJECTED", "NEEDS_CHANGES"]), notes: z.string().max(2000).default("") });
const batchReviewAction = z.object({ action: z.literal("bulk-approve"), articleIds: z.array(z.string().min(1)).min(1).max(100), confirmation: z.literal(true) });
const editAction = z.object({ action: z.literal("edit"), articleId: z.string().min(1), title: z.string().min(8).max(180), slug: z.string().max(140).optional(), excerpt: z.string().min(12).max(500), body: z.string().min(120).max(30000), seoTitle: z.string().max(180), metaDescription: z.string().max(300), tags: z.array(z.string().max(40)).max(12), imageBrief: z.string().max(1000), featuredAssetId: z.string().nullable().optional() });
const revisionAction = z.object({ action: z.literal("revise"), articleId: z.string().min(1), instruction: z.string().min(5).max(2000) });
const restoreAction = z.object({ action: z.literal("restore"), articleId: z.string().min(1), versionNumber: z.number().int().positive() });
const inputSchema = z.discriminatedUnion("action", [generationAction, editAction, revisionAction, reviewAction, batchReviewAction, restoreAction]);

function articleVersionFields(article: { title: string; slug: string; excerpt: string; body: string; seoTitle: string; metaDescription: string; tags: string[]; imageBrief: string; categoryId: string | null; featuredAssetId: string | null }) {
  return { title: article.title, slug: article.slug, excerpt: article.excerpt, body: article.body, seoTitle: article.seoTitle, metaDescription: article.metaDescription, tags: article.tags, imageBrief: article.imageBrief, categoryId: article.categoryId, featuredAssetId: article.featuredAssetId };
}

export async function GET(request: Request) {
  try {
    const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER", "PUBLISHER");
    const params = new URL(request.url).searchParams;
    const mediaSiteId = params.get("mediaSiteId");
    const status = params.get("status");
    if (mediaSiteId) await requireMediaAccess(user.id, mediaSiteId);
    const isOwner = await hasNetworkWideScope(user.id);
    const articles = await db.article.findMany({
      where: {
        ...(mediaSiteId ? { mediaSiteId } : isOwner ? {} : { mediaSite: { mediaScopes: { some: { userId: user.id } } } }),
        ...(status ? { status: statusSchema.parse(status) } : {}), archivedAt: null
      },
      include: {
        mediaSite: { select: { id: true, displayName: true, slug: true, newsroomByline: true } },
        sourceBrief: { select: { id: true, workingTitle: true, references: true, facts: true } }, featuredAsset: true,
        versions: { orderBy: { versionNumber: "desc" }, take: 10 }, reviews: { orderBy: { createdAt: "desc" }, take: 3 },
        publicationTargets: { orderBy: { createdAt: "desc" } }
      }, orderBy: { updatedAt: "desc" }
    });
    return Response.json(articles);
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const raw = await request.json();
    const input = inputSchema.parse(raw);
    const user = input.action === "review" || input.action === "bulk-approve"
      ? await requireRole("OWNER", "ADMIN", "REVIEWER")
      : await requireRole("OWNER", "ADMIN", "EDITOR");

    if (input.action === "generate") {
      const brief = await db.sourceBrief.findUnique({
        where: { id: input.sourceBriefId },
        include: {
          references: true,
          facts: true,
          mediaTargets: {
            include: {
              mediaSite: {
                include: {
                  profile: true,
                  categories: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }
                }
              }
            }
          }
        }
      });
      if (!brief || brief.archivedAt) return Response.json({ error: "Source brief not found." }, { status: 404 });
      for (const target of brief.mediaTargets) await requireMediaAccess(user.id, target.mediaSiteId);
      const outcomes = await Promise.all(brief.mediaTargets.map(async ({ mediaSiteId, mediaSite }) => {
        const existing = await db.article.findFirst({ where: { sourceBriefId: brief.id, mediaSiteId }, select: { id: true, title: true, status: true } });
        if (existing) return { mediaSiteId, articleId: existing.id, title: existing.title, status: existing.status, reusedExisting: true };
        let provider = process.env.AI_PROVIDER || "unconfigured";
        let model = process.env.AI_MODEL || "unconfigured";
        try {
          const profile = mediaSite.profile ?? { niche: "", targetAudience: "", editorialMission: "", toneGuidelines: "", styleGuidelines: "", language: "Indonesian", preferredWordCountMin: 350, preferredWordCountMax: 700 };
          const result = await generateDraft(brief, { ...mediaSite, profile, categories: mediaSite.categories });
          provider = result.provider; model = result.model || "unknown";
          const category = mediaSite.categories.find((item) => item.name.toLowerCase() === result.draft.suggestedCategory.toLowerCase());
          const slug = `${slugify(result.draft.slugSuggestion || result.draft.title)}-${mediaSiteId.slice(-6)}-${brief.id.slice(-6)}`.slice(0, 120);
          const article = await db.$transaction(async (tx) => {
            const created = await tx.article.create({ data: {
              mediaSiteId, sourceBriefId: brief.id, createdById: user.id, categoryId: category?.id ?? null,
              title: result.draft.title, slug, excerpt: result.draft.excerpt, body: result.draft.body,
              seoTitle: result.draft.seoTitle, metaDescription: result.draft.metaDescription, tags: result.draft.tags,
              imageBrief: result.draft.imageBrief, claimsUsed: result.draft.claimsUsed, uncertainties: result.draft.uncertainties,
              status: "NEEDS_REVIEW", versionNumber: 1
            } });
            await tx.articleVersion.create({ data: {
              articleId: created.id, versionNumber: 1, title: created.title, slug: created.slug, excerpt: created.excerpt,
              body: created.body, seoTitle: created.seoTitle, metaDescription: created.metaDescription, tags: created.tags,
              imageBrief: created.imageBrief, categoryId: created.categoryId, changeType: "INITIAL_AI",
              aiProvider: result.provider, aiModel: result.model, promptVersion: result.promptVersion,
              changeSummary: result.changeSummary, claimsUsed: result.draft.claimsUsed, uncertainties: result.draft.uncertainties,
              createdById: user.id
            } });
            await tx.aiGenerationRun.create({ data: {
              sourceBriefId: brief.id, articleId: created.id, mediaSiteId, operation: "GENERATE_ARTICLE",
              provider: result.provider, model: result.model || "unknown", promptVersion: result.promptVersion, status: "SUCCEEDED",
              inputHash: result.inputHash, outputSummary: result.draft.title, latencyMs: result.latencyMs,
              inputTokens: result.inputTokens, outputTokens: result.outputTokens, createdById: user.id, completedAt: new Date()
            } });
            await tx.auditLog.create({ data: {
              actorUserId: user.id, mediaSiteId, action: "ARTICLE_GENERATED", entityType: "Article", entityId: created.id,
              metadata: { provider: result.provider, model: result.model, promptVersion: result.promptVersion }
            } });
            return created;
          });
          return { mediaSiteId, articleId: article.id, title: article.title, status: article.status };
        } catch (error) {
          if (error instanceof IntegrationNotConfigured) return { mediaSiteId, status: "NOT_CONFIGURED", error: error.message };
          await db.aiGenerationRun.create({ data: {
            sourceBriefId: brief.id, mediaSiteId, operation: "GENERATE_ARTICLE", provider, model,
            promptVersion: "news-draft-id-v1", status: "FAILED", inputHash: `${brief.id}:${mediaSiteId}`,
            errorCode: "GENERATION_FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Unknown generation error",
            createdById: user.id, completedAt: new Date()
          } });
          return { mediaSiteId, status: "FAILED", error: error instanceof Error ? error.message : "Generation failed." };
        }
      }));
      return Response.json({ outcomes }, { status: 201 });
    }

    if (input.action === "bulk-approve") {
      const articles = await db.article.findMany({ where: { id: { in: input.articleIds }, status: "NEEDS_REVIEW", archivedAt: null }, include: { sourceBrief: { include: { references: true, facts: true } } } });
      const canOverrideEditorialSeparation = user.roles.some((assignment) => assignment.role === "OWNER" || assignment.role === "ADMIN");
      if (!canOverrideEditorialSeparation && articles.some((article) => article.createdById === user.id)) return Response.json({ error: "Reviewers cannot approve articles they created." }, { status: 403 });
      if (articles.length !== new Set(input.articleIds).size) return Response.json({ error: "Every selected article must exist and be awaiting review. No items were approved." }, { status: 409 });
      for (const article of articles) await requireMediaAccess(user.id, article.mediaSiteId);
      const result = await db.$transaction(async (tx) => {
        for (const article of articles) {
          await tx.article.update({ where: { id: article.id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id } });
          const version = await tx.articleVersion.findUnique({ where: { articleId_versionNumber: { articleId: article.id, versionNumber: article.versionNumber } } });
          await tx.editorialReview.create({ data: { articleId: article.id, articleVersionId: version?.id, reviewerId: user.id, decision: "APPROVED", notes: "Bulk-approved after explicit selection.", evidenceSnapshot: createEditorialEvidenceSnapshot(article.sourceBrief) } });
          await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: article.mediaSiteId, action: "ARTICLE_APPROVED", entityType: "Article", entityId: article.id, metadata: { batch: true } } });
        }
        return { count: articles.length, articleIds: articles.map(({ id }) => id) };
      });
      return Response.json(result);
    }

    const article = await db.article.findUnique({ where: { id: input.articleId }, include: { sourceBrief: { include: { references: true, facts: true } }, mediaSite: { include: { profile: true, categories: { where: { isActive: true } } } } } });
    if (!article) return Response.json({ error: "Article not found." }, { status: 404 });
    await requireMediaAccess(user.id, article.mediaSiteId);

    if (input.action === "edit") {
      if (["PUBLISHED", "ARCHIVED", "REJECTED"].includes(article.status)) return Response.json({ error: "This article cannot be edited in its current state." }, { status: 409 });
      const slug = `${slugify(input.slug || input.title)}-${article.mediaSiteId.slice(-6)}-${article.sourceBriefId.slice(-6)}`.slice(0, 120);
      const featuredAssetId = input.featuredAssetId === undefined ? article.featuredAssetId ?? null : input.featuredAssetId;
      if (featuredAssetId && !(await db.asset.findFirst({ where: { id: featuredAssetId, mediaSiteId: article.mediaSiteId, deletedAt: null } }))) return Response.json({ error: "Featured asset not found in this media library." }, { status: 400 });
      const next = { ...articleVersionFields(article), ...persistedFacts(article.claimsUsed, article.uncertainties), title: input.title, slug, excerpt: input.excerpt, body: input.body, seoTitle: input.seoTitle, metaDescription: input.metaDescription, tags: input.tags, imageBrief: input.imageBrief, featuredAssetId };
      const updated = await db.$transaction(async (tx) => {
        const saved = await tx.article.update({ where: { id: article.id }, data: { ...next, versionNumber: { increment: 1 }, status: "NEEDS_REVIEW", approvedAt: null, approvedById: null } });
        await tx.articleVersion.create({ data: { articleId: article.id, ...next, versionNumber: saved.versionNumber, changeType: "MANUAL_EDIT", createdById: user.id, changeSummary: "Manual editorial update." } });
        await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: article.mediaSiteId, action: "ARTICLE_EDITED", entityType: "Article", entityId: article.id, metadata: { versionNumber: saved.versionNumber } } });
        return saved;
      });
      return Response.json(updated);
    }

    if (input.action === "review") {
      const canOverrideEditorialSeparation = user.roles.some((assignment) => assignment.role === "OWNER" || assignment.role === "ADMIN");
      if (!canOverrideEditorialSeparation && article.createdById === user.id) return Response.json({ error: "Reviewers cannot approve articles they created." }, { status: 403 });
      if (article.status !== "NEEDS_REVIEW") return Response.json({ error: "Only drafts awaiting review may be reviewed." }, { status: 409 });
      const updated = await db.$transaction(async (tx) => {
        const status = input.decision === "APPROVED" ? "APPROVED" : input.decision === "REJECTED" ? "REJECTED" : "IN_REVISION";
        const saved = await tx.article.update({ where: { id: article.id }, data: { status, approvedAt: status === "APPROVED" ? new Date() : null, approvedById: status === "APPROVED" ? user.id : null } });
        const version = await tx.articleVersion.findUnique({ where: { articleId_versionNumber: { articleId: article.id, versionNumber: article.versionNumber } } });
        await tx.editorialReview.create({ data: { articleId: article.id, articleVersionId: version?.id, reviewerId: user.id, decision: input.decision, notes: input.notes, evidenceSnapshot: createEditorialEvidenceSnapshot(article.sourceBrief) } });
        await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: article.mediaSiteId, action: `ARTICLE_${input.decision}`, entityType: "Article", entityId: article.id, metadata: { notes: input.notes } } });
        return saved;
      });
      return Response.json(updated);
    }

    if (input.action === "revise") {
      if (["PUBLISHED", "ARCHIVED", "REJECTED"].includes(article.status)) return Response.json({ error: "This article cannot be revised in its current state." }, { status: 409 });
      const profile = article.mediaSite.profile ?? { niche: "", targetAudience: "", editorialMission: "", toneGuidelines: "", styleGuidelines: "", language: "Indonesian", preferredWordCountMin: 350, preferredWordCountMax: 700 };
      const result = await generateDraft(article.sourceBrief, { ...article.mediaSite, profile }, input.instruction, { title: article.title, excerpt: article.excerpt, body: article.body, seoTitle: article.seoTitle, metaDescription: article.metaDescription, tags: article.tags, imageBrief: article.imageBrief });
      const draft = result.draft;
      const versionNumber = article.versionNumber + 1;
      const slug = `${slugify(draft.slugSuggestion || draft.title)}-${article.mediaSiteId.slice(-6)}-${article.sourceBriefId.slice(-6)}`.slice(0, 120);
      const updated = await db.$transaction(async (tx) => {
        const saved = await tx.article.update({ where: { id: article.id }, data: { title: draft.title, slug, excerpt: draft.excerpt, body: draft.body, seoTitle: draft.seoTitle, metaDescription: draft.metaDescription, tags: draft.tags, imageBrief: draft.imageBrief, claimsUsed: draft.claimsUsed, uncertainties: draft.uncertainties, versionNumber, status: "NEEDS_REVIEW", approvedAt: null, approvedById: null } });
        await tx.articleVersion.create({ data: { articleId: article.id, ...articleVersionFields(saved), ...persistedFacts(saved.claimsUsed, saved.uncertainties), versionNumber, changeType: "AI_REVISION", changeInstruction: input.instruction, createdById: user.id, aiProvider: result.provider, aiModel: result.model, promptVersion: result.promptVersion, changeSummary: result.changeSummary } });
        await tx.aiGenerationRun.create({ data: { sourceBriefId: article.sourceBriefId, articleId: article.id, mediaSiteId: article.mediaSiteId, operation: "REVISE_ARTICLE", provider: result.provider, model: result.model || "unknown", promptVersion: result.promptVersion, status: "SUCCEEDED", inputHash: result.inputHash, outputSummary: draft.title, latencyMs: result.latencyMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens, createdById: user.id, completedAt: new Date() } });
        await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: article.mediaSiteId, action: "ARTICLE_REVISED", entityType: "Article", entityId: article.id, metadata: { versionNumber, instruction: input.instruction } } });
        return saved;
      });
      return Response.json(updated);
    }

    if (input.action === "restore") {
      if (["PUBLISHED", "ARCHIVED", "REJECTED"].includes(article.status)) return Response.json({ error: "This article cannot be restored in its current state." }, { status: 409 });
      const previous = await db.articleVersion.findUnique({ where: { articleId_versionNumber: { articleId: article.id, versionNumber: input.versionNumber } } });
      if (!previous) return Response.json({ error: "Article version not found." }, { status: 404 });
      const versionNumber = article.versionNumber + 1;
      const data = { title: previous.title, slug: `${slugify(previous.title)}-${article.mediaSiteId.slice(-6)}-${article.sourceBriefId.slice(-6)}`.slice(0, 120), excerpt: previous.excerpt, body: previous.body, seoTitle: previous.seoTitle, metaDescription: previous.metaDescription, tags: previous.tags, imageBrief: previous.imageBrief, categoryId: previous.categoryId ?? null, featuredAssetId: previous.featuredAssetId ?? null, claimsUsed: previous.claimsUsed === null ? [] : previous.claimsUsed, uncertainties: previous.uncertainties === null ? [] : previous.uncertainties };
      const updated = await db.$transaction(async (tx) => {
        const saved = await tx.article.update({ where: { id: article.id }, data: { ...data, versionNumber, status: "NEEDS_REVIEW", approvedAt: null, approvedById: null } });
        await tx.articleVersion.create({ data: { articleId: article.id, ...data, versionNumber, changeType: "RESTORE", createdById: user.id, changeSummary: `Restored version ${previous.versionNumber}.` } });
        await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: article.mediaSiteId, action: "ARTICLE_VERSION_RESTORED", entityType: "Article", entityId: article.id, metadata: { fromVersion: previous.versionNumber, versionNumber } } });
        return saved;
      });
      return Response.json(updated);
    }
    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) { return jsonError(error); }
}
