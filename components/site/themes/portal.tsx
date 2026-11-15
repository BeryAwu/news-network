import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import "@/app/css/themes/portal.css";
import { EmptyState, formatDate, formatTime } from "@/components/site/shell";
import type { HomeProps, SiteThemeModule } from "@/components/site/theme-types";
import { cloudinaryUrl, type SiteListItem } from "@/lib/site";

// One variable family carries both the heavy headlines and the body text.
const portalDisplay = localFont({ src: "../../../app/fonts/Archivo-latin.woff2", weight: "400 900", variable: "--nf-portal-display", display: "swap", preload: false });

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
const CATEGORY_COLOURS = 6;

/** Today's stories show the clock time, older ones show the date. */
function when(date: Date | null) {
  if (!date) return "";
  return dayFormat.format(date) === dayFormat.format(new Date()) ? formatTime(date) : formatDate(date);
}

/** The same category always gets the same one of six section colours. */
function categoryClass(item: SiteListItem) {
  const slug = item.category?.slug ?? "";
  let sum = 0;
  for (let i = 0; i < slug.length; i += 1) sum += slug.charCodeAt(i);
  return `portal-cat-${sum % CATEGORY_COLOURS}`;
}

function Meta({ item }: { item: SiteListItem }) {
  return (
    <div className="portal-meta">
      {item.category && <Link href={`/kategori/${item.category.slug}`}>{item.category.name}</Link>}
      <time dateTime={item.publishedAt?.toISOString()}>{when(item.publishedAt)}</time>
    </div>
  );
}

function Photo({ item, size, sizes }: { item: SiteListItem; size: [number, number]; sizes: string }) {
  if (!item.image) return null;
  const [width, height] = size;
  return <Image src={cloudinaryUrl(item.image.secureUrl, `f_auto,q_auto,c_fill,w_${width},h_${height}`)} alt={item.image.altText} width={width} height={height} sizes={sizes} unoptimized />;
}

function Lead({ item }: { item: SiteListItem }) {
  const caption = [item.image?.caption, item.image?.credit].filter(Boolean).join(", ");
  return (
    <article className={`portal-lead ${categoryClass(item)}${item.image ? "" : " portal-lead--plain"}`}>
      {item.image && (
        <figure className="portal-lead-media">
          <Link href={`/articles/${item.slug}`}><Photo item={item} size={[1200, 750]} sizes="(max-width: 960px) 100vw, 740px" /></Link>
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      )}
      <div className="portal-lead-body">
        <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
        <p>{item.excerpt}</p>
        <Meta item={item} />
      </div>
    </article>
  );
}

function Row({ item, excerpt = false }: { item: SiteListItem; excerpt?: boolean }) {
  return (
    <article className={`portal-row ${categoryClass(item)}`}>
      <div className="portal-row-body">
        <h3><Link href={`/articles/${item.slug}`}>{item.title}</Link></h3>
        {excerpt && <p>{item.excerpt}</p>}
        <Meta item={item} />
      </div>
      {item.image && (
        <Link href={`/articles/${item.slug}`} className="portal-row-thumb" tabIndex={-1} aria-hidden="true">
          <Image src={cloudinaryUrl(item.image.secureUrl, "f_auto,q_auto,c_fill,w_240,h_160")} alt="" width={240} height={160} sizes="120px" unoptimized />
        </Link>
      )}
    </article>
  );
}

function Card({ item }: { item: SiteListItem }) {
  return (
    <article className={`portal-card ${categoryClass(item)}${item.image ? "" : " portal-card--plain"}`}>
      {item.image && <figure><Link href={`/articles/${item.slug}`}><Photo item={item} size={[720, 480]} sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 360px" /></Link></figure>}
      <h3><Link href={`/articles/${item.slug}`}>{item.title}</Link></h3>
      <p>{item.excerpt}</p>
      <Meta item={item} />
    </article>
  );
}

function Home({ items, query, page }: HomeProps) {
  if (items.length === 0) return <EmptyState>{query ? "Tidak ada berita yang cocok." : "Belum ada berita yang diterbitkan."}</EmptyState>;
  if (query) {
    return (
      <>
        <h1 className="site-heading">Hasil untuk “{query}”</h1>
        <ul className="portal-results">{items.map((item) => <li key={item.slug}><Row item={item} excerpt /></li>)}</ul>
      </>
    );
  }
  const lead = page === 1 ? items[0] : undefined;
  const latest = lead ? items.slice(1, 6) : [];
  const rest = lead ? items.slice(6) : items;
  return (
    <>
      {lead && (
        <div className={`portal-front${latest.length === 0 ? " portal-front--solo" : ""}`}>
          <Lead item={lead} />
          {latest.length > 0 && (
            <section className="portal-latest" aria-labelledby="portal-latest-title">
              <h2 id="portal-latest-title">Terbaru</h2>
              <ul>{latest.map((item) => <li key={item.slug}><Row item={item} /></li>)}</ul>
            </section>
          )}
        </div>
      )}
      {rest.length > 0 && (
        <section className="portal-more" aria-labelledby="portal-more-title">
          <h2 id="portal-more-title">Berita lain</h2>
          <div className="portal-grid">{rest.map((item) => <Card key={item.slug} item={item} />)}</div>
        </section>
      )}
    </>
  );
}

export const theme: SiteThemeModule = { fonts: [portalDisplay], Home };
