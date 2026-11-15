import { db } from "@/lib/db";
import { hasNetworkWideScope, requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { failStaleGenerationRuns } from "@/lib/generation";

/** Recent AI draft runs (last 24h) the caller may see, newest first. */
export async function GET() {
  try {
    const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER");
    await failStaleGenerationRuns();
    const all = await hasNetworkWideScope(user.id);
    const runs = await db.aiGenerationRun.findMany({
      where: {
        operation: "GENERATE_ARTICLE",
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        ...(all ? {} : { mediaSiteId: { in: (await db.mediaAccess.findMany({ where: { userId: user.id }, select: { mediaSiteId: true } })).map((m) => m.mediaSiteId) } }),
      },
      orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, status: true, mediaSiteId: true, articleId: true, errorMessage: true, outputSummary: true, createdAt: true, completedAt: true, sourceBrief: { select: { id: true, workingTitle: true } } },
    });
    const media = await db.mediaSite.findMany({ where: { id: { in: [...new Set(runs.flatMap((r) => (r.mediaSiteId ? [r.mediaSiteId] : [])))] } }, select: { id: true, displayName: true } });
    const names = new Map(media.map((m) => [m.id, m.displayName]));
    return Response.json({ runs: runs.map((r) => ({ ...r, mediaName: r.mediaSiteId ? names.get(r.mediaSiteId) ?? "" : "" })) });
  } catch (error) { return jsonError(error); }
}
