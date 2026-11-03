"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const roles = [
  ["ADMIN", "Administrator — akses ke semua media"],
  ["EDITOR", "Editor — menyiapkan naskah"],
  ["REVIEWER", "Peninjau — menyetujui atau meminta perbaikan"],
  ["PUBLISHER", "Penerbit — menjalankan publikasi"]
] as const;
const roleNames: Record<string, string> = { ADMIN: "Admin", EDITOR: "Editor", REVIEWER: "Peninjau", PUBLISHER: "Penerbit" };

export default function UserForm({ media }: { media: { id: string; displayName: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("EDITOR");

  async function submit(data: FormData) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), email: data.get("email"), password: data.get("password"), role: data.get("role"), mediaSiteIds: data.getAll("mediaSiteIds") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Akun tidak dapat dibuat.");
      setMessage(`Akun ${result.email} dibuat dengan peran ${roleNames[result.role] || result.role}. Sampaikan kata sandi sementara melalui kanal aman.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Akun tidak dapat dibuat.");
    } finally {
      setBusy(false);
    }
  }

  return <form action={submit} className="card staff-form">
    <div className="form-intro"><span className="eyebrow">Akun staf</span><h2>Tambahkan anggota tim</h2><p className="muted">Gunakan nama dan alamat email anggota tim yang sebenarnya. Berikan kata sandi sementara melalui jalur pribadi.</p></div>
    <div className="grid grid-2">
      <div className="field"><label htmlFor="staff-name">Nama</label><input id="staff-name" name="name" minLength={2} maxLength={120} required autoComplete="name"/></div>
      <div className="field"><label htmlFor="staff-email">Alamat email</label><input id="staff-email" name="email" type="email" maxLength={254} required autoComplete="email"/></div>
      <div className="field"><label htmlFor="staff-password">Kata sandi awal</label><input id="staff-password" name="password" type="password" minLength={14} maxLength={200} required autoComplete="new-password"/><small className="muted">Minimal 14 karakter. Bagikan kata sandi ini secara pribadi, jangan lewat kanal publik.</small></div>
      <div className="field"><label htmlFor="staff-role">Peran dan tanggung jawab</label><select id="staff-role" name="role" value={role} onChange={(event) => setRole(event.target.value)}>{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    </div>
    {role === "ADMIN" ? <div className="notice">Administrator dapat mengakses semua media. Pilihan media tidak diperlukan.</div> : <fieldset className="media-access">
      <legend>Pilih media yang boleh dikelola</legend>
      <p className="muted">Anggota tim hanya dapat melihat media yang Anda centang di sini.</p>
      {media.length ? <div className="media-access-list">{media.map((item) => <label className="checkline" key={item.id}><input type="checkbox" name="mediaSiteIds" value={item.id}/><span>{item.displayName}</span></label>)}</div> : <div className="notice notice-warn">Buat media terlebih dahulu sebelum memberikan akses kepada editor, peninjau, atau penerbit.</div>}
    </fieldset>}
    {error && <div role="alert" className="notice notice-error">{error}</div>}
    {message && <div role="status" className="notice">{message}</div>}
    <button disabled={busy || (role !== "ADMIN" && !media.length)} className="btn btn-primary">{busy ? "Membuat akun…" : "Buat akun staf"}</button>
  </form>;
}
