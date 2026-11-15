import localFont from "next/font/local";
import Image from "next/image";
import Link from "next/link";
import "@/app/css/themes/ringkas.css";
import { EmptyState, formatDate } from "@/components/site/shell";
import type { HomeProps, SiteThemeModule } from "@/components/site/theme-types";
import { cloudinaryUrl, type SiteListItem } from "@/lib/site";

const display = localFont({ src: "../../../app/fonts/LibreBaskerville-latin.woff2", weight: "400 700", variable: "--nf-ringkas-display", display: "swap", preload: false });
const body = localFont({ src: "../../../app/fonts/PublicSans-latin.woff2", weight: "400 700", variable: "--nf-ringkas-body", display: "swap", preload: false });

/** Stories per page; the rank on later pages continues from the previous page. */
const PAGE_SIZE = 12;

function Meta({ item }: { item: SiteListItem }) {
  return (
    <div className="site-meta">
      {item.category && <Link href={`/kategori/${item.category.slug}`}>{item.category.name}</Link>}
      <time dateTime={item.publishedAt?.toISOString()}>{formatDate(item.publishedAt)}</time>
    </div>
  );
}

function TopStory({ item, rank }: { item: SiteListItem; rank: number }) {
  const { image } = item;
  const caption = image ? [image.caption, image.credit].filter(Boolean).join(", ") : "";
  return (
    <article className="ringkas-top">
      <div className="ringkas-top-text">
        <span className="ringkas-rank" aria-hidden="true">{rank}</span>
        <div className="ringkas-top-copy">
          <Meta item={item} />
          <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
          <p>{item.excerpt}</p>
        </div>
      </div>
      {image && (
        <figure className="ringkas-figure">
          <Link href={`/articles/${item.slug}`}>
            <Image src={cloudinaryUrl(image.secureUrl, "f_auto,q_auto,c_fill,w_1000,h_750")} alt={image.altText} width={1000} height={750} sizes="(max-width: 960px) 100vw, 600px" unoptimized />
          </Link>
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      )}
    </article>
  );
}

function Home({ items, query, page }: HomeProps) {
  const start = (page - 1) * PAGE_SIZE;
  const [top, ...rest] = items;
  return (
    <>
      <h1 className="site-heading">{query ? `Hasil untuk “${query}”` : page === 1 ? "Ringkasan hari ini" : "Ringkasan sebelumnya"}</h1>
      {items.length === 0 && <EmptyState>{query ? "Tidak ada berita yang cocok." : "Belum ada berita yang diterbitkan."}</EmptyState>}
      {query && items.length > 0 && (
        <ul className="ringkas-results">
          {items.map((item) => (
            <li key={item.slug}>
              <Meta item={item} />
              <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
              <p>{item.excerpt}</p>
            </li>
          ))}
        </ul>
      )}
      {!query && top && <TopStory item={top} rank={start + 1} />}
      {!query && rest.length > 0 && (
        <ol className="ringkas-list" start={start + 2}>
          {rest.map((item, i) => (
            <li key={item.slug} className="ringkas-item">
              <span className="ringkas-rank" aria-hidden="true">{start + i + 2}</span>
              <div className="ringkas-item-copy">
                <Meta item={item} />
                <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
                <p>{item.excerpt}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export const theme: SiteThemeModule = { fonts: [display, body], Home };
