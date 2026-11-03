"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Field = { name: string; label: string; maxLength: number; multiline?: boolean };
const basicFields: Field[] = [
  { name: "name", label: "Nama internal untuk pengelolaan", maxLength: 120 },
  { name: "displayName", label: "Nama media yang ditampilkan", maxLength: 120 },
  { name: "newsroomByline", label: "Nama redaksi yang ditampilkan", maxLength: 120 },
  { name: "hostname", label: "Domain situs (opsional, tanpa https://)", maxLength: 253 }
];
const profileFields: Field[] = [
  { name: "niche", label: "Fokus liputan", maxLength: 500 },
  { name: "targetAudience", label: "Pembaca utama", maxLength: 500 },
  { name: "editorialMission", label: "Misi redaksi", maxLength: 1000, multiline: true },
  { name: "toneGuidelines", label: "Gaya bahasa", maxLength: 1000, multiline: true },
  { name: "styleGuidelines", label: "Panduan penulisan", maxLength: 1000, multiline: true },
  { name: "publisherDisclosure", label: "Keterangan penerbit", maxLength: 1500, multiline: true },
  { name: "ownershipDisclosure", label: "Keterangan kepemilikan", maxLength: 1500, multiline: true }
];

export default function MediaForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(data: FormData) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal menyimpan media.");
      setMessage(`Media ${result.displayName} berhasil disimpan.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan media.");
    } finally {
      setBusy(false);
    }
  }

  function renderField(field: Field, required: boolean) {
    return <div className="field" key={field.name}>
      <label htmlFor={`media-${field.name}`}>{field.label}{required && <span aria-hidden="true"> *</span>}</label>
      {field.multiline
        ? <textarea id={`media-${field.name}`} name={field.name} maxLength={field.maxLength}/>
        : <input id={`media-${field.name}`} name={field.name} maxLength={field.maxLength} required={required} placeholder={field.name === "hostname" ? "contoh: berita.example.id" : undefined}/>}
    </div>;
  }

  return <form action={submit} className="card">
    <div className="form-intro"><span className="eyebrow">Langkah awal</span><h2>Tambahkan media</h2><p className="muted">Isi nama yang benar-benar digunakan penerbit. Detail redaksi dan domain bisa dilengkapi setelahnya.</p></div>
    <div className="grid grid-2">{basicFields.map((field) => renderField(field, ["name", "displayName", "newsroomByline"].includes(field.name)))}</div>
    <details className="optional-profile">
      <summary>Profil redaksi dan keterangan penerbit <span className="muted">(opsional)</span></summary>
      <p className="muted">Boleh dilewati dulu. Lengkapi fokus liputan, pembaca, dan keterangan penerbit sebelum membuat draf.</p>
      <div className="grid grid-2">
        {profileFields.map((field) => renderField(field, false))}
        <div className="field"><label htmlFor="media-language">Bahasa artikel</label><select id="media-language" name="language" defaultValue="Indonesian"><option value="Indonesian">Bahasa Indonesia</option><option value="English">Bahasa Inggris</option></select></div>
      </div>
    </details>
    {error && <div role="alert" className="notice notice-error" style={{ marginBottom: 12 }}>{error}</div>}
    {message && <div role="status" className="notice" style={{ marginBottom: 12 }}>{message}</div>}
    <button disabled={busy} className="btn btn-primary">{busy ? "Menyimpan…" : "Simpan media"}</button>
  </form>;
}
