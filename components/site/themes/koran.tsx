import localFont from "next/font/local";
import DefaultHome from "@/components/site/default-home";
import type { SiteThemeModule } from "@/components/site/theme-types";

const koranDisplay = localFont({ src: "../../../app/fonts/ZillaSlab-700-latin.woff2", weight: "700", variable: "--nf-koran-display", display: "swap" });
const koranBody = localFont({ src: [{ path: "../../../app/fonts/Spectral-400-latin.woff2", weight: "400", style: "normal" }, { path: "../../../app/fonts/Spectral-500-latin.woff2", weight: "500", style: "normal" }, { path: "../../../app/fonts/Spectral-400-italic-latin.woff2", weight: "400", style: "italic" }], variable: "--nf-koran-body", display: "swap" });

export const theme: SiteThemeModule = { fonts: [koranDisplay, koranBody], Home: DefaultHome };
