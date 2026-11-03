import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { z } from "zod";

export class PublishError extends Error { constructor(message: string, public readonly code: string, public readonly retryable: boolean) { super(message); } }
export async function publishTarget(targetId: string) {
  const target = await db.publicationTarget.findUnique({ where: { id: targetId }, include: { article: true, articleVersion: true, domain: true, mediaSite: true, assets: { where: { role: "FEATURED" }, include: { asset: true } } } });
  if (!target) throw new PublishError("Publication target not found.", "NOT_FOUND", false);
  const snapshot = z.object({ title: z.string(), slug: z.string(), excerpt: z.string(), body: z.string(), seoTitle: z.string(), metaDescription: z.string(), tags: z.array(z.string()), imageBrief: z.string(), claimsUsed: z.unknown(), uncertainties: z.unknown(), featuredAssetId: z.string().nullable() }).parse(target.approvedSnapshot);
    if (target.status === "PUBLISHED") return target;
  if (target.scheduledAt && target.scheduledAt.getTime() > Date.now()) return target;
  const correlationId = randomUUID();
  const claimed = await db.publicationTarget.updateMany({ where: { id: target.id, status: { in: ["QUEUED", "SCHEDULED", "FAILED"] }, attemptCount: target.attemptCount }, data: { status: "PUBLISHING", attemptCount: { increment: 1 }, lastErrorCode: null, lastErrorMessage: null } });
  if (claimed.count !== 1) return db.publicationTarget.findUniqueOrThrow({ where: { id: target.id } });
  const attemptNumber = target.attemptCount + 1;
  await db.publicationAttempt.create({ data: { publicationTargetId: target.id, attemptNumber, resultStatus: "FAILED", correlationId } });
  try {
    if (!target.domain) throw new PublishError("Publication domain is missing.", "DOMAIN_NOT_READY", false);
    if (target.article.status === "REJECTED" || target.article.status === "ARCHIVED") throw new PublishError("Rejected or archived articles cannot be published.", "ARTICLE_INELIGIBLE", false);
    if (target.article.versionNumber !== target.articleVersion.versionNumber || !target.article.approvedAt) throw new PublishError("The approved article version changed before delivery; request a fresh editorial review.", "ARTICLE_VERSION_NOT_APPROVED", false);
    const domain = target.domain;
    if (!domain.isActive || domain.verificationStatus !== "VERIFIED" || domain.mediaSiteId !== target.mediaSiteId) throw new PublishError("Publication domain is no longer active and verified for this media.", "DOMAIN_NOT_READY", false);
    const baseUrl = `https://${domain.hostname}`;
    const articleUrl = `${baseUrl.replace(/\/$/, "")}/articles/${snapshot.slug}`;
    const result = await db.$transaction(async (tx) => {
      const attempt = await tx.publicationAttempt.update({ where: { publicationTargetId_attemptNumber: { publicationTargetId: target.id, attemptNumber } }, data: { finishedAt: new Date(), resultStatus: "SUCCEEDED", httpStatus: 200, responseSummary: "Approved snapshot committed to the shared host-resolved Next.js renderer." } });
      const updated = await tx.publicationTarget.update({ where: { id: target.id }, data: { status: "PUBLISHED", publishedAt: new Date(), remoteArticleId: target.article.id, remoteUrl: articleUrl } });
      await tx.article.updateMany({ where: { id: target.articleId, versionNumber: target.articleVersion.versionNumber }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: target.createdById, mediaSiteId: target.mediaSiteId, action: "ARTICLE_PUBLISHED", entityType: "PublicationTarget", entityId: target.id, metadata: { correlationId, attemptNumber, hostname: domain.hostname, remoteUrl: articleUrl, articleVersionId: target.articleVersionId } } });
      return { attempt, updated };
    });
    return result.updated;
  } catch (error) {
    const publishError = error instanceof PublishError ? error : new PublishError(error instanceof Error ? error.message : "Publishing failed.", "PUBLISH_FAILED", true);
    await db.$transaction(async (tx) => {
      await tx.publicationAttempt.update({ where: { publicationTargetId_attemptNumber: { publicationTargetId: target.id, attemptNumber } }, data: { finishedAt: new Date(), resultStatus: "FAILED", httpStatus: null, errorCode: publishError.code, errorMessage: publishError.message, responseSummary: "Publishing adapter reported a failure." } });
      await tx.publicationTarget.update({ where: { id: target.id }, data: { status: "FAILED", lastErrorCode: publishError.code, lastErrorMessage: publishError.message } });
      const otherTargets = await tx.publicationTarget.count({ where: { articleId: target.articleId, id: { not: target.id }, status: "PUBLISHED" } });
      if (otherTargets === 0) await tx.article.updateMany({ where: { id: target.articleId, status: { not: "PUBLISHED" } }, data: { status: "PUBLISH_FAILED" } });
      await tx.auditLog.create({ data: { actorUserId: target.createdById, mediaSiteId: target.mediaSiteId, action: "ARTICLE_PUBLISH_FAILED", entityType: "PublicationTarget", entityId: target.id, metadata: { correlationId, attemptNumber, errorCode: publishError.code } } });
    });
    throw publishError;
  }
}
