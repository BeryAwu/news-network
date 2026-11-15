import type { ComponentType } from "react";
import type { Site, SiteListItem } from "@/lib/site";

export interface HomeProps {
  site: Site;
  /** The stories for this page, newest first. Never contains invented items. */
  items: SiteListItem[];
  /** The search text, empty when browsing. */
  query: string;
  /** 1-based page number; layouts show their big lead layout on page 1 without a query only. */
  page: number;
}

/** What components/site/themes/<slug>.tsx exports as `theme`. */
export interface SiteThemeModule {
  /** The next/font variable objects used by this design (`variable` is applied as a class on the site wrapper). */
  fonts: { variable: string }[];
  /** Everything between the header and the footer on the home page, including the empty state. */
  Home: ComponentType<HomeProps>;
}
