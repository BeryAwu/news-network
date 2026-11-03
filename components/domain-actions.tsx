"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui";

type Media = { id: string; displayName: string; domains: { id: string; hostname: string; isCanonical: boolean; isActive: boolean; verificationStatus: string }[] };

export default function DomainForm({ media }: { media: Media[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(data: FormData) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/domains", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaSiteId: data.get("mediaSiteId"), hostname: data.get("hostname"), isCanonical: data.get("isCanonical") === "on", action: "add" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Domain tidak dapat ditambahkan.");
      setMessage(`${result.hostname} sudah ditambahkan. Verifikasi kepemilikan domain sebelum mengaktifkannya.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Domain tidak dapat ditambahkan.");
    } finally {
      setBusy(false);
    }
  }

  async function change(mediaSiteId: string, hostname: string, action: "verify" | "disable", isCanonical = false) {
    if (action === "verify" && !window.confirm(`Apakah Anda sudah memeriksa kepemilikan ${hostname} melalui DNS atau penyedia hosting? Aplikasi tidak memeriksa DNS secara otomatis.`)) return;
    if (action === "disable" && !window.confirm(`Nonaktifkan ${hostname}? Domain ini tidak akan menerima publikasi baru.`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/domains", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaSiteId, hostname, action, isCanonical }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Status domain tidak dapat diperbarui.");
      setMessage(`${hostname}: ${result.verificationStatus === "VERIFIED" ? "terverifikasi" : result.verificationStatus}, ${result.isActive ? "aktif" : "nonaktif"}.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status domain tidak dapat diperbarui.");
    } finally {
      setBusy(false);
    }
  }

  if (!media.length) return <div className="notice">Buat profil media terlebih dahulu. Setelah media tersimpan, tambahkan domain situs di sini.</div>;

  return <div className="stack">
    <form className="card stack" action={submit}>
      <div className="form-intro"><span className="eyebrow">Setelah profil dibuat</span><h2>Tambahkan domain situs</h2><p className="muted">Gunakan nama domain, tanpa `https://`. Pilih satu domain utama untuk penerbit ini.</p></div>
      <div className="field"><label htmlFor="domain-media">Media</label><select id="domain-media" name="mediaSiteId" required>{media.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></div>
      <div className="field"><label htmlFor="domain-hostname">Nama domain</label><input id="domain-hostname" name="hostname" placeholder="berita.example.id" required maxLength={253}/></div>
      <label className="checkline"><input type="checkbox" name="isCanonical"/> Jadikan domain utama</label>
      <button className="btn btn-primary" disabled={busy || !media.length}>{busy ? "Menyimpan…" : "Tambah domain"}</button>
      <p className="muted">Domain baru belum aktif. Verifikasi kepemilikannya melalui DNS atau hosting di luar aplikasi sebelum menyalakannya.</p>
    </form>

    {media.flatMap((site) => site.domains.map((domain) => <section className="card domain-card" key={domain.id}>
      <div className="domain-card-heading"><div><strong>{domain.hostname}</strong><span>{site.displayName} · {domain.isCanonical ? "domain utama" : "domain tambahan"}</span></div><div className="actions"><StatusBadge status={domain.verificationStatus}/><StatusBadge status={domain.isActive ? "ACTIVE" : "DISABLED"}/></div></div>
      <div className="actions"><button disabled={busy || domain.verificationStatus === "VERIFIED"} className="btn" title="Periksa kepemilikan domain di luar aplikasi terlebih dahulu." onClick={() => change(site.id, domain.hostname, "verify", domain.isCanonical)}>{domain.verificationStatus === "VERIFIED" ? "Sudah diverifikasi" : "Konfirmasi verifikasi"}</button>{domain.isActive && <button disabled={busy} className="btn btn-danger" onClick={() => change(site.id, domain.hostname, "disable")}>Nonaktifkan domain</button>}</div>
    </section>))}
    {error && <div role="alert" className="notice notice-error">{error}</div>}
    {message && <div role="status" className="notice">{message}</div>}
  </div>;
}
