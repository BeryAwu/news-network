import { requireRole } from "@/lib/auth";
import { getBlastDetail } from "@/lib/blasts";
import { buildReportDocx, buildReportPdf, reportData } from "@/lib/blast-report";
import { rateLimit } from "@/lib/rate-limit";
import { blastFailure } from "../../route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER", "PUBLISHER");
    if (!rateLimit(`export:${user.id}`, 10, 60 * 1000)) return Response.json({ error: "Terlalu banyak unduhan. Tunggu sebentar." }, { status: 429 });
    const format = new URL(request.url).searchParams.get("format");
    if (format !== "docx" && format !== "pdf") return Response.json({ error: "Pilih format docx atau pdf." }, { status: 400 });
    const detail = await getBlastDetail(user, (await params).id);
    if (!detail.content) return Response.json({ error: "Isi berita belum siap, laporan belum bisa dibuat." }, { status: 409 });
    const data = reportData(detail);
    const file = format === "docx" ? await buildReportDocx(data) : await buildReportPdf(data);
    return new Response(new Uint8Array(file), { headers: { "content-type": format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf", "content-disposition": `attachment; filename="laporan-berita-${detail.id.slice(-6)}.${format}"`, "cache-control": "no-store" } });
  } catch (error) { return blastFailure(error); }
}
