import localFont from "next/font/local";
import Image from "next/image";
import Link from "next/link";
import "@/app/css/themes/mosaik.css";
import { EmptyState, formatDate } from "@/components/site/shell";
import type { HomeProps, SiteThemeModule } from "@/components/site/theme-types";
import { cloudinaryUrl, type SiteListItem } from "@/lib/site";

const mosaikDisplay = localFont({ src: "../../../app/fonts/Anton-latin.woff2", weight: "400", variable: "--nf-mosaik-display", display: "swap", preload: false });
const mosaikBody = localFont({ src: "../../../app/fonts/Archivo-latin.woff2", weight: "400 800", variable: "--nf-mosaik-body", display: "swap", preload: false });

/** Tile sizes in grid order; the pattern repeats every 7 stories: one 2x2, four 1x1, two 2x1. */
const PATTERN = ["lg", "sm", "sm", "sm", "sm", "wide", "wide"] as const;
type Size = (typeof PATTERN)[number];
const IMAGE_SIZE: Record<Size, { w: number; h: number; sizes: string }> = {
  lg: { w: 1200, h: 900, sizes: "(max-width: 960px) 100vw, 600px" },
  wide: { w: 900, h: 450, sizes: "(max-width: 960px) 100vw, 600px" },
  sm: { w: 600, h: 450, sizes: "(max-width: 640px) 100vw, 300px" },
};

function Meta({ item }: { item: SiteListItem }) {
  return (
    <div className="site-meta">
      {item.category && <Link href={`/kategori/${item.category.slug}`}>{item.category.name}</Link>}
      <time dateTime={item.publishedAt?.toISOString()}>{formatDate(item.publishedAt)}</time>
    </div>
  );
}

function Tile({ item, size }: { item: SiteListItem; size: Size }) {
  const { image } = item;
  const dims = IMAGE_SIZE[size];
  return (
    <article className={`mosaik-tile mosaik-tile--${size}${image ? "" : " mosaik-tile--text"}`}>
      {image && <Image className="mosaik-tile-img" src={cloudinaryUrl(image.secureUrl, `f_auto,q_auto,c_fill,w_${dims.w},h_${dims.h}`)} alt={image.altText} width={dims.w} height={dims.h} sizes={dims.sizes} unoptimized />}
      <div className="mosaik-tile-body">
        <Meta item={item} />
        <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
        {size !== "sm" && <p>{item.excerpt}</p>}
      </div>
    </article>
  );
}

function Results({ items }: { items: SiteListItem[] }) {
  return (
    <ul className="mosaik-results">
      {items.map((item) => (
        <li key={item.slug}>
          <Meta item={item} />
          <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
          <p>{item.excerpt}</p>
        </li>
      ))}
    </ul>
  );
}

/** Mosaic: the lead is a 2x2 tile, the rest follow the 7-tile pattern. Later pages start after the lead tile. */
function Home({ items, query, page }: HomeProps) {
  const offset = page === 1 ? 0 : 1;
  return (
    <>
      {query && <h1 className="site-heading">Hasil untuk “{query}”</h1>}
      {items.length === 0 && <EmptyState>{query ? "Tidak ada berita yang cocok." : "Belum ada berita yang diterbitkan."}</EmptyState>}
      {query && items.length > 0 && <Results items={items} />}
      {!query && items.length > 0 && (
        <div className="mosaik-grid">{items.map((item, i) => <Tile key={item.slug} item={item} size={PATTERN[(i + offset) % PATTERN.length]} />)}</div>
      )}
    </>
  );
}

export const theme: SiteThemeModule = { fonts: [mosaikDisplay, mosaikBody], Home };
