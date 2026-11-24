import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleAlert, PenLine } from "lucide-react";
import { EmptyState, PageHeading } from "@/components/ui";
import { formatWhen, legacyStatusInfo, statusInfo } from "@/components/blast-format";
import { requireUser } from "@/lib/auth";
import { listBlasts } from "@/lib/blasts";
import type { BlastListItem } from "@/lib/blast-types";
import BlastLedger from "@/components/blast-ledger";
import "@/app/css/blasts.css";

export const dynamic = "force-dynamic";

const number = new Intl.NumberFormat("id-ID");

interface BlastPage { items: BlastListItem[]; total: number; page: number; pages: number }

type ViewMode = "kartu" | "lembar";

function pageHref(page: number, view: ViewMode = "kartu", search = "", status = "") {
  const params = new URLSearchParams();
  if (view !== "kartu") params.set("view", view);
  if (page > 1) params.set("page", String(page));
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  const query = params.toString();
  return query ? `/blasts?${query}` : "/blasts";
}

function viewHref(view: ViewMode, page: number, search = "", status = "") {
  return pageHref(page, view, search, status);
}

function mediaLine(item: BlastListItem) {
  if (item.status === "GENERATING" || item.status === "FAILED") return `Dipilih untuk ${number.format(item.mediaCount)} media`;
  return `${number.format(item.publishedCount)} dari ${number.format(item.mediaCount)} media terbit`;
}

export default async function BlastsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const query = await searchParams;
  const raw = Array.isArray(query.page) ? query.page[0] : query.page;
  const requested = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
  const rawView = Array.isArray(query.view) ? query.view[0] : query.view;
  const view: ViewMode = rawView === "lembar" ? "lembar" : "kartu";
  const search = (Array.isArray(query.q) ? query.q[0] : query.q)?.trim() ?? "";
  const status = (Array.isArray(query.status) ? query.status[0] : query.status)?.trim() ?? "";

  let data: BlastPage | null = null;
  try {
    data = await listBlasts(user.id, requested, 20, { search: search || undefined, status: status || undefined });
  } catch {
    data = null;
  }

  const write = <Link className="btn btn-primary" href="/briefs"><PenLine size={18} aria-hidden="true" />Tulis berita baru</Link>;
  const switcher = (
    <div className="bl-view-switch" role="group" aria-label="Tampilan daftar berita">
      <Link className={view === "kartu" ? "is-active" : ""} href={viewHref("kartu", requested, search, status)} aria-current={view === "kartu" ? "page" : undefined}>Kartu</Link>
      <Link className={view === "lembar" ? "is-active" : ""} href={viewHref("lembar", requested, search, status)} aria-current={view === "lembar" ? "page" : undefined}>Lembar</Link>
    </div>
  );

  return (
    <>
      <PageHeading title="Daftar berita" subtitle="Semua berita yang pernah Anda tulis. Buka satu berita untuk memeriksa, menerbitkan, atau mengambil link-nya." action={<div className="bl-head-actions">{switcher}{write}</div>} />

      {!data ? (
        <div role="alert" className="notice notice-error">
          <CircleAlert size={18} aria-hidden="true" />
          <div className="stack-sm">
            <strong>Daftar berita belum bisa dimuat.</strong>
            <span>Koneksi ke server terputus sebentar. Tekan Coba lagi. Kalau tetap gagal, hubungi admin.</span>
            <div className="actions"><Link className="btn" href={pageHref(requested, view, search, status)}>Coba lagi</Link></div>
          </div>
        </div>
      ) : (
        <>
          <form className="bl-filter" method="get" action="/blasts">
            {view !== "kartu" && <input type="hidden" name="view" value={view} />}
            <input className="bl-filter-search" type="search" name="q" defaultValue={search} placeholder="Cari judul atau narasi…" aria-label="Cari berita" />
            <select name="status" defaultValue={status} aria-label="Filter status">
              <option value="">Semua status</option>
              <option value="DRAFT">Draf</option>
              <option value="PENDING_REVIEW">Menunggu tinjau</option>
              <option value="APPROVED">Disetujui</option>
              <option value="PUBLISHED">Terbit</option>
              <option value="REJECTED">Ditolak</option>
            </select>
            <button className="btn" type="submit">Cari</button>
            {(search || status) && <Link className="btn" href={pageHref(1, view)}>Hapus filter</Link>}
          </form>
          {data.total === 0 ? (
            search || status
              ? <p className="muted">Tidak ada berita yang cocok dengan filter ini.</p>
              : <EmptyState title="Belum ada berita" detail="Tulis satu berita, pilih media, dan kirim ke semua media sekaligus. Beritanya muncul di sini." href="/briefs" label="Tulis berita" />
          ) : data.items.length === 0 ? (
            <div className="notice notice-warn">
              <CircleAlert size={18} aria-hidden="true" />
              <div className="stack-sm">
                <span>Halaman ini kosong. Berita Anda ada di halaman sebelumnya.</span>
                <div className="actions"><Link className="btn" href={pageHref(data.pages, view, search, status)}>Ke halaman terakhir</Link></div>
              </div>
            </div>
          ) : (
        <section className="stack" aria-label="Daftar berita">
          <p className="muted num">{number.format(data.total)} berita</p>
          {view === "lembar" ? <BlastLedger items={data.items} startIndex={(data.page - 1) * 20 + 1} /> : <ul className="bl-list">
            {data.items.map((item) => {
              const info = item.status === "LEGACY" && item.legacyArticleStatus
                ? legacyStatusInfo[item.legacyArticleStatus] ?? statusInfo[item.status]
                : statusInfo[item.status];
              return (
                <li key={item.id} className="card bl-item">
                  <div className="bl-item-main">
                    <h2 className="bl-item-title">{item.title || "Berita tanpa judul"}</h2>
                    <p className="muted">Penulis: {item.author.name}. {formatWhen(item.createdAt)}</p>
                    <div className="bl-item-status">
                      <span className={`badge ${info.badge}`.trim()}>{info.label}</span>
                      {item.status !== "LEGACY" && <span className="num">{mediaLine(item)}</span>}
                      {item.failedCount > 0 && <span className="badge badge-red">{number.format(item.failedCount)} media gagal terbit</span>}
                    </div>
                  </div>
                  <Link className="btn" href={`/blasts/${item.id}`} aria-label={`Buka berita ${item.title || "tanpa judul"}`}>Buka</Link>
                </li>
              );
            })}
          </ul>}
          {data.pages > 1 && (
            <nav className="bl-pager" aria-label="Halaman daftar berita">
              {data.page > 1 ? <Link className="btn" href={pageHref(data.page - 1, view, search, status)}><ChevronLeft size={18} aria-hidden="true" />Sebelumnya</Link> : <span />}
              <span className="muted num">Halaman {data.page} dari {data.pages}</span>
              {data.page < data.pages ? <Link className="btn" href={pageHref(data.page + 1, view, search, status)}>Berikutnya<ChevronRight size={18} aria-hidden="true" /></Link> : <span />}
            </nav>
          )}
        </section>
          )}
        </>
      )}
    </>
  );
}
