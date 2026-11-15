import { z } from "zod";
import { after } from "next/server";
import { requireRole, requireSameOrigin } from "@/lib/auth";
import { aiConfiguration } from "@/lib/ai";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { BlastError, listBlasts, startBlast } from "@/lib/blasts";
import { executeGenerationRuns } from "@/lib/generation";
import { boundedPage } from "@/lib/http";

const startSchema = z.object({
  sourceBriefId: z.string().min(1),
  mode: z.enum(["AI", "AS_WRITTEN"]),
  styleSkillSlug: z.string().trim().max(80).optional(),
  styleNote: z.string().trim().max(500).optional(),
  featuredAssetId: z.string().min(1).optional(),
  galleryAssetIds: z.array(z.string().min(1)).max(4).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER", "PUBLISHER");
    const page = boundedPage(new URL(request.url).searchParams.get("page"));
    return Response.json(await listBlasts(user.id, page));
  } catch (error) { return blastFailure(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    const input = startSchema.parse(await request.json());
    if (input.mode === "AI") {
      if (!rateLimit(`ai:${user.id}`, 6, 60 * 1000)) return Response.json({ error: "Terlalu banyak permintaan AI. Tunggu sebentar sebelum mencoba lagi." }, { status: 429 });
      const ai = aiConfiguration();
      if (!ai.configured || !ai.provider) return Response.json({ error: "Layanan AI belum disiapkan. Pilih 'Pakai tulisan saya apa adanya' atau minta admin menyiapkan AI." }, { status: 409 });
    }
    const { runId } = await startBlast(user, input);
    if (runId) after(() => executeGenerationRuns([runId]));
    return Response.json({ id: input.sourceBriefId }, { status: 201 });
  } catch (error) { return blastFailure(error); }
}

/** BlastError carries its own plain message and status; everything else goes through the shared handler. */
export function blastFailure(error: unknown) {
  if (error instanceof BlastError) return Response.json({ error: error.message }, { status: error.status });
  return jsonError(error);
}
