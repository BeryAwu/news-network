import { db } from "@/lib/db";
import { hasNetworkWideScope, requireUser } from "@/lib/auth";
import { PageHeading, StatusBadge } from "@/components/ui";
import { aiConfiguration } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const user = await requireUser();
  const isOwner = await hasNetworkWideScope(user.id);
  const mediaWhere = isOwner ? {} : { mediaScopes: { some: { userId: user.id } } };
  const targetWhere = isOwner ? {} : { mediaSite: { mediaScopes: { some: { userId: user.id } } } };
  const [sites, targets, failedTargetCount] = await Promise.all([
    db.mediaSite.findMany({ where: mediaWhere, include: { domains: true, _count: { select: { articles: true, publicationTargets: true } } }, orderBy: { displayName: "asc" } }),
    db.publicationTarget.findMany({ where: targetWhere, include: { article: { select: { title: true } }, mediaSite: { select: { displayName: true } }, domain: { select: { hostname: true } }, attempts: { orderBy: { attemptNumber: "desc" }, take: 5 } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    db.publicationTarget.count({ where: { ...targetWhere, status: "FAILED" } })
  ]);
  const ai = aiConfiguration();
  const cloudConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const redisConfigured = Boolean(process.env.REDIS_URL);

  return <>
    <PageHeading title="Pemantauan sistem" subtitle="Lihat apakah konfigurasi layanan tersedia, domain siap digunakan, dan publikasi berhasil."/>
    <div className="grid grid-3">
      <section className="card"><strong>PostgreSQL</strong><p><StatusBadge status="DATABASE_CONNECTED"/></p><span className="muted">Terhubung: halaman ini berhasil membaca data.</span></section>
      <section className="card"><strong>AI untuk draf</strong><p><StatusBadge status={ai.configured ? "CREDENTIALS_CONFIGURED" : ai.mode === "test adapter" ? "TEST_ADAPTER" : ai.mode.toUpperCase().replaceAll(" ", "_")}/></p><span className="muted">{ai.provider || "Penyedia belum dipilih"} · {ai.model || "Model belum dipilih"}. Kunci tersedia bukan jaminan setiap permintaan berhasil.</span></section>
      <section className="card"><strong>Cloudinary</strong><p><StatusBadge status={cloudConfigured ? "CONFIGURED" : "SETUP_REQUIRED"}/></p><span className="muted">{cloudConfigured ? "Kredensial tersedia. Upload nyata tetap perlu diuji saat digunakan." : "Kredensial belum lengkap; unggah gambar tidak tersedia."}</span></section>
      <section className="card"><strong>Publikasi terjadwal</strong><p><StatusBadge status={redisConfigured ? "BULLMQ_CONFIGURED" : "INLINE_MODE"}/></p><span className="muted">{redisConfigured ? "Alamat Redis tersedia. Pastikan worker juga dijalankan." : "Publikasi langsung tersedia; jadwal memerlukan Redis dan worker."}</span></section>
      <section className="card"><strong>Publikasi gagal</strong><div className="metric">{failedTargetCount}</div><span className="muted">Jumlah persis dalam media yang dapat Anda akses.</span></section>
    </div>

    <section className="stack" style={{ marginTop: 28 }}>
      <div><h2 style={{ margin: 0, fontSize: 18 }}>Status domain</h2><p className="muted">Domain harus aktif dan sudah diverifikasi sebelum menerima publikasi.</p></div>
      <div className="table-wrap"><table><thead><tr><th>Domain</th><th>Media</th><th>Verifikasi</th><th>Aktif</th><th>Naskah</th><th>Target publikasi</th></tr></thead><tbody>
        {sites.flatMap((site) => site.domains.map((domain) => <tr key={domain.id}><td>{domain.hostname}</td><td>{site.displayName}</td><td><StatusBadge status={domain.verificationStatus}/></td><td>{domain.isActive ? "Ya" : "Tidak"}</td><td>{site._count.articles}</td><td>{site._count.publicationTargets}</td></tr>))}
      </tbody></table>{!sites.some((site) => site.domains.length > 0) && <div className="empty">Belum ada domain. Tambahkan domain di menu Media & domain setelah menyiapkan situs penerbit.</div>}</div>
    </section>

    <section className="stack" style={{ marginTop: 26 }}>
      <div><h2 style={{ margin: 0, fontSize: 18 }}>Publikasi terbaru</h2><p className="muted">Setiap status dan percobaan dicatat terpisah untuk domain tujuan.</p></div>
      <div className="table-wrap"><table><thead><tr><th>Naskah</th><th>Media / domain</th><th>Status</th><th>Waktu diperbarui</th><th>Percobaan</th><th>Pesan / tautan hasil</th></tr></thead><tbody>
        {targets.map((target) => <tr key={target.id}><td>{target.article.title}</td><td>{target.mediaSite.displayName}<div className="muted">{target.domain.hostname}</div></td><td><StatusBadge status={target.status}/></td><td>{target.updatedAt.toLocaleString("id-ID")}</td><td>{target.attemptCount}</td><td>{target.lastErrorMessage || target.remoteUrl || "Belum ada hasil"}</td></tr>)}
      </tbody></table>{!targets.length && <div className="empty">Belum ada publikasi. Naskah yang sudah disetujui akan muncul di sini.</div>}</div>
    </section>
  </>;
}
