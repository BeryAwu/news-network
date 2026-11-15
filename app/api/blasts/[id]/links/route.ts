import { requireRole } from "@/lib/auth";
import { getBlastDetail } from "@/lib/blasts";
import { buildLinksXlsx } from "@/lib/blast-report";
import { rateLimit } from "@/lib/rate-limit";
import { blastFailure } from "../../route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER", "PUBLISHER");
    if (!rateLimit(`export:${user.id}`, 10, 60 * 1000)) return Response.json({ error: "Terlalu banyak unduhan. Tunggu sebentar." }, { status: 429 });
    if (new URL(request.url).searchParams.get("format") !== "xlsx") return Response.json({ error: "Pilih format xlsx." }, { status: 400 });
    const detail = await getBlastDetail(user, (await params).id);
    const file = await buildLinksXlsx(detail);
    return new Response(new Uint8Array(file), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="link-berita-${detail.id.slice(-6)}.xlsx"`, "cache-control": "no-store" } });
  } catch (error) { return blastFailure(error); }
}
