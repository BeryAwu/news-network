import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { EmptyState, formatDate } from "@/components/site/shell";
import type { HomeProps, SiteThemeModule } from "@/components/site/theme-types";
import { cloudinaryUrl, type SiteListItem } from "@/lib/site";
import "@/app/css/themes/gelap.css";

const gelapDisplay = localFont({ src: "../../../app/fonts/BarlowCondensed-700-latin.woff2", weight: "700", variable: "--nf-gelap-display", display: "swap", preload: false });
const gelapBody = localFont({
  src: [
    { path: "../../../app/fonts/Barlow-400-latin.woff2", weight: "400", style: "normal" },
    { path: "../../../app/fonts/Barlow-600-latin.woff2", weight: "600", style: "normal" },
  ],
  variable: "--nf-gelap-body",
  display: "swap",
  preload: false,
});

function Meta({ item }: { item: SiteListItem }) {
  return (
    <div className="site-meta">
      {item.category && <Link href={`/kategori/${item.category.slug}`}>{item.category.name}</Link>}
      <time dateTime={item.publishedAt?.toISOString()}>{formatDate(item.publishedAt)}</time>
    </div>
  );
}

function Lead({ item }: { item: SiteListItem }) {
  const image = item.image;
  const caption = image ? [image.caption, image.credit].filter(Boolean).join(", ") : "";
  return (
    <article className={image ? "g-lead" : "g-lead g-lead--plain"}>
      {image && <Image className="g-lead-img" src={cloudinaryUrl(image.secureUrl, "f_auto,q_auto,c_fill,w_1000,h_1000")} alt={image.altText} width={1000} height={1000} sizes="(max-width: 60rem) 100vw, 620px" priority unoptimized />}
      <div className="g-lead-text">
        <Meta item={item} />
        <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
        <p>{item.excerpt}</p>
        {caption && <p className="g-credit">{caption}</p>}
      </div>
    </article>
  );
}

function Tile({ item }: { item: SiteListItem }) {
  const image = item.image;
  return (
    <article className="g-tile">
      <div className="g-tile-text">
        <Meta item={item} />
        <h3><Link href={`/articles/${item.slug}`}>{item.title}</Link></h3>
      </div>
      {image && (
        <div className="g-tile-media">
          <Image src={cloudinaryUrl(image.secureUrl, "f_auto,q_auto,c_fill,w_400,h_400")} alt={image.altText} width={400} height={400} sizes="176px" unoptimized />
        </div>
      )}
    </article>
  );
}

function Brief({ item }: { item: SiteListItem }) {
  return (
    <article className="g-brief">
      <Meta item={item} />
      <h3><Link href={`/articles/${item.slug}`}>{item.title}</Link></h3>
      <p>{item.excerpt}</p>
    </article>
  );
}

function Home({ items, query, page }: HomeProps) {
  if (items.length === 0) return <EmptyState>{query ? "Tidak ada berita yang cocok." : "Belum ada berita yang diterbitkan."}</EmptyState>;
  if (query) {
    return (
      <>
        <h1 className="site-heading">Hasil untuk “{query}”</h1>
        <ul className="g-results">
          {items.map((item) => (
            <li key={item.slug}>
              <Meta item={item} />
              <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
              <p>{item.excerpt}</p>
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (page > 1) {
    return (
      <section>
        <h2 className="site-heading">Terbaru</h2>
        <div className="g-dense-grid">{items.map((item) => <Brief key={item.slug} item={item} />)}</div>
      </section>
    );
  }
  const [lead, ...rest] = items;
  const stack = rest.slice(0, 4);
  const dense = rest.slice(4);
  return (
    <>
      <div className="g-split">
        <Lead item={lead} />
        {stack.length > 0 && <div className="g-stack">{stack.map((item) => <Tile key={item.slug} item={item} />)}</div>}
      </div>
      {dense.length > 0 && (
        <section className="g-dense">
          <h2 className="site-heading">Berita lain</h2>
          <div className="g-dense-grid">{dense.map((item) => <Brief key={item.slug} item={item} />)}</div>
        </section>
      )}
    </>
  );
}

export const theme: SiteThemeModule = { fonts: [gelapDisplay, gelapBody], Home };
