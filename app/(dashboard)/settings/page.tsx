import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { aiConfiguration } from "@/lib/ai";
import { db } from "@/lib/db";
import "@/app/css/connections.css";

export const dynamic = "force-dynamic";

type Tone = "green" | "yellow" | "red";
interface Service {
  key: string;
  title: string;
  purpose: string;
  tone: Tone;
  label: string;
  state: string;
  technical: string;
  extra?: string;
}

const toneBadge: Record<Tone, string> = { green: "badge badge-green", yellow: "badge badge-yellow", red: "badge badge-red" };
const toneIcon: Record<Tone, typeof CircleCheck> = { green: CircleCheck, yellow: TriangleAlert, red: CircleX };

async function databaseReachable() {
  if (!process.env.DATABASE_URL) return false;
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export default async function SettingsPage() {
  await requireRole("OWNER", "ADMIN");
  const ai = aiConfiguration();
  const databaseReady = await databaseReachable();
  const cloudConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const redisConfigured = Boolean(process.env.REDIS_URL);

  const aiService: Service = ai.mode === "test adapter"
    ? { key: "ai", title: "AI", purpose: "Menulis draf berita dari topik yang Anda berikan.", tone: "yellow", label: "Mode uji", state: "AI berjalan dalam mode uji. Drafnya berisi teks contoh, bukan tulisan AI sungguhan, jadi jangan diterbitkan.", technical: "AI_TEST_ADAPTER" }
    : ai.mode === "unsupported provider"
      ? { key: "ai", title: "AI", purpose: "Menulis draf berita dari topik yang Anda berikan.", tone: "red", label: "Penyedia tidak didukung", state: "Penyedia AI yang dipilih belum bisa dipakai. Minta teknisi server memilih openai, openai-compatible, atau openrouter, lalu mulai ulang aplikasi.", technical: "AI_PROVIDER, AI_MODEL, AI_API_KEY" }
      : ai.configured
        ? { key: "ai", title: "AI", purpose: "Menulis draf berita dari topik yang Anda berikan.", tone: "green", label: "Sudah disetel", state: "Kunci AI sudah terisi. Draf masih bisa gagal kalau kuota habis atau jaringan putus. Kalau itu terjadi, coba lagi beberapa menit kemudian.", technical: "AI_PROVIDER, AI_MODEL, AI_API_KEY" }
        : { key: "ai", title: "AI", purpose: "Menulis draf berita dari topik yang Anda berikan.", tone: "red", label: "Belum disetel", state: "Belum ada kunci AI, jadi draf belum bisa dibuat. Minta teknisi server mengisi penyedia dan kunci AI, lalu mulai ulang aplikasi.", technical: "AI_PROVIDER, AI_MODEL, AI_API_KEY" };
  aiService.extra = `Penyedia: ${ai.provider || "belum dipilih"}. Model: ${ai.model || "belum dipilih"}.${ai.provider === "openrouter" ? " Untuk menekan biaya, ganti AI_MODEL menjadi qwen/qwen3-32b. Permintaan diarahkan ke penyedia yang tidak mengumpulkan data menurut kebijakan OpenRouter. Itu bukan jaminan, jadi jangan menulis data pribadi atau rahasia redaksi di topik berita." : ""}`;

  const services: Service[] = [
    databaseReady
      ? { key: "database", title: "Database", purpose: "Menyimpan media, naskah, akun tim, dan riwayat kerja.", tone: "green", label: "Terhubung", state: "Aplikasi berhasil membaca database barusan.", technical: "DATABASE_URL" }
      : { key: "database", title: "Database", purpose: "Menyimpan media, naskah, akun tim, dan riwayat kerja.", tone: "red", label: "Tidak terhubung", state: "Aplikasi tidak bisa menjangkau database, jadi halaman lain bisa gagal dimuat. Minta teknisi server memeriksa alamat database dan memastikan database menyala.", technical: "DATABASE_URL" },
    cloudConfigured
      ? { key: "images", title: "Penyimpanan gambar (Cloudinary)", purpose: "Menyimpan gambar naskah dan logo media, lengkap dengan catatan hak pakainya.", tone: "green", label: "Sudah disetel", state: "Ketiga kunci Cloudinary sudah terisi. Halaman ini belum menguji unggahan, jadi coba unggah satu gambar untuk memastikan.", technical: "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET" }
      : { key: "images", title: "Penyimpanan gambar (Cloudinary)", purpose: "Menyimpan gambar naskah dan logo media, lengkap dengan catatan hak pakainya.", tone: "yellow", label: "Belum disetel", state: "Gambar belum bisa diunggah. Minta teknisi server mengisi tiga kunci Cloudinary, lalu mulai ulang aplikasi. Naskah tanpa gambar tetap bisa terbit.", technical: "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET" },
    aiService,
    redisConfigured
      ? { key: "schedule", title: "Penjadwalan otomatis (Redis)", purpose: "Menerbitkan naskah pada jam yang Anda pilih dan mengulang terbit yang gagal.", tone: "green", label: "Sudah disetel", state: "Alamat Redis sudah terisi. Halaman ini tidak bisa memeriksa proses penjadwalan (worker), jadi minta teknisi memastikan proses itu berjalan sebelum Anda mengandalkan jadwal.", technical: "REDIS_URL (antrean BullMQ)" }
      : { key: "schedule", title: "Penjadwalan otomatis (Redis)", purpose: "Menerbitkan naskah pada jam yang Anda pilih dan mengulang terbit yang gagal.", tone: "yellow", label: "Belum aktif", state: "Terbit sekarang tetap jalan. Jadwal yang Anda simpan belum berjalan sendiri. Minta teknisi server menyiapkan Redis dan proses penjadwalan, lalu mulai ulang aplikasi.", technical: "REDIS_URL (antrean BullMQ)" },
  ];

  const ready = services.filter((service) => service.tone === "green").length;
  const needsAttention = services.length - ready;

  return <>
    <PageHeading title="Koneksi layanan" subtitle="Cek apakah layanan di balik aplikasi sudah tersambung. Yang hijau siap, yang kuning masih bisa dipakai sebagian, yang merah menghambat pekerjaan." />
    <div className={needsAttention ? "notice notice-warn" : "notice notice-success"} role="status">
      {needsAttention
        ? `${needsAttention} dari ${services.length} layanan perlu perhatian. Kartu di bawah menjelaskan apa yang harus dibereskan.`
        : `Semua ${services.length} layanan sudah siap dipakai.`}
    </div>
    <div className="grid grid-2">
      {services.map((service) => {
        const Icon = toneIcon[service.tone];
        return <section className="card service-card" key={service.key} aria-labelledby={`service-${service.key}`}>
          <div className="service-head">
            <h2 id={`service-${service.key}`}>{service.title}</h2>
            <span className={toneBadge[service.tone]}><Icon size={16} aria-hidden="true" />{service.label}</span>
          </div>
          <p className="service-purpose">{service.purpose}</p>
          <p className={service.tone === "green" ? "service-state" : service.tone === "yellow" ? "service-state notice notice-warn" : "service-state notice notice-error"}>{service.state}</p>
          <p className="tech-note">Nama teknis: <code>{service.technical}</code></p>
          {service.extra && <p className="tech-note">{service.extra}</p>}
        </section>;
      })}
    </div>
    <p className="muted">Kunci rahasia dipasang di server oleh teknisi Anda. Halaman ini tidak pernah menampilkannya dan tidak bisa mengubahnya.</p>
  </>;
}
