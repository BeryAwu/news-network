import { ArticleCard, EmptyState } from "@/components/site/shell";
import type { HomeProps } from "@/components/site/theme-types";

/** The Newsprint home: one lead story over a three-column grid. Also the fallback while a design is being built. */
export default function DefaultHome({ items, query, page }: HomeProps) {
  const lead = !query && page === 1 ? items[0] : undefined;
  const rest = lead ? items.slice(1) : items;
  return (
    <>
      {query && <h1 className="site-heading">Hasil untuk “{query}”</h1>}
      {items.length === 0
        ? <EmptyState>{query ? "Tidak ada berita yang cocok." : "Belum ada berita yang diterbitkan."}</EmptyState>
        : <>{lead && <ArticleCard item={lead} featured />}{rest.length > 0 && <div className="site-grid">{rest.map((item) => <ArticleCard key={item.slug} item={item} />)}</div>}</>}
    </>
  );
}
