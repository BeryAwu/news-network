import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import type { CSSProperties, ReactNode } from "react";
import "@/app/site.css";
import { cloudinaryUrl, type Site, type SiteListItem } from "@/lib/site";

const display = localFont({ src: "../../app/fonts/ZillaSlab-700-latin.woff2", weight: "700", variable: "--nf-display", display: "swap" });
const body = localFont({ src: [{ path: "../../app/fonts/Spectral-400-latin.woff2", weight: "400", style: "normal" }, { path: "../../app/fonts/Spectral-500-latin.woff2", weight: "500", style: "normal" }, { path: "../../app/fonts/Spectral-400-italic-latin.woff2", weight: "400", style: "italic" }], variable: "--nf-body", display: "swap" });

const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const longDateFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
export function formatDate(date: Date | null) { return date ? dateFormat.format(date) : ""; }

export function SiteShell({ site, children, query = "" }: { site: Site; children: ReactNode; query?: string }) {
  const { media, theme } = site;
  const style = { "--color-brand": theme.primary } as CSSProperties;
  return (
    <div className={`site ${display.variable} ${body.variable}`} style={style}>
      <header className="site-header">
        <div className="site-wrap">
          <div className="site-masthead">
            <Link href="/" className="site-brand" aria-label={media.displayName}>
              {theme.logoUrl
                ? <Image src={theme.logoUrl} alt={media.displayName} width={180} height={48} className="site-logo" unoptimized />
                : <span className="site-brand-name">{media.displayName}</span>}
            </Link>
            <form action="/" method="get" role="search" className="site-search">
              <input name="q" defaultValue={query} placeholder="Cari berita" aria-label="Cari berita" maxLength={80} />
              <button type="submit" className="site-btn">Cari</button>
            </form>
          </div>
          <div className="site-dateline site-small">
            <span>{longDateFormat.format(new Date())}</span>
            {theme.tagline && <span>{theme.tagline}</span>}
          </div>
          <hr className="site-rule-double" />
          {media.categories.length > 0 && (
            <nav className="site-nav" aria-label="Kategori">
              <Link href="/">Terbaru</Link>
              {media.categories.map((c) => <Link key={c.id} href={`/kategori/${c.slug}`}>{c.name}</Link>)}
            </nav>
          )}
          <hr className="site-rule-double" />
        </div>
      </header>
      <main className="site-wrap site-main">{children}</main>
      <footer className="site-footer">
        <div className="site-wrap">
          <strong>{media.displayName}</strong>
          {media.description && <p>{media.description}</p>}
          {media.publisherDisclosure && <p>Penerbit: {media.publisherDisclosure}</p>}
          {media.ownershipDisclosure && <p>Kepemilikan: {media.ownershipDisclosure}</p>}
          <div className="site-footer-links">
            <span>{media.newsroomByline}</span>
            <a href="/rss.xml">RSS</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Picture({ item, featured }: { item: SiteListItem; featured: boolean }) {
  if (!item.image) return null;
  const caption = [item.image.caption, item.image.credit].filter(Boolean).join(", ");
  return (
    <figure className="site-card-media">
      <Link href={`/articles/${item.slug}`}>
        <Image src={cloudinaryUrl(item.image.secureUrl, featured ? "f_auto,q_auto,c_fill,w_1200,h_675" : "f_auto,q_auto,c_fill,w_600,h_338")} alt={item.image.altText} width={featured ? 1200 : 600} height={featured ? 675 : 338} sizes={featured ? "(max-width: 960px) 100vw, 640px" : "(max-width: 640px) 100vw, 360px"} unoptimized />
      </Link>
      {caption && <figcaption className="site-small">{caption}</figcaption>}
    </figure>
  );
}

export function ArticleCard({ item, featured = false }: { item: SiteListItem; featured?: boolean }) {
  const text = (
    <div className="site-card-body">
      <div className="site-meta">
        {item.category && <Link href={`/kategori/${item.category.slug}`}>{item.category.name}</Link>}
        <time dateTime={item.publishedAt?.toISOString()}>{formatDate(item.publishedAt)}</time>
      </div>
      <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
      <p>{item.excerpt}</p>
    </div>
  );
  return featured
    ? <article className="site-lead"><div>{text}</div><Picture item={item} featured /></article>
    : <article className="site-card"><Picture item={item} featured={false} />{text}</article>;
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="site-pagination" aria-label="Halaman">
      {page > 1 ? <Link href={hrefFor(page - 1)} rel="prev">Sebelumnya</Link> : <span />}
      <span>Halaman {page} dari {pages}</span>
      {page < pages ? <Link href={hrefFor(page + 1)} rel="next">Berikutnya</Link> : <span />}
    </nav>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="site-empty">{children}</p>;
}
