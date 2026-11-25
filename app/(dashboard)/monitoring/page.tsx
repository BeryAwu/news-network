import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { db } from "@/lib/db";
import { hasNetworkWideScope, requireUser } from "@/lib/auth";
import { EmptyState, PageHeading, StatusBadge } from "@/components/ui";
import { DayBars } from "@/components/charts";
import { aiConfiguration } from "@/lib/ai";
import { publishFailureReason } from "@/lib/publish-reasons";
import "@/app/css/monitoring.css";

export const dynamic = "force-dynamic";

const timeFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const DAY = 24 * 60 * 60 * 1000;

type Light = "green" | "yellow" | "red";
interface Check { key: string; title: string; light: Light; meaning: string; todo: string; link?: { href: string; label: string } }
const lightLabel: Record<Light, string> = { green: "Lancar", yellow: "Perlu perhatian", red: "Bermasalah" };

async function load(userId: string, isOwner: boolean) {
  const mediaWhere = isOwner ? {} : { mediaScopes: { some: { userId } } };
  const targetWhere = isOwner ? {} : { mediaSite: { mediaScopes: { some: { userId } } } };
  const now = Date.now();
  const sites = await db.mediaSite.findMany({ where: { ...mediaWhere, deletedAt: null }, include: { domains: true }, orderBy: { displayName: "asc" }, take: 200 });
  const runWhere = { operation: "GENERATE_ARTICLE" as const, ...(isOwner ? {} : { mediaSiteId: { in: sites.map((site) => site.id) } }) };
  const [failedTargets, failedTargetCount, publishedRows, failedRuns, runs24, overdue, waitingScheduled, latestAsset] = await Promise.all([
    db.publicationTarget.findMany({ where: { ...targetWhere, status: "FAILED" }, include: { article: { select: { title: true } }, mediaSite: { select: { displayName: true } }, domain: { select: { hostname: true } } }, orderBy: { updatedAt: "desc" }, take: 8 }),
    db.publicationTarget.count({ where: { ...targetWhere, status: "FAILED" } }),
    db.publicationTarget.findMany({ where: { ...targetWhere, status: "PUBLISHED", publishedAt: { gte: new Date(now - 15 * DAY) } }, select: { publishedAt: true }, take: 2000 }),
    db.aiGenerationRun.findMany({ where: { ...runWhere, status: "FAILED", createdAt: { gt: new Date(now - 7 * DAY) } }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, errorMessage: true, createdAt: true, mediaSiteId: true, sourceBrief: { select: { workingTitle: true } } } }),
    db.aiGenerationRun.groupBy({ by: ["status"], where: { ...runWhere, createdAt: { gt: new Date(now - DAY) } }, _count: { _all: true } }),
    db.publicationTarget.count({ where: { ...targetWhere, OR: [{ status: "SCHEDULED", scheduledAt: { lt: new Date(now - 5 * 60 * 1000) } }, { status: "QUEUED", updatedAt: { lt: new Date(now - 10 * 60 * 1000) } }] } }),
    db.publicationTarget.count({ where: { ...targetWhere, status: "SCHEDULED" } }),
    db.asset.findFirst({ where: { deletedAt: null, ...(isOwner ? {} : { mediaSite: mediaWhere }) }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const perDay = new Map<string, number>();
  const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  for (let i = 13; i >= 0; i -= 1) perDay.set(dayKey(new Date(now - i * DAY)), 0);
  for (const row of publishedRows) { const key = row.publishedAt ? dayKey(row.publishedAt) : null; if (key && perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1); }
  const days = [...perDay].map(([date, count]) => ({ date, count }));
  return { sites, failedTargets, failedTargetCount, days, failedRuns, runs24, overdue, waitingScheduled, latestAsset };
}

export default async function MonitoringPage() {
  const user = await requireUser();
  const isOwner = await hasNetworkWideScope(user.id);
  let data: Awaited<ReturnType<typeof load>> | null = null;
  try { data = await load(user.id, isOwner); } catch { data = null; }

  const ai = await aiConfiguration();
  const cloudConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const redisConfigured = Boolean(process.env.REDIS_URL);

  const aiOk = data?.runs24.find((row) => row.status === "SUCCEEDED")?._count._all ?? 0;
  const aiFailed = data?.runs24.find((row) => row.status === "FAILED")?._count._all ?? 0;
  const aiCheck: Check = !ai.configured
    ? { key: "ai", title: "Draf AI", light: "red", meaning: "Sistem belum bisa membuat draf berita otomatis.", todo: "Minta admin mengisi pengaturan AI di server, lalu muat ulang halaman ini.", link: { href: "/settings", label: "Buka pengaturan" } }
    : ai.mode === "test adapter"
      ? { key: "ai", title: "Draf AI", light: "yellow", meaning: "Sistem memakai AI percobaan. Drafnya contoh, bukan tulisan dari AI sungguhan.", todo: "Minta admin mematikan mode percobaan sebelum dipakai untuk berita nyata." }
      : aiFailed > 0
        ? { key: "ai", title: "Draf AI", light: aiOk === 0 ? "red" : "yellow", meaning: aiOk === 0 ? `Semua ${aiFailed} draf dalam 24 jam terakhir gagal dibuat.` : `${aiFailed} dari ${aiOk + aiFailed} draf dalam 24 jam terakhir gagal dibuat.`, todo: "Coba tulis ulang topiknya. Kalau tetap gagal, minta admin memeriksa kunci AI." }
        : { key: "ai", title: "Draf AI", light: "green", meaning: aiOk > 0 ? `${aiOk} draf berhasil dibuat dalam 24 jam terakhir.` : "Kunci AI sudah terpasang. Belum ada draf dalam 24 jam terakhir, jadi belum teruji.", todo: "Coba tulis ulang topiknya. Kalau tetap gagal, minta admin memeriksa kunci AI." };

  const imageCheck: Check = cloudConfigured
    ? { key: "image", title: "Penyimpanan gambar", light: "green", meaning: data?.latestAsset ? `Kunci penyimpanan terpasang. Gambar terakhir diunggah ${timeFormat.format(data.latestAsset.createdAt)}.` : "Kunci penyimpanan terpasang. Belum ada gambar yang diunggah, jadi belum teruji.", todo: "Minta admin memeriksa kunci Cloudinary di server.", link: { href: "/assets", label: "Buka pustaka gambar" } }
    : { key: "image", title: "Penyimpanan gambar", light: "red", meaning: "Gambar belum bisa diunggah.", todo: "Minta admin mengisi kunci Cloudinary di server.", link: { href: "/assets", label: "Buka pustaka gambar" } };

  const dbCheck: Check = data
    ? { key: "db", title: "Basis data", light: "green", meaning: "Halaman ini berhasil membaca data naskah dan media.", todo: "Tunggu semenit lalu muat ulang. Kalau tetap merah, hubungi admin." }
    : { key: "db", title: "Basis data", light: "red", meaning: "Data tidak bisa dibaca, jadi naskah dan riwayat belum tampil.", todo: "Tunggu semenit lalu muat ulang. Kalau tetap merah, hubungi admin." };

  const scheduleCheck: Check = !redisConfigured
    ? { key: "schedule", title: "Penerbitan terjadwal", light: "yellow", meaning: "Terbit sekarang berjalan. Jadwal tersimpan, tetapi naskah tidak terbit sendiri pada waktunya.", todo: "Minta admin menyalakan penjadwalan otomatis, atau terbitkan naskah secara manual." + (data?.waitingScheduled ? ` Saat ini ${data.waitingScheduled} jadwal menunggu.` : "") }
    : (data?.overdue ?? 0) > 0
      ? { key: "schedule", title: "Penerbitan terjadwal", light: "red", meaning: `${data?.overdue} naskah lewat dari waktu terbitnya dan belum diproses.`, todo: "Minta admin memeriksa apakah proses penjadwalan otomatis berjalan di server." }
      : { key: "schedule", title: "Penerbitan terjadwal", light: "green", meaning: data ? "Penjadwalan otomatis terpasang dan tidak ada jadwal yang terlambat." : "Penjadwalan otomatis terpasang.", todo: "Minta admin memeriksa apakah proses penjadwalan otomatis berjalan di server." };
  const checks = [aiCheck, imageCheck, dbCheck, scheduleCheck];
  const attention = checks.filter((check) => check.light !== "green").length;

  const days = data?.days ?? [];
  const publishedLast14 = days.reduce((sum, day) => sum + day.count, 0);
  const mediaNames = new Map((data?.sites ?? []).map((site) => [site.id, site.displayName]));

  return <>
    <PageHeading title="Kesehatan sistem" subtitle="Lampu hijau berarti semuanya jalan. Kuning atau merah berarti ada yang perlu dibereskan."/>

    {!data && <div className="notice notice-error" role="alert"><CircleAlert size={20} aria-hidden="true"/><span>Data tidak bisa dibaca dari basis data. Tunggu semenit lalu muat ulang halaman. Kalau tetap gagal, hubungi admin.</span></div>}
    {data && <p className={attention ? "mon-summary mon-summary-warn" : "mon-summary"} role="status">{attention ? `${attention} dari 4 layanan perlu perhatian.` : "Keempat layanan lancar."}</p>}

    <section className="grid-2" aria-label="Status layanan">
      {checks.map((check) => <article className="card stack-sm mon-card" key={check.key} data-light={check.light}>
        <div className="row-between"><h2>{check.title}</h2><span className={`badge badge-${check.light}`}>{lightLabel[check.light]}</span></div>
        <p>{check.meaning}</p>
        <p className={check.light === "green" ? "muted" : "mon-todo"}><strong>{check.light === "green" ? "Jika tidak hijau:" : "Yang perlu dilakukan:"}</strong> {check.todo}</p>
        {check.link && check.light !== "green" && <div><Link className="btn btn-sm" href={check.link.href}>{check.link.label}</Link></div>}
      </article>)}
    </section>

    <section className="card stack" aria-labelledby="mon-chart">
      <div className="stack-sm">
        <h2 id="mon-chart">Naskah terbit, 14 hari terakhir</h2>
        <p className="muted">{!data ? "Data tidak tersedia." : publishedLast14 > 0 ? `${publishedLast14} naskah terbit dalam dua minggu. ${data.failedTargetCount > 0 ? `${data.failedTargetCount} penerbitan gagal dan belum dicoba lagi.` : "Tidak ada penerbitan yang gagal."}` : `Belum ada naskah yang terbit dalam dua minggu terakhir.${data.failedTargetCount > 0 ? ` ${data.failedTargetCount} penerbitan gagal dan belum dicoba lagi.` : ""}`}</p>
      </div>
      {data ? <DayBars data={days} label="Jumlah naskah terbit per hari"/> : <div className="skeleton mon-chart-skeleton" aria-hidden="true"/>}
    </section>

    <div className="grid-2 mon-failures">
      <section className="card stack" aria-labelledby="mon-failed-pub">
        <div className="row-between"><h2 id="mon-failed-pub">Penerbitan yang gagal</h2>{data && data.failedTargetCount > 0 && <Link href="/publishing?tab=gagal#riwayat">Coba lagi di halaman Terbitkan</Link>}</div>
        {!data ? <p className="muted">Data tidak tersedia.</p> : data.failedTargets.length === 0 ? <EmptyState title="Tidak ada yang gagal" detail="Semua penerbitan berjalan. Kalau ada yang gagal, alasannya muncul di sini."/> : <ul className="mon-list">
          {data.failedTargets.map((target) => <li key={target.id}>
            <strong>{target.article.title}</strong>
            <span className="muted">{target.mediaSite.displayName}, {target.domain.hostname}, {timeFormat.format(target.updatedAt)}</span>
            <span className="field-error">{publishFailureReason(target.lastErrorCode)}</span>
          </li>)}
        </ul>}
      </section>

      <section className="card stack" aria-labelledby="mon-failed-ai">
        <div className="row-between"><h2 id="mon-failed-ai">Draf AI yang gagal</h2>{data && data.failedRuns.length > 0 && <Link href="/briefs">Tulis ulang topiknya</Link>}</div>
        {!data ? <p className="muted">Data tidak tersedia.</p> : data.failedRuns.length === 0 ? <EmptyState title="Tidak ada draf yang gagal" detail="Tujuh hari terakhir bersih. Draf yang gagal muncul di sini."/> : <ul className="mon-list">
          {data.failedRuns.map((run) => <li key={run.id}>
            <strong>{run.sourceBrief.workingTitle || "Topik tanpa judul"}</strong>
            <span className="muted">{run.mediaSiteId ? mediaNames.get(run.mediaSiteId) ?? "Media" : "Media"}, {timeFormat.format(run.createdAt)}</span>
            <span className="field-error">Draf tidak jadi dibuat. Tulis ulang topiknya untuk mencoba lagi.</span>
            {run.errorMessage && <details className="mon-detail"><summary>Pesan dari sistem</summary><span className="muted">{run.errorMessage}</span></details>}
          </li>)}
        </ul>}
      </section>
    </div>

    <section className="stack" aria-labelledby="mon-domains">
      <div className="stack-sm">
        <h2 id="mon-domains">Alamat situs</h2>
        <p className="muted">Naskah hanya bisa terbit ke alamat yang aktif dan sudah dikonfirmasi.</p>
      </div>
      {!data ? <p className="muted">Data tidak tersedia.</p> : !data.sites.some((site) => site.domains.length > 0) ? <EmptyState title="Belum ada alamat situs" detail="Tambahkan alamat situs di Media saya supaya naskah bisa terbit." href="/media" label="Buka media saya"/> : <div className="table-wrap"><table>
        <caption className="visually-hidden">Alamat situs per media</caption>
        <thead><tr><th scope="col">Alamat</th><th scope="col">Media</th><th scope="col">Konfirmasi</th><th scope="col">Aktif</th></tr></thead>
        <tbody>{data.sites.flatMap((site) => site.domains.map((domain) => <tr key={domain.id}><td>{domain.hostname}</td><td>{site.displayName}</td><td><StatusBadge status={domain.verificationStatus}/></td><td>{domain.isActive ? "Ya" : "Tidak"}</td></tr>))}</tbody>
      </table></div>}
    </section>
  </>;
}
