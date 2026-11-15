import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { icons: { icon: [{ url: "/newsroom-icon", type: "image/svg+xml" }] }, title: { default: "Newsroom — News Network", template: "%s · Newsroom" }, description: "Ruang kerja redaksi untuk menyiapkan sumber, meninjau naskah, dan memantau publikasi." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="id"><body>{children}</body></html>; }
