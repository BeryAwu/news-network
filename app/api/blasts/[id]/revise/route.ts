import { z } from "zod";
import { requireRole, requireSameOrigin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { aiConfiguration } from "@/lib/ai";
import { blastFailure } from "@/app/api/blasts/route";
import { reviseBlast } from "@/lib/blasts";

type Ctx = { params: Promise<{ id: string }> };

const reviseSchema = z.object({
  instruction: z.string().trim().min(3, "Tulis dulu apa yang ingin diubah.").max(1000, "Instruksi terlalu panjang. Ringkas jadi satu sampai tiga kalimat."),
});

/** Rewrites the shared article from an operator instruction. Runs inline: the operator waits for the new text. */
export async function POST(request: Request, { params }: Ctx) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    if (!rateLimit(`blast-revise:${user.id}`, 6, 60 * 1000)) return Response.json({ error: "Terlalu banyak permintaan AI. Tunggu sebentar sebelum mencoba lagi." }, { status: 429 });
    const ai = await aiConfiguration();
    if (!ai.configured || !ai.provider) return Response.json({ error: "Layanan AI belum disiapkan. Minta admin menyiapkan kunci AI di Koneksi layanan." }, { status: 409 });
    const input = reviseSchema.parse(await request.json());
    const { draft, summary } = await reviseBlast(user, (await params).id, input.instruction);
    return Response.json({ draft, summary });
  } catch (error) { return blastFailure(error); }
}
