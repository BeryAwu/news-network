import { after } from "next/server";
import { requireRole, requireSameOrigin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { aiConfiguration } from "@/lib/ai";
import { blastFailure } from "@/app/api/blasts/route";
import { retryBlast } from "@/lib/blasts";
import { executeGenerationRuns } from "@/lib/generation";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    if (!rateLimit(`blast-retry:${user.id}`, 6, 60 * 1000)) return Response.json({ error: "Terlalu banyak percobaan. Tunggu sebentar." }, { status: 429 });
    const ai = await aiConfiguration();
    if (!ai.configured || !ai.provider) return Response.json({ error: "Layanan AI belum disiapkan. Minta admin menyiapkan kunci AI di Koneksi layanan." }, { status: 409 });
    const { runId } = await retryBlast(user, (await params).id);
    after(() => executeGenerationRuns([runId]));
    return Response.json({ ok: true });
  } catch (error) { return blastFailure(error); }
}
