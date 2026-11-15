"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CircleAlert, ImagePlus, LoaderCircle, RefreshCw, Save, Star, Trash2 } from "lucide-react";
import { assetLicenseRequirementError } from "@/lib/asset-provenance";
import type { BlastAsset } from "@/lib/blast-types";
import "@/app/css/blast-images.css";

const MAX_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

type Source = "own" | "permission" | "cc" | "public" | "ai";
type Value = { featured: BlastAsset | null; gallery: BlastAsset[] };
type Status = "uploading" | "done" | "error";

type Item = {
  key: string;
  /** Kept in memory so a failed upload or a changed caption can be sent again. Missing for pictures that came in through `value`. */
  file: File | null;
  preview: string;
  ownsPreview: boolean;
  asset: BlastAsset | null;
  status: Status;
  progress: number;
  error: string;
  caption: string;
  credit: string;
  source: Source;
  ccType: string;
  sourceUrl: string;
  licenseUrl: string;
  attributionText: string;
  generationPrompt: string;
  /** Snapshot of the metadata the stored copy was uploaded with. */
  sentKey: string;
  rights: string;
};

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

function fileProblem(file: File) {
  if (file.size === 0) return "File ini kosong. Pilih gambar lain.";
  if (file.size > MAX_BYTES) return `Gambar ini ${formatSize(file.size)}, lebih besar dari batas 10 MB. Kecilkan ukurannya, lalu pilih lagi.`;
  if (!allowedTypes.has(file.type)) return "File ini bukan JPEG, PNG, WebP, atau AVIF. Simpan gambar dalam salah satu format itu, lalu pilih lagi.";
  return "";
}

function licenseOf(item: Item) {
  return item.source === "own" ? "USER_PROVIDED" : item.source === "permission" ? "OTHER" : item.source === "cc" ? item.ccType : item.source === "public" ? "PUBLIC_DOMAIN" : "AI_GENERATED";
}

function metaKey(item: Item) {
  return JSON.stringify([item.caption.trim(), item.credit.trim(), item.source, item.ccType, item.sourceUrl.trim(), item.licenseUrl.trim(), item.attributionText.trim(), item.generationPrompt.trim()]);
}

function rightsProblem(item: Item) {
  return assetLicenseRequirementError({ licenseType: licenseOf(item), sourceUrl: item.sourceUrl.trim(), licenseUrl: item.licenseUrl.trim(), credit: item.credit.trim(), attributionText: item.attributionText.trim(), generationPrompt: item.generationPrompt.trim() });
}

function plainServerError(status: number, message: unknown) {
  const text = typeof message === "string" ? message : "";
  const english = !text || /\b(the|must|is|are|only|choose|upload|exceeds|configured|not found|image|media)\b/i.test(text);
  if (!english) return text;
  if (status === 413) return "Gambar lebih besar dari 10 MB. Kecilkan ukurannya, lalu coba lagi.";
  if (status === 415) return "File ini bukan gambar yang dikenali. Pakai JPEG, PNG, WebP, atau AVIF.";
  if (status === 403 || status === 401) return "Akun Anda tidak boleh mengunggah gambar. Minta editor atau admin.";
  if (status === 429) return "Terlalu banyak unggahan dalam satu menit. Tunggu sebentar, lalu tekan Coba lagi.";
  if (status === 400) return "Ada isian gambar yang belum sesuai. Periksa keterangan dan bukti izinnya, lalu coba lagi.";
  return "Gambar belum bisa disimpan. Coba lagi sebentar lagi. Kalau tetap gagal, hubungi admin.";
}

type UploadResult = { ok: true; asset: BlastAsset } | { ok: false; error: string };

function upload(item: Item, onProgress: (percent: number) => void): Promise<UploadResult> {
  return new Promise((resolve) => {
    if (!item.file) { resolve({ ok: false, error: "Pilih gambarnya lagi dari komputer atau ponsel Anda." }); return; }
    const data = new FormData();
    const caption = item.caption.trim();
    data.set("file", item.file);
    data.set("originalFilename", item.file.name);
    data.set("altText", caption);
    data.set("caption", caption);
    data.set("credit", item.credit.trim());
    data.set("licenseType", licenseOf(item));
    data.set("isAiGenerated", String(item.source === "ai"));
    const optional: [string, string][] = [["sourceUrl", item.sourceUrl], ["licenseUrl", item.licenseUrl], ["attributionText", item.attributionText], ["generationPrompt", item.generationPrompt]];
    for (const [name, text] of optional) if (text.trim()) data.set(name, text.trim());
    const request = new XMLHttpRequest();
    request.open("POST", "/api/assets/sign");
    request.timeout = 90_000;
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100))); };
    request.onerror = () => resolve({ ok: false, error: "Sambungan internet terputus. Cek sambungan Anda, lalu tekan Coba lagi." });
    request.ontimeout = () => resolve({ ok: false, error: "Unggahan terlalu lama. Cek sambungan internet, lalu tekan Coba lagi." });
    request.onload = () => {
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(request.responseText) as Record<string, unknown>; } catch { body = {}; }
      if (request.status < 200 || request.status >= 300) { resolve({ ok: false, error: plainServerError(request.status, body.error) }); return; }
      resolve({
        ok: true,
        asset: {
          id: String(body.id),
          secureUrl: String(body.secureUrl),
          altText: String(body.altText ?? caption),
          caption: String(body.caption ?? caption),
          credit: String(body.credit ?? item.credit.trim()),
          width: Number(body.width) || 0,
          height: Number(body.height) || 0,
          isAiGenerated: Boolean(body.isAiGenerated),
        },
      });
    };
    request.send(data);
  });
}

function fromAsset(asset: BlastAsset, key: string): Item {
  const base: Item = {
    key, file: null, preview: asset.secureUrl, ownsPreview: false, asset, status: "done", progress: 100, error: "",
    caption: asset.caption || asset.altText, credit: asset.credit, source: asset.isAiGenerated ? "ai" : "own", ccType: "CC_BY", sourceUrl: "", licenseUrl: "", attributionText: "", generationPrompt: "", sentKey: "", rights: "",
  };
  return { ...base, sentKey: metaKey(base) };
}

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `img${keySeq}`;
}

function seedItems(value: Value) {
  return [value.featured, ...value.gallery].filter((asset): asset is BlastAsset => Boolean(asset)).map((asset) => fromAsset(asset, nextKey()));
}

function assetsOf(items: Item[]): Value {
  const ready = items.filter((item) => item.asset).map((item) => item.asset as BlastAsset);
  return { featured: ready[0] ?? null, gallery: ready.slice(1) };
}

function signature(value: Value) {
  return [value.featured?.id ?? "", ...value.gallery.map((asset) => asset.id)].join("|");
}

/**
 * Picture picker: first picture is the main one, the rest are extra pictures.
 * Each file is stored as soon as it is chosen; the component reports stored assets through `onChange`.
 * Caption, credit and licence are stored with the file, so changing them after the upload stores the file again.
 * `onPendingChange` reports how many pictures are still uploading, failed, or have unsaved caption changes.
 */
export default function BlastImages({ value, onChange, max = 5, onPendingChange }: {
  value: Value;
  onChange: (next: Value) => void;
  max?: number;
  onPendingChange?: (pending: number) => void;
}) {
  const [items, setItems] = useState<Item[]>(() => seedItems(value));
  const itemsRef = useRef(items);
  const emitted = useRef(signature(assetsOf(items)));
  const onChangeRef = useRef(onChange);
  const onPendingRef = useRef(onPendingChange);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => { onChangeRef.current = onChange; onPendingRef.current = onPendingChange; });

  function commit(next: Item[]) {
    itemsRef.current = next;
    setItems(next);
    const derived = assetsOf(next);
    const sig = signature(derived);
    if (sig !== emitted.current) { emitted.current = sig; onChangeRef.current(derived); }
    onPendingRef.current?.(next.filter((item) => item.status !== "done" || (item.file !== null && item.asset !== null && metaKey(item) !== item.sentKey)).length);
  }

  function patch(key: string, change: Partial<Item>) {
    commit(itemsRef.current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }

  // The parent may replace the pictures (for example after a reload from the server). Follow it only when nothing is in flight.
  const incoming = signature(value);
  useEffect(() => {
    if (incoming === emitted.current) return;
    if (itemsRef.current.some((item) => item.status === "uploading")) return;
    for (const item of itemsRef.current) if (item.ownsPreview) URL.revokeObjectURL(item.preview);
    emitted.current = incoming;
    const next = seedItems(value);
    itemsRef.current = next;
    setItems(next);
    onPendingRef.current?.(0);
  }, [incoming, value]);

  useEffect(() => () => { for (const item of itemsRef.current) if (item.ownsPreview) URL.revokeObjectURL(item.preview); }, []);

  async function send(key: string) {
    const item = itemsRef.current.find((entry) => entry.key === key);
    if (!item) return;
    const problem = rightsProblem(item);
    if (problem) { patch(key, { rights: problem }); return; }
    patch(key, { status: "uploading", progress: 0, error: "", rights: "" });
    const sent = metaKey(item);
    const result = await upload(item, (percent) => {
      if (itemsRef.current.some((entry) => entry.key === key)) patch(key, { progress: percent });
    });
    const still = itemsRef.current.find((entry) => entry.key === key);
    if (!still) return; // removed while uploading
    if (result.ok) patch(key, { status: "done", progress: 100, asset: result.asset, sentKey: sent, error: "" });
    else patch(key, { status: "error", error: result.error });
  }

  function take(files: FileList | File[]) {
    const list = Array.from(files);
    const room = max - itemsRef.current.length;
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of list) {
      const problem = fileProblem(file);
      if (problem) problems.push(`${file.name}: ${problem}`);
      else if (accepted.length >= room) problems.push(`${file.name}: Batas ${max} gambar sudah penuh. Hapus satu gambar kalau ingin menggantinya.`);
      else accepted.push(file);
    }
    setNotes(problems);
    if (!accepted.length) return;
    const added: Item[] = accepted.map((file) => ({
      key: nextKey(), file, preview: URL.createObjectURL(file), ownsPreview: true, asset: null, status: "uploading", progress: 0, error: "",
      caption: "", credit: "", source: "own", ccType: "CC_BY", sourceUrl: "", licenseUrl: "", attributionText: "", generationPrompt: "", sentKey: "", rights: "",
    }));
    commit([...itemsRef.current, ...added]);
    for (const item of added) void send(item.key);
  }

  function remove(key: string) {
    const item = itemsRef.current.find((entry) => entry.key === key);
    if (item?.ownsPreview) URL.revokeObjectURL(item.preview);
    commit(itemsRef.current.filter((entry) => entry.key !== key));
    setNotes([]);
  }

  function makeMain(key: string) {
    const item = itemsRef.current.find((entry) => entry.key === key);
    if (!item) return;
    commit([item, ...itemsRef.current.filter((entry) => entry.key !== key)]);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) take(event.dataTransfer.files);
  }

  const full = items.length >= max;

  return <div className="stack bi-root">
    <div className="bi-drop" data-dragging={dragging} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <ImagePlus size={32} aria-hidden="true"/>
      <div className="stack-sm">
        <strong>{full ? `Sudah ada ${max} gambar` : "Tarik gambar ke sini"}</strong>
        <span className="muted">{full ? "Hapus satu gambar kalau ingin menambah yang lain." : `atau pilih dari komputer atau ponsel Anda. Bisa sampai ${max} gambar.`}</span>
      </div>
      <label htmlFor="bi-file" className={full ? "btn btn-primary bi-pick bi-pick-off" : "btn btn-primary bi-pick"} aria-disabled={full}>Pilih gambar</label>
      <input
        ref={fileRef}
        id="bi-file"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="visually-hidden"
        disabled={full}
        aria-describedby="bi-file-help"
        onChange={(event) => { if (event.target.files?.length) take(event.target.files); event.target.value = ""; }}
      />
    </div>
    <p id="bi-file-help" className="field-help">Format JPEG, PNG, WebP, atau AVIF. Setiap gambar maksimal 10 MB. Gambar pertama jadi gambar utama, sisanya gambar tambahan (maksimal {max - 1}).</p>
    {notes.length > 0 && <div className="notice notice-error" role="alert"><CircleAlert size={20} aria-hidden="true"/><ul className="bi-notes">{notes.map((note) => <li key={note}>{note}</li>)}</ul></div>}

    {items.length > 0 && <ul className="bi-list">
      {items.map((item, index) => {
        const dirty = item.file !== null && item.asset !== null && metaKey(item) !== item.sentKey;
        const editable = item.file !== null;
        const busy = item.status === "uploading";
        const id = `bi-${item.key}`;
        return <li key={item.key} className="bi-card">
          <div className="bi-thumb">
            <Image src={item.preview} alt={item.caption || `Pratinjau gambar ${index + 1}`} fill unoptimized sizes="160px"/>
          </div>
          <div className="bi-body stack-sm">
            <div className="row-between">
              <span className={index === 0 ? "badge badge-blue" : "badge"}>{index === 0 ? "Gambar utama" : "Gambar tambahan"}</span>
              {busy && <span className="muted bi-state" role="status"><LoaderCircle size={16} className="bi-spin" aria-hidden="true"/>Mengunggah {item.progress}%</span>}
              {item.status === "done" && !dirty && <span className="bi-ok bi-state" role="status">Tersimpan</span>}
              {dirty && !busy && <span className="bi-warn bi-state" role="status">Perubahan belum disimpan</span>}
            </div>
            {busy && <progress className="bi-progress" max={100} value={item.progress} aria-label={`Kemajuan unggahan gambar ${index + 1}`}/>}
            {item.status === "error" && <div className="notice notice-error" role="alert"><CircleAlert size={20} aria-hidden="true"/><span>{item.error}</span></div>}

            {editable ? <>
              <div className="field">
                <label htmlFor={`${id}-caption`}>Keterangan gambar</label>
                <input id={`${id}-caption`} maxLength={500} value={item.caption} disabled={busy} onChange={(event) => patch(item.key, { caption: event.target.value })}/>
                <span className="field-help">Satu kalimat tentang isi gambar. Tampil di bawah gambar dan dibaca oleh pembaca layar.</span>
              </div>
              <div className="field">
                <label htmlFor={`${id}-credit`}>Foto oleh (boleh kosong)</label>
                <input id={`${id}-credit`} maxLength={500} value={item.credit} disabled={busy} onChange={(event) => patch(item.key, { credit: event.target.value })}/>
              </div>
              <details className="bi-license">
                <summary>Bukan foto milik sendiri?</summary>
                <div className="stack-sm bi-license-body">
                  <div className="choice-list" role="radiogroup" aria-label="Asal gambar">
                    {sources.map((entry) => <label className="choice" key={entry.key}>
                      <input type="radio" name={`${id}-source`} value={entry.key} checked={item.source === entry.key} disabled={busy} onChange={() => patch(item.key, { source: entry.key, rights: "" })}/>
                      <span className="choice-copy"><strong>{entry.label}</strong><small>{entry.hint}</small></span>
                    </label>)}
                  </div>
                  {item.source === "cc" && <div className="field"><label htmlFor={`${id}-cc`}>Jenis lisensi CC</label><select id={`${id}-cc`} value={item.ccType} disabled={busy} onChange={(event) => patch(item.key, { ccType: event.target.value, rights: "" })}><option value="CC_BY">CC BY: boleh dipakai, wajib sebut pembuatnya</option><option value="CC_BY_SA">CC BY-SA: sebut pembuatnya, lisensi tetap sama</option><option value="CC0">CC0: tanpa syarat</option></select></div>}
                  {(item.source === "cc" || item.source === "public") && <div className="field"><label htmlFor={`${id}-source-url`}>Tautan halaman asal gambar</label><input id={`${id}-source-url`} type="url" inputMode="url" maxLength={2000} placeholder="https://" value={item.sourceUrl} disabled={busy} onChange={(event) => patch(item.key, { sourceUrl: event.target.value, rights: "" })}/></div>}
                  {item.source === "cc" && <div className="field"><label htmlFor={`${id}-license-url`}>Tautan teks lisensi</label><input id={`${id}-license-url`} type="url" inputMode="url" maxLength={2000} placeholder="https://creativecommons.org/licenses/…" value={item.licenseUrl} disabled={busy} onChange={(event) => patch(item.key, { licenseUrl: event.target.value, rights: "" })}/></div>}
                  {(item.source === "cc" || item.source === "permission") && <div className="field">
                    <label htmlFor={`${id}-attribution`}>{item.source === "permission" ? "Siapa yang memberi izin, dan bagaimana bentuknya?" : "Teks kredit yang diminta lisensi (boleh kosong)"}</label>
                    {item.source === "permission"
                      ? <textarea id={`${id}-attribution`} maxLength={1000} value={item.attributionText} disabled={busy} onChange={(event) => patch(item.key, { attributionText: event.target.value, rights: "" })}/>
                      : <input id={`${id}-attribution`} maxLength={1000} value={item.attributionText} disabled={busy} onChange={(event) => patch(item.key, { attributionText: event.target.value, rights: "" })}/>}
                    {item.source === "permission" && <span className="field-help">Contoh: Izin tertulis dari Budi Santoso lewat surel, 3 November.</span>}
                  </div>}
                  {item.source === "ai" && <div className="field"><label htmlFor={`${id}-prompt`}>Perintah yang dipakai untuk membuat gambar</label><textarea id={`${id}-prompt`} maxLength={1000} value={item.generationPrompt} disabled={busy} onChange={(event) => patch(item.key, { generationPrompt: event.target.value, rights: "" })}/><span className="field-help">Jangan masukkan data pribadi.</span></div>}
                  {item.source !== "own" && <p className="muted">Gambar dari Google atau media sosial tidak otomatis boleh dipakai. Kalau Anda belum yakin izinnya, jangan unggah.</p>}
                  {item.rights && <span className="field-error" role="alert">{item.rights}</span>}
                </div>
              </details>
            </> : <p className="muted">{item.caption ? `Keterangan: ${item.caption}` : "Tanpa keterangan."}{item.credit ? ` Foto oleh ${item.credit}.` : ""}</p>}

            <div className="actions">
              {item.status === "error" && <button type="button" className="btn btn-sm btn-primary" onClick={() => void send(item.key)}><RefreshCw size={16} aria-hidden="true"/>Coba lagi</button>}
              {dirty && !busy && <button type="button" className="btn btn-sm btn-primary" onClick={() => void send(item.key)}><Save size={16} aria-hidden="true"/>Simpan keterangan</button>}
              {index > 0 && <button type="button" className="btn btn-sm" disabled={busy} onClick={() => makeMain(item.key)}><Star size={16} aria-hidden="true"/>Jadikan gambar utama</button>}
              <button type="button" className="btn btn-sm btn-quiet" onClick={() => remove(item.key)}><Trash2 size={16} aria-hidden="true"/>Hapus</button>
            </div>
          </div>
        </li>;
      })}
    </ul>}
  </div>;
}
