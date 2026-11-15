import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard, EmptyState, Pagination, SiteShell } from "@/components/site/shell";
import { listPublished, requestOrigin, resolveSite } from "@/lib/site";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await resolveSite();
  const category = site.media.categories.find((c) => c.slug === slug);
  if (!category) notFound();
  const origin = await requestOrigin();
  const title = `${category.name} · ${site.media.displayName}`;
  const description = category.description || `Berita ${category.name} terbaru dari ${site.media.displayName}`;
  return { title: { absolute: title }, description, alternates: { canonical: `${origin}/kategori/${category.slug}` }, openGraph: { type: "website", title, description, siteName: site.media.displayName, url: `${origin}/kategori/${category.slug}` } };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, { page: rawPage }] = await Promise.all([params, searchParams]);
  const site = await resolveSite();
  const category = site.media.categories.find((c) => c.slug === slug);
  if (!category) notFound();
  const { items, page, pages } = await listPublished(site, { page: Number(rawPage) || 1, categoryId: category.id });
  return (
    <SiteShell site={site}>
      <h1 className="site-heading">{category.name}</h1>
      {category.description && <p className="site-small" style={{ marginTop: "calc(var(--space-sm) * -1)", marginBottom: "var(--space-lg)" }}>{category.description}</p>}
      {items.length === 0
        ? <EmptyState>Belum ada berita di kategori ini.</EmptyState>
        : <div className="site-grid">{items.map((item) => <ArticleCard key={item.slug} item={item} />)}</div>}
      <Pagination page={page} pages={pages} hrefFor={(n) => (n > 1 ? `/kategori/${category.slug}?page=${n}` : `/kategori/${category.slug}`)} />
    </SiteShell>
  );
}
