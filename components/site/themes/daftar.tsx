import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import "@/app/css/themes/daftar.css";
import { EmptyState, formatDate, formatTime } from "@/components/site/shell";
import type { HomeProps, SiteThemeModule } from "@/components/site/theme-types";
import { cloudinaryUrl, type SiteListItem } from "@/lib/site";

// One compact variable family for the whole design.
const display = localFont({ src: "../../../app/fonts/IBMPlexSans-latin.woff2", weight: "400 700", variable: "--nf-display", display: "swap", preload: false });

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
const DAY_MS = 24 * 60 * 60 * 1000;

interface DayGroup { key: string; label: string; items: SiteListItem[] }

/** Splits newest-first stories into runs of the same Asia/Jakarta calendar day. */
function groupByDay(items: SiteListItem[]): DayGroup[] {
  const now = Date.now();
  const today = dayFormat.format(now);
  const yesterday = dayFormat.format(now - DAY_MS);
  const groups: DayGroup[] = [];
  for (const item of items) {
    const key = item.publishedAt ? dayFormat.format(item.publishedAt) : "tanpa-tanggal";
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      const label = !item.publishedAt ? "Tanpa tanggal" : key === today ? "Hari ini" : key === yesterday ? "Kemarin" : formatDate(item.publishedAt);
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

function Row({ item, showDate }: { item: SiteListItem; showDate: boolean }) {
  const href = `/articles/${item.slug}`;
  return (
    <article className="daftar-row">
      {item.image
        ? (
          <Link href={href} className="daftar-thumb" tabIndex={-1} aria-hidden="true">
            <Image src={cloudinaryUrl(item.image.secureUrl, "f_auto,q_auto,c_fill,w_240,h_160")} alt="" width={240} height={160} sizes="120px" unoptimized />
          </Link>
        )
        : <span className="daftar-thumb daftar-thumb--none" aria-hidden="true" />}
      <div className="daftar-body">
        <h3><Link href={href}>{item.title}</Link></h3>
        <p>{item.excerpt}</p>
      </div>
      <div className="daftar-side">
        {item.category && <Link href={`/kategori/${item.category.slug}`}>{item.category.name}</Link>}
        <time dateTime={item.publishedAt?.toISOString()}>{showDate ? `${formatDate(item.publishedAt)}, ${formatTime(item.publishedAt)}` : formatTime(item.publishedAt)}</time>
      </div>
    </article>
  );
}

function Home({ items, query }: HomeProps) {
  if (items.length === 0) return <EmptyState>{query ? "Tidak ada berita yang cocok." : "Belum ada berita yang diterbitkan."}</EmptyState>;
  if (query) {
    return (
      <>
        <h1 className="site-heading">Hasil untuk “{query}”</h1>
        <ul className="daftar-list">{items.map((item) => <li key={item.slug}><Row item={item} showDate /></li>)}</ul>
      </>
    );
  }
  return (
    <>
      {groupByDay(items).map((group) => (
        <section key={group.key} className="daftar-day" aria-labelledby={`daftar-day-${group.key}`}>
          <h2 id={`daftar-day-${group.key}`}>{group.label}</h2>
          <ul className="daftar-list">{group.items.map((item) => <li key={item.slug}><Row item={item} showDate={false} /></li>)}</ul>
        </section>
      ))}
    </>
  );
}

export const theme: SiteThemeModule = { fonts: [display], Home };
