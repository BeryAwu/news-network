import type { MarkShape } from "@/lib/site-themes";

/** SVG path/shape markup (viewBox 0 0 48 48) for each logo mark, drawn in `fill`. The letter sits on top in `ink`. */
const SHAPES: Record<MarkShape, (fill: string) => string> = {
  square: (f) => `<rect x="4" y="4" width="40" height="40" rx="6" fill="${f}"/>`,
  circle: (f) => `<circle cx="24" cy="24" r="21" fill="${f}"/>`,
  hex: (f) => `<path d="M24 3l18 10.5v21L24 45 6 34.5v-21z" fill="${f}"/>`,
  bars: (f) => `<rect x="4" y="4" width="40" height="40" rx="4" fill="${f}"/><rect x="10" y="30" width="6" height="8" fill="#ffffff" opacity=".55"/><rect x="21" y="24" width="6" height="14" fill="#ffffff" opacity=".55"/><rect x="32" y="18" width="6" height="20" fill="#ffffff" opacity=".55"/>`,
  flag: (f) => `<path d="M6 4h36v26l-18 14L6 30z" fill="${f}"/>`,
  compass: (f) => `<circle cx="24" cy="24" r="21" fill="${f}"/><path d="M24 7l6 17-6 17-6-17z" fill="#ffffff" opacity=".35"/>`,
  drop: (f) => `<path d="M24 3C34 15 41 22 41 31a17 17 0 0 1-34 0C7 22 14 15 24 3z" fill="${f}"/>`,
  bolt: (f) => `<path d="M27 2L8 27h12l-3 19 23-28H27z" fill="${f}"/>`,
  tab: (f) => `<path d="M4 10a6 6 0 0 1 6-6h28a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill="${f}"/><rect x="4" y="4" width="40" height="9" rx="4" fill="#000000" opacity=".18"/>`,
  star: (f) => `<path d="M24 2l6.5 14.5L46 18l-11.5 10.5L38 44l-14-8-14 8 3.5-15.5L2 18l15.5-1.5z" fill="${f}"/>`,
};

/** Black or white ink for text drawn on `hex`, whichever reads better (WCAG relative luminance). */
export function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.4 ? "#111111" : "#ffffff";
}

export function markInner(shape: MarkShape, fill: string) {
  return SHAPES[shape](fill);
}

/** A standalone SVG (used as the favicon): the mark with the media's first letter on it. */
export function markSvg(shape: MarkShape, fill: string, letter: string): string {
  const ink = shape === "bars" ? "#ffffff" : inkOn(fill);
  const safe = (letter.trim().charAt(0) || "N").toUpperCase().replace(/[<>&"']/g, "");
  const text = shape === "bars" ? "" : `<text x="24" y="${shape === "flag" ? 25 : shape === "drop" ? 33 : 32}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${shape === "bolt" ? 0 : 24}" fill="${ink}">${safe}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="64" height="64">${markInner(shape, fill)}${text}</svg>`;
}
