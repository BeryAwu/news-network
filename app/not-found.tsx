import Link from "next/link";
import { appFont } from "@/lib/app-font";
import "@/app/app.css";

/** Neutral on purpose: unknown public hostnames land here and must not reveal the dashboard's branding. */
export default function NotFound() {
  return (
    <div className={`app ${appFont.variable}`}>
      <main className="auth-panel" style={{ minHeight: "100vh" }}>
        <div className="auth-box">
          <div className="stack-sm">
            <h1>Halaman tidak ditemukan</h1>
            <p className="muted">Alamat ini belum terdaftar, atau isinya sudah tidak tersedia.</p>
          </div>
          <Link className="btn btn-primary" href="/">Kembali ke beranda</Link>
        </div>
      </main>
    </div>
  );
}
