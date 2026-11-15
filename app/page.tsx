import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Pagination, SiteShell } from "@/components/site/shell";
import { loadSiteTheme } from "@/components/site/theme-loader";
import { listPublished, requestHostname, requestOrigin, resolveSite } from "@/lib/site";
import { normalizeHostname } from "@/lib/security";

type SearchParams = Promise<{ page?: string; q?: string }>;

async function isAdminHost() {
  const hostname = await requestHostname();
  if (!hostname) notFound();
  const adminBase = process.env.ADMIN_BASE_URL || "http://localhost:3000";
  return hostname === normalizeHostname(new URL(adminBase).hostname);
}

export async function generateMetadata(): Promise<Metadata> {
  if (await isAdminHost()) return {};
  const site = await resolveSite();
  const origin = await requestOrigin();
  const description = site.media.description || site.theme.tagline || `Berita terbaru dari ${site.media.displayName}`;
  return {
    icons: { icon: [{ url: "/site-icon", type: "image/svg+xml" }] },
    title: { absolute: site.media.displayName },
    description,
    alternates: { canonical: origin + "/", types: { "application/rss+xml": origin + "/rss.xml" } },
    openGraph: { type: "website", siteName: site.media.displayName, title: site.media.displayName, description, url: origin + "/", locale: site.media.defaultLocale.replace("-", "_") },
  };
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  if (await isAdminHost()) {
    if (!process.env.DATABASE_URL) redirect("/setup?issue=database");
    redirect("/dashboard");
  }
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 80);
  const site = await resolveSite();
  const { items, page, pages } = await listPublished(site, { page: Number(params.page) || 1, q });
  const qs = (n: number) => `/?${new URLSearchParams({ ...(q ? { q } : {}), ...(n > 1 ? { page: String(n) } : {}) }).toString()}`.replace(/\?$/, "");
  const { Home: ThemedHome } = await loadSiteTheme(site.theme.template);
  return (
    <SiteShell site={site} query={q}>
      <ThemedHome site={site} items={items} query={q} page={page} />
      <Pagination page={page} pages={pages} hrefFor={qs} />
    </SiteShell>
  );
}
