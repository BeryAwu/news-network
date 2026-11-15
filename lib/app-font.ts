import localFont from "next/font/local";

/** The dashboard's single family, self-hosted (Latin subset; covers Indonesian). OFL licensed. */
export const appFont = localFont({ src: "../app/fonts/PlusJakartaSans-latin.woff2", weight: "400 800", variable: "--nf-app", display: "swap" });
