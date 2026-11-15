import { db } from "@/lib/db";
import { generateDraft, IntegrationNotConfigured } from "@/lib/ai";
import { slugify } from "@/lib/security";
import { enabledWritingGuidance } from "@/lib/writing-skills";
import { createSharedArticles } from "@/lib/blasts";

/** A run that has been PENDING this long is presumed lost (process restart) and reported as failed. */
export const GENERATION_STALE_MS = 15 * 60 * 1000;
const CONCURRENCY = 3;

/**
 * Executes one PENDING AiGenerationRun: loads brief + media fresh from the database, calls the model,
 * and either creates the article (version 1) or marks the run FAILED. Never throws.
 */
export async function executeGenerationRun(runId: string): Promise<void> {
  const run = await db.aiGenerationRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "PENDING") return;
  if (!run.mediaSiteId) return executeBlastRun(run.id);
  const mediaSiteId = run.mediaSiteId;
  const fail = (code: string, message: string) => db.aiGenerationRun.update({ where: { id: run.id }, data: { status: "FAILED", errorCode: code, errorMessage: message.slice(0, 1000), completedAt: new Date() } });
  try {
    const [brief, mediaSite] = await Promise.all([
      db.sourceBrief.findUnique({ where: { id: run.sourceBriefId }, include: { references: true, facts: true } }),
      db.mediaSite.findUnique({ where: { id: mediaSiteId }, include: { profile: true, categories: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } }),
    ]);
    if (!brief || brief.archivedAt || !mediaSite) { await fail("INPUT_MISSING", "Brief atau media tidak lagi tersedia."); return; }
    const profile = mediaSite.profile ?? { niche: "", targetAudience: "", editorialMission: "", toneGuidelines: "", styleGuidelines: "", language: "Indonesian", preferredWordCountMin: 350, preferredWordCountMax: 700 };
    const skillGuidance = await enabledWritingGuidance(db, mediaSiteId);
    const guidance = [skillGuidance, run.styleNote ? `Catatan gaya khusus dari operator untuk naskah ini: ${run.styleNote}` : ""].filter(Boolean).join("\n\n");
    const result = await generateDraft(brief, { ...mediaSite, profile, categories: mediaSite.categories }, undefined, undefined, guidance);
    const category = mediaSite.categories.find((item) => item.name.toLowerCase() === result.draft.suggestedCategory.toLowerCase());
    const slug = `${slugify(result.draft.slugSuggestion || result.draft.title)}-${mediaSiteId.slice(-6)}-${brief.id.slice(-6)}`.slice(0, 120);
    await db.$transaction(async (tx) => {
      const claimed = await tx.aiGenerationRun.updateMany({ where: { id: run.id, status: "PENDING" }, data: { status: "SUCCEEDED" } });
      if (claimed.count !== 1) return;
      const created = await tx.article.create({ data: {
        mediaSiteId, sourceBriefId: brief.id, createdById: run.createdById, categoryId: category?.id ?? null,
        title: result.draft.title, slug, excerpt: result.draft.excerpt, body: result.draft.body,
        seoTitle: result.draft.seoTitle, metaDescription: result.draft.metaDescription, tags: result.draft.tags,
        imageBrief: result.draft.imageBrief, claimsUsed: result.draft.claimsUsed, uncertainties: result.draft.uncertainties,
        status: "NEEDS_REVIEW", versionNumber: 1,
      } });
      await tx.articleVersion.create({ data: {
        articleId: created.id, versionNumber: 1, title: created.title, slug: created.slug, excerpt: created.excerpt,
        body: created.body, seoTitle: created.seoTitle, metaDescription: created.metaDescription, tags: created.tags,
        imageBrief: created.imageBrief, categoryId: created.categoryId, changeType: "INITIAL_AI",
        aiProvider: result.provider, aiModel: result.model, promptVersion: result.promptVersion,
        changeSummary: result.changeSummary, claimsUsed: result.draft.claimsUsed, uncertainties: result.draft.uncertainties,
        createdById: run.createdById,
      } });
      await tx.aiGenerationRun.update({ where: { id: run.id }, data: {
        articleId: created.id, provider: result.provider, model: result.model || "unknown", promptVersion: result.promptVersion,
        inputHash: result.inputHash, outputSummary: result.draft.title, latencyMs: result.latencyMs,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens, completedAt: new Date(),
      } });
      await tx.auditLog.create({ data: {
        actorUserId: run.createdById, mediaSiteId, action: "ARTICLE_GENERATED", entityType: "Article", entityId: created.id,
        metadata: { provider: result.provider, model: result.model, promptVersion: result.promptVersion, runId: run.id },
      } });
    });
  } catch (error) {
    if (error instanceof IntegrationNotConfigured) { await fail("NOT_CONFIGURED", error.message); return; }
    await fail("GENERATION_FAILED", error instanceof Error ? error.message : "Unknown generation error");
  }
}

/** Runs the given PENDING runs with bounded concurrency. Intended for `after()` in a request handler. */
export async function executeGenerationRuns(runIds: string[]): Promise<void> {
  const queue = [...runIds];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let id = queue.shift(); id; id = queue.shift()) await executeGenerationRun(id);
  }));
}

/** Marks runs that never finished (e.g. server restart mid-generation) as failed so the UI stops waiting. */
export async function failStaleGenerationRuns() {
  await db.aiGenerationRun.updateMany({
    where: { operation: "GENERATE_ARTICLE", status: "PENDING", createdAt: { lt: new Date(Date.now() - GENERATION_STALE_MS) } },
    data: { status: "FAILED", errorCode: "INTERRUPTED", errorMessage: "Proses terhenti sebelum selesai (server dimulai ulang atau melewati batas waktu). Coba buat ulang.", completedAt: new Date() },
  });
}

const GENERIC_PROFILE = { niche: "Berita umum", targetAudience: "Masyarakat umum", editorialMission: "", toneGuidelines: "Netral, jelas, dan mudah dipahami", styleGuidelines: "", language: "Indonesian", preferredWordCountMin: 350, preferredWordCountMax: 700 };

/**
 * A blast run has no media of its own: the AI writes ONE article for the brief, and the same text is stored for every media target.
 * The chosen writing style (a skill slug plus an optional note) replaces the per-media style toggles.
 */
async function executeBlastRun(runId: string): Promise<void> {
  const run = await db.aiGenerationRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "PENDING") return;
  const fail = (code: string, message: string) => db.aiGenerationRun.update({ where: { id: run.id }, data: { status: "FAILED", errorCode: code, errorMessage: message.slice(0, 1000), completedAt: new Date() } });
  try {
    const brief = await db.sourceBrief.findUnique({
      where: { id: run.sourceBriefId },
      include: { references: true, facts: true, mediaTargets: { include: { mediaSite: { select: { id: true, categories: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } } } } } } },
    });
    if (!brief || brief.archivedAt || !brief.mediaTargets.length) { await fail("INPUT_MISSING", "Berita atau media tidak lagi tersedia."); return; }
    const skill = run.styleSkillSlug ? await db.writingSkill.findFirst({ where: { slug: run.styleSkillSlug, isActive: true }, select: { promptGuidance: true } }) : null;
    const guidance = [skill?.promptGuidance ?? "", run.styleNote ? `Catatan gaya khusus dari operator untuk naskah ini: ${run.styleNote}` : ""].filter(Boolean).join("\n\n");
    const names = [...new Set(brief.mediaTargets.flatMap((t) => t.mediaSite.categories.map((c) => c.name)))];
    const result = await generateDraft(brief, { displayName: "Berita", profile: GENERIC_PROFILE, categories: names.map((name) => ({ name })) }, undefined, undefined, guidance);
    await db.$transaction(async (tx) => {
      const claimed = await tx.aiGenerationRun.updateMany({ where: { id: run.id, status: "PENDING" }, data: { status: "SUCCEEDED" } });
      if (claimed.count !== 1) return;
      const draft = result.draft;
      const created = await createSharedArticles(tx, { id: brief.id, featuredAssetId: brief.featuredAssetId, galleryAssetIds: brief.galleryAssetIds }, brief.mediaTargets.map((t) => t.mediaSite),
        { title: draft.title, excerpt: draft.excerpt, body: draft.body, seoTitle: draft.seoTitle, metaDescription: draft.metaDescription, tags: draft.tags, imageBrief: draft.imageBrief, claimsUsed: draft.claimsUsed, uncertainties: draft.uncertainties, suggestedCategory: draft.suggestedCategory },
        run.createdById, { changeType: "INITIAL_AI", summary: result.changeSummary, aiProvider: result.provider, aiModel: result.model, promptVersion: result.promptVersion });
      await tx.aiGenerationRun.update({ where: { id: run.id }, data: { articleId: created[0]?.id, provider: result.provider, model: result.model || "unknown", promptVersion: result.promptVersion, inputHash: result.inputHash, outputSummary: draft.title, latencyMs: result.latencyMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens, completedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: run.createdById, action: "BLAST_GENERATED", entityType: "SourceBrief", entityId: brief.id, metadata: { provider: result.provider, model: result.model, promptVersion: result.promptVersion, runId: run.id, media: created.length } } });
    });
  } catch (error) {
    if (error instanceof IntegrationNotConfigured) { await fail("NOT_CONFIGURED", error.message); return; }
    await fail("GENERATION_FAILED", error instanceof Error ? error.message : "Unknown generation error");
  }
}
