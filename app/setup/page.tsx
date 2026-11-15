import { CircleAlert } from "lucide-react";
import AuthArt, { AuthBrand } from "@/components/auth-art";
import { appFont } from "@/lib/app-font";
import "@/app/app.css";
import Link from "next/link";
import { databaseReady } from "@/lib/database";
import { aiConfiguration } from "@/lib/ai";
export const dynamic = "force-dynamic";
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ issue?: string }> }) {
  const query = await searchParams;
  const database = await databaseReady();
  const session = Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32);
  const cloud = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const ai = await aiConfiguration();
  const redis = Boolean(process.env.REDIS_URL);
  const items = [
    ["PostgreSQL / Prisma", database, "DATABASE_URL diperlukan untuk akun, media, naskah dan publikasi.", true],
    ["Sesi aman", session, "SESSION_SECRET minimal 32 karakter diperlukan untuk login.", true],
    ["Cloudinary (wajib untuk gambar)", cloud, "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET hanya di environment server.", true],
    ["AI", ai.configured && ai.mode !== "test adapter", "AI_PROVIDER=openrouter dan AI_API_KEY OpenRouter diperlukan untuk draft produksi. AI_MODEL default qwen/qwen3-235b-a22b-2507; adapter lokal hanya untuk development/test.", true],
    ["Redis / BullMQ", redis, "Opsional untuk job publikasi terjadwal dan retry latar belakang.", false]
  ] as const;
  const done = items.filter(([, ok]) => ok).length;
  return (
    <div className={`app ${appFont.variable}`}>
      <div className="auth">
        <AuthArt />
        <main className="auth-panel">
          <div className="auth-box wide">
            <AuthBrand />
            <div className="stack-sm">
              <h1>Penyiapan aplikasi</h1>
              <p className="muted">{done} dari {items.length} sambungan sudah siap. Aplikasi tidak menampilkan layanan sebagai aktif sebelum benar-benar tersambung.</p>
            </div>
            {query.issue === "database" && (
              <div className="notice notice-warn" role="alert"><CircleAlert size={20} aria-hidden="true" /><span>Database tidak bisa dihubungi. Periksa DATABASE_URL dan pastikan PostgreSQL menyala. Halaman ini tidak menampilkan rahasia server.</span></div>
            )}
            <div className="stack">
              {items.map(([name, ok, detail, required]) => (
                <div className="card stack-sm" key={name}>
                  <div className="row-between">
                    <strong>{name}</strong>
                    <span className={ok ? "badge badge-green" : required ? "badge badge-yellow" : "badge"}>{ok ? "Sudah siap" : required ? "Perlu disiapkan" : "Opsional"}</span>
                  </div>
                  <p className="muted">{detail}</p>
                </div>
              ))}
            </div>
            <p className="help">Gambar wajib disimpan di Cloudinary. Langkah lengkap ada di README.md pada repositori.</p>
            <Link className="btn btn-primary" href="/login">Coba masuk lagi</Link>
          </div>
        </main>
      </div>
    </div>
  );
}
