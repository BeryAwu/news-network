import type { PDFFont } from "pdf-lib";

/** pdf-lib's standard fonts only encode WinAnsi; anything else becomes "?" instead of throwing. */
export const pdfSafe = (text: string) => text.replace(/[^\u0020-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/g, "?");

/** Word-wraps `text` to `width`, splitting a single word that is wider than the line. */
export function pdfWrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of pdfSafe(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
    if (line) lines.push(line);
    line = word;
    while (font.widthOfTextAtSize(line, size) > width) {
      let cut = line.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut -= 1;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
