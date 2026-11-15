import ExcelJS from "exceljs";
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import { requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { parseReportDate, publishedRows, type PublishedRow } from "@/lib/reports";
import { pdfSafe as safe, pdfWrap as wrap } from "@/lib/pdf-text";

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const dayOnly = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const stamp = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

async function buildXlsx(rows: PublishedRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Newsroom";
  const sheet = workbook.addWorksheet("Berita terbit", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Tanggal terbit", key: "date", width: 26 },
    { header: "Media", key: "media", width: 28 },
    { header: "Judul berita", key: "title", width: 70 },
    { header: "Link berita", key: "url", width: 70 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    const added = sheet.addRow({ date: row.publishedAt, media: row.mediaName, title: row.title, url: { text: row.url, hyperlink: row.url } });
    added.getCell("date").numFmt = "dd mmm yyyy hh:mm";
    added.getCell("title").alignment = { wrapText: true, vertical: "top" };
    added.getCell("url").font = { color: { argb: "FF0563C1" }, underline: true };
  }
  sheet.autoFilter = { from: "A1", to: "D1" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function buildPdf(rows: PublishedRow[], periodLabel: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 36, size = 9, lead = 12;
  const cols = [{ x: M, w: 92, h: "Tanggal terbit" }, { x: M + 98, w: 110, h: "Media" }, { x: M + 214, w: 270, h: "Judul berita" }, { x: M + 490, w: W - 2 * M - 490, h: "Link berita" }];
  const ink = rgb(0.13, 0.11, 0.1), muted = rgb(0.4, 0.37, 0.35), link = rgb(0.02, 0.39, 0.76), line = rgb(0.85, 0.83, 0.8);
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const header = (first: boolean) => {
    if (first) {
      page.drawText("Laporan berita terbit", { x: M, y: y - 14, size: 16, font: bold, color: ink });
      page.drawText(safe(`${periodLabel}. ${rows.length} berita. Dibuat ${dateTime.format(new Date())}.`), { x: M, y: y - 32, size: 10, font, color: muted });
      y -= 52;
    }
    for (const c of cols) page.drawText(c.h, { x: c.x, y: y - 10, size, font: bold, color: ink });
    y -= 16;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: ink });
    y -= 6;
  };
  header(true);
  for (const row of rows) {
    const date = wrap(dateTime.format(row.publishedAt), font, size, cols[0]!.w);
    const media = wrap(row.mediaName, font, size, cols[1]!.w);
    const title = wrap(row.title, font, size, cols[2]!.w);
    const url = wrap(row.url, font, size, cols[3]!.w);
    const count = Math.max(date.length, media.length, title.length, url.length);
    const height = count * lead + 8;
    if (y - height < M) { page = pdf.addPage([W, H]); y = H - M; header(false); }
    const draw = (lines: string[], c: { x: number }, color: typeof ink) => lines.forEach((l, i) => page.drawText(l, { x: c.x, y: y - 10 - i * lead, size, font, color }));
    draw(date, cols[0]!, ink); draw(media, cols[1]!, ink); draw(title, cols[2]!, ink); draw(url, cols[3]!, link);
    const annotation = pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [cols[3]!.x, y - url.length * lead - 2, cols[3]!.x + cols[3]!.w, y], Border: [0, 0, 0], A: { Type: "Action", S: PDFName.of("URI"), URI: PDFString.of(row.url) } });
    page.node.addAnnot(pdf.context.register(annotation));
    y -= height;
    page.drawLine({ start: { x: M, y: y + 3 }, end: { x: W - M, y: y + 3 }, thickness: 0.5, color: line });
  }
  if (!rows.length) page.drawText("Belum ada berita terbit pada periode ini.", { x: M, y: y - 14, size: 11, font, color: muted });
  const total = pdf.getPageCount();
  pdf.getPages().forEach((p, i) => p.drawText(`Halaman ${i + 1} dari ${total}`, { x: W - M - 80, y: 16, size: 8, font, color: muted }));
  return Buffer.from(await pdf.save());
}

export async function GET(request: Request) {
  try {
    const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER", "PUBLISHER");
    if (!rateLimit(`export:${user.id}`, 10, 60 * 1000)) return Response.json({ error: "Terlalu banyak unduhan. Tunggu sebentar." }, { status: 429 });
    const params = new URL(request.url).searchParams;
    const format = params.get("format");
    if (format !== "xlsx" && format !== "pdf") return Response.json({ error: "Pilih format xlsx atau pdf." }, { status: 400 });
    const from = parseReportDate(params.get("from")), to = parseReportDate(params.get("to"), true);
    const media = (params.get("media") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    const rows = await publishedRows(user.id, { from, to }, media);
    const period = from || to ? `Periode ${from ? dayOnly.format(from) : "awal"} sampai ${to ? dayOnly.format(to) : "sekarang"}` : "Semua periode";
    const file = format === "xlsx" ? await buildXlsx(rows) : await buildPdf(rows, period);
    return new Response(new Uint8Array(file), {
      headers: {
        "content-type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
        "content-disposition": `attachment; filename="laporan-berita-${stamp()}.${format}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) { return jsonError(error); }
}
