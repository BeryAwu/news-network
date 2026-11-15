import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import ExcelJS from "exceljs";
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { BlastDetail } from "@/lib/blast-types";
import { pdfSafe, pdfWrap } from "@/lib/pdf-text";

const longDate = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

export interface BlastReportData {
  author: string;
  date: string;
  title: string;
  finalText: string;
  /** Null when the original narrative is the same text as the final one. */
  originalText: string | null;
  links: { mediaName: string; url: string }[];
}

const paragraphsOf = (text: string) => text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);

/** The report content is the detail the caller was already allowed to read; nothing else is loaded. */
export function reportData(detail: BlastDetail): BlastReportData {
  const published = detail.media.flatMap((m) => (m.publication?.publishedAt ? [new Date(m.publication.publishedAt).getTime()] : []));
  const date = published.length ? new Date(Math.min(...published)) : new Date(detail.createdAt);
  const finalText = detail.content?.body ?? detail.originalNarrative;
  const same = paragraphsOf(finalText).join("\n") === paragraphsOf(detail.originalNarrative).join("\n");
  return {
    author: detail.author.name,
    date: longDate.format(date),
    title: detail.content?.title ?? "",
    finalText,
    originalText: same ? null : detail.originalNarrative,
    links: detail.links.map((l) => ({ mediaName: l.mediaName, url: l.url })),
  };
}

export async function buildLinksXlsx(detail: BlastDetail) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Newsroom";
  const sheet = workbook.addWorksheet("Link berita", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [{ header: "No", key: "no", width: 6 }, { header: "Media", key: "media", width: 30 }, { header: "Judul", key: "title", width: 70 }, { header: "Link", key: "url", width: 70 }];
  sheet.getRow(1).font = { bold: true };
  detail.links.forEach((link, index) => {
    const row = sheet.addRow({ no: index + 1, media: link.mediaName, title: link.title, url: { text: link.url, hyperlink: link.url } });
    row.getCell("title").alignment = { wrapText: true, vertical: "top" };
    row.getCell("url").font = { color: { argb: "FF0563C1" }, underline: true };
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const run = (text: string, options: { bold?: boolean; size?: number } = {}) => new TextRun({ text, bold: options.bold, size: options.size });

export async function buildReportDocx(data: BlastReportData) {
  const label = (name: string, value: string) => new Paragraph({ spacing: { after: 80 }, children: [run(`${name}: `, { bold: true }), run(value)] });
  const heading = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 120 }, children: [run(text, { bold: true })] });
  const body = (text: string) => paragraphsOf(text).map((p) => new Paragraph({ spacing: { after: 160, line: 320 }, children: [run(p, { size: 24 })] }));
  const children = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 240 }, children: [run("Laporan blast berita", { bold: true })] }),
    label("Pengarang", data.author),
    label("Tanggal", data.date),
    heading("Judul berita"),
    new Paragraph({ spacing: { after: 120 }, children: [run(data.title, { bold: true, size: 28 })] }),
    heading("Narasi berita"),
    ...body(data.finalText),
    ...(data.originalText ? [heading("Narasi asli"), ...body(data.originalText)] : []),
    heading("Link berita yang sudah terbit"),
    ...(data.links.length
      ? data.links.map((l, i) => new Paragraph({ spacing: { after: 100 }, children: [run(`${i + 1}. ${l.mediaName}: `, { bold: true }), new ExternalHyperlink({ link: l.url, children: [new TextRun({ text: l.url, style: "Hyperlink", color: "0563C1", underline: {} })] })] }))
      : [new Paragraph({ children: [run("Belum ada link yang terbit.")] })]),
  ];
  const doc = new Document({ creator: "Newsroom", title: `Laporan: ${data.title}`, sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

export async function buildReportPdf(data: BlastReportData) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 56, width = W - 2 * M;
  const ink = rgb(0.13, 0.11, 0.1), muted = rgb(0.4, 0.37, 0.35), link = rgb(0.02, 0.39, 0.76);
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const room = (needed: number) => { if (y - needed < M) { page = pdf.addPage([W, H]); y = H - M; } };
  const text = (value: string, f: PDFFont, size: number, color = ink, gap = 4) => {
    const lead = size * 1.4;
    for (const line of pdfWrap(value, f, size, width)) { room(lead); page.drawText(line, { x: M, y: y - size, size, font: f, color }); y -= lead; }
    y -= gap;
  };
  const heading = (value: string) => { y -= 12; room(40); text(value, bold, 13, ink, 6); };

  text("Laporan blast berita", bold, 20, ink, 14);
  text(`Pengarang: ${data.author}`, font, 11, ink, 2);
  text(`Tanggal: ${data.date}`, font, 11, ink, 8);
  heading("Judul berita");
  text(data.title, bold, 14, ink, 8);
  heading("Narasi berita");
  for (const p of paragraphsOf(data.finalText)) text(p, font, 11, ink, 8);
  if (data.originalText) { heading("Narasi asli"); for (const p of paragraphsOf(data.originalText)) text(p, font, 11, muted, 8); }
  heading("Link berita yang sudah terbit");
  if (!data.links.length) text("Belum ada link yang terbit.", font, 11, muted);
  data.links.forEach((l, i) => {
    text(`${i + 1}. ${l.mediaName}`, bold, 11, ink, 1);
    const lines = pdfWrap(l.url, font, 10, width);
    const lead = 14;
    room(lines.length * lead + 6);
    const top = y;
    lines.forEach((line, k) => page.drawText(line, { x: M, y: y - 10 - k * lead, size: 10, font, color: link }));
    y -= lines.length * lead;
    page.node.addAnnot(pdf.context.register(pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [M, y, M + width, top], Border: [0, 0, 0], A: { Type: "Action", S: PDFName.of("URI"), URI: PDFString.of(pdfSafe(l.url)) } })));
    y -= 6;
  });
  const total = pdf.getPageCount();
  pdf.getPages().forEach((p, i) => p.drawText(`Halaman ${i + 1} dari ${total}`, { x: W - M - 70, y: 24, size: 8, font, color: muted }));
  return Buffer.from(await pdf.save());
}
