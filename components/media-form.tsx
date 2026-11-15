"use client";

import "@/app/css/media.css";
import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { asFailure, failure, readBody } from "@/components/plain-errors";

type Errors = Partial<Record<"name" | "displayName" | "newsroomByline" | "hostname", string>>;

const apiFields = {
  name: "Nama untuk daftar internal terlalu pendek. Tulis minimal 2 huruf.",
  displayName: "Nama merek terlalu pendek. Tulis minimal 2 huruf.",
  newsroomByline: "Nama redaksi terlalu pendek. Tulis minimal 2 huruf.",
  hostname: "Alamat situs belum benar. Tulis alamatnya saja, misalnya berita.example.id.",
  niche: "Fokus liputan maksimal 500 karakter. Persingkat tulisannya.",
  targetAudience: "Pembaca utama maksimal 500 karakter. Persingkat tulisannya.",
  editorialMission: "Misi redaksi maksimal 1.000 karakter. Persingkat tulisannya.",
  toneGuidelines: "Gaya bahasa maksimal 1.000 karakter. Persingkat tulisannya.",
  styleGuidelines: "Panduan penulisan maksimal 1.000 karakter. Persingkat tulisannya.",
  publisherDisclosure: "Keterangan penerbit maksimal 1.500 karakter. Persingkat tulisannya.",
  ownershipDisclosure: "Keterangan kepemilikan maksimal 1.500 karakter. Persingkat tulisannya.",
};

/** Accepts what people paste ("https://Berita.example.id/") and returns the bare host, or null when it cannot be an address. */
function cleanHostname(raw: string) {
  const host = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(host) && host.length <= 253 ? host : null;
}

export default function MediaForm() {
  const router = useRouter();
  const uid = useId();
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id: string | null; displayName: string; hasAddress: boolean } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setCreated(null);
    const text = (key: string) => String(data.get(key) || "").trim();
    const hostnameRaw = text("hostname");
    const hostname = hostnameRaw ? cleanHostname(hostnameRaw) : "";
    const errors: Errors = {};
    if (text("name").length < 2) errors.name = apiFields.name;
    if (text("displayName").length < 2) errors.displayName = apiFields.displayName;
    if (text("newsroomByline").length < 2) errors.newsroomByline = apiFields.newsroomByline;
    if (hostname === null) errors.hostname = "Tulis alamat situsnya saja, tanpa garis miring atau spasi. Contoh: berita.example.id.";
    setFieldErrors(errors);
    const first = (["name", "displayName", "newsroomByline", "hostname"] as const).find((key) => errors[key]);
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    const body: Record<string, string> = {};
    for (const [key, value] of data.entries()) body[key] = String(value).trim();
    body.hostname = hostname ?? "";
    setBusy(true);
    try {
      const response = await fetch("/api/media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await readBody(response);
      if (!response.ok) throw failure(response.status, result, apiFields, "Media belum tersimpan. Periksa isian di atas, lalu coba lagi.");
      setCreated({ id: typeof result.id === "string" ? result.id : null, displayName: String(result.displayName ?? body.displayName), hasAddress: Boolean(body.hostname) });
      form.reset();
      router.refresh();
    } catch (e) {
      const problem = asFailure(e, "Media belum tersimpan. Periksa isian di atas, lalu coba lagi.");
      if (problem.field && problem.field in apiFields && ["name", "displayName", "newsroomByline", "hostname"].includes(problem.field)) {
        setFieldErrors({ [problem.field]: problem.message });
        document.getElementById(`${uid}-${problem.field}`)?.focus();
      } else {
        setError(problem.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof Errors, label: string, help: string, props: { maxLength: number; placeholder?: string; required?: boolean; inputMode?: "url" }) => <div className="field">
    <label htmlFor={`${uid}-${key}`}>{label}{props.required && <span className="muted"> (wajib)</span>}</label>
    <input id={`${uid}-${key}`} name={key} maxLength={props.maxLength} placeholder={props.placeholder} inputMode={props.inputMode} autoComplete="off" autoCapitalize="off" aria-required={props.required} aria-invalid={Boolean(fieldErrors[key])} aria-describedby={`${uid}-${key}-note`}/>
    <p id={`${uid}-${key}-note`} className={fieldErrors[key] ? "field-error" : "field-help"}>{fieldErrors[key] || help}</p>
  </div>;

  const advanced = (key: string, label: string, help: string, multiline: boolean, maxLength: number, placeholder: string) => <div className="field">
    <label htmlFor={`${uid}-${key}`}>{label}</label>
    {multiline
      ? <textarea id={`${uid}-${key}`} name={key} maxLength={maxLength} placeholder={placeholder} aria-describedby={`${uid}-${key}-note`}/>
      : <input id={`${uid}-${key}`} name={key} maxLength={maxLength} placeholder={placeholder} autoComplete="off" aria-describedby={`${uid}-${key}-note`}/>}
    <p id={`${uid}-${key}-note`} className="field-help">{help}</p>
  </div>;

  return <form onSubmit={submit} noValidate className="card stack" aria-labelledby={`${uid}-title`}>
    <div className="form-intro">
      <h2 id={`${uid}-title`}>Tambah media baru</h2>
      <p>Isi empat hal ini dulu. Sisanya bisa dilengkapi kapan saja.</p>
    </div>
    <div className="grid grid-2">
      {field("name", "Nama untuk daftar internal", "Nama pendek untuk tim Anda, misalnya Berita Kota. Pembaca tidak melihatnya.", { maxLength: 120, required: true, placeholder: "Berita Kota" })}
      {field("displayName", "Nama merek", "Nama yang dilihat pembaca di situs, misalnya Kabar Kota.", { maxLength: 120, required: true, placeholder: "Kabar Kota" })}
      {field("newsroomByline", "Nama redaksi di artikel", "Tampil sebagai penulis di setiap artikel, misalnya Redaksi Kabar Kota.", { maxLength: 120, required: true, placeholder: "Redaksi Kabar Kota" })}
      {field("hostname", "Alamat situs (domain)", "Alamat yang dibuka pembaca, tanpa https://. Boleh dikosongkan dan diisi nanti.", { maxLength: 253, placeholder: "berita.example.id", inputMode: "url" })}
    </div>

    <details className="advanced">
      <summary>Pengaturan lanjutan <span className="muted">(boleh dilewati)</span></summary>
      <div className="stack advanced-body">
        <p className="muted">Pengaturan ini membantu AI menulis sesuai gaya media Anda dan mengisi bagian bawah situs. Warna dan tagline situs diatur setelah media dibuat.</p>
        <div className="grid grid-2">
          {advanced("niche", "Fokus liputan", "Topik utama media, misalnya ekonomi daerah. AI memakainya agar draf tidak melenceng.", false, 500, "Ekonomi daerah")}
          {advanced("targetAudience", "Pembaca utama", "Siapa yang membaca, misalnya pelaku UMKM di Jawa Timur.", false, 500, "Pelaku UMKM")}
          {advanced("editorialMission", "Misi redaksi", "Satu atau dua kalimat tentang tujuan media. Jadi pegangan AI saat menulis.", true, 1000, "")}
          {advanced("toneGuidelines", "Gaya bahasa", "Nada tulisan, misalnya lugas dan tanpa istilah teknis.", true, 1000, "")}
          {advanced("styleGuidelines", "Panduan penulisan", "Aturan khusus, misalnya judul maksimal 12 kata.", true, 1000, "")}
          <div className="field">
            <label htmlFor={`${uid}-language`}>Bahasa artikel</label>
            <select id={`${uid}-language`} name="language" defaultValue="Indonesian" aria-describedby={`${uid}-language-note`}><option value="Indonesian">Bahasa Indonesia</option><option value="English">Bahasa Inggris</option></select>
            <p id={`${uid}-language-note`} className="field-help">Bahasa yang dipakai AI untuk draf artikel.</p>
          </div>
          {advanced("publisherDisclosure", "Keterangan penerbit", "Tampil di bagian bawah situs publik. Tulis nama badan penerbit.", true, 1500, "")}
          {advanced("ownershipDisclosure", "Keterangan kepemilikan", "Tampil di bagian bawah situs publik. Tulis siapa pemilik media.", true, 1500, "")}
        </div>
      </div>
    </details>

    {error && <div role="alert" className="notice notice-error">{error}</div>}
    {created && <div role="status" className="notice notice-success">
      <div className="stack-sm">
        <strong>Media {created.displayName} sudah dibuat.</strong>
        <span>Langkah berikutnya: {created.hasAddress ? "konfirmasi alamat situsnya setelah DNS diarahkan ke server." : "tambahkan alamat situsnya."}</span>
        {created.id && <Link className="btn" href={`/media?site=${created.id}&tab=alamat`}>{created.hasAddress ? "Konfirmasi alamat situs" : "Tambah alamat situs"}</Link>}
      </div>
    </div>}
    <div className="actions"><button type="submit" disabled={busy} className="btn btn-primary">{busy ? "Membuat media…" : "Buat media"}</button></div>
  </form>;
}
