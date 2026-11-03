import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireMediaAccess, requireRole, requireSameOrigin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
const createSchema = z.object({ sourceBriefId: z.string().min(1), sourceReferenceId: z.string().min(1).optional(), claimText: z.string().trim().min(8).max(1000), supportStatus: z.enum(["SUPPORTED", "CONFLICTED", "UNVERIFIED"]).default("UNVERIFIED"), evidenceNote: z.string().max(2000).default("") });
export async function GET(request: Request) {
  try {
    const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER", "PUBLISHER");
    const sourceBriefId = z.string().min(1).parse(new URL(request.url).searchParams.get("sourceBriefId"));
    const brief = await db.sourceBrief.findUnique({ where: { id: sourceBriefId }, include: { mediaTargets: true } });
    if (!brief) return Response.json({ error: "Source brief not found." }, { status: 404 });
    for (const target of brief.mediaTargets) await requireMediaAccess(user.id, target.mediaSiteId);
    const facts = await db.sourceFact.findMany({ where: { sourceBriefId }, include: { sourceReference: { select: { id: true, url: true, title: true, publisherName: true, retrievalStatus: true } } }, orderBy: { createdAt: "asc" } });
    return Response.json(facts);
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    const input = createSchema.parse(await request.json());
    const brief = await db.sourceBrief.findUnique({ where: { id: input.sourceBriefId }, include: { mediaTargets: true } });
    if (!brief || brief.archivedAt) return Response.json({ error: "Source brief not found." }, { status: 404 });
    for (const target of brief.mediaTargets) await requireMediaAccess(user.id, target.mediaSiteId);
    if (input.sourceReferenceId) {
      const reference = await db.sourceReference.findFirst({ where: { id: input.sourceReferenceId, sourceBriefId: brief.id } });
      if (!reference) return Response.json({ error: "Reference must belong to this source brief." }, { status: 400 });
    }
    const fact = await db.sourceFact.create({ data: { sourceBriefId: brief.id, sourceReferenceId: input.sourceReferenceId, claimText: input.claimText, supportStatus: input.supportStatus, evidenceNote: input.evidenceNote } });
    await audit(user.id, "SOURCE_FACT_RECORDED", "SourceFact", fact.id, null, { sourceBriefId: brief.id, sourceReferenceId: input.sourceReferenceId, supportStatus: fact.supportStatus });
    return Response.json(fact, { status: 201 });
  } catch (error) { return jsonError(error); }
}
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    const input = z.object({ factId: z.string().min(1) }).parse(await request.json());
    const existing = await db.sourceFact.findUnique({ where: { id: input.factId }, include: { sourceBrief: { include: { mediaTargets: true } } } });
    if (!existing) return Response.json({ error: "Source fact not found." }, { status: 404 });
    for (const target of existing.sourceBrief.mediaTargets) await requireMediaAccess(user.id, target.mediaSiteId);
    const cited = await db.$queryRaw<{ isCited: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM "ArticleVersion" AS version
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(version."claimsUsed") = 'array' THEN version."claimsUsed" ELSE '[]'::jsonb END
        ) AS claims(claim)
        CROSS JOIN LATERAL jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(claims.claim -> 'sourceFactIds') = 'array' THEN claims.claim -> 'sourceFactIds' ELSE '[]'::jsonb END
        ) AS cited_facts(fact_id)
        WHERE cited_facts.fact_id = ${existing.id}
      ) AS "isCited"
    `;
    if (cited[0]?.isCited) return Response.json({ error: "Evidence fact is cited by a saved article version. Mark it conflicted or unverified instead of deleting it." }, { status: 409 });
    await db.sourceFact.delete({ where: { id: existing.id } });
    await audit(user.id, "SOURCE_FACT_REMOVED", "SourceFact", existing.id, null, { sourceBriefId: existing.sourceBriefId });
    return Response.json({ removed: existing.id });
  } catch (error) { return jsonError(error); }
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    const input = z.object({ factId: z.string().min(1), supportStatus: z.enum(["SUPPORTED", "CONFLICTED", "UNVERIFIED"]), evidenceNote: z.string().max(2000) }).parse(await request.json());
    const existing = await db.sourceFact.findUnique({ where: { id: input.factId }, include: { sourceBrief: { include: { mediaTargets: true } } } });
    if (!existing) return Response.json({ error: "Source fact not found." }, { status: 404 });
    for (const target of existing.sourceBrief.mediaTargets) await requireMediaAccess(user.id, target.mediaSiteId);
    const fact = await db.sourceFact.update({ where: { id: existing.id }, data: { supportStatus: input.supportStatus, evidenceNote: input.evidenceNote } });
    await audit(user.id, "SOURCE_FACT_VERIFICATION_UPDATED", "SourceFact", fact.id, null, { supportStatus: fact.supportStatus });
    return Response.json(fact);
  } catch (error) { return jsonError(error); }
}
