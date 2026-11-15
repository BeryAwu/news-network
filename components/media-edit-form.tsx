"use client";
import { DEFAULT_THEME_SLUG, SITE_THEMES } from "@/lib/site-themes";

import "@/app/css/media.css";
import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { asFailure, failure, readBody } from "@/components/plain-errors";

type Site = {
  id: string; name: string; displayName: string; slug: string; status: string;
  publisherDisclosure: string; ownershipDisclosure: string; newsroomByline: string; themeConfig?: unknown;
  profile: { niche: string; targetAudience: string; editorialMission: string; toneGuidelines: string; styleGuidelines: string; language: string } | null;
};

/** The public site falls back to this green when a media has no colour of its own (lib/site.ts). */
const DEFAULT_BRAND = "#176b4a";
const LOGO_PREFIX = "https://res.cloudinary.com/";
const HEX = /^#[0-9a-fA-F]{6}$/;

const apiFields: Record<string, string> = {
  name: "Nama untuk daftar internal terlalu pendek. Tulis minimal 2 huruf.",
  displayName: "Nama merek terlalu pendek. Tulis minimal 2 huruf.",
  newsroomByline: "Nama redaksi terlalu pendek. Tulis minimal 2 huruf.",
  slug: "Kode media terlalu pendek. Tulis minimal 2 karakter, huruf kecil dan tanda hubung.",
  themePrimary: "Kode warna belum benar. Pilih warna dengan kotak warna, atau tulis 7 karakter seperti #176B4A.",
  themeTagline: "Tagline maksimal 160 karakter. Persingkat tulisannya.",
  themeLogoUrl: `Alamat logo harus dimulai dengan ${LOGO_PREFIX} (gambar dari Cloudinary).`,
  niche: "Fokus liputan maksimal 500 karakter. Persingkat tulisannya.",
  targetAudience: "Pembaca utama maksimal 500 karakter. Persingkat tulisannya.",
  editorialMission: "Misi redaksi maksimal 1.000 karakter. Persingkat tulisannya.",
  toneGuidelines: "Gaya bahasa maksimal 1.000 karakter. Persingkat tulisannya.",
  styleGuidelines: "Panduan penulisan maksimal 1.000 karakter. Persingkat tulisannya.",
  publisherDisclosure: "Keterangan penerbit maksimal 1.500 karakter. Persingkat tulisannya.",
  ownershipDisclosure: "Keterangan kepemilikan maksimal 1.500 karakter. Persingkat tulisannya.",
};
const advancedKeys: Record<string, true> = Object.fromEntries(["slug", "editorialMission", "toneGuidelines", "styleGuidelines", "language", "publisherDisclosure", "ownershipDisclosure", "status"].map((key) => [key, true]));
const statusOptions = [["DRAFT", "Draf: belum tayang"], ["ACTIVE", "Aktif: tayang"], ["PAUSED", "Dijeda: berhenti sementara"], ["DISABLED", "Nonaktif: ditutup"]] as const;

/** Contrast of a hex colour against white, used to warn about colours too light for light button text. */
function contrastAgainstWhite(hex: string) {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05);
}

export default function MediaEditForm({ site }: { site: Site }) {
  const router = useRouter();
  const advancedRef = useRef<HTMLDetailsElement>(null);
  const theme = (typeof site.themeConfig === "object" && site.themeConfig !== null ? site.themeConfig : {}) as { primary?: string; tagline?: string; logoUrl?: string | null; template?: string };
  const profile = site.profile;
  const [displayName, setDisplayName] = useState(site.displayName);
  const [template, setTemplate] = useState(theme.template || DEFAULT_THEME_SLUG);
  const [primary, setPrimary] = useState(theme.primary || "");
  const [tagline, setTagline] = useState(theme.tagline || "");
  const [logoUrl, setLogoUrl] = useState(theme.logoUrl || "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const id = (key: string) => `${site.id}-${key}`;
  const brand = HEX.test(primary) ? primary : DEFAULT_BRAND;
  const tooLight = contrastAgainstWhite(brand) < 3;
  const logoValid = logoUrl.startsWith(LOGO_PREFIX) && URL.canParse(logoUrl);

  function show(key: string, text: string) {
    if (advancedKeys[key] && advancedRef.current) advancedRef.current.open = true;
    setErrors({ [key]: text });
    requestAnimationFrame(() => document.getElementById(id(key))?.focus());
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setMessage("");
    setErrors({});
    const text = (key: string) => String(data.get(key) || "").trim();
    const checks: [string, boolean][] = [
      ["name", text("name").length < 2], ["displayName", text("displayName").length < 2], ["newsroomByline", text("newsroomByline").length < 2], ["slug", text("slug").length < 2],
      ["themePrimary", Boolean(text("themePrimary")) && !HEX.test(text("themePrimary"))],
      ["themeLogoUrl", Boolean(text("themeLogoUrl")) && !(text("themeLogoUrl").startsWith(LOGO_PREFIX) && URL.canParse(text("themeLogoUrl")))],
    ];
    const bad = checks.find(([, invalid]) => invalid);
    if (bad) {
      show(bad[0], apiFields[bad[0]]);
      return;
    }
    const body: Record<string, string> = {};
    for (const [key, value] of data.entries()) body[key] = String(value).trim();
    setBusy(true);
    try {
      const response = await fetch("/api/media", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaSiteId: site.id, ...body }) });
      const result = await readBody(response);
      if (!response.ok) throw failure(response.status, result, apiFields, "Perubahan belum tersimpan. Periksa isian, lalu coba lagi.");
      setMessage("Perubahan tersimpan.");
      router.refresh();
    } catch (e) {
      const problem = asFailure(e, "Perubahan belum tersimpan. Periksa isian, lalu coba lagi.");
      if (problem.field && apiFields[problem.field]) show(problem.field, problem.message);
      else setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  const help = (key: string, text: string) => <p id={id(`${key}-note`)} className={errors[key] ? "field-error" : "field-help"}>{errors[key] || text}</p>;
  const props = (key: string) => ({ id: id(key), name: key, "aria-invalid": Boolean(errors[key]), "aria-describedby": id(`${key}-note`) });

  const textField = (key: string, label: string, note: string, value: string, max: number, required = false) => <div className="field">
    <label htmlFor={id(key)}>{label}{required && <span className="muted"> (wajib)</span>}</label>
    <input {...props(key)} defaultValue={value} maxLength={max} autoComplete="off" aria-required={required}/>
    {help(key, note)}
  </div>;
  const areaField = (key: string, label: string, note: string, value: string, max: number) => <div className="field">
    <label htmlFor={id(key)}>{label}</label>
    <textarea {...props(key)} defaultValue={value} maxLength={max}/>
    {help(key, note)}
  </div>;

  const knownLanguage = !profile?.language || ["Indonesian", "English"].includes(profile.language);

  return <form onSubmit={save} noValidate className="stack" aria-label={`Profil dan tampilan ${site.displayName}`}>
    <section className="form-section">
      <div className="form-intro"><h3>Profil dasar</h3><p>Nama dan arah liputan. AI memakai fokus liputan dan pembaca utama setiap kali membuat draf.</p></div>
      <div className="grid grid-2">
        <div className="field">
          <label htmlFor={id("displayName")}>Nama merek <span className="muted">(wajib)</span></label>
          <input {...props("displayName")} value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} autoComplete="off" aria-required="true"/>
          {help("displayName", "Nama yang dilihat pembaca di situs.")}
        </div>
        {textField("name", "Nama untuk daftar internal", "Nama pendek untuk tim Anda. Pembaca tidak melihatnya.", site.name, 120, true)}
        {textField("newsroomByline", "Nama redaksi di artikel", "Tampil sebagai penulis di setiap artikel.", site.newsroomByline, 120, true)}
        {textField("niche", "Fokus liputan", "Topik utama media, misalnya ekonomi daerah.", profile?.niche || "", 500)}
        {textField("targetAudience", "Pembaca utama", "Siapa yang membaca, misalnya pelaku UMKM di Jawa Timur.", profile?.targetAudience || "", 500)}
      </div>
    </section>

    <hr className="divider"/>

    <section className="form-section">
      <div className="form-intro"><h3>Tampilan situs</h3><p>Warna dan tagline muncul di situs publik. Pratinjau berubah saat Anda mengetik.</p></div>
      <div className="theme-layout">
        <div className="stack">
          <fieldset className="field">
            <legend className="field-label">Desain situs</legend>
            <div className="choice-list">
              {SITE_THEMES.map((item) => (
                <label className="choice" key={item.slug}>
                  <input type="radio" name="themeTemplate" value={item.slug} checked={template === item.slug} onChange={() => setTemplate(item.slug)}/>
                  <span className="choice-copy"><strong>{item.name}</strong><small>{item.description}</small></span>
                </label>
              ))}
            </div>
            <span className="field-help">Tiap media bisa punya desain berbeda. Berita yang sudah terbit ikut tampil dengan desain baru.</span>
          </fieldset>
          <div className="field">
            <label htmlFor={id("themePrimary")}>Warna utama</label>
            <div className="color-row">
              <input type="color" className="color-swatch" value={brand} onChange={(event) => setPrimary(event.target.value)} aria-label="Pilih warna utama dengan kotak warna"/>
              <input {...props("themePrimary")} value={primary} onChange={(event) => setPrimary(event.target.value.trim())} maxLength={7} placeholder={DEFAULT_BRAND} spellCheck={false} autoComplete="off" inputMode="text" className="color-hex"/>
              <button type="button" className="btn btn-quiet" onClick={() => setPrimary("")} disabled={!primary}>Pakai warna bawaan</button>
            </div>
            {help("themePrimary", "Dipakai untuk tombol dan tautan di situs. Kosong berarti warna bawaan dari desain yang dipilih.")}
            {tooLight && <p className="field-error">Warna ini terang. Tulisan putih di tombol akan sulit dibaca, jadi pilih yang lebih gelap.</p>}
          </div>
          <div className="field">
            <label htmlFor={id("themeTagline")}>Tagline</label>
            <input {...props("themeTagline")} value={tagline} onChange={(event) => setTagline(event.target.value)} maxLength={160} autoComplete="off"/>
            {help("themeTagline", "Satu kalimat di bawah nama media, maksimal 160 karakter.")}
          </div>
          <div className="field">
            <label htmlFor={id("themeLogoUrl")}>Alamat gambar logo</label>
            <input {...props("themeLogoUrl")} value={logoUrl} onChange={(event) => setLogoUrl(event.target.value.trim())} maxLength={500} inputMode="url" placeholder={`${LOGO_PREFIX}…`} autoComplete="off"/>
            {help("themeLogoUrl", `Opsional. Harus gambar dari Cloudinary dan dimulai dengan ${LOGO_PREFIX}. Kosong berarti situs menampilkan nama merek.`)}
          </div>
        </div>
        <div className="theme-preview" style={{ "--preview-brand": brand } as React.CSSProperties} role="img" aria-label={`Pratinjau: ${displayName || "nama media"}, tagline ${tagline || "kosong"}, warna utama ${brand}`}>
          <div className="theme-preview-masthead">
            {logoValid
              ? <Image src={logoUrl} alt="" width={180} height={48} unoptimized className="theme-preview-logo"/>
              : <strong className="theme-preview-name">{displayName || "Nama media"}</strong>}
            <span className="theme-preview-tagline">{tagline || "Tagline tampil di sini"}</span>
          </div>
          <div className="theme-preview-body">
            <span className="theme-preview-link">Judul berita contoh</span>
            <span className="theme-preview-button">Cari</span>
          </div>
        </div>
      </div>
    </section>

    <hr className="divider"/>

    <details className="advanced" ref={advancedRef}>
      <summary>Pengaturan lanjutan <span className="muted">(boleh dilewati)</span></summary>
      <div className="stack advanced-body">
        <div className="grid grid-2">
          {areaField("editorialMission", "Misi redaksi", "Satu atau dua kalimat tentang tujuan media. Jadi pegangan AI saat menulis.", profile?.editorialMission || "", 1000)}
          {areaField("toneGuidelines", "Gaya bahasa", "Nada tulisan, misalnya lugas dan tanpa istilah teknis.", profile?.toneGuidelines || "", 1000)}
          {areaField("styleGuidelines", "Panduan penulisan", "Aturan khusus, misalnya judul maksimal 12 kata.", profile?.styleGuidelines || "", 1000)}
          <div className="field">
            <label htmlFor={id("language")}>Bahasa artikel</label>
            <select {...props("language")} defaultValue={profile?.language || "Indonesian"}>
              <option value="Indonesian">Bahasa Indonesia</option>
              <option value="English">Bahasa Inggris</option>
              {!knownLanguage && <option value={profile?.language}>{profile?.language}</option>}
            </select>
            {help("language", "Bahasa yang dipakai AI untuk draf artikel.")}
          </div>
          {areaField("publisherDisclosure", "Keterangan penerbit", "Tampil di bagian bawah situs publik. Tulis nama badan penerbit.", site.publisherDisclosure, 1500)}
          {areaField("ownershipDisclosure", "Keterangan kepemilikan", "Tampil di bagian bawah situs publik. Tulis siapa pemilik media.", site.ownershipDisclosure, 1500)}
          {textField("slug", "Kode media", "Dipakai di alamat internal media. Jangan diubah kalau sudah ada naskah terbit.", site.slug, 80)}
          <div className="field">
            <label htmlFor={id("status")}>Status media</label>
            <select {...props("status")} defaultValue={site.status}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            {help("status", "Menjadi Aktif otomatis saat alamat situs dikonfirmasi. Ubah di sini hanya untuk menjeda atau menutup media.")}
          </div>
        </div>
      </div>
    </details>

    {error && <div role="alert" className="notice notice-error">{error}</div>}
    {message && <div role="status" className="notice notice-success">{message}</div>}
    <div className="actions"><button type="submit" disabled={busy} className="btn btn-primary">{busy ? "Menyimpan…" : "Simpan perubahan"}</button></div>
  </form>;
}
