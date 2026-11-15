import { themeInfo } from "@/lib/site-themes";
import type { SiteThemeModule } from "@/components/site/theme-types";

/**
 * Loads one design at request time so a page only pulls in the fonts and CSS of the design it shows.
 * Dynamic import is deliberate: the specifier is chosen at runtime from the media's saved design.
 */
export async function loadSiteTheme(slug: string | null | undefined): Promise<SiteThemeModule> {
  switch (themeInfo(slug).slug) {
    case "portal": return (await import("@/components/site/themes/portal")).theme;
    case "majalah": return (await import("@/components/site/themes/majalah")).theme;
    case "daftar": return (await import("@/components/site/themes/daftar")).theme;
    case "gelap": return (await import("@/components/site/themes/gelap")).theme;
    case "lini": return (await import("@/components/site/themes/lini")).theme;
    case "waktu": return (await import("@/components/site/themes/waktu")).theme;
    case "kartu": return (await import("@/components/site/themes/kartu")).theme;
    case "mosaik": return (await import("@/components/site/themes/mosaik")).theme;
    case "ringkas": return (await import("@/components/site/themes/ringkas")).theme;
    default: return (await import("@/components/site/themes/koran")).theme;
  }
}
