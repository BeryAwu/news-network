"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, ImagePlus } from "lucide-react";
import { assetLicenseRequirementError } from "@/lib/asset-provenance";
import "@/app/css/assets.css";

const MAX_BYTES = 10 * 1024 * 1024;
const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
type Media = { id: string; displayName: string };
type Source = "own" | "permission" | "cc" | "public" | "ai";

const sources: { key: Source; label: string; hint: string }[] = [
  { key: "own", label: "Foto milik sendiri atau redaksi", hint: "Dibuat oleh tim kami atau oleh kontributor yang menyerahkan haknya." },
  { key: "permission", label: "Dapat izin tertulis", hint: "Pemilik gambar sudah mengizinkan lewat pesan atau surat." },
  { key: "cc", label: "Lisensi terbuka (CC)", hint: "Gambar dari situs yang memakai lisensi Creative Commons." },
  { key: "public", label: "Domain publik", hint: "Gambar yang hak ciptanya sudah habis atau dilepas." },
  { key: "ai", label: "Ilustrasi buatan AI", hint: "Gambar yang dibuat dengan alat AI." },
];

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileProblem(file: File | null) {
  if (!file) return "Pilih gambar dulu.";
  if (file.size > MAX_BYTES) return `Gambar ini ${formatSize(file.size)}, lebih besar dari batas 10 MB. Kecilkan ukurannya, lalu pilih lagi.`;
  if (!allowed.has(file.type)) return "File ini bukan JPEG, PNG, WebP, atau AVIF. Simpan gambar dalam salah satu format itu, lalu pilih lagi.";
  return "";
}

/** Server messages are partly English; show plain Indonesian by status unless the server already answered in Indonesian. */
function plainServerError(status: number, message: string | undefined) {
  const english = !message || /\b(the|must|is|are|only|choose|upload|exceeds|configured|not found)\b/i.test(message);
  if (!english) return message as string;
  if (status === 413) return "Gambar lebih besar dari 10 MB. Kecilkan ukurannya, lalu coba lagi.";
  if (status === 415) return "File ini bukan gambar yang dikenali. Pakai JPEG, PNG, WebP, atau AVIF.";
  if (status === 403 || status === 401) return "Akun Anda tidak boleh mengunggah ke media ini. Minta editor atau admin.";
  if (status === 404) return "Media tidak ditemukan. Muat ulang halaman, lalu coba lagi.";
  if (status === 400) return "Ada isian yang belum sesuai. Periksa tiap langkah, lalu coba lagi.";
  return "Gambar belum bisa disimpan. Coba lagi sebentar lagi. Kalau tetap gagal, hubungi admin.";
}

export default function AssetUploader({ media, cloudConfigured = true }: { media: Media[]; cloudConfigured?: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [source, setSource] = useState<Source | "">("");
  const [ccType, setCcType] = useState("CC_BY");
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const licenseType = source === "own" ? "USER_PROVIDED" : source === "permission" ? "OTHER" : source === "cc" ? ccType : source === "public" ? "PUBLIC_DOMAIN" : source === "ai" ? "AI_GENERATED" : "";

  function take(next: File | null) {
    setSaved(false);
    setError("");
    setFile(next);
    setPreview("");
    if (next && !fileProblem(next)) {
      const reader = new FileReader();
      reader.onload = () => setPreview(typeof reader.result === "string" ? reader.result : "");
      reader.readAsDataURL(next);
    }
    const problem = next ? fileProblem(next) : "";
    setErrors((current) => ({ ...current, file: problem }));
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (!dropped) return;
    if (fileRef.current) { const transfer = new DataTransfer(); transfer.items.add(dropped); fileRef.current.files = transfer.files; }
    take(dropped);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) || "").trim();
    const next: Record<string, string> = {};
    if (!text("mediaSiteId")) next.mediaSiteId = "Pilih media tujuan gambar.";
    const problem = fileProblem(file);
    if (problem) next.file = problem;
    if (!licenseType) next.source = "Pilih dari mana gambar ini berasal.";
    else {
      const rights = assetLicenseRequirementError({ licenseType, sourceUrl: text("sourceUrl"), licenseUrl: text("licenseUrl"), credit: text("credit"), attributionText: text("attributionText"), generationPrompt: text("generationPrompt") });
      if (rights) next.rights = rights;
    }
    setErrors(next);
    setError("");
    setSaved(false);
    if (Object.keys(next).length) {
      setError("Gambar belum bisa disimpan. Lengkapi bagian yang ditandai merah.");
      return;
    }
    if (!file) return;
    data.set("file", file);
    data.set("originalFilename", file.name);
    data.set("licenseType", licenseType);
    data.set("isAiGenerated", String(licenseType === "AI_GENERATED"));
    setBusy(true);
    try {
      const response = await fetch("/api/assets/sign", { method: "POST", body: data, signal: AbortSignal.timeout(90_000) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(plainServerError(response.status, result.error));
      setSaved(true);
      formRef.current?.reset();
      setFile(null);
      setSource("");
      setCcType("CC_BY");
      router.refresh();
    } catch (e) {
      setError(e instanceof DOMException && e.name === "TimeoutError" ? "Unggahan terlalu lama. Cek sambungan internet, lalu coba lagi." : e instanceof Error ? e.message : "Gambar belum bisa disimpan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const needsSourceUrl = source === "cc" || source === "public";

  return <form ref={formRef} onSubmit={submit} noValidate className="card stack" aria-labelledby="uploader-title">
    <div className="stack-sm">
      <h2 id="uploader-title">Tambah gambar</h2>
      <p className="muted">Tiga langkah. Setelah tersimpan, gambar bisa dipasang ke naskah.</p>
    </div>
    {!cloudConfigured && <div className="notice notice-warn" role="status"><CircleAlert size={20} aria-hidden="true"/><span>Penyimpanan gambar belum disiapkan di server, jadi unggahan belum bisa dipakai. Minta admin mengisi kunci Cloudinary. <Link href="/monitoring">Lihat kesehatan sistem</Link></span></div>}

    <fieldset className="step" disabled={!cloudConfigured || busy}>
      <legend className="step-title"><span className="step-num">1</span>Pilih media</legend>
      <div className="field">
        <label htmlFor="asset-media">Gambar ini untuk media apa?</label>
        <select name="mediaSiteId" id="asset-media" defaultValue={media.length === 1 ? media[0].id : ""} onChange={() => setErrors((current) => ({ ...current, mediaSiteId: "" }))} aria-invalid={Boolean(errors.mediaSiteId)} aria-describedby={errors.mediaSiteId ? "asset-media-error" : undefined}>
          {media.length !== 1 && <option value="" disabled>Pilih media</option>}
          {media.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
        </select>
        {errors.mediaSiteId && <span id="asset-media-error" className="field-error">{errors.mediaSiteId}</span>}
      </div>
    </fieldset>

    <hr className="divider"/>

    <fieldset className="step" disabled={!cloudConfigured || busy}>
      <legend className="step-title"><span className="step-num">2</span>Pilih file gambar</legend>
      <div className="stack-sm">
        <div className="drop" data-dragging={dragging} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          {preview && file ? <div className="drop-preview"><Image src={preview} alt="Pratinjau gambar yang akan diunggah" fill unoptimized sizes="160px"/></div> : <ImagePlus size={28} aria-hidden="true"/>}
          <div className="stack-sm">
            <strong>{file ? file.name : "Tarik gambar ke sini"}</strong>
            <span className="muted">{file ? formatSize(file.size) : "atau pilih dari komputer atau ponsel Anda"}</span>
          </div>
          <label htmlFor="asset-file" className="btn drop-button">{file ? "Ganti gambar" : "Pilih gambar"}</label>
          <input ref={fileRef} id="asset-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="visually-hidden" aria-describedby="asset-file-help asset-file-error" onChange={(event) => take(event.target.files?.[0] ?? null)}/>
        </div>
        <span id="asset-file-help" className="field-help">JPEG, PNG, WebP, atau AVIF. Maksimal 10 MB.</span>
        <span id="asset-file-error" className="field-error" role={errors.file ? "alert" : undefined}>{errors.file}</span>
      </div>
      <div className="grid-2">
        <div className="field"><label htmlFor="asset-alt">Isi gambar dalam satu kalimat</label><input id="asset-alt" name="altText" maxLength={500}/><span className="field-help">Dibaca oleh pembaca layar. Kosongkan kalau gambar hanya hiasan.</span></div>
        <div className="field"><label htmlFor="asset-caption">Keterangan di bawah gambar (boleh kosong)</label><input id="asset-caption" name="caption" maxLength={2000}/></div>
      </div>
    </fieldset>

    <hr className="divider"/>

    <fieldset className="step" disabled={!cloudConfigured || busy}>
      <legend className="step-title"><span className="step-num">3</span>Dari mana gambar ini?</legend>
      <div className="choice-list" role="radiogroup" aria-label="Asal gambar">
        {sources.map((item) => <label className="choice" key={item.key}>
          <input type="radio" name="sourceChoice" value={item.key} checked={source === item.key} onChange={() => { setSource(item.key); setErrors((current) => ({ ...current, source: "", rights: "" })); }}/>
          <span className="choice-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
        </label>)}
      </div>
      {errors.source && <span className="field-error" role="alert">{errors.source}</span>}
      <input type="hidden" name="licenseType" value={licenseType}/>

      {source === "cc" && <div className="field"><label htmlFor="asset-cc">Jenis lisensi CC</label><select id="asset-cc" value={ccType} onChange={(event) => setCcType(event.target.value)}><option value="CC_BY">CC BY: boleh dipakai, wajib sebut pembuatnya</option><option value="CC_BY_SA">CC BY-SA: sebut pembuatnya, lisensi tetap sama</option><option value="CC0">CC0: tanpa syarat</option></select></div>}

      {source && <div className="source-fields stack-sm">
        {source === "ai" && <div className="field"><label htmlFor="asset-prompt">Perintah yang dipakai untuk membuat gambar</label><textarea id="asset-prompt" name="generationPrompt" maxLength={1000}/><span className="field-help">Disimpan bersama gambar supaya tim bisa menelusurinya. Jangan masukkan data pribadi.</span></div>}
        {source === "permission" && <div className="field"><label htmlFor="asset-permission">Siapa yang memberi izin, dan bagaimana bentuknya?</label><textarea id="asset-permission" name="attributionText" maxLength={1000}/><span className="field-help">Contoh: Izin tertulis dari Budi Santoso lewat surel, 3 November.</span></div>}
        {needsSourceUrl && <div className="field"><label htmlFor="asset-source">Tautan halaman asal gambar</label><input id="asset-source" name="sourceUrl" type="url" inputMode="url" maxLength={2000} placeholder="https://"/></div>}
        {source === "cc" && <div className="field"><label htmlFor="asset-license-url">Tautan teks lisensi</label><input id="asset-license-url" name="licenseUrl" type="url" inputMode="url" maxLength={2000} placeholder="https://creativecommons.org/licenses/…"/></div>}
        {(source === "cc" || source === "permission") && <div className="field"><label htmlFor="asset-publisher">Pemilik atau penerbit gambar (boleh kosong)</label><input id="asset-publisher" name="sourcePublisher" maxLength={250}/></div>}
        <div className="field"><label htmlFor="asset-credit">{source === "ai" ? "Nama alat AI (boleh kosong)" : source === "cc" && ccType !== "CC0" ? "Nama pembuat gambar" : "Nama fotografer atau pembuat (boleh kosong)"}</label><input id="asset-credit" name="credit" maxLength={500}/></div>
        {source === "cc" && <div className="field"><label htmlFor="asset-attribution">Teks kredit yang diminta lisensi (boleh kosong)</label><input id="asset-attribution" name="attributionText" maxLength={1000}/></div>}
        {source === "cc" && <p className="why">Kenapa kami minta ini: lisensi terbuka biasanya mewajibkan Anda menyebut pembuat gambar. Tautan asal dan tautan lisensi menjadi bukti kalau ada yang bertanya.</p>}
        {source === "public" && <p className="why">Kenapa kami minta ini: tautan asal menunjukkan bahwa gambar memang berstatus domain publik.</p>}
        {source === "ai" && <p className="why">Kenapa kami minta ini: pembaca berhak tahu gambar dibuat AI, dan perintahnya membantu tim memeriksa hasilnya.</p>}
        {source === "permission" && <p className="why">Kenapa kami minta ini: catatan izin melindungi redaksi kalau pemilik gambar menanyakannya nanti.</p>}
      </div>}
      {errors.rights && <span className="field-error" role="alert">{errors.rights}</span>}
      <div className="notice notice-warn"><CircleAlert size={20} aria-hidden="true"/><span>Gambar dari Google atau media sosial tidak otomatis boleh dipakai. Kalau Anda belum yakin izinnya, jangan unggah.</span></div>
    </fieldset>

    {error && <div role="alert" className="notice notice-error"><CircleAlert size={20} aria-hidden="true"/><span>{error}</span></div>}
    {saved && <div role="status" className="notice notice-success"><CircleCheck size={20} aria-hidden="true"/><span>Gambar tersimpan di pustaka. Berikutnya, <a href="#pasang">pasang ke naskah</a> atau lihat di <a href="#pustaka">daftar gambar</a>.</span></div>}
    <div><button type="submit" className="btn btn-primary" disabled={busy || !cloudConfigured || media.length === 0}>{busy ? "Mengunggah…" : "Simpan gambar"}</button></div>
  </form>;
}
