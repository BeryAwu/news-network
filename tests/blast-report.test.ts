import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildLinksXlsx, buildReportDocx, buildReportPdf, reportData } from "../lib/blast-report";
import type { BlastDetail } from "../lib/blast-types";

const narrative = "Polisi menggelar patroli malam di Bintaro. Petugas menyisir titik rawan.\n\nWarga diimbau tetap waspada.";

function detail(overrides: Partial<BlastDetail> = {}): BlastDetail {
  return {
    id: "brief-123456", status: "PUBLISHED", mode: "AI", createdAt: "2026-11-07T03:00:00.000Z", author: { id: "u1", name: "Sari Wulandari" },
    originalNarrative: narrative,
    content: { title: "Patroli Malam di Bintaro", excerpt: "x", body: "Teks final yang berbeda dari narasi asli, ditulis AI dan disunting.", seoTitle: "", metaDescription: "", tags: [], featured: null, gallery: [] },
    generation: null,
    media: [
      { mediaSiteId: "m1", name: "Kabar Tangsel", articleId: "a1", articleStatus: "PUBLISHED", hostname: "a.test", canPublish: true, problem: null, publication: { status: "PUBLISHED", url: "https://a.test/articles/patroli", error: null, publishedAt: "2026-11-08T01:00:00.000Z" } },
      { mediaSiteId: "m2", name: "Liputan 77", articleId: "a2", articleStatus: "PUBLISHED", hostname: "b.test", canPublish: true, problem: null, publication: { status: "PUBLISHED", url: "https://b.test/articles/patroli", error: null, publishedAt: "2026-11-08T02:00:00.000Z" } },
    ],
    links: [{ mediaName: "Kabar Tangsel", title: "Patroli Malam di Bintaro", url: "https://a.test/articles/patroli" }, { mediaName: "Liputan 77", title: "Patroli Malam di Bintaro", url: "https://b.test/articles/patroli" }],
    canEdit: true, canPublish: true, ...overrides,
  };
}

describe("blast report data", () => {
  it("dates the report by the first publication and keeps the author and every live link", () => {
    const data = reportData(detail());
    expect(data.date).toBe("8 November 2026");
    expect(data.author).toBe("Sari Wulandari");
    expect(data.links.map((l) => l.url)).toEqual(["https://a.test/articles/patroli", "https://b.test/articles/patroli"]);
  });

  it("shows the original narrative separately only when it differs from the final text", () => {
    expect(reportData(detail()).originalText).toBe(narrative);
    const same = detail({ content: { ...detail().content!, body: narrative } });
    expect(reportData(same).originalText).toBeNull();
  });
});

describe("blast files", () => {
  it("builds a Word file that contains the author, the title, both texts and the links", async () => {
    const docx = await buildReportDocx(reportData(detail()));
    const xml = await (await JSZip.loadAsync(docx)).file("word/document.xml")!.async("string");
    for (const expected of ["Sari Wulandari", "Patroli Malam di Bintaro", "Teks final yang berbeda", "Narasi asli", "Polisi menggelar patroli"]) expect(xml).toContain(expected);
    const rels = await (await JSZip.loadAsync(docx)).file("word/_rels/document.xml.rels")!.async("string");
    expect(rels).toContain("https://b.test/articles/patroli");
  });

  it("builds a PDF and an Excel sheet with one row per live link", async () => {
    const pdf = await buildReportPdf(reportData(detail()));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const xlsx = await buildLinksXlsx(detail());
    const sheet = await (await JSZip.loadAsync(xlsx)).file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet.match(/<row /g)?.length).toBe(3);
  });

  it("does not fail on very long unbroken words or text outside Latin-1", async () => {
    const odd = detail({ content: { ...detail().content!, title: "Judul dengan huruf 日本語 dan ".repeat(3), body: `${"a".repeat(400)}\n\n${"kata ".repeat(900)}` } });
    expect((await buildReportPdf(reportData(odd))).length).toBeGreaterThan(1000);
  });
});
