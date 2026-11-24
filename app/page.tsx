import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import HeroSlider, { type HeroSlide } from "@/components/site/hero-slider";
import RecommendTabs from "@/components/site/recommend-tabs";
import { EmptyState, Pagination, SectionTitle, SiteShell, StoryRow, formatShortDate, formatTime } from "@/components/site/shell";
import { cloudinaryUrl, listPublished, requestHostname, requestOrigin, resolveSite, type SiteListItem } from "@/lib/site";
import { normalizeHostname } from "@/lib/security";

type SearchParams = Promise<{ page?: string; q?: string }>;

/** Newest stories shown in the slider; the latest list starts after them. */
const HERO_COUNT = 5;
const LATEST_PER_PAGE = 10;
const RECOMMEND_COUNT = 5;

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
  const q = (params.q ?? "").slice(0, 80).trim();
  const requested = Math.max(1, Number(params.page) || 1);
  const site = await resolveSite();
  const qs = (n: number) => `/?${new URLSearchParams({ ...(q ? { q } : {}), ...(n > 1 ? { page: String(n) } : {}) }).toString()}`.replace(/\?$/, "");

  if (q) {
    const { items, page, pages, total } = await listPublished(site, { q, page: requested, take: LATEST_PER_PAGE });
    return (
      <SiteShell site={site} query={q}>
        <section className="site-search-results" aria-labelledby="hasil">
          <SectionTitle id="hasil">Hasil pencarian “{q}”</SectionTitle>
          <p className="site-muted">{total ? `${total} berita ditemukan.` : ""}</p>
          {items.length ? <div className="site-rows">{items.map((item) => <StoryRow key={item.slug} item={item} />)}</div> : <EmptyState>Tidak ada berita yang cocok dengan “{q}”. Coba kata lain yang lebih umum.</EmptyState>}
          <Pagination page={page} pages={pages} hrefFor={qs} />
        </section>
      </SiteShell>
    );
  }

  const [lead, latest, week, month, all] = await Promise.all([
    listPublished(site, { take: HERO_COUNT }),
    listPublished(site, { skip: HERO_COUNT, page: requested, take: LATEST_PER_PAGE }),
    listPublished(site, { withinDays: 7, take: RECOMMEND_COUNT }),
    listPublished(site, { withinDays: 30, take: RECOMMEND_COUNT }),
    listPublished(site, { take: RECOMMEND_COUNT }),
  ]);
  const page = latest.page;
  const pages = Math.max(1, Math.ceil((latest.total - HERO_COUNT) / LATEST_PER_PAGE));

  if (!lead.items.length) {
    return <SiteShell site={site} current="home"><EmptyState>Belum ada berita yang terbit. Berita baru akan tampil di sini begitu diterbitkan.</EmptyState></SiteShell>;
  }

  const slides: HeroSlide[] = lead.items.map((item) => ({
    slug: item.slug, title: item.title, excerpt: item.excerpt, category: item.category, authorName: item.authorName,
    imageUrl: item.image ? cloudinaryUrl(item.image.secureUrl, "f_auto,q_auto,c_fill,g_auto,w_1600,h_800") : null,
    imageAlt: item.image?.altText ?? "",
    dateLabel: `${formatShortDate(item.publishedAt)}, ${formatTime(item.publishedAt)}`,
    dateTime: item.publishedAt?.toISOString() ?? null,
  }));
  const recList = (items: SiteListItem[], empty: string) => items.length
    ? <ul className="site-rec-list">{items.map((item) => <li key={item.slug}><StoryRow item={item} showExcerpt={false} /></li>)}</ul>
    : <EmptyState>{empty}</EmptyState>;

  return (
    <SiteShell site={site} current="home">
      {page === 1 && <HeroSlider slides={slides} />}
      <div className="site-home-grid">
        <section aria-labelledby="terbaru">
          <SectionTitle id="terbaru">Berita terbaru</SectionTitle>
          {latest.items.length
            ? <div className="site-rows">{latest.items.map((item) => <StoryRow key={item.slug} item={item} />)}</div>
            : <EmptyState>Semua berita yang ada sudah tampil di berita utama di atas.</EmptyState>}
          <Pagination page={page} pages={pages} hrefFor={qs} />
        </section>
        <aside className="site-aside" aria-labelledby="rekomendasi">
          <SectionTitle id="rekomendasi">Rekomendasi</SectionTitle>
          <RecommendTabs tabs={[
            { key: "minggu", label: "Minggu ini", content: recList(week.items, "Belum ada berita dalam 7 hari terakhir.") },
            { key: "bulan", label: "Bulan ini", content: recList(month.items, "Belum ada berita dalam 30 hari terakhir.") },
            { key: "semua", label: "Semua", content: recList(all.items, "Belum ada berita.") },
          ]} />
        </aside>
      </div>
    </SiteShell>
  );
}
