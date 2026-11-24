/** Black or white ink for text drawn on `hex`, whichever reads better (WCAG relative luminance). */
export function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.4 ? "#1a2433" : "#ffffff";
}

const initial = (name: string) => (name.trim().charAt(0) || "N").toUpperCase().replace(/[<>&"']/g, "");

/** The media's logo mark (viewBox 0 0 48 48): a rounded square in its colour holding its first letter. */
export function markSvg(fill: string, name: string, standalone = true): string {
  const inner = `<rect x="3" y="3" width="42" height="42" rx="9" fill="${fill}"/><text x="24" y="32.5" text-anchor="middle" font-family="'Schibsted Grotesk', Arial, sans-serif" font-weight="800" font-size="25" fill="${inkOn(fill)}">${initial(name)}</text>`;
  return standalone ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="64" height="64">${inner}</svg>` : inner;
}
