import Link from "next/link";
import { FileSpreadsheet, FileText } from "lucide-react";
import { EmptyState, PageHeading } from "@/components/ui";
import { HorizontalBars } from "@/components/charts";
import { requireUser } from "@/lib/auth";
import { mediaStats, parseReportDate, publishedRows, type MediaStat, type PublishedRow } from "@/lib/reports";
import "@/app/css/reports.css";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 50;
const dayMs = 24 * 60 * 60 * 1000;
const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const dayOnly = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const number = new Intl.NumberFormat("id-ID");

const presets = [
  { key: "today", label: "Hari ini" },
  { key: "7d", label: "7 hari terakhir" },
  { key: "30d", label: "30 hari terakhir" },
  { key: "month", label: "Bulan ini" },
  { key: "all", label: "Semua" },
] as const;
type PresetKey = (typeof presets)[number]["key"];

type Query = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Today in Asia/Jakarta as YYYY-MM-DD. */
function jakartaDay(offsetDays = 0) {
  return new Date(Date.now() + 7 * 60 * 60 * 1000 + offsetDays * dayMs).toISOString().slice(0, 10);
}

function presetDates(key: PresetKey): { from: string; to: string } {
  const today = jakartaDay();
  if (key === "today") return { from: today, to: today };
  if (key === "7d") return { from: jakartaDay(-6), to: today };
  if (key === "30d") return { from: jakartaDay(-29), to: today };
  if (key === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: "", to: "" };
}

function relativeTime(date: Date | null) {
  if (!date) return "Belum ada";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return dayOnly.format(date);
}

function href(params: Record<string, string>, path = "/reports") {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}

function Hosts({ hostnames }: { hostnames: string[] }) {
  return hostnames.length ? <span className="rep-hosts">{hostnames.join(", ")}</span> : <span className="rep-hosts">Alamat belum dikonfirmasi</span>;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireUser();
  const query = await searchParams;

  const rangeParam = first(query.range);
  const fromParam = first(query.from) ?? "";
  const toParam = first(query.to) ?? "";
  const custom = !rangeParam && (fromParam || toParam);
  const presetKey: PresetKey = custom ? "all" : presets.some((p) => p.key === rangeParam) ? (rangeParam as PresetKey) : "30d";
  const dates = custom ? { from: parseReportDate(fromParam) ? fromParam : "", to: parseReportDate(toParam) ? toParam : "" } : presetDates(presetKey);
  const activeRange = custom ? "custom" : presetKey;

  const mediaParam = [query.media].flat().filter((v): v is string => typeof v === "string").flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  const selected = new Set(mediaParam);
  const mediaValue = [...selected].join(",");

  const from = parseReportDate(dates.from || null);
  const to = parseReportDate(dates.to || null, true);
  const badRange = Boolean(from && to && from > to);

  let stats: MediaStat[] = [];
  let rows: PublishedRow[] = [];
  let failed = false;
  if (!badRange) {
    try {
      const all = await mediaStats(user.id, { from, to });
      const ids = new Set(all.map((m) => m.mediaSiteId));
      const chosen = [...selected].filter((id) => ids.has(id));
      stats = all;
      rows = await publishedRows(user.id, { from, to }, chosen);
    } catch {
      failed = true;
    }
  }

  const shown = selected.size ? stats.filter((m) => selected.has(m.mediaSiteId)) : stats;
  const totalAll = shown.reduce((sum, m) => sum + m.publishedTotal, 0);
  const totalRange = shown.reduce((sum, m) => sum + m.publishedInRange, 0);
  const activeMedia = shown.filter((m) => m.publishedInRange > 0).length;
  const latest = shown.reduce<Date | null>((acc, m) => (m.lastPublishedAt && (!acc || m.lastPublishedAt > acc) ? m.lastPublishedAt : acc), null);
  const periodText = dates.from || dates.to
    ? `${dates.from ? dayOnly.format(parseReportDate(dates.from)!) : "awal"} sampai ${dates.to ? dayOnly.format(parseReportDate(dates.to)!) : "sekarang"}`
    : "semua waktu";

  const exportParams = { from: dates.from, to: dates.to, media: mediaValue };
  const exportHref = (format: "xlsx" | "pdf") => href({ format, ...exportParams }, "/api/reports/export");

  return (
    <>
      <PageHeading title="Laporan" subtitle="Lihat berapa berita yang sudah terbit di tiap media, lalu unduh daftarnya." />
      <div className="stack">
        <section className="card stack" aria-labelledby="rep-period">
          <h2 id="rep-period">Pilih periode</h2>
          <nav className="rep-presets" aria-label="Periode cepat">
            {presets.map((p) => (
              <Link key={p.key} className={`btn ${activeRange === p.key ? "btn-primary" : ""}`} aria-current={activeRange === p.key ? "true" : undefined} href={href({ range: p.key, media: mediaValue })}>
                {p.label}
              </Link>
            ))}
          </nav>
          <form className="stack" action="/reports" method="get">
            <div className="rep-dates">
              <div className="field"><label htmlFor="rep-from">Dari</label><input id="rep-from" name="from" type="date" defaultValue={dates.from} /></div>
              <div className="field"><label htmlFor="rep-to">Sampai</label><input id="rep-to" name="to" type="date" defaultValue={dates.to} /></div>
            </div>
            {stats.length > 1 && (
              <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="field-label">Media</legend>
                <div className="rep-media">
                  {stats.map((m) => (
                    <label className="choice" key={m.mediaSiteId}>
                      <input type="checkbox" name="media" value={m.mediaSiteId} defaultChecked={selected.has(m.mediaSiteId)} />
                      <span>{m.mediaName}</span>
                    </label>
                  ))}
                </div>
                <span className="field-help">Tidak memilih media berarti semua media ikut.</span>
              </fieldset>
            )}
            <div className="rep-submit">
              <button className="btn" type="submit">Tampilkan</button>
              <span className="muted">Periode: {periodText}</span>
            </div>
          </form>
        </section>

        {badRange && <div className="notice notice-error" role="alert"><span>Tanggal &quot;Dari&quot; lebih baru daripada tanggal &quot;Sampai&quot;. Tukar kedua tanggal itu lalu tekan Tampilkan.</span></div>}
        {failed && <div className="notice notice-error" role="alert"><span>Laporan belum bisa dimuat. Muat ulang halaman ini. Jika masih gagal, coba lagi beberapa menit lagi.</span></div>}

        {!badRange && !failed && (stats.length === 0 ? (
          <EmptyState title="Belum ada media" detail="Laporan muncul setelah Anda menambahkan media dan menerbitkan berita." href="/media" label="Buka Media saya" />
        ) : (
          <>
            <div className="grid-4">
              <div className="card stat"><span className="stat-label">Total berita terbit</span><span className="stat-figure">{number.format(totalAll)}</span><span className="stat-hint">sejak awal</span></div>
              <div className="card stat"><span className="stat-label">Terbit pada periode</span><span className="stat-figure">{number.format(totalRange)}</span><span className="stat-hint">{periodText}</span></div>
              <div className="card stat"><span className="stat-label">Media aktif</span><span className="stat-figure">{number.format(activeMedia)}</span><span className="stat-hint">dari {number.format(shown.length)} media, pada periode ini</span></div>
              <div className="card stat"><span className="stat-label">Terakhir terbit</span><span className="stat-figure" style={{ fontSize: "var(--app-text-xl)" }}>{relativeTime(latest)}</span>{latest && <span className="stat-hint">{dateTime.format(latest)}</span>}</div>
            </div>

            <section className="stack" aria-labelledby="rep-media-title">
              <h2 id="rep-media-title">Pantauan per media</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th scope="col">Media</th><th scope="col">Total terbit</th><th scope="col">Terbit pada periode</th><th scope="col">Terakhir terbit</th><th scope="col">Menunggu diperiksa</th><th scope="col">Siap terbit</th></tr>
                  </thead>
                  <tbody>
                    {shown.map((m) => (
                      <tr key={m.mediaSiteId}>
                        <td>
                          <div className="rep-name">{m.mediaName}</div>
                          <Hosts hostnames={m.hostnames} />
                          {m.publishedTotal === 0 && <div><span className="badge">Belum ada berita</span></div>}
                        </td>
                        <td className="num">{number.format(m.publishedTotal)}</td>
                        <td className="num">{number.format(m.publishedInRange)}</td>
                        <td>{m.lastPublishedAt ? relativeTime(m.lastPublishedAt) : <span className="muted">Belum ada</span>}</td>
                        <td className="num">{m.waiting > 0 ? <Link href="/blasts">{number.format(m.waiting)}</Link> : "0"}</td>
                        <td className="num">{m.ready > 0 ? <Link href="/blasts">{number.format(m.ready)}</Link> : "0"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card stack-sm">
                <strong>Berita terbit pada periode, per media</strong>
                <HorizontalBars rows={shown.map((m) => ({ label: m.mediaName, value: m.publishedInRange }))} unit="berita" />
              </div>
            </section>

            <section className="card card-soft stack" aria-labelledby="rep-export-title">
              <h2 id="rep-export-title">Unduh daftar berita terbit</h2>
              <p>Berkas berisi tanggal terbit, media, judul, dan link setiap berita, sesuai periode dan media yang Anda pilih di atas.</p>
              <div className="rep-export">
                <a className="btn btn-primary" href={exportHref("xlsx")} download><FileSpreadsheet size={20} aria-hidden="true" />Unduh Excel (.xlsx)</a>
                <a className="btn" href={exportHref("pdf")} download><FileText size={20} aria-hidden="true" />Unduh PDF</a>
              </div>
            </section>

            <section className="stack" aria-labelledby="rep-list-title">
              <h2 id="rep-list-title">Daftar berita terbit</h2>
              {rows.length === 0 ? (
                <div className="empty"><strong>Belum ada berita terbit pada periode ini.</strong><span>Pilih periode lain, atau tulis berita baru.</span></div>
              ) : (
                <>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th scope="col">Tanggal terbit</th><th scope="col">Media</th><th scope="col">Judul</th><th scope="col">Link</th></tr></thead>
                      <tbody>
                        {rows.slice(0, LIST_LIMIT).map((r, i) => (
                          <tr key={`${r.url}-${i}`}>
                            <td>{dateTime.format(r.publishedAt)}</td>
                            <td>{r.mediaName}</td>
                            <td className="rep-title">{r.title || <span className="muted">Tanpa judul</span>}</td>
                            <td className="rep-link"><a href={r.url} target="_blank" rel="noopener noreferrer">Buka berita</a></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > LIST_LIMIT && <p className="muted">Menampilkan {LIST_LIMIT} dari {number.format(rows.length)}. Unduh untuk daftar lengkap.</p>}
                </>
              )}
            </section>
          </>
        ))}
      </div>
    </>
  );
}
