import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import AiKeyForm from "@/components/ai-key-form";
import { readAiKeyStatus } from "@/lib/ai-status";
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
  await requireRole("OWNER");
  const isOwner = true;
  const ai = await aiConfiguration();
  const aiKey = await readAiKeyStatus();
  const databaseReady = await databaseReachable();
  const cloudConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const redisConfigured = Boolean(process.env.REDIS_URL);

  const aiService: Service = ai.mode === "test adapter"
    ? { key: "ai", title: "AI", purpose: "Menulis draf berita", tone: "yellow", label: "Mode uji", state: "AI berjalan dalam mode uji. Drafnya berisi teks contoh, bukan tulisan AI sungguhan.", technical: "AI_TEST_ADAPTER" }
    : ai.mode === "unsupported provider"
      ? { key: "ai", title: "AI", purpose: "Menulis draf berita", tone: "red", label: "Penyedia tidak didukung", state: "Penyedia AI yang dipilih belum bisa dipakai. Minta teknisi server memilih openai, openai-compatible, atau openrouter.", technical: "AI_PROVIDER, AI_MODEL, AI_API_KEY" }
      : ai.configured
        ? { key: "ai", title: "AI", purpose: "Menulis draf berita", tone: "green", label: "Siap", state: "", technical: "AI_PROVIDER, AI_MODEL, AI_API_KEY, AI_BASE_URL" }
        : { key: "ai", title: "AI", purpose: "Menulis draf berita", tone: "red", label: "Belum disetel", state: "Belum ada kunci AI. Klik Kelola kunci AI untuk menambah.", technical: "AI_PROVIDER, AI_MODEL, AI_API_KEY, AI_BASE_URL" };
  aiService.extra = ai.provider && ai.model ? `${ai.provider} · ${ai.model}` : undefined;

  const services: Service[] = [
    databaseReady
      ? { key: "database", title: "Database", purpose: "Menyimpan berita dan pengaturan", tone: "green", label: "Terhubung", state: "", technical: "DATABASE_URL" }
      : { key: "database", title: "Database", purpose: "Menyimpan berita dan pengaturan", tone: "red", label: "Tidak terhubung", state: "Database tidak terjangkau. Minta teknisi periksa koneksi.", technical: "DATABASE_URL" },
    cloudConfigured
      ? { key: "images", title: "Cloudinary", purpose: "Menyimpan gambar dan logo", tone: "green", label: "Siap", state: "", technical: "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET" }
      : { key: "images", title: "Cloudinary", purpose: "Menyimpan gambar dan logo", tone: "yellow", label: "Belum disetel", state: "Gambar belum bisa diunggah. Minta teknisi isi kunci Cloudinary.", technical: "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET" },
    aiService,
    redisConfigured
      ? { key: "schedule", title: "Penjadwalan (Redis)", purpose: "Terbit otomatis sesuai jadwal", tone: "green", label: "Aktif", state: "", technical: "REDIS_URL" }
      : { key: "schedule", title: "Penjadwalan (Redis)", purpose: "Terbit otomatis sesuai jadwal", tone: "yellow", label: "Belum aktif", state: "Terbit sekarang tetap jalan. Jadwal belum otomatis.", technical: "REDIS_URL" },
  ];

  const ready = services.filter((service) => service.tone === "green").length;
  const needsAttention = services.length - ready;

  return <>
    <PageHeading title="Koneksi layanan" subtitle="Cek status layanan yang dipakai aplikasi." />
    <div className={needsAttention ? "notice notice-warn" : "notice notice-success"} role="status">
      {needsAttention
        ? `${needsAttention} dari ${services.length} layanan perlu perhatian.`
        : `Semua ${services.length} layanan siap.`}
    </div>
    <section className="service-monitor" aria-labelledby="service-monitor-title">
      <div className="service-monitor-head">
        <div><h2 id="service-monitor-title">Status layanan</h2><p className="muted">Ringkasan koneksi yang memengaruhi kerja redaksi.</p></div>
        <span className="service-count">{ready}/{services.length} siap</span>
      </div>
      <div className="service-list">
        {services.map((service) => {
          const Icon = toneIcon[service.tone];
          return <div className={`service-row service-row-${service.tone}`} key={service.key}>
            <Icon className="service-row-icon" size={21} aria-hidden="true" />
            <div className="service-row-main"><strong>{service.title}</strong><span>{service.purpose}</span>{service.extra && <small>{service.extra}</small>}</div>
            <span className={toneBadge[service.tone]}>{service.label}</span>
            <details className="service-row-details"><summary>Detail</summary><div><p>{service.state || "Tidak ada tindakan yang perlu dilakukan."}</p><code>{service.technical}</code></div></details>
          </div>;
        })}
      </div>
    </section>
    {isOwner && <AiKeyForm initial={aiKey} />}
    <p className="muted">Kunci database, Cloudinary, dan Redis dipasang di server. Halaman ini tidak menampilkan kunci rahasia.</p>
  </>;
}
