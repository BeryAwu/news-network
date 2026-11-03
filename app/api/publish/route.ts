import { z } from "zod";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { db } from "@/lib/db";
import { audit, hasNetworkWideScope, requireMediaAccess, requireRole, requireSameOrigin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { publishTarget } from "@/lib/publishing";
import { editorialEvidenceSnapshotSchema } from "@/lib/editorial-evidence";
const publishAction = z.object({ action: z.literal("publish"), articleIds: z.array(z.string().min(1)).min(1).max(100), scheduledAt: z.string().datetime().optional() });
const retryAction = z.object({ action: z.literal("retry"), targetIds: z.array(z.string().min(1)).min(1).max(100) });
const inputSchema = z.discriminatedUnion("action", [publishAction, retryAction]);
let queue: Queue | null = null;
function publishingQueue() { if (!process.env.REDIS_URL) return null; if (!queue) { const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true }); queue = new Queue("news-publishing", { connection }); } return queue; }
export async function GET() { try { const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER", "PUBLISHER"); const all = await hasNetworkWideScope(user.id); const targets = await db.publicationTarget.findMany({ where: all ? {} : { mediaSite: { mediaScopes: { some: { userId: user.id } } } }, include: { domain: { select: { hostname: true } }, mediaSite: { select: { id: true, displayName: true, slug: true, domains: { where: { isCanonical: true, isActive: true, verificationStatus: "VERIFIED" } } } }, article: { select: { id: true, title: true, slug: true, status: true } }, attempts: { orderBy: { attemptNumber: "desc" }, take: 3 } }, orderBy: { createdAt: "desc" } }); return Response.json(targets); } catch (e) { return jsonError(e); } }
export async function POST(request: Request) { try { requireSameOrigin(request); const input = inputSchema.parse(await request.json()); const user = await requireRole("OWNER", "ADMIN", "PUBLISHER");
if (input.action === "publish") { const articles = await db.article.findMany({ where: { id: { in: input.articleIds }, status: "APPROVED", archivedAt: null }, include: { mediaSite: { include: { domains: { where: { isActive: true, verificationStatus: "VERIFIED" } } } }, versions: true, reviews: { where: { decision: "APPROVED" }, orderBy: { createdAt: "desc" } } }, }); if (articles.length !== new Set(input.articleIds).size) return Response.json({ error: "Every selected article must be approved and eligible. No publication targets were created." }, { status: 409 }); const approvalEvidence = new Map<string, z.infer<typeof editorialEvidenceSnapshotSchema>>(); for (const article of articles) {
  await requireMediaAccess(user.id, article.mediaSiteId);
  if (!article.mediaSite.domains.some((domain) => domain.isCanonical)) return Response.json({ error: `Media ${article.mediaSite.displayName} requires an active verified canonical domain before publishing.` }, { status: 409 });
  const version = article.versions.find((item) => item.versionNumber === article.versionNumber);
  const approval = version && article.reviews.find((review) => review.decision === "APPROVED" && review.articleVersionId === version.id);
  if (!version || !approval) return Response.json({ error: `Article ${article.title} has no reviewer approval for its current version. No targets were created.` }, { status: 409 });
  const evidence = editorialEvidenceSnapshotSchema.safeParse(approval.evidenceSnapshot);
  if (!evidence.success) return Response.json({ error: `Article ${article.title} has invalid approval evidence. No targets were created.` }, { status: 409 });
  approvalEvidence.set(version.id, evidence.data);
}
const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null; if (scheduledAt && scheduledAt.getTime() <= Date.now()) return Response.json({ error: "Scheduled time must be in the future." }, { status: 400 });
const created = await db.$transaction(async (tx) => {
  const targets: { id: string; idempotencyKey: string; status: string; attemptCount: number }[] = [];
  for (const article of articles) {
    const version = article.versions.find((item) => item.versionNumber === article.versionNumber);
    if (!version) throw new Error(`Missing current article version for ${article.id}.`);
    for (const domain of article.mediaSite.domains) {
      const key = `${article.id}:${version.versionNumber}:${domain.id}`;
      const existing = await tx.publicationTarget.findUnique({ where: { idempotencyKey: key } });
      if (existing?.status === "PUBLISHED") { targets.push(existing); continue; }
      const evidence = approvalEvidence.get(version.id);
      if (!evidence) throw new Error(`Missing validated approval evidence for article version ${version.id}.`);
      const snapshot = { title: version.title, slug: version.slug, excerpt: version.excerpt, body: version.body, seoTitle: version.seoTitle, metaDescription: version.metaDescription, tags: version.tags, imageBrief: version.imageBrief, claimsUsed: version.claimsUsed, uncertainties: version.uncertainties, featuredAssetId: version.featuredAssetId, sourceReferences: evidence.sourceReferences, sourceFacts: evidence.sourceFacts };
      const target = existing
        ? await tx.publicationTarget.update({ where: { id: existing.id }, data: { status: scheduledAt ? "SCHEDULED" : "QUEUED", scheduledAt, approvedSnapshot: snapshot, lastErrorCode: null, lastErrorMessage: null } })
        : await tx.publicationTarget.create({ data: { articleId: article.id, mediaSiteId: article.mediaSiteId, domainId: domain.id, articleVersionId: version.id, approvedSnapshot: snapshot, status: scheduledAt ? "SCHEDULED" : "QUEUED", scheduledAt, idempotencyKey: key, createdById: user.id } });
      if (version.featuredAssetId) await tx.publicationAsset.upsert({ where: { publicationTargetId_assetId_role: { publicationTargetId: target.id, assetId: version.featuredAssetId, role: "FEATURED" } }, create: { publicationTargetId: target.id, assetId: version.featuredAssetId, role: "FEATURED" }, update: {} });
      targets.push(target);
      await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: article.mediaSiteId, action: scheduledAt ? "ARTICLE_SCHEDULED" : "ARTICLE_PUBLISH_QUEUED", entityType: "PublicationTarget", entityId: target.id, metadata: { idempotencyKey: key, scheduledAt, hostname: domain.hostname } } });
    }
  }
  return targets;
});
const pendingTargets = created.filter((target) => target.status !== "PUBLISHED");
const jobQueue = publishingQueue();
if (jobQueue) {
  for (const target of pendingTargets) await jobQueue.add("publish", { targetId: target.id }, { jobId: `${target.idempotencyKey.replace(/[^a-zA-Z0-9:_-]/g, "_")}_${target.attemptCount}`, ...(scheduledAt ? { delay: Math.max(0, scheduledAt.getTime() - Date.now()) } : {}), attempts: 5, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 1000, removeOnFail: 1000 });
} else if (!scheduledAt) {
  await Promise.all(pendingTargets.map(async (target) => { try { await publishTarget(target.id); } catch { /* each target persists its own error and attempt */ } }));
}
return Response.json({ targets: pendingTargets, alreadyPublishedCount: created.length - pendingTargets.length, queueMode: jobQueue ? "bullmq" : scheduledAt ? "scheduled-needs-worker" : "inline" }, { status: 201 }); }
const targets = await db.publicationTarget.findMany({ where: { id: { in: input.targetIds }, status: "FAILED" }, include: { article: true } }); if (targets.length !== new Set(input.targetIds).size) return Response.json({ error: "Every selected target must exist and have failed." }, { status: 409 }); for (const target of targets) await requireMediaAccess(user.id, target.mediaSiteId); const retried = await Promise.all(targets.map(async (target) => { await db.publicationTarget.update({ where: { id: target.id }, data: { status: "QUEUED", lastErrorCode: null, lastErrorMessage: null } }); await audit(user.id, "ARTICLE_PUBLISH_RETRIED", "PublicationTarget", target.id, target.mediaSiteId, { previousErrorCode: target.lastErrorCode }); if (process.env.REDIS_URL) { await publishingQueue()!.add("publish", { targetId: target.id }, { jobId: `${target.idempotencyKey.replace(/[^a-zA-Z0-9:_-]/g, "_")}_retry_${target.attemptCount + 1}`, attempts: 5, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 1000, removeOnFail: 1000 }); return { targetId: target.id, status: "QUEUED" }; } try { await publishTarget(target.id); return { targetId: target.id, status: "PUBLISHED" }; } catch (error) { return { targetId: target.id, status: "FAILED", error: error instanceof Error ? error.message : "Publishing failed." }; } })); return Response.json({ retried });
} catch (e) { return jsonError(e); } }
