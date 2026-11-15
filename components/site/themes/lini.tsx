import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { EmptyState, formatDate } from "@/components/site/shell";
import type { HomeProps, SiteThemeModule } from "@/components/site/theme-types";
import { cloudinaryUrl, type SiteListItem } from "@/lib/site";
import "@/app/css/themes/lini.css";

// One humanist family carries headlines and text; the stylesheet maps both font slots to it.
const liniDisplay = localFont({ src: "../../../app/fonts/SourceSans3-latin.woff2", weight: "400 800", variable: "--nf-lini-display", display: "swap", preload: false });

function Meta({ item }: { item: SiteListItem }) {
  return (
    <div className="site-meta">
      {item.category && <Link href={`/kategori/${item.category.slug}`}>{item.category.name}</Link>}
      <time dateTime={item.publishedAt?.toISOString()}>{formatDate(item.publishedAt)}</time>
    </div>
  );
}

function Story({ item, first }: { item: SiteListItem; first: boolean }) {
  const image = item.image;
  const caption = image ? [image.caption, image.credit].filter(Boolean).join(", ") : "";
  const className = ["l-story", first ? "l-story--first" : "", image ? "" : "l-story--text"].filter(Boolean).join(" ");
  return (
    <article className={className}>
      {image && (
        <figure className="l-story-media">
          <Link href={`/articles/${item.slug}`}>
            <Image src={cloudinaryUrl(image.secureUrl, "f_auto,q_auto,c_fill,w_1200,h_675")} alt={image.altText} width={1200} height={675} sizes="(max-width: 42rem) 100vw, 640px" priority={first} unoptimized />
          </Link>
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      )}
      <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
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
        <ul className="l-results">
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
  return <div className="l-stream">{items.map((item, i) => <Story key={item.slug} item={item} first={page === 1 && i === 0} />)}</div>;
}

export const theme: SiteThemeModule = { fonts: [liniDisplay], Home };
