import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, CircleAlert, ListChecks, PenLine } from "lucide-react";
import { PageHeading, StatusBadge } from "@/components/ui";
import { DayBars, HorizontalBars, StackedBar, type Part } from "@/components/charts";
import AutoRefresh from "@/components/auto-refresh";
import { requireUser } from "@/lib/auth";
import { dashboardSnapshot, type DashboardSnapshot } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

const timeFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

interface NextStep { title: string; detail: string; href: string; action: string }

function chooseNextStep(s: DashboardSnapshot): NextStep {
  const { counts } = s;
  const approved = counts.articleStatuses.APPROVED ?? 0;
  if (counts.mediaSites === 0) return { title: "Tambahkan media pertama Anda", detail: "Media adalah situs berita yang akan menerima naskah. Isi nama, gaya penulisan, dan domainnya.", href: "/media", action: "Tambah media" };
  if (counts.verifiedDomains === 0) return { title: "Hubungkan domain media Anda", detail: "Naskah baru bisa terbit setelah satu domain dinyatakan terverifikasi.", href: "/media", action: "Atur domain" };
  if (s.reviewQueue > 0) return { title: `${s.reviewQueue} berita menunggu diperiksa`, detail: "Baca beritanya, lalu setujui dan terbitkan, minta perbaikan, atau tolak.", href: "/blasts", action: "Buka Daftar berita" };
  if (approved > 0) return { title: `${approved} berita siap terbit`, detail: "Buka Daftar berita, lalu terbitkan sekarang atau jadwalkan.", href: "/blasts", action: "Buka daftar berita" };
  return { title: "Tulis berita baru", detail: "Tulis satu narasi, pilih media yang menerimanya, lalu minta AI menulis atau pakai tulisan Anda.", href: "/briefs", action: "Tulis berita" };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const snapshot = await dashboardSnapshot(user.id);
  const { counts } = snapshot;
  const st = counts.articleStatuses;
  const next = chooseNextStep(snapshot);
  const drafts = (st.NEEDS_REVIEW ?? 0) + (st.IN_REVISION ?? 0) + (st.DRAFT ?? 0);
  const approved = st.APPROVED ?? 0;
  const published = st.PUBLISHED ?? 0;
  const publishedLast14 = snapshot.charts.publishedPerDay.reduce((sum, day) => sum + day.count, 0);

  const steps = [
    { n: 1, title: "Tulis", count: counts.sourceBriefs, hint: "topik berita yang sudah ditulis", href: "/briefs", attention: counts.sourceBriefs === 0 },
    { n: 2, title: "Draf AI", count: snapshot.generatingDrafts, hint: snapshot.generatingDrafts > 0 ? "draf sedang dibuat" : "tidak ada draf yang sedang dibuat", href: "/blasts", attention: snapshot.generatingDrafts > 0 },
    { n: 3, title: "Periksa", count: snapshot.reviewQueue, hint: "naskah menunggu keputusan Anda", href: "/blasts", attention: snapshot.reviewQueue > 0 },
    { n: 4, title: "Terbit", count: approved, hint: "naskah siap terbit", href: "/blasts", attention: approved > 0 },
  ];
  const parts: Part[] = [
    { label: "Perlu diperiksa", value: st.NEEDS_REVIEW ?? 0, color: "var(--app-warn)" },
    { label: "Perlu diperbaiki", value: st.IN_REVISION ?? 0, color: "var(--app-info)" },
    { label: "Siap terbit", value: approved, color: "var(--app-primary)" },
    { label: "Sudah terbit", value: published, color: "var(--app-success)" },
    { label: "Ditolak", value: st.REJECTED ?? 0, color: "var(--app-danger)" },
  ];

  return (
    <>
      <AutoRefresh active={snapshot.generatingDrafts > 0} />
      <PageHeading title={`Halo, ${user.name.split(" ")[0]}`} subtitle="Ringkasan pekerjaan redaksi hari ini." action={<Link className="btn" href="/guide"><BookOpen size={18} aria-hidden="true" />Buka panduan</Link>} />

      <section className="card card-soft row-between" aria-labelledby="next-step">
        <div className="stack-sm">
          <h2 id="next-step">{next.title}</h2>
          <p className="muted">{next.detail}</p>
        </div>
        <Link className="btn btn-primary" href={next.href}>{next.action}<ArrowRight size={18} aria-hidden="true" /></Link>
      </section>

      {counts.approvedArticlesWithoutReadyDomain > 0 && (
        <div className="notice notice-warn" role="status">
          <CircleAlert size={20} aria-hidden="true" />
          <span>{counts.approvedArticlesWithoutReadyDomain} naskah sudah disetujui, tetapi medianya belum punya domain terverifikasi. <Link href="/media">Atur domain</Link></span>
        </div>
      )}

      <section aria-label="Pekerjaan utama" className="quick-actions">
        <Link href="/briefs" className="quick"><span className="quick-icon"><PenLine size={26} aria-hidden="true" /></span><strong>Tulis berita</strong><span className="muted">Satu narasi, kirim ke media yang Anda pilih.</span></Link>
        <Link href="/blasts" className="quick"><span className="quick-icon"><ListChecks size={26} aria-hidden="true" /></span><strong>Daftar berita</strong><span className="muted">Baca draf, lalu setujui dan terbitkan.</span></Link>
        <Link href="/reports" className="quick"><span className="quick-icon"><BarChart3 size={26} aria-hidden="true" /></span><strong>Laporan</strong><span className="muted">Berapa berita terbit per media, unduh Excel atau PDF.</span></Link>
      </section>

      <section aria-labelledby="pipeline-title" className="stack-sm">
        <h2 id="pipeline-title">Alur kerja</h2>
        <div className="pipeline">
          {steps.map((step) => (
            <Link key={step.n} href={step.href} className="pipeline-step" data-attention={step.attention}>
              <span className="pipeline-index">{step.n}</span>
              <span className="pipeline-title">{step.title}</span>
              <span className="pipeline-count">{step.count}</span>
              <span className="pipeline-hint">{step.hint}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid-2">
        <section className="card stack" aria-labelledby="chart-days">
          <div className="stack-sm">
            <h2 id="chart-days">Naskah terbit, 14 hari terakhir</h2>
            <p className="muted">{publishedLast14 > 0 ? `${publishedLast14} naskah terbit dalam dua minggu.` : "Belum ada naskah yang terbit dalam dua minggu terakhir."}</p>
          </div>
          <DayBars data={snapshot.charts.publishedPerDay} label="Jumlah naskah terbit per hari" />
        </section>
        <section className="card stack" aria-labelledby="chart-status">
          <div className="stack-sm">
            <h2 id="chart-status">Posisi semua naskah</h2>
            <p className="muted">{counts.articles > 0 ? `${counts.articles} naskah, ${drafts} masih dikerjakan.` : "Belum ada naskah."}</p>
          </div>
          <StackedBar parts={parts} ariaLabel="Jumlah naskah menurut status" />
          {snapshot.charts.perMedia.length > 0 && (
            <>
              <hr className="divider" />
              <div className="stack-sm">
                <h3>Naskah terbit per media</h3>
                <HorizontalBars rows={snapshot.charts.perMedia.slice(0, 6).map((m) => ({ label: m.mediaName, value: m.published }))} unit="naskah terbit" />
              </div>
            </>
          )}
        </section>
      </div>

      <section className="card stack" aria-labelledby="recent-title">
        <div className="row-between">
          <h2 id="recent-title">Aktivitas penerbitan terbaru</h2>
          <Link href="/blasts">Lihat semua</Link>
        </div>
        {snapshot.latestTargets.length === 0 ? (
          <p className="muted">Belum ada aktivitas. Setelah naskah diterbitkan, riwayatnya muncul di sini.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Naskah</th><th>Media</th><th>Status</th><th>Waktu</th></tr></thead>
              <tbody>
                {snapshot.latestTargets.map((t) => (
                  <tr key={t.id}>
                    <td>{t.articleTitle}{t.lastErrorMessage && <div className="field-error">{t.lastErrorMessage}</div>}</td>
                    <td>{t.mediaName}<div className="muted">{t.hostname}</div></td>
                    <td><StatusBadge status={t.status} /></td>
                    <td className="num">{timeFormat.format(new Date(t.updatedAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
