"use client";

import { useState } from "react";
import { CircleAlert } from "lucide-react";
import BlastImages from "@/components/blast-images";
import { callApi, messageOf } from "@/components/blast-format";
import { Failure } from "@/components/plain-errors";
import type { BlastAsset, BlastContent, BlastDetail, BlastEditInput } from "@/lib/blast-types";

type Images = { featured: BlastAsset | null; gallery: BlastAsset[] };
type Field = "title" | "excerpt" | "body" | "tags" | "seoTitle" | "metaDescription";
type Errors = Partial<Record<Field, string>>;

const number = new Intl.NumberFormat("id-ID");
const fieldIds: Record<Field, string> = { title: "bl-edit-title", excerpt: "bl-edit-excerpt", body: "bl-edit-body", tags: "bl-edit-tags", seoTitle: "bl-edit-seo-title", metaDescription: "bl-edit-meta" };
const fieldOrder: Field[] = ["title", "excerpt", "body", "tags", "seoTitle", "metaDescription"];

/** The same limits the server enforces, in words the operator can act on. */
const limitMessages: Record<Field, string> = {
  title: "Judul harus 8 sampai 180 huruf.",
  excerpt: "Ringkasan harus 12 sampai 500 huruf.",
  body: "Isi berita harus 120 sampai 30.000 huruf.",
  tags: "Kata kunci paling banyak 12, masing-masing paling panjang 40 huruf.",
  seoTitle: "Judul untuk mesin pencari paling panjang 180 huruf.",
  metaDescription: "Deskripsi untuk mesin pencari paling panjang 300 huruf.",
};

function parseTags(text: string) {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of text.split(/[,\n]/)) {
    const tag = part.trim();
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags;
}

const imageKey = (images: Images) => [images.featured?.id ?? "", ...images.gallery.map((asset) => asset.id)].join("|");

function lengthError(field: Field, length: number, min: number, max: number) {
  return length < min || length > max ? `${limitMessages[field]} Sekarang ${number.format(length)} huruf.` : undefined;
}

export default function BlastEditForm({ blastId, content, live, onSaved, onCancel }: { blastId: string; content: BlastContent; live: boolean; onSaved: (detail: BlastDetail) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(content.title);
  const [excerpt, setExcerpt] = useState(content.excerpt);
  const [body, setBody] = useState(content.body);
  const [tagsText, setTagsText] = useState(content.tags.join(", "));
  const [seoTitle, setSeoTitle] = useState(content.seoTitle);
  const [metaDescription, setMetaDescription] = useState(content.metaDescription);
  const [images, setImages] = useState<Images>({ featured: content.featured, gallery: content.gallery });
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function clear(field: Field) {
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    setFormError("");
  }

  function show(next: Errors) {
    setErrors(next);
    const first = fieldOrder.find((field) => next[field]);
    if (first) document.getElementById(fieldIds[first])?.focus();
  }

  async function save(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const tags = parseTags(tagsText);
    const next: Errors = {
      title: lengthError("title", title.trim().length, 8, 180),
      excerpt: lengthError("excerpt", excerpt.trim().length, 12, 500),
      body: lengthError("body", body.trim().length, 120, 30000),
      seoTitle: lengthError("seoTitle", seoTitle.trim().length, 0, 180),
      metaDescription: lengthError("metaDescription", metaDescription.trim().length, 0, 300),
      tags: tags.length > 12 || tags.some((tag) => tag.length > 40) ? limitMessages.tags : undefined,
    };
    if (fieldOrder.some((field) => next[field])) {
      setFormError("Ada isian yang belum benar. Perbaiki yang bertanda merah, lalu simpan lagi.");
      show(next);
      return;
    }
    if (pending > 0) {
      setFormError("Ada gambar yang belum selesai diunggah atau belum tersimpan. Tunggu sampai selesai, atau hapus gambar itu, lalu simpan lagi.");
      return;
    }

    const payload: BlastEditInput = {};
    if (title.trim() !== content.title) payload.title = title.trim();
    if (excerpt.trim() !== content.excerpt) payload.excerpt = excerpt.trim();
    if (body.trim() !== content.body) payload.body = body.trim();
    if (seoTitle.trim() !== content.seoTitle) payload.seoTitle = seoTitle.trim();
    if (metaDescription.trim() !== content.metaDescription) payload.metaDescription = metaDescription.trim();
    if (tags.join("\n") !== content.tags.join("\n")) payload.tags = tags;
    if (imageKey(images) !== imageKey({ featured: content.featured, gallery: content.gallery })) {
      payload.featuredAssetId = images.featured?.id ?? null;
      payload.galleryAssetIds = images.gallery.map((asset) => asset.id);
    }
    if (Object.keys(payload).length === 0) {
      setErrors({});
      setFormError("Belum ada yang berubah. Ubah isinya dulu, atau tekan Batal.");
      return;
    }

    setErrors({});
    setFormError("");
    setSaving(true);
    try {
      const detail = await callApi<BlastDetail>(`/api/blasts/${encodeURIComponent(blastId)}`, "Perubahan belum tersimpan. Coba lagi sebentar lagi.", { method: "PATCH", body: payload, fields: limitMessages });
      onSaved(detail);
    } catch (error) {
      if (error instanceof Failure && error.field && error.field in limitMessages) show({ [error.field as Field]: error.message });
      else setFormError(messageOf(error, "Perubahan belum tersimpan. Coba lagi sebentar lagi."));
      setSaving(false);
    }
  }

  const describe = (field: Field) => (errors[field] ? `${fieldIds[field]}-error` : `${fieldIds[field]}-help`);

  return (
    <form className="card bl-form" noValidate onSubmit={(event) => void save(event)} aria-label="Edit berita">
      <div className="stack-sm">
        <h2>Edit berita</h2>
        <p className="muted">
          {live
            ? "Berita ini sudah tayang. Perubahan langsung tayang di semua media sekaligus, dan alamat berita di web tidak berubah."
            : "Perubahan berlaku untuk semua media sekaligus. Setelah menyimpan, baca lagi beritanya, lalu terbitkan."}
        </p>
      </div>

      <div className="field">
        <label htmlFor={fieldIds.title}>Judul berita</label>
        <input id={fieldIds.title} value={title} onChange={(event) => { setTitle(event.target.value); clear("title"); }} aria-invalid={Boolean(errors.title)} aria-describedby={describe("title")} autoComplete="off" />
        {errors.title ? <span id={`${fieldIds.title}-error`} className="field-error">{errors.title}</span> : <span id={`${fieldIds.title}-help`} className="field-help">8 sampai 180 huruf. Sekarang {number.format(title.trim().length)}.</span>}
      </div>

      <div className="field">
        <label htmlFor={fieldIds.excerpt}>Ringkasan</label>
        <textarea id={fieldIds.excerpt} className="bl-excerpt-input" value={excerpt} onChange={(event) => { setExcerpt(event.target.value); clear("excerpt"); }} aria-invalid={Boolean(errors.excerpt)} aria-describedby={describe("excerpt")} />
        {errors.excerpt ? <span id={`${fieldIds.excerpt}-error`} className="field-error">{errors.excerpt}</span> : <span id={`${fieldIds.excerpt}-help`} className="field-help">Satu atau dua kalimat yang tampil di bawah judul. 12 sampai 500 huruf. Sekarang {number.format(excerpt.trim().length)}.</span>}
      </div>

      <div className="field">
        <label htmlFor={fieldIds.body}>Isi berita</label>
        <textarea id={fieldIds.body} className="bl-body-input" value={body} onChange={(event) => { setBody(event.target.value); clear("body"); }} aria-invalid={Boolean(errors.body)} aria-describedby={describe("body")} />
        {errors.body ? <span id={`${fieldIds.body}-error`} className="field-error">{errors.body}</span> : <span id={`${fieldIds.body}-help`} className="field-help">Pisahkan paragraf dengan satu baris kosong. Paling sedikit 120 huruf. Sekarang {number.format(body.trim().length)}.</span>}
      </div>

      <div className="field">
        <label htmlFor={fieldIds.tags}>Kata kunci</label>
        <input id={fieldIds.tags} value={tagsText} onChange={(event) => { setTagsText(event.target.value); clear("tags"); }} aria-invalid={Boolean(errors.tags)} aria-describedby={describe("tags")} autoComplete="off" />
        {errors.tags ? <span id={`${fieldIds.tags}-error`} className="field-error">{errors.tags}</span> : <span id={`${fieldIds.tags}-help`} className="field-help">Pisahkan dengan koma. Contoh: ekonomi, harga beras, pasar.</span>}
      </div>

      <fieldset className="bl-fieldset">
        <legend>Gambar</legend>
        <BlastImages value={images} onChange={setImages} onPendingChange={setPending} />
      </fieldset>

      <details className="bl-details">
        <summary>Pengaturan lanjutan</summary>
        <div className="bl-advanced">
          <div className="field">
            <label htmlFor={fieldIds.seoTitle}>Judul untuk mesin pencari</label>
            <input id={fieldIds.seoTitle} value={seoTitle} onChange={(event) => { setSeoTitle(event.target.value); clear("seoTitle"); }} aria-invalid={Boolean(errors.seoTitle)} aria-describedby={describe("seoTitle")} autoComplete="off" />
            {errors.seoTitle ? <span id={`${fieldIds.seoTitle}-error`} className="field-error">{errors.seoTitle}</span> : <span id={`${fieldIds.seoTitle}-help`} className="field-help">Boleh kosong. Paling panjang 180 huruf.</span>}
          </div>
          <div className="field">
            <label htmlFor={fieldIds.metaDescription}>Deskripsi untuk mesin pencari</label>
            <textarea id={fieldIds.metaDescription} className="bl-excerpt-input" value={metaDescription} onChange={(event) => { setMetaDescription(event.target.value); clear("metaDescription"); }} aria-invalid={Boolean(errors.metaDescription)} aria-describedby={describe("metaDescription")} />
            {errors.metaDescription ? <span id={`${fieldIds.metaDescription}-error`} className="field-error">{errors.metaDescription}</span> : <span id={`${fieldIds.metaDescription}-help`} className="field-help">Boleh kosong. Paling panjang 300 huruf.</span>}
          </div>
        </div>
      </details>

      {formError && (
        <div role="alert" className="notice notice-error">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      <div className="bl-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Menyimpan…" : "Simpan perubahan"}</button>
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>Batal</button>
      </div>
    </form>
  );
}
