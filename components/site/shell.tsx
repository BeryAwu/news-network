import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import "@/app/site.css";
import { SiteLogoMark } from "@/components/site/logo";
import { loadSiteTheme } from "@/components/site/theme-loader";
import { themeInfo } from "@/lib/site-themes";
import { cloudinaryUrl, type Site, type SiteListItem } from "@/lib/site";

const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const longDateFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
export function formatDate(date: Date | null) { return date ? dateFormat.format(date) : ""; }
const timeFormat = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
export function formatTime(date: Date | null) { return date ? timeFormat.format(date).replace(".", ":") : ""; }

function Brand({ site }: { site: Site }) {
  const { media, theme } = site;
  const info = themeInfo(theme.template);
  return (
    <Link href="/" className="site-brand" aria-label={media.displayName}>
      {theme.logoUrl
        ? <Image src={theme.logoUrl} alt={media.displayName} width={180} height={48} className="site-logo" unoptimized />
        : <><SiteLogoMark shape={info.mark} color={theme.primary} name={media.displayName} /><span className="site-brand-name">{media.displayName}</span></>}
    </Link>
  );
}

function SearchForm({ query }: { query: string }) {
  return (
    <form action="/" method="get" role="search" className="site-search">
      <input name="q" defaultValue={query} placeholder="Cari berita" aria-label="Cari berita" maxLength={80} />
      <button type="submit" className="site-btn">Cari</button>
    </form>
  );
}

function CategoryNav({ site }: { site: Site }) {
  if (!site.media.categories.length) return null;
  return (
    <nav className="site-nav" aria-label="Kategori">
      <Link href="/">Terbaru</Link>
      {site.media.categories.map((c) => <Link key={c.id} href={`/kategori/${c.slug}`}>{c.name}</Link>)}
    </nav>
  );
}

function Header({ site, query, variant }: { site: Site; query: string; variant: string }) {
  const today = longDateFormat.format(new Date());
  const tagline = site.theme.tagline;
  if (variant === "bar") {
    return (
      <header className="site-header site-header--bar">
        <div className="site-wrap site-header-row"><Brand site={site} /><CategoryNav site={site} /><SearchForm query={query} /></div>
      </header>
    );
  }
  if (variant === "stacked") {
    return (
      <header className="site-header site-header--stacked">
        <div className="site-topline"><div className="site-wrap site-topline-row"><span>{today}</span>{tagline && <span>{tagline}</span>}</div></div>
        <div className="site-wrap site-header-row"><Brand site={site} /><SearchForm query={query} /></div>
        <div className="site-navband"><div className="site-wrap"><CategoryNav site={site} /></div></div>
      </header>
    );
  }
  if (variant === "minimal") {
    return (
      <header className="site-header site-header--minimal">
        <div className="site-wrap site-header-row"><Brand site={site} />{tagline && <p className="site-tagline-inline">{tagline}</p>}</div>
        <div className="site-wrap site-header-sub"><CategoryNav site={site} /><SearchForm query={query} /></div>
      </header>
    );
  }
  return (
    <header className="site-header site-header--center">
      <div className="site-wrap">
        <div className="site-masthead"><Brand site={site} /><SearchForm query={query} /></div>
        <div className="site-dateline site-small"><span>{today}</span>{tagline && <span>{tagline}</span>}</div>
        <hr className="site-rule-double" />
        <CategoryNav site={site} />
        <hr className="site-rule-double" />
      </div>
    </header>
  );
}

export async function SiteShell({ site, children, query = "" }: { site: Site; children: ReactNode; query?: string }) {
  const { media, theme } = site;
  const info = themeInfo(theme.template);
  const mod = await loadSiteTheme(info.slug);
  // next/font names each family after its variable, so every design owns unique names; map them back to the generic ones the stylesheets use.
  const style = { "--color-brand": theme.primary, "--nf-display": `var(--nf-${info.slug}-display)`, "--nf-body": `var(--nf-${info.slug}-body)`, "--nf-outlier": `var(--nf-${info.slug}-outlier)` } as CSSProperties;
  return (
    <div className={`site t-${info.slug} ${mod.fonts.map((font) => font.variable).join(" ")}`} data-dark={info.dark ? "true" : undefined} style={style}>
      <Header site={site} query={query} variant={info.header} />
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
