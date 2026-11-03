import Link from "next/link";
import { databaseReady } from "@/lib/database";
import { aiConfiguration } from "@/lib/ai";
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ issue?: string }> }) {
  const query = await searchParams;
  const database = await databaseReady();
  const session = Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32);
  const cloud = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const ai = aiConfiguration();
  const redis = Boolean(process.env.REDIS_URL);
  const items = [
    ["PostgreSQL / Prisma", database, "DATABASE_URL diperlukan untuk akun, media, naskah dan publikasi.", true],
    ["Sesi aman", session, "SESSION_SECRET minimal 32 karakter diperlukan untuk login.", true],
    ["Cloudinary (wajib untuk gambar)", cloud, "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET hanya di environment server.", true],
    ["AI", ai.configured && ai.mode !== "test adapter", "AI_PROVIDER=openrouter dan AI_API_KEY OpenRouter diperlukan untuk draft produksi. AI_MODEL default qwen/qwen3-235b-a22b-2507; adapter lokal hanya untuk development/test.", true],
    ["Redis / BullMQ", redis, "Opsional untuk job publikasi terjadwal dan retry latar belakang.", false]
  ] as const;
  return <main className="login-page"><section className="login-card" style={{ width: "min(680px,100%)" }}><div className="brand" style={{ padding: 0, color: "#176b4a" }}>Newsroom<small style={{ color: "#65726c" }}>Application setup</small></div><h1 style={{ marginTop: 26 }}>Setup newsroom diperlukan</h1><p className="subtitle">Layanan tidak akan mengklaim integrasi atau data editorial aktif sebelum koneksi nyata tersedia.</p>{query.issue === "database" && <div className="notice notice-warn" style={{ marginTop: 16 }}>Hostname dashboard dikenali, tetapi koneksi database tidak tersedia. Periksa DATABASE_URL dan kesiapan PostgreSQL; halaman ini tidak menampilkan rahasia environment.</div>}<div className="stack" style={{ marginTop: 20 }}>{items.map(([name, ok, detail, required]) => <div className="card" key={name}><div className="actions" style={{ justifyContent: "space-between" }}><strong>{name}</strong><span className={ok ? "badge badge-green" : required ? "badge badge-yellow" : "badge"}>{ok ? "CONFIGURED" : required ? "SETUP REQUIRED" : "OPTIONAL"}</span></div><div className="muted" style={{ marginTop: 8 }}>{detail}</div></div>)}</div><div className="notice notice-warn" style={{ marginTop: 18 }}>Jangan mengunggah gambar ke Google Images atau penyimpanan alternatif; Cloudinary tetap diwajibkan. Server staging dan dashboard produksi harus menggunakan DATABASE_URL, SESSION_SECRET kuat, dan konfigurasi Cloudinary privat.</div><div className="actions" style={{ marginTop: 18 }}><Link className="btn btn-primary" href="/login">Coba masuk lagi</Link><span className="muted">Langkah lengkap tersedia di README.md dalam repositori.</span></div></section></main>;
}
