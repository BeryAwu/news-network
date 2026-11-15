import localFont from "next/font/local";
import Link from "next/link";
import "@/app/css/themes/kartu.css";
import { ArticleCard, EmptyState, formatDate } from "@/components/site/shell";
import type { HomeProps, SiteThemeModule } from "@/components/site/theme-types";
import type { SiteListItem } from "@/lib/site";

const display = localFont({ src: "../../../app/fonts/Nunito-latin.woff2", weight: "400 800", variable: "--nf-kartu-display", display: "swap", preload: false });

function Results({ items }: { items: SiteListItem[] }) {
  return (
    <ul className="kartu-results">
      {items.map((item) => (
        <li key={item.slug}>
          <div className="site-meta">
            {item.category && <Link href={`/kategori/${item.category.slug}`}>{item.category.name}</Link>}
            <time dateTime={item.publishedAt?.toISOString()}>{formatDate(item.publishedAt)}</time>
          </div>
          <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
          <p>{item.excerpt}</p>
        </li>
      ))}
    </ul>
  );
}

/** Cards: a featured card with its photo beside the text, then a grid of rounded cards. */
function Home({ items, query, page }: HomeProps) {
  const lead = !query && page === 1 ? items[0] : undefined;
  const rest = lead ? items.slice(1) : items;
  return (
    <>
      {query && <h1 className="site-heading">Hasil untuk “{query}”</h1>}
      {items.length === 0 && <EmptyState>{query ? "Tidak ada berita yang cocok." : "Belum ada berita yang diterbitkan."}</EmptyState>}
      {query && items.length > 0 && <Results items={items} />}
      {!query && lead && <ArticleCard item={lead} featured />}
      {!query && rest.length > 0 && (
        <>
          {lead && <h2 className="site-heading kartu-more">Berita lain</h2>}
          <div className="site-grid">{rest.map((item) => <ArticleCard key={item.slug} item={item} />)}</div>
        </>
      )}
    </>
  );
}

export const theme: SiteThemeModule = { fonts: [display], Home };
