import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleAlert, PenLine } from "lucide-react";
import { EmptyState, PageHeading } from "@/components/ui";
import { formatWhen, statusInfo } from "@/components/blast-format";
import { requireUser } from "@/lib/auth";
import { listBlasts } from "@/lib/blasts";
import type { BlastListItem } from "@/lib/blast-types";
import "@/app/css/blasts.css";

export const dynamic = "force-dynamic";

const number = new Intl.NumberFormat("id-ID");

interface BlastPage { items: BlastListItem[]; total: number; page: number; pages: number }

function pageHref(page: number) {
  return page <= 1 ? "/blasts" : `/blasts?page=${page}`;
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

  let data: BlastPage | null = null;
  try {
    data = await listBlasts(user.id, requested);
  } catch {
    data = null;
  }

  const write = <Link className="btn btn-primary" href="/briefs"><PenLine size={18} aria-hidden="true" />Tulis berita baru</Link>;

  return (
    <>
      <PageHeading title="Daftar berita" subtitle="Semua berita yang pernah Anda tulis. Buka satu berita untuk memeriksa, menerbitkan, atau mengambil link-nya." action={write} />

      {!data ? (
        <div role="alert" className="notice notice-error">
          <CircleAlert size={18} aria-hidden="true" />
          <div className="stack-sm">
            <strong>Daftar berita belum bisa dimuat.</strong>
            <span>Koneksi ke server terputus sebentar. Tekan Coba lagi. Kalau tetap gagal, hubungi admin.</span>
            <div className="actions"><Link className="btn" href={pageHref(requested)}>Coba lagi</Link></div>
          </div>
        </div>
      ) : data.total === 0 ? (
        <EmptyState title="Belum ada berita" detail="Tulis satu berita, pilih media, dan kirim ke semua media sekaligus. Beritanya muncul di sini." href="/briefs" label="Tulis berita" />
      ) : data.items.length === 0 ? (
        <div className="notice notice-warn">
          <CircleAlert size={18} aria-hidden="true" />
          <div className="stack-sm">
            <span>Halaman ini kosong. Berita Anda ada di halaman sebelumnya.</span>
            <div className="actions"><Link className="btn" href={pageHref(data.pages)}>Ke halaman terakhir</Link></div>
          </div>
        </div>
      ) : (
        <section className="stack" aria-label="Daftar berita">
          <p className="muted num">{number.format(data.total)} berita</p>
          <ul className="bl-list">
            {data.items.map((item) => {
              const info = statusInfo[item.status];
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
          </ul>
          {data.pages > 1 && (
            <nav className="bl-pager" aria-label="Halaman daftar berita">
              {data.page > 1 ? <Link className="btn" href={pageHref(data.page - 1)}><ChevronLeft size={18} aria-hidden="true" />Sebelumnya</Link> : <span />}
              <span className="muted num">Halaman {data.page} dari {data.pages}</span>
              {data.page < data.pages ? <Link className="btn" href={pageHref(data.page + 1)}>Berikutnya<ChevronRight size={18} aria-hidden="true" /></Link> : <span />}
            </nav>
          )}
        </section>
      )}
    </>
  );
}
