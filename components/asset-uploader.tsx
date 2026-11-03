"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const allowed: Record<string, true> = { "image/jpeg": true, "image/png": true, "image/webp": true, "image/avif": true };
type Media = { id: string; displayName: string };

export default function AssetUploader({ media }: { media: Media[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [licenseType, setLicenseType] = useState("");

  async function submit(data: FormData) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const file = data.get("file");
      if (!(file instanceof File) || !file.size) throw new Error("Pilih gambar terlebih dahulu.");
      if (file.size > 10 * 1024 * 1024) throw new Error("Ukuran gambar melebihi 10 MB.");
      if (!allowed[file.type]) throw new Error("Format harus JPEG, PNG, WebP, atau AVIF.");
      const selectedLicense = String(data.get("licenseType") || "");
      if (!selectedLicense) throw new Error("Pilih dasar penggunaan gambar sebelum mengunggah.");
      if (selectedLicense === "AI_GENERATED" && !String(data.get("generationPrompt") || "").trim()) throw new Error("Isi prompt atau deskripsi pembuat gambar AI.");
      data.set("originalFilename", file.name);
      data.set("isAiGenerated", String(selectedLicense === "AI_GENERATED"));
      const response = await fetch("/api/assets/sign", { method: "POST", body: data, signal: AbortSignal.timeout(90_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gambar tidak dapat diunggah.");
      setMessage("Gambar berhasil diunggah ke Cloudinary dan catatan hak penggunaannya disimpan.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gambar tidak dapat diunggah.");
    } finally {
      setBusy(false);
    }
  }

  return <form action={submit} className="card stack">
    <div className="form-intro"><span className="eyebrow">Pustaka gambar newsroom</span><h2>Tambahkan gambar</h2><p className="muted">Pilih media, unggah berkas, dan catat dari mana gambar berasal serta bagaimana gambar boleh digunakan.</p></div>
    <div className="grid grid-2">
      <div className="field"><label htmlFor="asset-media">Media</label><select name="mediaSiteId" id="asset-media" required>{media.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></div>
      <div className="field"><label htmlFor="asset-file">Berkas gambar</label><input id="asset-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required/><small className="muted">JPEG, PNG, WebP, atau AVIF · maksimal 10 MB.</small></div>
      <div className="field"><label htmlFor="asset-alt">Deskripsi untuk pembaca layar</label><input id="asset-alt" name="altText" maxLength={500}/><small className="muted">Jelaskan isi gambar jika membantu memahami berita; biarkan kosong bila dekoratif.</small></div>
      <div className="field"><label htmlFor="asset-caption">Keterangan gambar (opsional)</label><input id="asset-caption" name="caption" maxLength={2000}/></div>
      <div className="field"><label htmlFor="asset-credit">Fotografer atau kreator (opsional)</label><input id="asset-credit" name="credit" maxLength={500}/></div>
      <div className="field"><label htmlFor="asset-license">Izin penggunaan</label><select id="asset-license" name="licenseType" value={licenseType} onChange={(event) => setLicenseType(event.target.value)} required><option value="" disabled>Pilih dasar penggunaan</option><option value="USER_PROVIDED">Dibuat tim kami atau izin langsung sudah diberikan</option><option value="CC0">CC0 — domain publik, tanpa atribusi wajib</option><option value="CC_BY">CC BY — perlu mencantumkan atribusi</option><option value="CC_BY_SA">CC BY-SA — atribusi dan lisensi yang sama</option><option value="PUBLIC_DOMAIN">Domain publik</option><option value="AI_GENERATED">Dibuat dengan AI</option><option value="OTHER">Lisensi atau izin lainnya</option></select></div>
    </div>

    <details className="optional-profile"><summary>Rincian sumber dan lisensi <span className="muted">(tambahkan jika ada)</span></summary>
      <p className="muted">Catat alamat situs sumber dan keterangan hak agar tim dapat memeriksanya lagi nanti.</p>
      <div className="grid grid-2">
        <div className="field"><label htmlFor="asset-source">Tautan asal gambar</label><input id="asset-source" name="sourceUrl" type="url" maxLength={2000}/></div>
        <div className="field"><label htmlFor="asset-publisher">Pemilik atau penerbit gambar</label><input id="asset-publisher" name="sourcePublisher" maxLength={250}/></div>
        <div className="field"><label htmlFor="asset-license-url">Tautan teks lisensi</label><input id="asset-license-url" name="licenseUrl" type="url" maxLength={2000}/></div>
        <div className="field"><label htmlFor="asset-attribution">Teks kredit atau atribusi</label><input id="asset-attribution" name="attributionText" maxLength={1000}/></div>
      </div>
    </details>

    {licenseType === "AI_GENERATED" && <div className="field"><label htmlFor="asset-generation-prompt">Prompt atau deskripsi pembuatan gambar</label><textarea id="asset-generation-prompt" name="generationPrompt" maxLength={1000} required/><small className="muted">Catatan ini disimpan bersama aset; jangan masukkan data pribadi ke prompt.</small></div>}
    {licenseType === "OTHER" && <div className="field"><label htmlFor="asset-other-attribution">Jelaskan izin atau hak penggunaan</label><textarea id="asset-other-attribution" name="attributionText" maxLength={1000} required/></div>}
    <div className="notice notice-warn">Google Images bukan bukti izin. Pilih hanya hak yang sudah dipastikan. Jika sumber atau izinnya belum diketahui, jangan unggah gambar tersebut.</div>
    {error && <div role="alert" className="notice notice-error">{error}</div>}
    {message && <div role="status" className="notice">{message}</div>}
    <button disabled={busy || media.length === 0} className="btn btn-primary">{busy ? "Memeriksa dan mengunggah…" : "Simpan gambar"}</button>
  </form>;
}
