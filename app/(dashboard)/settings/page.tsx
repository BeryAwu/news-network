import { PageHeading, StatusBadge } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { aiConfiguration } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireRole("OWNER", "ADMIN");
  const ai = aiConfiguration();
  const cloudConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const redisConfigured = Boolean(process.env.REDIS_URL);

  return <>
    <PageHeading title="Integrasi layanan" subtitle="Layanan yang dipakai untuk membuat draf, menyimpan gambar, dan menjalankan jadwal publikasi."/>
    <div className="notice notice-warn" style={{ marginBottom: 18 }}>Kunci rahasia hanya dibaca dari environment server. Halaman ini tidak menampilkan atau menyimpan rahasia. Setelah pengaturan server diubah, mulai ulang aplikasi.</div>
    <div className="grid grid-2">
      <section className="card integration-card">
        <div className="integration-heading"><div><span className="eyebrow">Pembuatan draf</span><h2>AI</h2></div><StatusBadge status={ai.configured ? "CREDENTIALS_CONFIGURED" : ai.mode === "test adapter" ? "TEST_ADAPTER" : ai.mode.toUpperCase().replaceAll(" ", "_")}/></div>
        <p>Provider: <strong>{ai.provider || "belum dipilih"}</strong></p>
        <p>Model: <strong>{ai.model || "belum dipilih"}</strong></p>
        <p className="muted">Konfigurasi OpenRouter memakai model Qwen3 235B. Untuk menekan biaya, ganti <code>AI_MODEL</code> menjadi <code>qwen/qwen3-32b</code>. Kunci API disimpan di server, bukan di browser.</p>
        <div className={ai.configured ? "notice" : "notice notice-warn"}>{ai.configured ? "Kredensial AI tersedia. Permintaan draf tetap dapat gagal karena kuota, jaringan, atau endpoint model." : "Isi AI_API_KEY di environment untuk membuat draf produksi."}</div>
        {ai.provider === "openrouter" && <p className="muted integration-footnote">Permintaan membatasi routing ke endpoint yang tidak mengumpulkan data menurut kebijakan OpenRouter. Ini tidak menjamin Zero Data Retention; jangan kirim data pribadi atau rahasia newsroom ke prompt.</p>}
      </section>

      <section className="card integration-card">
        <div className="integration-heading"><div><span className="eyebrow">Penyimpanan gambar</span><h2>Cloudinary</h2></div><StatusBadge status={cloudConfigured ? "CONFIGURED" : "SETUP_REQUIRED"}/></div>
        <p className="muted">Gambar dikelola lewat akun Cloudinary newsroom. Binary tidak disimpan di disk aplikasi; metadata dan hak penggunaan dicatat bersama aset.</p>
        <div className={cloudConfigured ? "notice" : "notice notice-warn"}>{cloudConfigured ? "Kredensial tersedia. Unggah gambar nyata belum diuji." : "Lengkapi tiga variabel CLOUDINARY di server sebelum mengunggah gambar."}</div>
      </section>

      <section className="card integration-card">
        <div className="integration-heading"><div><span className="eyebrow">Jadwal dan retry</span><h2>Antrean publikasi</h2></div><StatusBadge status={redisConfigured ? "BULLMQ_CONFIGURED" : "INLINE_MODE"}/></div>
        <p className="muted">Tanpa Redis, publikasi langsung tetap diproses oleh aplikasi. Untuk menjalankan jadwal otomatis dan retry di latar belakang, siapkan Redis lalu jalankan worker.</p>
        {redisConfigured ? <div className="notice">REDIS_URL tersedia. Pastikan proses worker juga berjalan sebelum mengandalkan jadwal.</div> : <div className="notice notice-warn">Redis belum disiapkan. Jadwal yang disimpan tidak berjalan otomatis.</div>}
      </section>

      <section className="card integration-card">
        <div className="integration-heading"><div><span className="eyebrow">Akun dan domain</span><h2>Keamanan newsroom</h2></div><StatusBadge status="ACTIVE"/></div>
        <p className="muted">Login memakai cookie sesi HTTP-only. Pemeriksaan peran dan akses media dilakukan di server.</p>
        <div className="notice">Sebelum mengaktifkan domain, verifikasi kendalinya melalui DNS atau hosting di luar aplikasi. Tanda verifikasi admin adalah catatan tindakan, bukan pemeriksaan DNS otomatis.</div>
      </section>
    </div>
  </>;
}
