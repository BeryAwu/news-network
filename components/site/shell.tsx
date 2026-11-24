import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import type { CSSProperties, ReactNode } from "react";
import "@/app/site.css";
import { SiteLogoMark } from "@/components/site/logo";
import { inkOn } from "@/lib/logo-mark";
import { cloudinaryUrl, type Site, type SiteListItem } from "@/lib/site";

/** Headlines and interface: a grotesque drawn for a news publisher. */
const display = localFont({ src: "../../app/fonts/SchibstedGrotesk-latin.woff2", weight: "400 800", variable: "--site-font-display", display: "swap" });
/** Article text: a serif made for reading on screens. */
const reading = localFont({
  src: [
    { path: "../../app/fonts/Spectral-400-latin.woff2", weight: "400", style: "normal" },
    { path: "../../app/fonts/Spectral-500-latin.woff2", weight: "500", style: "normal" },
    { path: "../../app/fonts/Spectral-400-italic-latin.woff2", weight: "400", style: "italic" },
  ],
  variable: "--site-font-reading",
  display: "swap",
});

const tz = "Asia/Jakarta";
const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: tz });
const shortDateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: tz });
const longDateFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz });
const timeFormat = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: tz });

export function formatDate(date: Date | null) { return date ? dateFormat.format(date) : ""; }
export function formatShortDate(date: Date | null) { return date ? shortDateFormat.format(date) : ""; }
export function formatLongDate(date: Date | null) { return date ? longDateFormat.format(date) : ""; }
export function formatTime(date: Date | null) { return date ? `${timeFormat.format(date).replace(":", ".")} WIB` : ""; }

function Brand({ site }: { site: Site }) {
  const { media, theme } = site;
  return (
    <Link href="/" className="site-brand" aria-label={`${media.displayName}, ke beranda`}>
      {theme.logoUrl
        ? <Image src={theme.logoUrl} alt={media.displayName} width={200} height={52} className="site-logo" unoptimized />
        : <><SiteLogoMark color={theme.primary} name={media.displayName} size={44} /><span className="site-brand-name">{media.displayName}</span></>}
    </Link>
  );
}

function SearchForm({ query }: { query: string }) {
  return (
    <form action="/" method="get" role="search" className="site-search">
      <label className="site-visually-hidden" htmlFor="site-search-input">Cari berita</label>
      <input id="site-search-input" name="q" type="search" defaultValue={query} placeholder="Cari berita…" maxLength={80} />
      <button type="submit">Cari</button>
    </form>
  );
}

function Nav({ site, current }: { site: Site; current?: string }) {
  return (
    <nav className="site-nav" aria-label="Rubrik">
      <div className="site-wrap site-nav-row">
        <Link href="/" aria-current={current === "home" ? "page" : undefined}>Beranda</Link>
        {site.media.categories.map((c) => <Link key={c.id} href={`/kategori/${c.slug}`} aria-current={current === c.slug ? "page" : undefined}>{c.name}</Link>)}
      </div>
    </nav>
  );
}

/**
 * The one layout every media site shares. Only the name, logo, tagline and brand colour change per media:
 * the colour is fed in as --brand and everything else is fixed in app/site.css.
 */
export function SiteShell({ site, children, query = "", current }: { site: Site; children: ReactNode; query?: string; current?: string }) {
  const { media, theme } = site;
  const style = { "--brand": theme.primary, "--brand-ink": inkOn(theme.primary) } as CSSProperties;
  const year = new Date().getFullYear();
  return (
    <div className={`site ${display.variable} ${reading.variable}`} style={style}>
      <a className="site-skip" href="#konten">Langsung ke isi</a>
      <div className="site-topbar">
        <div className="site-wrap site-topbar-row">
          <span>{formatLongDate(new Date())}</span>
          {theme.tagline && <span className="site-topbar-tagline">{theme.tagline}</span>}
        </div>
      </div>
      <header className="site-masthead">
        <div className="site-wrap site-masthead-row">
          <Brand site={site} />
          <SearchForm query={query} />
        </div>
      </header>
      <Nav site={site} current={current} />
      <main id="konten" className="site-wrap site-main">{children}</main>
      <footer className="site-footer">
        <div className="site-wrap site-footer-grid">
          <div className="site-footer-about">
            <Brand site={site} />
            {(media.description || theme.tagline) && <p>{media.description || theme.tagline}</p>}
          </div>
          {media.categories.length > 0 && (
            <nav aria-label="Rubrik di kaki halaman">
              <h2>Rubrik</h2>
              <ul>{media.categories.map((c) => <li key={c.id}><Link href={`/kategori/${c.slug}`}>{c.name}</Link></li>)}</ul>
            </nav>
          )}
          <div>
            <h2>Redaksi</h2>
            <ul>
              <li>{media.newsroomByline}</li>
              {media.publisherDisclosure && <li>Penerbit: {media.publisherDisclosure}</li>}
              {media.ownershipDisclosure && <li>Kepemilikan: {media.ownershipDisclosure}</li>}
              <li><a href="/rss.xml">Langganan RSS</a></li>
            </ul>
          </div>
        </div>
        <div className="site-wrap"><p className="site-footer-base">© {year} {media.displayName}. Hak cipta dilindungi.</p></div>
      </footer>
    </div>
  );
}

/** "Oleh <name>" followed by the publish date, both as plain text the reader can scan. */
export function Byline({ item, withTime = false }: { item: Pick<SiteListItem, "authorName" | "publishedAt">; withTime?: boolean }) {
  return (
    <p className="site-byline">
      <span>Oleh <strong>{item.authorName}</strong></span>
      <time dateTime={item.publishedAt?.toISOString()}>{withTime ? `${formatShortDate(item.publishedAt)}, ${formatTime(item.publishedAt)}` : formatShortDate(item.publishedAt)}</time>
    </p>
  );
}

function Thumb({ item, width, height, sizes }: { item: SiteListItem; width: number; height: number; sizes: string }) {
  if (!item.image) return <div className="site-thumb site-thumb-empty" aria-hidden="true" />;
  return <Image className="site-thumb" src={cloudinaryUrl(item.image.secureUrl, `f_auto,q_auto,c_fill,w_${width},h_${height}`)} alt={item.image.altText} width={width} height={height} sizes={sizes} unoptimized />;
}

/** One story as a row: picture on the left, headline and byline on the right. */
export function StoryRow({ item, showExcerpt = true }: { item: SiteListItem; showExcerpt?: boolean }) {
  return (
    <article className="site-row">
      <Link href={`/articles/${item.slug}`} className="site-row-media" tabIndex={-1} aria-hidden="true"><Thumb item={item} width={480} height={300} sizes="(max-width: 640px) 34vw, 240px" /></Link>
      <div className="site-row-body">
        {item.category && <Link className="site-kicker" href={`/kategori/${item.category.slug}`}>{item.category.name}</Link>}
        <h3><Link href={`/articles/${item.slug}`}>{item.title}</Link></h3>
        {showExcerpt && item.excerpt && <p className="site-row-excerpt">{item.excerpt}</p>}
        <Byline item={item} />
      </div>
    </article>
  );
}

/** One story as a card with a wide picture, for grids. */
export function StoryCard({ item }: { item: SiteListItem }) {
  return (
    <article className="site-card">
      <Link href={`/articles/${item.slug}`} className="site-card-media" tabIndex={-1} aria-hidden="true"><Thumb item={item} width={720} height={405} sizes="(max-width: 640px) 100vw, 360px" /></Link>
      {item.category && <Link className="site-kicker" href={`/kategori/${item.category.slug}`}>{item.category.name}</Link>}
      <h3><Link href={`/articles/${item.slug}`}>{item.title}</Link></h3>
      <Byline item={item} />
    </article>
  );
}

export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return <h2 id={id} className="site-section-title">{children}</h2>;
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="site-pager" aria-label="Halaman">
      {page > 1 ? <Link href={hrefFor(page - 1)} rel="prev">Sebelumnya</Link> : <span />}
      <span>Halaman {page} dari {pages}</span>
      {page < pages ? <Link href={hrefFor(page + 1)} rel="next">Berikutnya</Link> : <span />}
    </nav>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="site-empty">{children}</p>;
}
