import { z } from "zod";
import { db } from "@/lib/db";
import { audit, hasNetworkWideScope, requireMediaAccess, requireRole, requireSameOrigin } from "@/lib/auth";
import { boundedPage, jsonError } from "@/lib/http";
import { fetchReference } from "@/lib/ingest";
import { rateLimit } from "@/lib/rate-limit";
const briefInput = z.object({ workingTitle: z.string().min(5).max(200), narrative: z.string().max(20000).default(""), editorNotes: z.string().max(5000).default(""), references: z.array(z.string().max(2000)).max(10).default([]), mediaSiteIds: z.array(z.string().min(1)).min(1).max(20) });
const updateSchema = z.object({ action: z.enum(["edit", "archive"]), briefId: z.string().min(1), workingTitle: z.string().min(5).max(200).optional(), narrative: z.string().max(20000).optional(), editorNotes: z.string().max(5000).optional() });
const referenceSchema = z.object({ action: z.enum(["add-reference", "remove-reference"]), briefId: z.string().min(1), referenceId: z.string().optional(), url: z.string().url().max(2000).optional() });
export async function GET(request: Request) {
  try {
    const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER", "PUBLISHER");
    const params = new URL(request.url).searchParams;
    const page = boundedPage(params.get("page"));
    const isOwner = await hasNetworkWideScope(user.id);
    const briefs = await db.sourceBrief.findMany({
      where: {
        archivedAt: null,
        ...(isOwner ? {} : { mediaTargets: { some: { mediaSite: { mediaScopes: { some: { userId: user.id } } } } } })
      },
      include: { references: true, facts: { include: { sourceReference: { select: { id: true, url: true, title: true } } }, orderBy: { createdAt: "asc" } }, mediaTargets: { include: { mediaSite: { select: { id: true, displayName: true } } } }, _count: { select: { articles: true } } },
      orderBy: { updatedAt: "desc" }, skip: (page - 1) * 100, take: 100
    });
    return Response.json(briefs);
  } catch (error) { return jsonError(error); }
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    const raw = await request.json() as { action?: string };
    if (raw.action === "add-reference" || raw.action === "remove-reference") {
      const input = referenceSchema.parse(raw);
      const brief = await db.sourceBrief.findUnique({ where: { id: input.briefId }, include: { mediaTargets: true, references: true } });
      if (!brief || brief.archivedAt) return Response.json({ error: "Source brief not found." }, { status: 404 });
      for (const target of brief.mediaTargets) await requireMediaAccess(user.id, target.mediaSiteId);
      if (input.action === "remove-reference") {
        if (!input.referenceId) return Response.json({ error: "Reference ID is required." }, { status: 400 });
        const reference = brief.references.find((item) => item.id === input.referenceId);
        if (!reference) return Response.json({ error: "Reference not found." }, { status: 404 });
        const evidenceCount = await db.sourceFact.count({ where: { sourceReferenceId: reference.id } });
        if (evidenceCount) return Response.json({ error: `Reference is tied to ${evidenceCount} evidence claim(s); unlink or reassign those claims before removal.` }, { status: 409 });
        await db.sourceReference.delete({ where: { id: reference.id } });
        await audit(user.id, "SOURCE_REFERENCE_REMOVED", "SourceReference", reference.id);
        return Response.json({ removed: reference.id });
      }
      if (!input.url) return Response.json({ error: "Reference URL is required." }, { status: 400 });
      if (brief.references.length >= 10) return Response.json({ error: "A brief supports at most ten references." }, { status: 400 });
      try {
        const page = await fetchReference(input.url);
        const reference = await db.sourceReference.create({ data: { sourceBriefId: brief.id, url: input.url, canonicalUrl: page.canonicalUrl, title: page.title, publisherName: page.publisherName, publishedAt: page.publishedAt, excerpt: page.excerpt, httpStatus: page.httpStatus, retrievedAt: page.retrievedAt, contentHash: page.contentHash, retrievalStatus: "SUCCESS" } });
        await audit(user.id, "SOURCE_REFERENCE_ADDED", "SourceReference", reference.id);
        return Response.json(reference, { status: 201 });
      } catch (error) {
        const reference = await db.sourceReference.create({ data: { sourceBriefId: brief.id, url: input.url, retrievalStatus: error instanceof Error && /private|unsafe|not allowed|credential|robots|access policy/i.test(error.message) ? "BLOCKED" : "FAILED", errorCode: error instanceof Error ? error.message.slice(0, 250) : "FETCH_FAILED", retrievedAt: new Date() } });
        await audit(user.id, "SOURCE_REFERENCE_FETCH_FAILED", "SourceReference", reference.id);
        return Response.json(reference, { status: 201 });
      }
    }
    const input = updateSchema.parse(raw);
    const brief = await db.sourceBrief.findUnique({ where: { id: input.briefId }, include: { mediaTargets: true, articles: { select: { id: true } } } });
    if (!brief || brief.archivedAt) return Response.json({ error: "Source brief not found." }, { status: 404 });
    for (const target of brief.mediaTargets) await requireMediaAccess(user.id, target.mediaSiteId);
    if (input.action === "archive") {
      if (brief.articles.length) return Response.json({ error: "Brief with generated articles cannot be archived until article retention is reviewed." }, { status: 409 });
      await db.sourceBrief.update({ where: { id: brief.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
      await audit(user.id, "SOURCE_BRIEF_ARCHIVED", "SourceBrief", brief.id);
      return Response.json({ id: brief.id, status: "ARCHIVED" });
    }
    const updated = await db.sourceBrief.update({ where: { id: brief.id }, data: { workingTitle: input.workingTitle, narrative: input.narrative, editorNotes: input.editorNotes } });
    await audit(user.id, "SOURCE_BRIEF_UPDATED", "SourceBrief", brief.id, null, { fields: ["workingTitle", "narrative", "editorNotes"].filter((field) => input[field as keyof typeof input] !== undefined) });
    return Response.json(updated);
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    const input = briefInput.parse(await request.json());
    if (!rateLimit(`ingest:${user.id}`, 20, 60 * 1000)) return Response.json({ error: "Terlalu banyak pengambilan sumber. Tunggu sebentar." }, { status: 429 });
    const targets = await db.mediaSite.findMany({ where: { id: { in: input.mediaSiteIds }, status: { in: ["ACTIVE", "DRAFT"] } }, select: { id: true } });
    if (targets.length !== new Set(input.mediaSiteIds).size) return Response.json({ error: "One or more media targets are unavailable." }, { status: 400 });
    for (const target of targets) await requireMediaAccess(user.id, target.id);
    const brief = await db.sourceBrief.create({ data: { createdById: user.id, workingTitle: input.workingTitle, narrative: input.narrative, editorNotes: input.editorNotes, mediaTargets: { create: targets.map(({ id }) => ({ mediaSiteId: id })) } }, include: { mediaTargets: true } });
    const references = await Promise.all(input.references.map(async (url) => {
      try {
        const page = await fetchReference(url);
        return await db.sourceReference.create({ data: { sourceBriefId: brief.id, url, canonicalUrl: page.canonicalUrl, title: page.title, publisherName: page.publisherName, publishedAt: page.publishedAt, excerpt: page.excerpt, httpStatus: page.httpStatus, retrievedAt: page.retrievedAt, contentHash: page.contentHash, retrievalStatus: "SUCCESS" } });
      } catch (error) {
        return await db.sourceReference.create({ data: { sourceBriefId: brief.id, url, retrievalStatus: error instanceof Error && /private|unsafe|not allowed|credential|robots|access policy/i.test(error.message) ? "BLOCKED" : "FAILED", errorCode: error instanceof Error ? error.message.slice(0, 250) : "FETCH_FAILED", retrievedAt: new Date() } });
      }
    }));
    await db.sourceBrief.update({ where: { id: brief.id }, data: { status: "READY" } });
    await audit(user.id, "SOURCE_BRIEF_CREATED", "SourceBrief", brief.id, null, { referenceCount: references.length, mediaSiteIds: targets.map(({ id }) => id) });
    return Response.json({ ...brief, references }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
