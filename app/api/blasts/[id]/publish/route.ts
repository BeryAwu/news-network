import { z } from "zod";
import { requireRole, requireSameOrigin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getBlastDetail, publishBlast } from "@/lib/blasts";
import { blastFailure } from "../../route";

const schema = z.object({ scheduledAt: z.string().datetime().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "PUBLISHER");
    if (!rateLimit(`publish:${user.id}`, 10, 60 * 1000)) return Response.json({ error: "Terlalu banyak aksi terbit. Tunggu sebentar." }, { status: 429 });
    const body = schema.parse(await request.json().catch(() => ({})));
    const id = (await params).id;
    const { skipped } = await publishBlast(user, id, body.scheduledAt ? new Date(body.scheduledAt) : null);
    return Response.json({ detail: await getBlastDetail(user, id), skipped });
  } catch (error) { return blastFailure(error); }
}
