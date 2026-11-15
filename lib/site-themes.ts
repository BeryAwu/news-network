/**
 * Static facts about the ten public-site designs. Plain data only (no React, no fonts) so the dashboard form,
 * the favicon route and the media API can import it. The React side lives in components/site/themes/<slug>.tsx.
 */
export type HomeLayoutName = "front" | "portal" | "magazine" | "list" | "split" | "stream" | "timeline" | "cards" | "mosaic" | "digest";
export type HeaderVariant = "center" | "bar" | "stacked" | "minimal";
export type MarkShape = "square" | "circle" | "hex" | "bars" | "flag" | "compass" | "drop" | "bolt" | "tab" | "star";

export interface SiteThemeInfo {
  slug: string;
  name: string;
  /** One plain sentence for the owner picking a design. */
  description: string;
  layout: HomeLayoutName;
  header: HeaderVariant;
  mark: MarkShape;
  /** Used when the media has no colour of its own. */
  defaultColor: string;
  /** Dark designs paint their own page background. */
  dark: boolean;
}

export const SITE_THEMES = [
  { slug: "koran", name: "Koran", description: "Gaya koran cetak: huruf serif, garis ganda, berita utama di atas tiga kolom.", layout: "front", header: "center", mark: "square", defaultColor: "#8a3b24", dark: false },
  { slug: "portal", name: "Portal", description: "Portal berita modern: berita utama besar dengan daftar berita terbaru di samping.", layout: "portal", header: "stacked", mark: "flag", defaultColor: "#c1121f", dark: false },
  { slug: "majalah", name: "Majalah", description: "Majalah: gambar utama sangat besar, judul serif elegan, banyak ruang kosong.", layout: "magazine", header: "minimal", mark: "circle", defaultColor: "#7b2d5b", dark: false },
  { slug: "daftar", name: "Daftar", description: "Padat dan cepat dipindai: daftar judul dengan gambar kecil, cocok untuk berita yang banyak.", layout: "list", header: "bar", mark: "bars", defaultColor: "#0b5cad", dark: false },
  { slug: "gelap", name: "Meja gelap", description: "Latar gelap dengan aksen kuning, berita utama di kiri dan daftar di kanan.", layout: "split", header: "bar", mark: "bolt", defaultColor: "#f2b705", dark: true },
  { slug: "lini", name: "Lini", description: "Satu kolom lebar seperti membaca arus berita, huruf besar dan lega.", layout: "stream", header: "minimal", mark: "drop", defaultColor: "#1d3557", dark: false },
  { slug: "waktu", name: "Lini waktu", description: "Berita disusun menurut jam terbit, dengan garis waktu di sisi kiri.", layout: "timeline", header: "bar", mark: "tab", defaultColor: "#1b7f5c", dark: false },
  { slug: "kartu", name: "Kartu", description: "Kartu berwarna dengan sudut membulat, ramah dan cerah.", layout: "cards", header: "stacked", mark: "compass", defaultColor: "#0f8b8d", dark: false },
  { slug: "mosaik", name: "Mosaik", description: "Berani: judul tebal, kotak berbingkai, satu berita besar dikelilingi berita kecil.", layout: "mosaic", header: "center", mark: "star", defaultColor: "#e63946", dark: false },
  { slug: "ringkas", name: "Ringkas", description: "Ringkasan harian: berita bernomor yang rapi, mudah dibaca sekilas.", layout: "digest", header: "stacked", mark: "hex", defaultColor: "#2a6f4b", dark: false },
] as const satisfies readonly SiteThemeInfo[];

export type SiteThemeSlug = (typeof SITE_THEMES)[number]["slug"];
export const THEME_SLUGS = SITE_THEMES.map((theme) => theme.slug) as [SiteThemeSlug, ...SiteThemeSlug[]];
export const DEFAULT_THEME_SLUG: SiteThemeSlug = "koran";

export function themeInfo(slug: string | null | undefined): SiteThemeInfo {
  return SITE_THEMES.find((theme) => theme.slug === slug) ?? SITE_THEMES[0];
}
