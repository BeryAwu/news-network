import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import "@/app/css/themes/majalah.css";
import { EmptyState, formatDate } from "@/components/site/shell";
import type { HomeProps, SiteThemeModule } from "@/components/site/theme-types";
import { cloudinaryUrl, type SiteListItem } from "@/lib/site";

const display = localFont({ src: "../../../app/fonts/BodoniModa-latin.woff2", weight: "400 900", variable: "--nf-display", display: "swap", preload: false });
const body = localFont({ src: "../../../app/fonts/HankenGrotesk-latin.woff2", weight: "400 600", variable: "--nf-body", display: "swap", preload: false });

const captionOf = (item: SiteListItem) => [item.image?.caption, item.image?.credit].filter(Boolean).join(", ");

function Meta({ item }: { item: SiteListItem }) {
  return (
    <div className="site-meta">
      {item.category && <Link href={`/kategori/${item.category.slug}`}>{item.category.name}</Link>}
      <time dateTime={item.publishedAt?.toISOString()}>{formatDate(item.publishedAt)}</time>
    </div>
  );
}

function Hero({ item }: { item: SiteListItem }) {
  const caption = captionOf(item);
  return (
    <section className={`mag-hero${item.image ? "" : " mag-hero--plain"}`}>
      {item.image && (
        <figure className="mag-hero-media">
          <Link href={`/articles/${item.slug}`}>
            <Image src={cloudinaryUrl(item.image.secureUrl, "f_auto,q_auto,c_fill,w_2000,h_1100")} alt={item.image.altText} width={2000} height={1100} sizes="100vw" priority unoptimized />
          </Link>
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      )}
      <div className="mag-wrap">
        <article className="mag-hero-text">
          <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
          <p>{item.excerpt}</p>
          <Meta item={item} />
        </article>
      </div>
    </section>
  );
}

function Story({ item }: { item: SiteListItem }) {
  const caption = captionOf(item);
  return (
    <article className={`site-card${item.image ? "" : " site-card--plain"}`}>
      {item.image && (
        <figure className="site-card-media">
          <Link href={`/articles/${item.slug}`}>
            <Image src={cloudinaryUrl(item.image.secureUrl, "f_auto,q_auto,c_fill,w_1000,h_800")} alt={item.image.altText} width={1000} height={800} sizes="(max-width: 48rem) 100vw, 58vw" unoptimized />
          </Link>
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      )}
      <div className="site-card-body">
        <h3><Link href={`/articles/${item.slug}`}>{item.title}</Link></h3>
        <p>{item.excerpt}</p>
        <Meta item={item} />
      </div>
    </article>
  );
}

function Home({ items, query, page }: HomeProps) {
  if (items.length === 0) return <EmptyState>{query ? "Tidak ada berita yang cocok." : "Belum ada berita yang diterbitkan."}</EmptyState>;
  if (query) {
    return (
      <>
        <h1 className="site-heading">Hasil untuk “{query}”</h1>
        <ul className="mag-results">
          {items.map((item) => (
            <li key={item.slug}>
              <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
              <p>{item.excerpt}</p>
              <Meta item={item} />
            </li>
          ))}
        </ul>
      </>
    );
  }
  const hero = page === 1 ? items[0] : undefined;
  const rest = hero ? items.slice(1) : items;
  return (
    <>
      {hero && <Hero item={hero} />}
      {rest.length > 0 && (
        <section className="mag-more" aria-labelledby="mag-more-title">
          <h2 id="mag-more-title">Berita lain</h2>
          <div className="site-grid">{rest.map((item) => <Story key={item.slug} item={item} />)}</div>
        </section>
      )}
    </>
  );
}

export const theme: SiteThemeModule = { fonts: [display, body], Home };
