import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { EmptyState, formatDate, formatTime } from "@/components/site/shell";
import type { HomeProps, SiteThemeModule } from "@/components/site/theme-types";
import { cloudinaryUrl, type SiteListItem } from "@/lib/site";
import "@/app/css/themes/waktu.css";

// Schibsted Grotesk carries headlines and text (the stylesheet maps both font slots to it); JetBrains Mono sets the clock times.
const display = localFont({ src: "../../../app/fonts/SchibstedGrotesk-latin.woff2", weight: "400 800", variable: "--nf-waktu-display", display: "swap", preload: false });
const outlier = localFont({ src: "../../../app/fonts/JetBrainsMono-latin.woff2", weight: "400 600", variable: "--nf-waktu-outlier", display: "swap", preload: false });

const dayLabel = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const dayIso = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" });

interface Day { label: string; iso: string | undefined; items: SiteListItem[] }

/** Newest-first stories grouped into runs that share a calendar day in Jakarta time. */
function groupByDay(items: SiteListItem[]): Day[] {
  const days: Day[] = [];
  for (const item of items) {
    const label = item.publishedAt ? dayLabel.format(item.publishedAt) : "";
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(item);
    else days.push({ label, iso: item.publishedAt ? dayIso.format(item.publishedAt) : undefined, items: [item] });
  }
  return days;
}

function Entry({ item, latest }: { item: SiteListItem; latest: boolean }) {
  const image = item.image;
  return (
    <li className={latest ? "w-entry w-entry--latest" : "w-entry"}>
      <time className="w-time" dateTime={item.publishedAt?.toISOString()}>{formatTime(item.publishedAt)}</time>
      <article className="w-card">
        <div className="w-card-text">
          {item.category && <div className="site-meta"><Link href={`/kategori/${item.category.slug}`}>{item.category.name}</Link></div>}
          <h3><Link href={`/articles/${item.slug}`}>{item.title}</Link></h3>
          <p>{item.excerpt}</p>
        </div>
        {image && <Image className="w-thumb" src={cloudinaryUrl(image.secureUrl, "f_auto,q_auto,c_fill,w_300,h_300")} alt={image.altText} width={300} height={300} sizes="104px" unoptimized />}
      </article>
    </li>
  );
}

function Home({ items, query, page }: HomeProps) {
  if (items.length === 0) return <EmptyState>{query ? "Tidak ada berita yang cocok." : "Belum ada berita yang diterbitkan."}</EmptyState>;
  if (query) {
    return (
      <>
        <h1 className="site-heading">Hasil untuk “{query}”</h1>
        <ul className="w-results">
          {items.map((item) => (
            <li key={item.slug}>
              <div className="site-meta">
                {item.category && <Link href={`/kategori/${item.category.slug}`}>{item.category.name}</Link>}
                <time dateTime={item.publishedAt?.toISOString()}>{formatDate(item.publishedAt)}</time>
              </div>
              <h2><Link href={`/articles/${item.slug}`}>{item.title}</Link></h2>
              <p>{item.excerpt}</p>
            </li>
          ))}
        </ul>
      </>
    );
  }
  return (
    <div className="w-feed">
      {groupByDay(items).map((day, d) => (
        <section className="w-day" key={day.label + d}>
          {day.label && <h2 className="w-day-head"><time dateTime={day.iso}>{day.label}</time></h2>}
          <ol className="w-list">
            {day.items.map((item, i) => <Entry key={item.slug} item={item} latest={page === 1 && d === 0 && i === 0} />)}
          </ol>
        </section>
      ))}
    </div>
  );
}

export const theme: SiteThemeModule = { fonts: [display, outlier], Home };
