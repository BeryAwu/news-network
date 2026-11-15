"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, LoaderCircle, Plus, RefreshCw, Send, X } from "lucide-react";
import BlastImages from "@/components/blast-images";
import { EmptyState } from "@/components/ui";
import type { BlastAsset, BlastMode } from "@/lib/blast-types";

type AiState = { ready: boolean; testMode: boolean };
type Step = 1 | 2 | 3 | 4 | 5;
type Method = "ai" | "own";
type MediaItem = { id: string; displayName: string; status: string; hostname: string | null; confirmed: boolean };
type Skill = { id: string; slug: string; name: string; description: string };
type Load<T> = { state: "loading" } | { state: "error" } | { state: "ok"; items: T[] };
type Errors = { images?: string; title?: string; narrative?: string; links?: string; media?: string; method?: string };
type Send =
  | { phase: "idle" }
  | { phase: "sending"; text: string }
  | { phase: "first-failed"; error: string }
  | { phase: "second-failed"; error: string }
  | { phase: "done" };

const MAX_LINKS = 10;
const OWN_MIN = 120;
const TITLE_MIN = 8;
const STEP_NAMES = ["Gambar", "Narasi", "Media", "Cara menulis", "Periksa dan kirim"] as const;
const STEP_HINTS = [
  "Pilih gambar untuk berita ini, atau lewati kalau tidak ada. Gambar pertama jadi gambar utama.",
  "Tulis judul dan ceritakan beritanya dengan kata-kata Anda.",
  "Berita yang sama dikirim ke semua media yang tercentang.",
  "Pilih siapa yang menulis beritanya.",
  "Baca ringkasannya. Belum ada yang terbit sebelum Anda memeriksa naskahnya.",
] as const;
const STYLE_CHIPS = ["Formal seperti siaran pers", "Santai dan mudah dipahami", "Singkat, tiga paragraf", "Tekankan hasil dan dampak"] as const;
const number = new Intl.NumberFormat("id-ID");

function isConfirmed(domain: { isActive?: boolean; verificationStatus?: string }) {
  return domain.isActive === true && domain.verificationStatus === "VERIFIED";
}

function toMedia(raw: unknown): MediaItem[] {
  if (!Array.isArray(raw)) return [];
  const items: MediaItem[] = [];
  for (const entry of raw as Record<string, unknown>[]) {
    if (typeof entry?.id !== "string" || typeof entry.displayName !== "string") continue;
    const status = typeof entry.status === "string" ? entry.status : "ACTIVE";
    if (status !== "ACTIVE" && status !== "DRAFT") continue;
    const domains = (Array.isArray(entry.domains) ? entry.domains : []) as { hostname?: string; isActive?: boolean; verificationStatus?: string }[];
    const confirmed = domains.find(isConfirmed);
    items.push({ id: entry.id, displayName: entry.displayName, status, hostname: (confirmed ?? domains[0])?.hostname ?? null, confirmed: Boolean(confirmed) });
  }
  return items;
}

function toSkills(raw: unknown): Skill[] {
  if (!raw || typeof raw !== "object" || !("skills" in raw) || !Array.isArray(raw.skills)) return [];
  const list: unknown[] = raw.skills;
  return (list as Record<string, unknown>[])
    .filter((entry) => typeof entry?.slug === "string" && typeof entry.name === "string")
    .map((entry) => ({ id: String(entry.id ?? entry.slug), slug: String(entry.slug), name: String(entry.name), description: typeof entry.description === "string" ? entry.description : "" }));
}

function validUrl(text: string) {
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function apiMessage(body: unknown) {
  if (!body || typeof body !== "object" || !("error" in body)) return "";
  const message = body.error;
  return typeof message === "string" && message.trim() ? message : "";
}

function briefError(status: number, message: string) {
  if (status === 403) return "Akun Anda belum boleh menulis untuk salah satu media yang dipilih. Kembali ke langkah 3 dan ganti pilihannya.";
  if (status === 429) return message || "Terlalu banyak permintaan. Tunggu sebentar, lalu coba lagi.";
  if (status === 400) return "Isian belum sesuai. Periksa judul, narasi, dan tautan sumber, lalu coba lagi.";
  return "Naskah belum bisa disimpan. Tunggu sebentar, lalu tekan tombolnya lagi. Yang Anda ketik masih ada.";
}

function blastError(mode: Method, status: number, message: string) {
  if (status === 409 && mode === "ai") return "Layanan AI belum disiapkan. Kembali ke langkah 4 dan pilih “Pakai tulisan saya apa adanya”, atau minta pemilik mengisinya di Koneksi layanan.";
  if (status === 429) return message || "Terlalu banyak permintaan. Tunggu sebentar, lalu tekan Coba lagi.";
  if (status === 404) return "Naskah tidak ditemukan. Muat ulang halaman, lalu mulai lagi.";
  if (status === 400 && message) return message;
  if (status === 403) return "Akun Anda belum boleh membuat berita untuk media ini. Minta admin memeriksa akses Anda.";
  return mode === "ai" ? "Layanan AI tidak menjawab. Tunggu sebentar, lalu tekan Coba lagi." : "Berita belum bisa dibuat. Tunggu sebentar, lalu tekan Coba lagi.";
}

export default function BriefForm({ ai, isAdmin }: { ai: AiState; isAdmin: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [images, setImages] = useState<{ featured: BlastAsset | null; gallery: BlastAsset[] }>({ featured: null, gallery: [] });
  const [pendingImages, setPendingImages] = useState(0);
  const [title, setTitle] = useState("");
  const [narrative, setNarrative] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [method, setMethod] = useState<Method>(ai.ready ? "ai" : "own");
  const [styleSlug, setStyleSlug] = useState("");
  const [styleNote, setStyleNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [mediaLoad, setMediaLoad] = useState<Load<MediaItem>>({ state: "loading" });
  const [skillLoad, setSkillLoad] = useState<Load<Skill>>({ state: "loading" });
  const [mediaTry, setMediaTry] = useState(0);
  const [skillTry, setSkillTry] = useState(0);
  const [send, setSend] = useState<Send>({ phase: "idle" });
  const seeded = useRef(false);
  const briefId = useRef("");
  const busy = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/media", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("media");
        return toMedia(await response.json());
      })
      .then((items) => {
        if (!alive) return;
        setMediaLoad({ state: "ok", items });
        if (!seeded.current) { seeded.current = true; setSelected(items.map((item) => item.id)); }
      })
      .catch(() => { if (alive) setMediaLoad({ state: "error" }); });
    return () => { alive = false; };
  }, [mediaTry]);

  useEffect(() => {
    let alive = true;
    fetch("/api/skills", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("skills");
        return toSkills(await response.json());
      })
      .then((items) => { if (alive) setSkillLoad({ state: "ok", items }); })
      .catch(() => { if (alive) setSkillLoad({ state: "error" }); });
    return () => { alive = false; };
  }, [skillTry]);

  useEffect(() => {
    if (!moved.current) { moved.current = true; return; }
    headingRef.current?.focus();
  }, [step]);

  const titleLength = title.trim().length;
  const narrativeLength = narrative.trim().length;
  const mediaItems = mediaLoad.state === "ok" ? mediaLoad.items : [];
  const chosenMedia = mediaItems.filter((item) => selected.includes(item.id));
  const skills = skillLoad.state === "ok" ? skillLoad.items : [];
  const chosenSkill = skills.find((skill) => skill.slug === styleSlug);
  const cleanLinks = links.map((link) => link.trim()).filter(Boolean);
  const pictureCount = (images.featured ? 1 : 0) + images.gallery.length;
  const mode: BlastMode = method === "ai" ? "AI" : "AS_WRITTEN";
  const sending = send.phase === "sending" || send.phase === "done";

  function check(target: Step): Errors {
    const next: Errors = {};
    if (target === 1 && pendingImages > 0) next.images = "Ada gambar yang belum tersimpan. Tunggu sampai selesai. Kalau ada yang gagal, tekan Coba lagi atau hapus gambarnya. Kalau Anda mengubah keterangan, tekan Simpan keterangan.";
    if (target === 2) {
      if (titleLength < TITLE_MIN) next.title = `Judul terlalu pendek. Tulis minimal ${TITLE_MIN} huruf, misalnya “Jalan Sudirman ditutup untuk perbaikan”.`;
      if (narrativeLength === 0) next.narrative = "Narasi masih kosong. Ceritakan beritanya dengan kata-kata Anda.";
      const bad = links.findIndex((link) => link.trim() && !validUrl(link.trim()));
      if (bad >= 0) next.links = `Tautan sumber nomor ${bad + 1} belum benar. Salin alamat lengkapnya, diawali https://.`;
    }
    if (target === 3 && selected.length === 0) next.media = mediaItems.length ? "Pilih minimal satu media untuk menerima berita ini." : "Belum ada media di akun Anda, jadi berita belum bisa dikirim.";
    if (target === 4) {
      if (method === "ai" && !ai.ready) next.method = "Layanan AI belum siap. Pilih “Pakai tulisan saya apa adanya”.";
      if (method === "own" && narrativeLength < OWN_MIN) next.method = `Narasi Anda baru ${number.format(narrativeLength)} huruf. Untuk dipakai apa adanya, perlu minimal ${OWN_MIN} huruf. Tambahkan di langkah 2, atau minta AI menulis.`;
      if (method === "own" && titleLength < TITLE_MIN) next.method = `Judul baru ${titleLength} huruf. Perlu minimal ${TITLE_MIN} huruf. Perbaiki di langkah 2.`;
    }
    return next;
  }

  function go(target: Step) {
    setStep(target);
    setSend((current) => (current.phase === "first-failed" || current.phase === "second-failed" ? current : { phase: "idle" }));
  }

  function next() {
    const found = check(step);
    setErrors(found);
    if (Object.keys(found).length) return;
    go(Math.min(5, step + 1) as Step);
  }

  function skipImages() {
    setErrors({});
    go(2);
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
    setErrors((current) => ({ ...current, media: undefined }));
  }

  async function submit() {
    if (busy.current) return;
    for (const target of [1, 2, 3, 4] as const) {
      const found = check(target);
      if (Object.keys(found).length) { setErrors(found); go(target); return; }
    }
    busy.current = true;
    try {
      if (!briefId.current) {
        setSend({ phase: "sending", text: "Menyimpan naskah Anda…" });
        let response: Response;
        try {
          response = await fetch("/api/briefs", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ workingTitle: title.trim(), narrative: narrative.trim(), editorNotes: "", references: cleanLinks, mediaSiteIds: chosenMedia.map((item) => item.id) }),
          });
        } catch {
          setSend({ phase: "first-failed", error: "Sambungan internet terputus, naskah belum tersimpan. Cek sambungan Anda, lalu tekan tombolnya lagi. Yang Anda ketik masih ada." });
          return;
        }
        const body = await response.json().catch(() => null);
        if (!response.ok || typeof body?.id !== "string") {
          setSend({ phase: "first-failed", error: briefError(response.status, apiMessage(body)) });
          return;
        }
        briefId.current = body.id;
      }
      setSend({ phase: "sending", text: method === "ai" ? "Mengirim ke AI…" : "Membuat berita…" });
      let response: Response;
      try {
        response = await fetch("/api/blasts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceBriefId: briefId.current,
            mode,
            ...(method === "ai" && styleSlug ? { styleSkillSlug: styleSlug } : {}),
            ...(method === "ai" && styleNote.trim() ? { styleNote: styleNote.trim() } : {}),
            ...(images.featured ? { featuredAssetId: images.featured.id } : {}),
            ...(images.gallery.length ? { galleryAssetIds: images.gallery.map((asset) => asset.id) } : {}),
          }),
        });
      } catch {
        setSend({ phase: "second-failed", error: "Naskah Anda sudah tersimpan, tetapi sambungan internet terputus sebelum berita dibuat. Cek sambungan, lalu tekan Coba lagi." });
        return;
      }
      const body = await response.json().catch(() => null);
      if (!response.ok || typeof body?.id !== "string") {
        setSend({ phase: "second-failed", error: `Naskah Anda sudah tersimpan, tetapi berita belum dibuat. ${blastError(method, response.status, apiMessage(body))}` });
        return;
      }
      setSend({ phase: "done" });
      router.push(`/blasts/${body.id}`);
    } finally {
      busy.current = false;
    }
  }

  const ownShort = narrativeLength < OWN_MIN || titleLength < TITLE_MIN;
  const sendLabel = method === "ai" ? "Buat berita dengan AI" : "Simpan berita";

  return <div className="stack bf-wizard">
    <div className="bf-wizard-head">
      <p className="bf-step-count" aria-live="polite">Langkah {step} dari 5</p>
      <div className="bf-progress" role="progressbar" aria-label="Kemajuan langkah" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step} style={{ "--bf-progress": `${step * 20}%` } as React.CSSProperties}><span/></div>
      <h2 className="bf-step-title" tabIndex={-1} ref={headingRef}>{STEP_NAMES[step - 1]}</h2>
      <p className="muted">{STEP_HINTS[step - 1]}</p>
    </div>

    <section className="card stack" hidden={step !== 1} aria-label="Gambar">
      <BlastImages value={images} onChange={(value) => { setImages(value); setErrors((current) => ({ ...current, images: undefined })); }} onPendingChange={(count) => { setPendingImages(count); if (count === 0) setErrors((current) => ({ ...current, images: undefined })); }}/>
      {errors.images && <div className="notice notice-error" role="alert"><CircleAlert size={20} aria-hidden="true"/><span>{errors.images}</span></div>}
    </section>

    <section className="card stack" hidden={step !== 2} aria-label="Narasi">
      <div className="field">
        <label htmlFor="bf-title">Judul berita</label>
        <input id="bf-title" name="workingTitle" maxLength={180} value={title} onChange={(event) => { setTitle(event.target.value); setErrors((current) => ({ ...current, title: undefined })); }} aria-invalid={Boolean(errors.title)} aria-describedby="bf-title-help bf-title-error" autoComplete="off"/>
        <span id="bf-title-help" className="field-help">Satu kalimat yang menjelaskan beritanya. Contoh: Jalan Sudirman ditutup untuk perbaikan.</span>
        <span id="bf-title-error" className="field-error" role={errors.title ? "alert" : undefined}>{errors.title}</span>
      </div>
      <div className="field">
        <label htmlFor="bf-narrative">Narasi</label>
        <textarea id="bf-narrative" name="narrative" className="bf-narrative" maxLength={20000} value={narrative} onChange={(event) => { setNarrative(event.target.value); setErrors((current) => ({ ...current, narrative: undefined })); }} aria-invalid={Boolean(errors.narrative)} aria-describedby="bf-narrative-help bf-narrative-error"/>
        <span id="bf-narrative-help" className="field-help">Tulis seperti bercerita ke rekan, tidak perlu rapi. Siapa, apa, kapan, di mana, dan kenapa. <span className="num">{number.format(narrativeLength)} huruf</span></span>
        <span id="bf-narrative-error" className="field-error" role={errors.narrative ? "alert" : undefined}>{errors.narrative}</span>
      </div>
      <details className="bf-disclosure">
        <summary>Tambah tautan sumber</summary>
        <div className="bf-disclosure-body stack-sm">
          <p className="field-help">Alamat halaman yang menjadi sumber cerita Anda. Boleh dikosongkan.</p>
          {links.map((link, index) => <div className="bf-link-row" key={index}>
            <input className="input" type="url" inputMode="url" placeholder="https://" aria-label={`Tautan sumber ${index + 1}`} maxLength={2000} value={link} onChange={(event) => { setLinks((current) => current.map((entry, at) => (at === index ? event.target.value : entry))); setErrors((current) => ({ ...current, links: undefined })); }}/>
            <button type="button" className="btn btn-quiet bf-icon-btn" aria-label={`Hapus tautan sumber ${index + 1}`} onClick={() => setLinks((current) => current.filter((_, at) => at !== index))}><X size={18} aria-hidden="true"/></button>
          </div>)}
          <div><button type="button" className="btn btn-sm" disabled={links.length >= MAX_LINKS} onClick={() => setLinks((current) => [...current, ""])}><Plus size={16} aria-hidden="true"/>Tambah tautan</button></div>
          {errors.links && <span className="field-error" role="alert">{errors.links}</span>}
        </div>
      </details>
    </section>

    <section className="card stack" hidden={step !== 3} aria-label="Media">
      {mediaLoad.state === "loading" && <div role="status" aria-label="Memuat daftar media" className="stack-sm"><div className="skeleton bf-skeleton-choice"/><div className="skeleton bf-skeleton-choice"/></div>}
      {mediaLoad.state === "error" && <div className="notice notice-error" role="alert">
        <CircleAlert size={20} aria-hidden="true"/>
        <div className="stack-sm"><span>Daftar media belum bisa dimuat. Cek sambungan internet Anda, lalu coba lagi. Yang sudah Anda ketik tetap aman.</span><div><button type="button" className="btn btn-sm" onClick={() => { setMediaLoad({ state: "loading" }); setMediaTry((value) => value + 1); }}><RefreshCw size={16} aria-hidden="true"/>Muat ulang daftar media</button></div></div>
      </div>}
      {mediaLoad.state === "ok" && mediaItems.length === 0 && <EmptyState
        title="Belum ada media di akun Anda"
        detail={isAdmin ? "Hubungkan media ke akun Anda di halaman Media, lalu kembali ke sini." : "Minta admin atau pemilik menghubungkan media ke akun Anda. Setelah itu Anda bisa menulis berita di sini."}
        href={isAdmin ? "/media" : undefined}
        label={isAdmin ? "Buka halaman Media" : undefined}
      />}
      {mediaLoad.state === "ok" && mediaItems.length > 0 && <fieldset className="bf-fieldset">
        <div className="bf-choice-head">
          <legend className="bf-count-line"><strong>{chosenMedia.length} dari {mediaItems.length} media dipilih</strong></legend>
          <div className="actions">
            <button type="button" className="btn btn-sm" onClick={() => { setSelected(mediaItems.map((item) => item.id)); setErrors((current) => ({ ...current, media: undefined })); }}>Pilih semua</button>
            <button type="button" className="btn btn-sm" onClick={() => setSelected([])}>Kosongkan</button>
          </div>
        </div>
        <div className="choice-list">
          {mediaItems.map((item) => <label className="choice bf-choice" key={item.id}>
            <input type="checkbox" name="mediaSiteIds" value={item.id} checked={selected.includes(item.id)} onChange={() => toggle(item.id)}/>
            <span className="choice-copy">
              <strong>{item.displayName}</strong>
              <small>{item.hostname ?? "Alamat situs belum diisi"}</small>
              {!item.confirmed && <small className="bf-warn">Belum bisa terbit di sini: alamat situs belum dikonfirmasi</small>}
            </span>
          </label>)}
        </div>
      </fieldset>}
      {errors.media && <div className="notice notice-error" role="alert"><CircleAlert size={20} aria-hidden="true"/><span>{errors.media}</span></div>}
    </section>

    <section className="card stack" hidden={step !== 4} aria-label="Cara menulis">
      <p>AI menulis satu berita saja, dan berita itu dikirim ke semua media yang Anda pilih.</p>
      <div className="choice-list" role="radiogroup" aria-label="Cara menulis">
        <label className="choice bf-method" aria-disabled={!ai.ready}>
          <input type="radio" name="method" value="ai" checked={method === "ai"} disabled={!ai.ready} onChange={() => { setMethod("ai"); setErrors((current) => ({ ...current, method: undefined })); }}/>
          <span className="choice-copy">
            <strong>Minta AI menulis {ai.ready && <span className="badge badge-green">Disarankan</span>}</strong>
            <small>AI menyusun berita dari narasi Anda. Anda memeriksa dan boleh mengubahnya sebelum terbit.</small>
            {!ai.ready && <small className="bf-warn">{ai.testMode ? "Layanan AI di server ini masih mode uji. Pakai tulisan Anda sendiri dulu." : "Layanan AI belum disiapkan. Minta pemilik mengisinya di Koneksi layanan. Anda tetap bisa memakai tulisan sendiri."}</small>}
          </span>
        </label>
        <label className="choice bf-method">
          <input type="radio" name="method" value="own" checked={method === "own"} onChange={() => { setMethod("own"); setErrors((current) => ({ ...current, method: undefined })); }}/>
          <span className="choice-copy">
            <strong>Pakai tulisan saya apa adanya</strong>
            <small>Narasi Anda dipakai sebagai isi berita tanpa diubah AI.</small>
          </span>
        </label>
      </div>

      {method === "own" && <div className="bf-method-extra stack-sm">
        <p className={narrativeLength >= OWN_MIN ? "bf-count" : "bf-count bf-count-short"} aria-live="polite">Narasi: {number.format(narrativeLength)} dari minimal {OWN_MIN} huruf{narrativeLength >= OWN_MIN ? ". Cukup." : "."}</p>
        <p className={titleLength >= TITLE_MIN ? "bf-count" : "bf-count bf-count-short"} aria-live="polite">Judul: {number.format(titleLength)} dari minimal {TITLE_MIN} huruf{titleLength >= TITLE_MIN ? ". Cukup." : "."}</p>
        {ownShort && <div><button type="button" className="btn btn-sm" onClick={() => go(2)}><ArrowLeft size={16} aria-hidden="true"/>Tambah tulisan</button></div>}
      </div>}

      {method === "ai" && ai.ready && <div className="bf-method-extra stack">
        <fieldset className="bf-fieldset">
          <legend><strong>Gaya penulisan</strong></legend>
          {skillLoad.state === "loading" && <div role="status" aria-label="Memuat gaya penulisan" className="skeleton bf-skeleton-choice"/>}
          {skillLoad.state === "error" && <div className="notice notice-warn" role="alert"><CircleAlert size={20} aria-hidden="true"/><div className="stack-sm"><span>Daftar gaya belum bisa dimuat. Anda tetap bisa lanjut tanpa gaya khusus.</span><div><button type="button" className="btn btn-sm" onClick={() => { setSkillLoad({ state: "loading" }); setSkillTry((value) => value + 1); }}><RefreshCw size={16} aria-hidden="true"/>Coba lagi</button></div></div></div>}
          <div className="choice-list" role="radiogroup" aria-label="Gaya penulisan">
            <label className="choice bf-choice"><input type="radio" name="style" value="" checked={styleSlug === ""} onChange={() => setStyleSlug("")}/><span className="choice-copy"><strong>Tanpa gaya khusus</strong><small>AI memakai gaya biasa tiap media.</small></span></label>
            {skills.map((skill) => <label className="choice bf-choice" key={skill.id}><input type="radio" name="style" value={skill.slug} checked={styleSlug === skill.slug} onChange={() => setStyleSlug(skill.slug)}/><span className="choice-copy"><strong>{skill.name}</strong>{skill.description && <small>{skill.description}</small>}</span></label>)}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="bf-style-note">Catatan gaya untuk berita ini (boleh kosong)</label>
          <textarea id="bf-style-note" className="bf-style-note" maxLength={500} value={styleNote} onChange={(event) => setStyleNote(event.target.value)} aria-describedby="bf-style-help"/>
          <span id="bf-style-help" className="field-help">Ketuk salah satu contoh di bawah, atau tulis sendiri. {styleNote.length} dari 500 huruf.</span>
        </div>
        <div className="bf-chips">
          {STYLE_CHIPS.map((chip) => <button type="button" key={chip} className="bf-chip" aria-pressed={styleNote === chip} onClick={() => setStyleNote(chip)}>{chip}</button>)}
        </div>
      </div>}
      {errors.method && <div className="notice notice-error" role="alert"><CircleAlert size={20} aria-hidden="true"/><span>{errors.method}</span></div>}
    </section>

    {step === 5 && <section className="card stack" aria-label="Ringkasan">
      <dl className="bf-summary">
        <div><dt>Gambar</dt><dd>{pictureCount === 0 ? "Tanpa gambar." : <ul className="bf-thumbs">
          {[images.featured, ...images.gallery].filter((asset): asset is BlastAsset => Boolean(asset)).map((asset, index) => <li key={asset.id}><span className="bf-thumb"><Image src={asset.secureUrl} alt={asset.altText || `Gambar ${index + 1}`} fill unoptimized sizes="96px"/></span><small>{index === 0 ? "Gambar utama" : "Tambahan"}</small></li>)}
        </ul>}</dd></div>
        <div><dt>Judul</dt><dd><strong>{title.trim()}</strong></dd></div>
        <div><dt>Narasi</dt><dd className="bf-clamp">{narrative.trim()}</dd></div>
        {cleanLinks.length > 0 && <div><dt>Tautan sumber</dt><dd>{cleanLinks.length} tautan</dd></div>}
        <div><dt>Media ({chosenMedia.length})</dt><dd><ul className="bf-plain-list">{chosenMedia.map((item) => <li key={item.id}>{item.displayName}{!item.confirmed && <small className="bf-warn"> Belum bisa terbit di sini: alamat situs belum dikonfirmasi</small>}</li>)}</ul></dd></div>
        <div><dt>Cara menulis</dt><dd>{method === "ai" ? "AI menulis satu berita untuk semua media" : "Tulisan Anda dipakai apa adanya"}</dd></div>
        {method === "ai" && <div><dt>Gaya penulisan</dt><dd>{chosenSkill ? chosenSkill.name : "Tanpa gaya khusus"}</dd></div>}
        {method === "ai" && styleNote.trim() && <div><dt>Catatan gaya</dt><dd>{styleNote.trim()}</dd></div>}
      </dl>
      <hr className="divider"/>
      {send.phase === "sending" && <div className="notice" role="status"><LoaderCircle size={20} className="bf-spin" aria-hidden="true"/><span>{send.text}</span></div>}
      {send.phase === "done" && <div className="notice notice-success" role="status"><CircleCheck size={20} aria-hidden="true"/><span>Berita dibuat. Membuka halaman berita…</span></div>}
      {send.phase === "first-failed" && <div className="notice notice-error" role="alert"><CircleAlert size={20} aria-hidden="true"/><span>{send.error}</span></div>}
      {send.phase === "second-failed" && <div className="notice notice-error" role="alert"><CircleAlert size={20} aria-hidden="true"/><div className="stack-sm"><span>{send.error}</span><span>Tidak perlu menulis ulang. Tombol Coba lagi hanya mengulang langkah terakhir. Naskah yang tersimpan ada di <Link href="/blasts">Daftar berita</Link>.</span></div></div>}
      <div className="actions">
        <button type="button" className="btn btn-primary bf-send" disabled={sending} onClick={() => void submit()}>
          {send.phase === "sending" ? <LoaderCircle size={18} className="bf-spin" aria-hidden="true"/> : send.phase === "second-failed" ? <RefreshCw size={18} aria-hidden="true"/> : <Send size={18} aria-hidden="true"/>}
          {send.phase === "sending" ? "Sedang mengirim…" : send.phase === "second-failed" ? "Coba lagi" : sendLabel}
        </button>
      </div>
      {send.phase === "first-failed" && <p className="muted">Yang Anda ketik dan gambar yang sudah diunggah masih ada.</p>}
    </section>}

    <div className="bf-nav">
      {step > 1 ? <button type="button" className="btn" disabled={sending} onClick={() => { setErrors({}); go((step - 1) as Step); }}><ArrowLeft size={18} aria-hidden="true"/>Kembali</button> : <span/>}
      <div className="actions">
        {step === 1 && !images.featured && pendingImages === 0 && <button type="button" className="btn btn-quiet" onClick={skipImages}>Lewati, tanpa gambar</button>}
        {step < 5 && <button type="button" className="btn btn-primary" onClick={next}>Lanjut<ArrowRight size={18} aria-hidden="true"/></button>}
      </div>
    </div>
  </div>;
}
