"use client";
import { useState } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";

function loginErrorMessage(status: number, serverMessage?: string) {
  if (status === 401 || status === 400) return "Email atau kata sandi salah. Periksa lagi lalu coba masuk kembali.";
  if (status === 429) return "Terlalu banyak percobaan masuk. Tunggu beberapa menit lalu coba lagi.";
  if (status === 403) return "Permintaan ditolak oleh server. Muat ulang halaman dan coba lagi.";
  return serverMessage || "Gagal masuk karena kesalahan server. Coba lagi sebentar lagi.";
}

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(form: FormData) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        setError(loginErrorMessage(response.status, result.error));
        return;
      }
      // Full navigation so the new session cookie is sent with the very next request.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="stack">
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} placeholder="nama@perusahaan.com" />
      </div>
      <div className="field">
        <label htmlFor="password">Kata sandi</label>
        <div className="password-wrap">
          <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={200} />
          <button type="button" className="password-toggle" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
            {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {error && <div role="alert" className="notice notice-error"><CircleAlert size={20} aria-hidden="true" /><span>{error}</span></div>}
      <button type="submit" disabled={busy} className="btn btn-primary btn-block">{busy ? "Memeriksa…" : "Masuk"}</button>
      <p className="help">Lupa kata sandi? Minta admin Anda mengatur ulang akunnya.</p>
    </form>
  );
}
