import { db } from "@/lib/db";
import { AuthError, hasNetworkWideScope, requireMediaAccess } from "@/lib/auth";
import { slugify } from "@/lib/security";
import { createEditorialEvidenceSnapshot, editorialEvidenceSnapshotSchema } from "@/lib/editorial-evidence";
import { publishTarget } from "@/lib/publishing";
import { publishingQueue } from "@/lib/publish-queue";
import { failStaleGenerationRuns } from "@/lib/generation";
import { plainPublishError } from "@/lib/publish-reasons";
import { aiConfiguration, DraftEvidenceValidationError, generateDraft, IntegrationNotConfigured, plainAiFailure, PROMPT_VERSION } from "@/lib/ai";
import type { Prisma, VersionChange } from "@prisma/client";
import type { BlastAsset, BlastContent, BlastDetail, BlastDraftPreview, BlastEditInput, BlastLink, BlastListItem, BlastMedia, BlastMediaChange, BlastMode, BlastStatus, PublicationState } from "@/lib/blast-types";

type User = { id: string; name: string; roles: { role: string }[] };

const isRole = (user: User, ...roles: string[]) => user.roles.some((assignment) => roles.includes(assignment.role));
/** OWNER, ADMIN and OPERATOR may approve what they wrote themselves. */
const canSelfApprove = (user: User) => isRole(user, "OWNER", "ADMIN", "OPERATOR");
const canPublishRole = (user: User) => isRole(user, "OWNER", "ADMIN") || (isRole(user, "PUBLISHER") && isRole(user, "REVIEWER"));

const toAsset = (a: { id: string; secureUrl: string; altText: string; caption: string; credit: string; width: number; height: number; isAiGenerated: boolean }): BlastAsset => ({
  id: a.id, secureUrl: a.secureUrl, altText: a.altText, caption: a.caption, credit: a.credit, width: a.width, height: a.height, isAiGenerated: a.isAiGenerated,
});

export class BlastError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

const blastInclude = {
      createdBy: { select: { id: true, name: true } },
      references: true,
      facts: true,
      mediaTargets: { include: { mediaSite: { select: { id: true, displayName: true, status: true, domains: { where: { isActive: true, verificationStatus: "VERIFIED" }, orderBy: [{ isCanonical: "desc" }, { createdAt: "asc" }], select: { id: true, hostname: true } } } } } },
      articles: {
        where: { archivedAt: null, status: { not: "ARCHIVED" } },
        include: { publicationTargets: { orderBy: { createdAt: "desc" }, select: { id: true, domainId: true, status: true, remoteUrl: true, lastErrorCode: true, lastErrorMessage: true, publishedAt: true, scheduledAt: true } } },
        orderBy: { createdAt: "asc" },
      },
    } satisfies Prisma.SourceBriefInclude;

export type LoadedBlast = Prisma.SourceBriefGetPayload<{ include: typeof blastInclude }>;

async function loadBlast(id: string): Promise<LoadedBlast | null> {
  // A deleted berita (archivedAt set) is gone: every screen and action treats it as not found.
  return db.sourceBrief.findFirst({ where: { id, archivedAt: null }, include: blastInclude });
}

/** Creator, or OWNER/ADMIN. Anyone else gets a 404 so ids do not leak. */
async function assertCanSee(user: User, blast: { createdById: string }) {
  if (blast.createdById === user.id || (await hasNetworkWideScope(user.id))) return;
  throw new BlastError("Berita tidak ditemukan.", 404);
}

async function accessibleAssets(user: User, ids: string[], mediaIds: string[]) {
  if (!ids.length) return [];
  const assets = await db.asset.findMany({ where: { id: { in: ids }, deletedAt: null } });
  const wide = await hasNetworkWideScope(user.id);
  for (const id of ids) {
    const asset = assets.find((a) => a.id === id);
    const ok = asset && (asset.mediaSiteId ? mediaIds.includes(asset.mediaSiteId) : asset.createdById === user.id || wide);
    if (!ok) throw new BlastError("Salah satu gambar tidak ditemukan atau tidak boleh dipakai.", 400);
  }
  return ids.map((id) => assets.find((a) => a.id === id)!);
}

function deriveStatus(blast: LoadedBlast, run: { status: string } | null): BlastStatus {
  if (!blast.contentMode) return "LEGACY";
  if (!blast.articles.length) return run?.status === "PENDING" ? "GENERATING" : "FAILED";
  const mediaWithArticle = blast.articles.length;
  const published = blast.articles.filter((a) => a.status === "PUBLISHED").length;
  if (published === mediaWithArticle) return "PUBLISHED";
  if (published > 0) return "PARTIAL";
  if (blast.articles.some((a) => a.publicationTargets.some((t) => t.status === "SCHEDULED"))) return "SCHEDULED";
  return "DRAFT";
}

function summarize(blast: LoadedBlast, status: BlastStatus): Pick<BlastListItem, "title" | "mediaCount" | "publishedCount" | "failedCount"> {
  return {
    title: blast.articles[0]?.title ?? blast.workingTitle,
    mediaCount: blast.mediaTargets.length,
    publishedCount: blast.articles.filter((a) => a.status === "PUBLISHED").length,
    failedCount: status === "LEGACY" ? 0 : blast.articles.filter((a) => a.publicationTargets[0]?.status === "FAILED").length,
  };
}

export interface BlastListOptions { from?: Date; to?: Date; liveOnly?: boolean; search?: string; status?: string }

export async function listBlasts(userId: string, page = 1, take = 20, opts: BlastListOptions = {}) {
  const wide = await hasNetworkWideScope(userId);
  // A topic saved by the wizard but never started (the second call failed) has no content yet and is not a blast.
  const where: Prisma.SourceBriefWhereInput = { archivedAt: null, OR: [{ contentMode: { not: null } }, { articles: { some: {} } }], ...(wide ? {} : { createdById: userId }) };
  if (opts.search) {
    const q = opts.search.trim();
    where.AND = [{ OR: [{ workingTitle: { contains: q, mode: "insensitive" } }, { narrative: { contains: q, mode: "insensitive" } }] }];
  }
  if (opts.status) {
    where.articles = { some: { status: opts.status as never, archivedAt: null } };
  }
  if (opts.liveOnly || opts.from || opts.to) {
    const publishedAt = opts.from || opts.to ? { publishedAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {};
    where.articles = { some: { status: "PUBLISHED", archivedAt: null, ...publishedAt } };
  }
  const safePage = Math.max(1, Math.min(page, 500));
  const [total, rows] = await Promise.all([
    db.sourceBrief.count({ where }),
    db.sourceBrief.findMany({ where, orderBy: { createdAt: "desc" }, skip: (safePage - 1) * take, take, select: { id: true } }),
  ]);
  const items: BlastListItem[] = [];
  for (const row of rows) {
    const blast = await loadBlast(row.id);
    if (!blast) continue;
    const run = blast.articles.length ? null : await db.aiGenerationRun.findFirst({ where: { sourceBriefId: blast.id, operation: "GENERATE_ARTICLE", mediaSiteId: null }, orderBy: { createdAt: "desc" }, select: { status: true } });
    const status = deriveStatus(blast, run);
    const statuses = new Set(blast.articles.map((article) => article.status));
    const legacyArticleStatus = statuses.size === 1 ? [...statuses][0] : null;
    items.push({ id: blast.id, createdAt: blast.createdAt.toISOString(), author: blast.createdBy, status, mode: (blast.contentMode as BlastMode | null) ?? null, legacyArticleStatus, ...summarize(blast, status) });
  }
  return { items, total, page: safePage, pages: Math.max(1, Math.ceil(total / take)) };
}

function mediaRows(blast: LoadedBlast): BlastMedia[] {
  return blast.mediaTargets.map(({ mediaSite }) => {
    const article = blast.articles.find((a) => a.mediaSiteId === mediaSite.id) ?? null;
    const primary = mediaSite.domains[0] ?? null;
    let problem: string | null = null;
    if (!primary) problem = "Alamat situs belum dikonfirmasi.";
    else if (mediaSite.status !== "ACTIVE") problem = "Media ini belum aktif. Konfirmasi alamat situsnya di Media saya.";
    const target = article ? (article.publicationTargets.find((t) => t.domainId === primary?.id) ?? article.publicationTargets[0] ?? null) : null;
    const failed = target?.status === "FAILED" ? plainPublishError(target.lastErrorMessage ?? undefined, 500, "Berita belum bisa terbit di media ini.").text : null;
    return {
      mediaSiteId: mediaSite.id,
      name: mediaSite.displayName,
      articleId: article?.id ?? null,
      articleStatus: article?.status ?? null,
      hostname: primary?.hostname ?? null,
      canPublish: !problem,
      problem,
      publication: target ? { status: target.status as PublicationState, url: target.status === "PUBLISHED" ? target.remoteUrl : null, error: failed, publishedAt: target.publishedAt?.toISOString() ?? null } : null,
    };
  });
}

export async function getBlastDetail(user: User, id: string): Promise<BlastDetail> {
  const blast = await loadBlast(id);
  if (!blast) throw new BlastError("Berita tidak ditemukan.", 404);
  await assertCanSee(user, blast);
  const run = await db.aiGenerationRun.findFirst({ where: { sourceBriefId: blast.id, operation: "GENERATE_ARTICLE", mediaSiteId: null }, orderBy: { createdAt: "desc" } });
  if (run?.status === "PENDING" && !blast.articles.length) { await failStaleGenerationRuns(); }
  const fresh = run?.status === "PENDING" ? await db.aiGenerationRun.findUnique({ where: { id: run.id } }) : run;
  const status = deriveStatus(blast, fresh);
  const first = blast.articles[0] ?? null;
  const assetIds = first ? [first.featuredAssetId, ...first.galleryAssetIds].filter((x): x is string => Boolean(x)) : [];
  const assets = assetIds.length ? await db.asset.findMany({ where: { id: { in: assetIds } } }) : [];
  const byId = new Map(assets.map((a) => [a.id, a]));
  const content: BlastContent | null = first ? {
    title: first.title, excerpt: first.excerpt, body: first.body, seoTitle: first.seoTitle, metaDescription: first.metaDescription, tags: first.tags,
    featured: first.featuredAssetId && byId.get(first.featuredAssetId) ? toAsset(byId.get(first.featuredAssetId)!) : null,
    gallery: first.galleryAssetIds.flatMap((aid) => (byId.get(aid) ? [toAsset(byId.get(aid)!)] : [])),
  } : null;
  const media = mediaRows(blast);
  const links: BlastLink[] = media.flatMap((m) => (m.publication?.status === "PUBLISHED" && m.publication.url ? [{ mediaName: m.name, title: content?.title ?? blast.workingTitle, url: m.publication.url }] : []));
  const wide = await hasNetworkWideScope(user.id);
  const generation = fresh ? { state: (fresh.status === "SUCCEEDED" ? "DONE" : fresh.status) as "PENDING" | "FAILED" | "DONE", error: fresh.status === "FAILED" ? plainAiFailure(fresh.errorMessage) : null } : null;
  const options = await db.mediaSite.findMany({
    where: { deletedAt: null, status: { not: "DISABLED" }, ...(wide ? {} : { mediaScopes: { some: { userId: user.id } } }) },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, domains: { where: { isActive: true, verificationStatus: "VERIFIED" }, orderBy: [{ isCanonical: "desc" }, { createdAt: "asc" }], select: { hostname: true }, take: 1 } },
  });
  return {
    id: blast.id, status, mode: (blast.contentMode as BlastMode | null) ?? null, createdAt: blast.createdAt.toISOString(), author: blast.createdBy,
    originalNarrative: blast.narrative, content, generation, media, links,
    canEdit: Boolean(blast.contentMode) && (blast.createdById === user.id || wide),
    canPublish: Boolean(blast.contentMode) && canPublishRole(user),
    availableMedia: options.map((o) => ({ id: o.id, name: o.displayName, hostname: o.domains[0]?.hostname ?? null })),
  };
}

// ---------------------------------------------------------------------------------------------
// Creating

export interface SharedContent {
  title: string; excerpt: string; body: string; seoTitle: string; metaDescription: string; tags: string[];
  imageBrief?: string; claimsUsed?: unknown; uncertainties?: unknown; suggestedCategory?: string;
}

/** One Article (plus its first version) per media, all with the same text. */
export async function createSharedArticles(
  tx: Prisma.TransactionClient,
  blast: { id: string; featuredAssetId: string | null; galleryAssetIds: string[] },
  media: { id: string; categories?: { id: string; name: string }[] }[],
  content: SharedContent,
  createdById: string,
  version: { changeType: "INITIAL_AI" | "MANUAL_EDIT"; summary: string; aiProvider?: string; aiModel?: string; promptVersion?: string },
) {
  const created: { id: string; mediaSiteId: string }[] = [];
  for (const site of media) {
    const slug = `${slugify(content.title)}-${site.id.slice(-6)}-${blast.id.slice(-6)}`.slice(0, 120);
    const category = content.suggestedCategory ? site.categories?.find((c) => c.name.toLowerCase() === content.suggestedCategory!.toLowerCase()) : undefined;
    const shared = {
      title: content.title, slug, excerpt: content.excerpt, body: content.body, seoTitle: content.seoTitle, metaDescription: content.metaDescription,
      tags: content.tags, imageBrief: content.imageBrief ?? "", claimsUsed: (content.claimsUsed ?? []) as Prisma.InputJsonValue, uncertainties: (content.uncertainties ?? []) as Prisma.InputJsonValue,
      featuredAssetId: blast.featuredAssetId, galleryAssetIds: blast.galleryAssetIds, categoryId: category?.id ?? null,
    };
    const article = await tx.article.create({ data: { ...shared, mediaSiteId: site.id, sourceBriefId: blast.id, createdById, status: "NEEDS_REVIEW", versionNumber: 1 } });
    await tx.articleVersion.create({ data: { ...shared, articleId: article.id, versionNumber: 1, changeType: version.changeType, changeSummary: version.summary, aiProvider: version.aiProvider, aiModel: version.aiModel, promptVersion: version.promptVersion, createdById } });
    created.push({ id: article.id, mediaSiteId: site.id });
  }
  return created;
}

export interface StartBlastInput { sourceBriefId: string; mode: BlastMode; styleSkillSlug?: string; styleNote?: string; featuredAssetId?: string; galleryAssetIds?: string[] }

/** Marks a brief as a blast. AS_WRITTEN creates the content now; AI returns a run id for the caller to execute in the background. */
export async function startBlast(user: User, input: StartBlastInput): Promise<{ runId: string | null }> {
  const brief = await db.sourceBrief.findUnique({ where: { id: input.sourceBriefId }, include: { mediaTargets: { include: { mediaSite: { select: { id: true, categories: { where: { isActive: true }, select: { id: true, name: true } } } } } } } });
  if (!brief || brief.archivedAt) throw new BlastError("Topik tidak ditemukan.", 404);
  if (brief.createdById !== user.id && !(await hasNetworkWideScope(user.id))) throw new BlastError("Topik tidak ditemukan.", 404);
  if (brief.contentMode) throw new BlastError("Berita ini sudah dimulai.", 409);
  const mediaIds = brief.mediaTargets.map((t) => t.mediaSiteId);
  if (!mediaIds.length) throw new BlastError("Pilih minimal satu media.", 400);
  for (const id of mediaIds) await requireMediaAccess(user.id, id);
  const ids = [input.featuredAssetId, ...(input.galleryAssetIds ?? [])].filter((x): x is string => Boolean(x));
  if (new Set(ids).size !== ids.length) throw new BlastError("Gambar yang sama dipilih dua kali.", 400);
  await accessibleAssets(user, ids, mediaIds);
  const featuredAssetId = input.featuredAssetId ?? null;
  const galleryAssetIds = input.galleryAssetIds ?? [];

  if (input.mode === "AS_WRITTEN") {
    const body = brief.narrative.trim();
    const title = brief.workingTitle.trim();
    if (title.length < 8) throw new BlastError("Judul terlalu pendek. Tulis minimal 8 karakter.", 400);
    if (body.length < 120) throw new BlastError("Narasi terlalu pendek untuk diterbitkan apa adanya. Tulis minimal 120 karakter, atau pilih AI.", 400);
    const excerpt = (body.split(/(?<=[.!?])\s+/)[0] ?? body).slice(0, 280).trim().padEnd(12, ".");
    await db.$transaction(async (tx) => {
      await tx.sourceBrief.update({ where: { id: brief.id }, data: { contentMode: "AS_WRITTEN", featuredAssetId, galleryAssetIds } });
      await createSharedArticles(tx, { id: brief.id, featuredAssetId, galleryAssetIds }, brief.mediaTargets.map((t) => t.mediaSite), { title, excerpt, body, seoTitle: title.slice(0, 180), metaDescription: excerpt.slice(0, 300), tags: [] }, user.id, { changeType: "MANUAL_EDIT", summary: "Ditulis operator, tanpa AI." });
      await tx.auditLog.create({ data: { actorUserId: user.id, action: "BLAST_CREATED", entityType: "SourceBrief", entityId: brief.id, metadata: { mode: "AS_WRITTEN", media: mediaIds.length } } });
    });
    return { runId: null };
  }

  const run = await db.$transaction(async (tx) => {
    await tx.sourceBrief.update({ where: { id: brief.id }, data: { contentMode: "AI", styleSkillSlug: input.styleSkillSlug || null, featuredAssetId, galleryAssetIds } });
    const created = await tx.aiGenerationRun.create({ data: { sourceBriefId: brief.id, mediaSiteId: null, operation: "GENERATE_ARTICLE", provider: process.env.AI_PROVIDER || "unconfigured", model: process.env.AI_MODEL || "unconfigured", promptVersion: "pending", status: "PENDING", inputHash: `${brief.id}:blast`, styleNote: input.styleNote?.trim() || null, styleSkillSlug: input.styleSkillSlug || null, createdById: user.id } });
    await tx.auditLog.create({ data: { actorUserId: user.id, action: "BLAST_CREATED", entityType: "SourceBrief", entityId: brief.id, metadata: { mode: "AI", media: mediaIds.length } } });
    return created;
  });
  return { runId: run.id };
}

// ---------------------------------------------------------------------------------------------
// Editing (before or after publishing)

const assetShape = (a: { secureUrl: string; altText: string; caption: string; credit: string; isAiGenerated: boolean; width: number; height: number }) => ({ secureUrl: a.secureUrl, altText: a.altText, caption: a.caption, credit: a.credit, isAiGenerated: a.isAiGenerated, width: a.width, height: a.height });

export async function editBlast(user: User, id: string, input: BlastEditInput, change?: { type: VersionChange; summary: string }) {
  const blast = await loadBlast(id);
  if (!blast) throw new BlastError("Berita tidak ditemukan.", 404);
  await assertCanSee(user, blast);
  if (!blast.contentMode) throw new BlastError("Berita lama ini tidak bisa diedit dari layar ini.", 409);
  if (blast.createdById !== user.id && !(await hasNetworkWideScope(user.id))) throw new AuthError("Hanya pengarang, admin, atau pemilik yang boleh mengedit.", 403);
  if (!blast.articles.length) throw new BlastError("Isi berita belum siap.", 409);
  const mediaIds = blast.mediaTargets.map((t) => t.mediaSiteId);
  for (const mid of mediaIds) await requireMediaAccess(user.id, mid);

  const nextFeatured = input.featuredAssetId === undefined ? undefined : input.featuredAssetId;
  const nextGallery = input.galleryAssetIds;
  const touched = [nextFeatured ?? undefined, ...(nextGallery ?? [])].filter((x): x is string => Boolean(x));
  if (nextFeatured !== undefined && nextFeatured !== null && nextGallery?.includes(nextFeatured)) throw new BlastError("Gambar utama tidak boleh dobel di galeri.", 400);
  await accessibleAssets(user, touched, mediaIds);

  const resolveAssets = async (featuredId: string | null, galleryIds: string[]) => {
    const ids = [featuredId, ...galleryIds].filter((x): x is string => Boolean(x));
    const rows = ids.length ? await db.asset.findMany({ where: { id: { in: ids } } }) : [];
    const by = new Map(rows.map((r) => [r.id, r]));
    return { featured: featuredId ? by.get(featuredId) ?? null : null, gallery: galleryIds.flatMap((g) => (by.get(g) ? [by.get(g)!] : [])) };
  };

  await db.$transaction(async (tx) => {
    for (const article of blast.articles) {
      const featuredAssetId = nextFeatured === undefined ? article.featuredAssetId : nextFeatured;
      const galleryAssetIds = nextGallery ?? article.galleryAssetIds;
      const fields = {
        title: input.title ?? article.title, excerpt: input.excerpt ?? article.excerpt, body: input.body ?? article.body,
        seoTitle: input.seoTitle ?? article.seoTitle, metaDescription: input.metaDescription ?? article.metaDescription, tags: input.tags ?? article.tags,
        featuredAssetId, galleryAssetIds,
      };
      const live = article.status === "PUBLISHED";
      const saved = await tx.article.updateMany({
        where: { id: article.id, versionNumber: article.versionNumber },
        data: { ...fields, versionNumber: { increment: 1 }, ...(live ? {} : { status: "NEEDS_REVIEW", approvedAt: null, approvedById: null }) },
      });
      if (saved.count !== 1) throw new BlastError("Berita baru saja diubah orang lain. Muat ulang halaman, lalu coba lagi.", 409);
      const version = await tx.articleVersion.create({ data: { articleId: article.id, versionNumber: article.versionNumber + 1, slug: article.slug, imageBrief: article.imageBrief, categoryId: article.categoryId, ...fields, changeType: change?.type ?? "MANUAL_EDIT", changeSummary: change?.summary ?? (live ? "Perbaikan setelah terbit." : "Disunting operator."), claimsUsed: article.claimsUsed as Prisma.InputJsonValue, uncertainties: article.uncertainties as Prisma.InputJsonValue, createdById: user.id } });
      if (live) {
        const { featured, gallery } = await resolveAssets(featuredAssetId, galleryAssetIds);
        for (const target of article.publicationTargets.filter((t) => t.status === "PUBLISHED")) {
          const current = await tx.publicationTarget.findUniqueOrThrow({ where: { id: target.id }, select: { approvedSnapshot: true } });
          const snapshot = { ...(current.approvedSnapshot as Record<string, unknown>), title: fields.title, excerpt: fields.excerpt, body: fields.body, seoTitle: fields.seoTitle, metaDescription: fields.metaDescription, tags: fields.tags, featuredAssetId, featuredAsset: featured ? assetShape(featured) : null, gallery: gallery.map(assetShape) };
          await tx.publicationTarget.update({ where: { id: target.id }, data: { approvedSnapshot: snapshot as Prisma.InputJsonValue, articleVersionId: version.id } });
          await tx.publicationAsset.deleteMany({ where: { publicationTargetId: target.id, role: { in: ["FEATURED", "GALLERY"] } } });
          if (featured) await tx.publicationAsset.create({ data: { publicationTargetId: target.id, assetId: featured.id, role: "FEATURED" } });
          for (const g of gallery) await tx.publicationAsset.create({ data: { publicationTargetId: target.id, assetId: g.id, role: "GALLERY" } });
        }
      } else {
        await tx.publicationTarget.updateMany({ where: { articleId: article.id, status: { in: ["QUEUED", "SCHEDULED"] } }, data: { status: "CANCELLED", lastErrorCode: "ARTICLE_REWORKED", lastErrorMessage: "Dibatalkan karena berita diedit sebelum terbit." } });
      }
      await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: article.mediaSiteId, action: live ? "BLAST_EDITED_LIVE" : "BLAST_EDITED", entityType: "Article", entityId: article.id, metadata: { versionNumber: article.versionNumber + 1 } } });
    }
    if (nextFeatured !== undefined || nextGallery) await tx.sourceBrief.update({ where: { id: blast.id }, data: { ...(nextFeatured !== undefined ? { featuredAssetId: nextFeatured } : {}), ...(nextGallery ? { galleryAssetIds: nextGallery } : {}) } });
  });
  return getBlastDetail(user, id);
}

/**
 * Rewrites the shared article from an operator instruction, keeping the brief's evidence rules.
 * The draft is NOT saved: it comes back for review, and becomes a new version only when the
 * operator presses "Simpan perubahan" (which goes through editBlast).
 */
export async function reviseBlast(user: User, id: string, instruction: string): Promise<{ draft: BlastDraftPreview; summary: string }> {
  const blast = await loadBlast(id);
  if (!blast) throw new BlastError("Berita tidak ditemukan.", 404);
  await assertCanSee(user, blast);
  if (blast.createdById !== user.id && !(await hasNetworkWideScope(user.id))) throw new AuthError("Hanya pengarang, admin, atau pemilik yang boleh meminta revisi.", 403);
  if (!blast.contentMode) throw new BlastError("Berita lama ini tidak bisa direvisi dari layar ini.", 409);
  if (!blast.articles.length) throw new BlastError("Isi berita belum siap.", 409);
  for (const t of blast.mediaTargets) await requireMediaAccess(user.id, t.mediaSiteId);

  const article = blast.articles[0];
  const skill = blast.styleSkillSlug ? await db.writingSkill.findFirst({ where: { slug: blast.styleSkillSlug, isActive: true }, select: { promptGuidance: true } }) : null;
  const lastRun = await db.aiGenerationRun.findFirst({ where: { sourceBriefId: blast.id, mediaSiteId: null }, orderBy: { createdAt: "desc" }, select: { styleNote: true } });
  const guidance = [skill?.promptGuidance ?? "", lastRun?.styleNote ? `Catatan gaya khusus dari operator untuk naskah ini: ${lastRun.styleNote}` : ""].filter(Boolean).join("\n\n");
  const ai = await aiConfiguration();
  const base = {
    sourceBriefId: blast.id, articleId: article.id, mediaSiteId: null, operation: "REVISE_ARTICLE" as const,
    provider: ai.provider || "unconfigured", model: ai.model || "unconfigured", promptVersion: PROMPT_VERSION,
    inputHash: `${blast.id}:revise:${article.versionNumber}`, createdById: user.id,
  };

  let result: Awaited<ReturnType<typeof generateDraft>>;
  try {
    result = await generateDraft(
      {
        workingTitle: blast.workingTitle,
        narrative: blast.narrative,
        editorNotes: blast.editorNotes,
        sourceSummary: blast.sourceSummary,
        references: blast.references.map(({ id: refId, url, title, publisherName, excerpt, retrievalStatus }) => ({ id: refId, url, title, publisherName, excerpt, retrievalStatus })),
        facts: blast.facts.map(({ id: factId, claimText, supportStatus, evidenceNote, sourceReferenceId }) => ({ id: factId, claimText, supportStatus, evidenceNote, sourceReferenceId })),
      },
      { displayName: "Berita", profile: GENERIC_BLAST_PROFILE, categories: [] },
      instruction,
      { title: article.title, excerpt: article.excerpt, body: article.body, seoTitle: article.seoTitle, metaDescription: article.metaDescription, tags: article.tags, imageBrief: article.imageBrief },
      guidance,
    );
  } catch (error) {
    const reason = error instanceof DraftEvidenceValidationError
      ? "Model AI tetap menyebut bukti yang tidak tersedia. Tambahkan fakta yang terverifikasi di topik, atau perjelas instruksinya."
      : error instanceof IntegrationNotConfigured
        ? error.message
        : error instanceof Error && /timeout|abort/i.test(`${error.name} ${error.message}`)
          ? "Penyedia AI terlalu lama menjawab. Coba lagi dengan instruksi yang lebih pendek."
          : plainAiFailure(error instanceof Error ? error.message : null);
    await db.aiGenerationRun.create({ data: { ...base, status: "FAILED", errorCode: error instanceof DraftEvidenceValidationError ? "EVIDENCE_VALIDATION_FAILED" : "REVISION_FAILED", errorMessage: (error instanceof Error ? error.message : "Unknown revision error").slice(0, 1000), completedAt: new Date() } });
    throw new BlastError(reason, 502);
  }

  const draft = result.draft;
  const preview: BlastDraftPreview = { title: draft.title, excerpt: draft.excerpt, body: draft.body, seoTitle: draft.seoTitle, metaDescription: draft.metaDescription, tags: draft.tags };
  await db.aiGenerationRun.create({ data: { ...base, status: "SUCCEEDED", provider: result.provider, model: result.model || "unknown", promptVersion: result.promptVersion, inputHash: result.inputHash, outputSummary: draft.title, latencyMs: result.latencyMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens, completedAt: new Date() } });
  return { draft: preview, summary: result.changeSummary };
}

/** Neutral profile for blast revisions: the brief carries the editorial material, not a single media brand. */
const GENERIC_BLAST_PROFILE = { niche: "Berita umum", targetAudience: "Masyarakat umum", editorialMission: "", toneGuidelines: "Netral, jelas, dan mudah dipahami", styleGuidelines: "", language: "Indonesian", preferredWordCountMin: 350, preferredWordCountMax: 700 };

// ---------------------------------------------------------------------------------------------
// Publishing

export interface SkippedMedia { mediaName: string; reason: string }

/** Approves the content (the person pressing the button is the human decision) and publishes to every media that can take it. */
export async function publishBlast(user: User, id: string, scheduledAt: Date | null): Promise<{ skipped: SkippedMedia[] }> {
  const blast = await loadBlast(id);
  if (!blast) throw new BlastError("Berita tidak ditemukan.", 404);
  await assertCanSee(user, blast);
  if (!blast.contentMode) throw new BlastError("Berita lama ini tidak bisa diterbitkan dari layar ini.", 409);
  if (!canPublishRole(user)) throw new AuthError("Peran Anda tidak boleh menerbitkan berita.", 403);
  if (!blast.articles.length) throw new BlastError("Isi berita belum siap.", 409);
  if (scheduledAt && scheduledAt.getTime() <= Date.now()) throw new BlastError("Waktu jadwal harus di masa depan.", 400);
  const rows = mediaRows(blast);
  const skipped: SkippedMedia[] = [];
  const queued: { id: string; idempotencyKey: string; attemptCount: number }[] = [];
  const evidence = editorialEvidenceSnapshotSchema.parse(createEditorialEvidenceSnapshot(blast));
  const author = blast.createdBy;

  for (const article of blast.articles) {
    const row = rows.find((r) => r.mediaSiteId === article.mediaSiteId);
    const media = blast.mediaTargets.find((t) => t.mediaSiteId === article.mediaSiteId)!.mediaSite;
    if (!row || !row.canPublish) { skipped.push({ mediaName: media.displayName, reason: row?.problem ?? "Media tidak ditemukan." }); continue; }
    await requireMediaAccess(user.id, article.mediaSiteId);
    if (!canSelfApprove(user) && article.createdById === user.id) { skipped.push({ mediaName: media.displayName, reason: "Anda tidak boleh menyetujui berita yang Anda tulis sendiri." }); continue; }
    if (article.status === "PUBLISHED" && !article.publicationTargets.some((t) => t.status === "FAILED")) continue;

    const version = await db.articleVersion.findUniqueOrThrow({ where: { articleId_versionNumber: { articleId: article.id, versionNumber: article.versionNumber } } });
    if (article.status !== "PUBLISHED" && article.status !== "APPROVED") {
      await db.$transaction(async (tx) => {
        await tx.article.update({ where: { id: article.id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id } });
        await tx.editorialReview.create({ data: { articleId: article.id, articleVersionId: version.id, reviewerId: user.id, decision: "APPROVED", notes: "Disetujui saat diterbitkan.", evidenceSnapshot: evidence } });
        await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: article.mediaSiteId, action: "ARTICLE_APPROVED", entityType: "Article", entityId: article.id, metadata: { via: "blast" } } });
      });
    }
    const assetIds = [version.featuredAssetId, ...version.galleryAssetIds].filter((x): x is string => Boolean(x));
    const assets = assetIds.length ? await db.asset.findMany({ where: { id: { in: assetIds } } }) : [];
    const byId = new Map(assets.map((a) => [a.id, a]));
    const featured = version.featuredAssetId ? byId.get(version.featuredAssetId) ?? null : null;
    const gallery = version.galleryAssetIds.flatMap((g) => (byId.get(g) ? [byId.get(g)!] : []));
    const aiAssisted = (await db.articleVersion.count({ where: { articleId: article.id, changeType: { in: ["INITIAL_AI", "AI_REVISION"] } } })) > 0;

    for (const domain of media.domains) {
      const key = `${article.id}:${version.versionNumber}:${domain.id}`;
      const existing = await db.publicationTarget.findUnique({ where: { idempotencyKey: key } });
      if (existing?.status === "PUBLISHED" || existing?.status === "PUBLISHING") continue;
      const snapshot = {
        aiAssisted, authorName: author.name, title: version.title, slug: version.slug, excerpt: version.excerpt, body: version.body, seoTitle: version.seoTitle, metaDescription: version.metaDescription, tags: version.tags,
        imageBrief: version.imageBrief, claimsUsed: version.claimsUsed, uncertainties: version.uncertainties, featuredAssetId: version.featuredAssetId,
        featuredAsset: featured ? assetShape(featured) : null, gallery: gallery.map(assetShape), sourceReferences: evidence.sourceReferences, sourceFacts: evidence.sourceFacts,
      } as unknown as Prisma.InputJsonValue;
      const status = scheduledAt ? "SCHEDULED" : "QUEUED";
      const target = await db.$transaction(async (tx) => {
        const t = existing
          ? await tx.publicationTarget.update({ where: { id: existing.id }, data: { status, scheduledAt, approvedSnapshot: snapshot, lastErrorCode: null, lastErrorMessage: null } })
          : await tx.publicationTarget.create({ data: { articleId: article.id, mediaSiteId: article.mediaSiteId, domainId: domain.id, articleVersionId: version.id, approvedSnapshot: snapshot, status, scheduledAt, idempotencyKey: key, createdById: user.id } });
        await tx.publicationAsset.deleteMany({ where: { publicationTargetId: t.id, role: { in: ["FEATURED", "GALLERY"] } } });
        if (featured) await tx.publicationAsset.create({ data: { publicationTargetId: t.id, assetId: featured.id, role: "FEATURED" } });
        for (const g of gallery) await tx.publicationAsset.create({ data: { publicationTargetId: t.id, assetId: g.id, role: "GALLERY" } });
        await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: article.mediaSiteId, action: scheduledAt ? "ARTICLE_SCHEDULED" : "ARTICLE_PUBLISH_QUEUED", entityType: "PublicationTarget", entityId: t.id, metadata: { via: "blast", hostname: domain.hostname, scheduledAt } } });
        return t;
      });
      queued.push({ id: target.id, idempotencyKey: target.idempotencyKey, attemptCount: target.attemptCount });
    }
  }

  const queue = publishingQueue();
  if (queue) {
    for (const t of queued) await queue.add("publish", { targetId: t.id }, { jobId: `${t.idempotencyKey.replace(/[^a-zA-Z0-9:_-]/g, "_")}_${t.attemptCount}`, ...(scheduledAt ? { delay: Math.max(0, scheduledAt.getTime() - Date.now()) } : {}), attempts: 5, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 1000, removeOnFail: 1000 });
  } else if (!scheduledAt) {
    await Promise.all(queued.map(async (t) => { try { await publishTarget(t.id); } catch { /* each target stores its own error and attempt */ } }));
  }
  return { skipped };
}

export async function unpublishBlast(user: User, id: string) {
  const blast = await loadBlast(id);
  if (!blast) throw new BlastError("Berita tidak ditemukan.", 404);
  await assertCanSee(user, blast);
  if (!canPublishRole(user)) throw new AuthError("Peran Anda tidak boleh menarik berita.", 403);
  for (const t of blast.mediaTargets) await requireMediaAccess(user.id, t.mediaSiteId);
  await db.$transaction(async (tx) => {
    for (const article of blast.articles) {
      const live = await tx.publicationTarget.updateMany({ where: { articleId: article.id, status: "PUBLISHED" }, data: { status: "CANCELLED", lastErrorCode: "UNPUBLISHED", lastErrorMessage: `Ditarik dari publikasi oleh ${user.name}.` } });
      await tx.publicationTarget.updateMany({ where: { articleId: article.id, status: { in: ["QUEUED", "SCHEDULED"] } }, data: { status: "CANCELLED", lastErrorCode: "UNPUBLISHED", lastErrorMessage: `Dibatalkan oleh ${user.name}.` } });
      if (article.status === "PUBLISHED") await tx.article.update({ where: { id: article.id }, data: { status: "APPROVED", publishedAt: null } });
      if (live.count) await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: article.mediaSiteId, action: "ARTICLE_UNPUBLISHED", entityType: "Article", entityId: article.id, metadata: { via: "blast", targets: live.count } } });
    }
  });
  return getBlastDetail(user, id);
}

/** Takes every live or waiting copy of these articles off the public sites and archives them. Runs inside a transaction. */
async function withdrawAndArchive(tx: Prisma.TransactionClient, user: User, articles: { id: string; mediaSiteId: string }[], reason: string) {
  const now = new Date();
  for (const article of articles) {
    const live = await tx.publicationTarget.updateMany({
      where: { articleId: article.id, status: { in: ["PUBLISHED", "QUEUED", "SCHEDULED", "PUBLISHING", "FAILED"] } },
      data: { status: "CANCELLED", lastErrorCode: "REMOVED", lastErrorMessage: `${reason} oleh ${user.name}.` },
    });
    await tx.article.update({ where: { id: article.id }, data: { archivedAt: now, status: "ARCHIVED", publishedAt: null } });
    await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: article.mediaSiteId, action: "ARTICLE_REMOVED", entityType: "Article", entityId: article.id, metadata: { via: "blast", reason, withdrawn: live.count } } });
  }
}

/**
 * Sets which media carry the berita. Unchecked media lose it: the story is taken off their site and archived.
 * Newly checked media get the current text; if the berita is already live elsewhere it goes live there too.
 * A media removed earlier and checked again gets its old article back (same address), updated to the current text.
 */
export async function setBlastMedia(user: User, id: string, mediaSiteIds: string[]): Promise<BlastMediaChange> {
  const blast = await loadBlast(id);
  if (!blast) throw new BlastError("Berita tidak ditemukan.", 404);
  await assertCanSee(user, blast);
  if (!blast.contentMode) throw new BlastError("Berita lama ini tidak bisa diatur dari layar ini.", 409);
  if (blast.createdById !== user.id && !(await hasNetworkWideScope(user.id))) throw new AuthError("Hanya pengarang, admin, atau pemilik yang boleh mengatur media berita ini.", 403);
  const source = blast.articles[0];
  if (!source) throw new BlastError("Isi berita belum siap. Tunggu sampai beritanya selesai ditulis.", 409);
  const next = [...new Set(mediaSiteIds)];
  if (!next.length) throw new BlastError("Pilih minimal satu media. Untuk menghapus berita dari semua media, pakai Hapus berita.", 400);
  for (const mid of next) await requireMediaAccess(user.id, mid);

  const current = blast.mediaTargets.map((t) => t.mediaSiteId);
  const added = next.filter((mid) => !current.includes(mid));
  const removed = current.filter((mid) => !next.includes(mid));
  const removedArticles = blast.articles.filter((a) => removed.includes(a.mediaSiteId));
  if (removedArticles.some((a) => a.status === "PUBLISHED") && !canPublishRole(user)) throw new AuthError("Peran Anda tidak boleh menarik berita yang sudah terbit.", 403);
  const wasLive = blast.articles.some((a) => a.status === "PUBLISHED" && !removed.includes(a.mediaSiteId));
  const keep = blast.articles.find((a) => !removed.includes(a.mediaSiteId)) ?? source;
  const categoryName = keep.categoryId ? (await db.category.findUnique({ where: { id: keep.categoryId }, select: { name: true } }))?.name : undefined;
  const newSites = added.length ? await db.mediaSite.findMany({ where: { id: { in: added }, deletedAt: null }, select: { id: true, categories: { where: { isActive: true }, select: { id: true, name: true } } } }) : [];

  await db.$transaction(async (tx) => {
    await withdrawAndArchive(tx, user, removedArticles, "Media dilepas dari berita");
    if (removed.length) await tx.sourceBriefMedia.deleteMany({ where: { sourceBriefId: blast.id, mediaSiteId: { in: removed } } });

    const fresh: typeof newSites = [];
    for (const site of newSites) {
      await tx.sourceBriefMedia.create({ data: { sourceBriefId: blast.id, mediaSiteId: site.id } });
      const old = await tx.article.findFirst({ where: { sourceBriefId: blast.id, mediaSiteId: site.id, archivedAt: { not: null } }, orderBy: { updatedAt: "desc" } });
      if (!old) { fresh.push(site); continue; }
      const fields = { title: keep.title, excerpt: keep.excerpt, body: keep.body, seoTitle: keep.seoTitle, metaDescription: keep.metaDescription, tags: keep.tags, featuredAssetId: keep.featuredAssetId, galleryAssetIds: keep.galleryAssetIds };
      await tx.article.update({ where: { id: old.id }, data: { ...fields, archivedAt: null, status: "NEEDS_REVIEW", approvedAt: null, approvedById: null, versionNumber: { increment: 1 } } });
      await tx.articleVersion.create({ data: { ...fields, articleId: old.id, versionNumber: old.versionNumber + 1, slug: old.slug, imageBrief: keep.imageBrief, categoryId: old.categoryId, claimsUsed: keep.claimsUsed as Prisma.InputJsonValue, uncertainties: keep.uncertainties as Prisma.InputJsonValue, changeType: "MANUAL_EDIT", changeSummary: "Media dipasang lagi ke berita.", createdById: user.id } });
    }
    // The writer of the berita stays the author on every media, so "from the same writer" lists stay correct.
    await createSharedArticles(tx, { id: blast.id, featuredAssetId: keep.featuredAssetId, galleryAssetIds: keep.galleryAssetIds }, fresh,
      { title: keep.title, excerpt: keep.excerpt, body: keep.body, seoTitle: keep.seoTitle, metaDescription: keep.metaDescription, tags: keep.tags, imageBrief: keep.imageBrief, claimsUsed: keep.claimsUsed, uncertainties: keep.uncertainties, suggestedCategory: categoryName },
      blast.createdById, { changeType: "MANUAL_EDIT", summary: "Media ditambahkan ke berita." });
    await tx.auditLog.create({ data: { actorUserId: user.id, action: "BLAST_MEDIA_CHANGED", entityType: "SourceBrief", entityId: blast.id, metadata: { added, removed } } });
  });

  let skipped: SkippedMedia[] = [];
  if (added.length && wasLive) {
    if (canPublishRole(user)) skipped = (await publishBlast(user, id, null)).skipped;
    else skipped = [{ mediaName: "Media baru", reason: "Peran Anda tidak boleh menerbitkan. Minta admin menekan Terbitkan." }];
  }
  return { detail: await getBlastDetail(user, id), added: added.length, removed: removed.length, skipped };
}

/** Deletes a berita: takes it off every media, then hides it from the list. Versions and the audit trail stay. */
export async function deleteBlast(user: User, id: string) {
  const blast = await loadBlast(id);
  if (!blast) throw new BlastError("Berita tidak ditemukan.", 404);
  await assertCanSee(user, blast);
  if (blast.createdById !== user.id && !(await hasNetworkWideScope(user.id))) throw new AuthError("Hanya pengarang, admin, atau pemilik yang boleh menghapus berita ini.", 403);
  if (blast.articles.some((a) => a.status === "PUBLISHED") && !canPublishRole(user)) throw new AuthError("Berita ini sudah terbit. Peran Anda tidak boleh menariknya, jadi minta admin yang menghapus.", 403);
  await db.$transaction(async (tx) => {
    await withdrawAndArchive(tx, user, blast.articles, "Berita dihapus");
    await tx.sourceBrief.update({ where: { id: blast.id }, data: { archivedAt: new Date() } });
    await tx.auditLog.create({ data: { actorUserId: user.id, action: "BLAST_DELETED", entityType: "SourceBrief", entityId: blast.id, metadata: { articles: blast.articles.length } } });
  });
}

/**
 * Queues a new generation run for a FAILED blast, keeping the same brief, style, and assets.
 * Does NOT delete existing articles so any partial content is preserved.
 * Returns the new run id for the caller to execute via after().
 */
export async function retryBlast(user: User, id: string): Promise<{ runId: string }> {
  const blast = await loadBlast(id);
  if (!blast) throw new BlastError("Berita tidak ditemukan.", 404);
  await assertCanSee(user, blast);
  if (!blast.contentMode) throw new BlastError("Berita ini belum pernah diproses AI.", 409);
  if (blast.contentMode !== "AI") throw new BlastError("Berita ini ditulis langsung, bukan lewat AI.", 409);
  for (const t of blast.mediaTargets) await requireMediaAccess(user.id, t.mediaSiteId);
  const lastRun = await db.aiGenerationRun.findFirst({ where: { sourceBriefId: blast.id, mediaSiteId: null }, orderBy: { createdAt: "desc" }, select: { styleNote: true, styleSkillSlug: true } });
  const ai = await aiConfiguration();
  const run = await db.aiGenerationRun.create({ data: {
    sourceBriefId: blast.id,
    mediaSiteId: null,
    operation: "GENERATE_ARTICLE",
    provider: ai.provider || process.env.AI_PROVIDER || "unconfigured",
    model: ai.model || process.env.AI_MODEL || "unconfigured",
    promptVersion: "pending",
    status: "PENDING",
    inputHash: `${blast.id}:blast:retry:${Date.now()}`,
    styleNote: lastRun?.styleNote ?? null,
    styleSkillSlug: blast.styleSkillSlug ?? lastRun?.styleSkillSlug ?? null,
    createdById: user.id,
  } });
  await db.auditLog.create({ data: { actorUserId: user.id, action: "BLAST_RETRY", entityType: "SourceBrief", entityId: blast.id, metadata: { runId: run.id } } });
  return { runId: run.id };
}
