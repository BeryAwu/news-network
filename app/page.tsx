import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArticleCard, EmptyState, Pagination, SiteShell } from "@/components/site/shell";
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
  const { items, page, pages, total } = await listPublished(site, { page: Number(params.page) || 1, q });
  const qs = (n: number) => `/?${new URLSearchParams({ ...(q ? { q } : {}), ...(n > 1 ? { page: String(n) } : {}) }).toString()}`.replace(/\?$/, "");
  const lead = !q && page === 1 ? items[0] : undefined;
  const rest = lead ? items.slice(1) : items;
  return (
    <SiteShell site={site} query={q}>
      {q && <h1 className="site-heading">Hasil untuk “{q}” ({total})</h1>}
      {items.length === 0
        ? <EmptyState>{q ? "Tidak ada berita yang cocok." : "Belum ada berita yang diterbitkan."}</EmptyState>
        : <>{lead && <ArticleCard item={lead} featured />}{rest.length > 0 && <div className="site-grid">{rest.map((item) => <ArticleCard key={item.slug} item={item} />)}</div>}</>}
      <Pagination page={page} pages={pages} hrefFor={qs} />
    </SiteShell>
  );
}
