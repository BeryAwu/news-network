"use client";

import "@/app/css/media.css";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { asFailure, failure, readBody } from "@/components/plain-errors";

type Category = { id: string; name: string; slug: string; description: string; isActive: boolean; _count: { articles: number } };

const apiFields = {
  name: "Nama kategori harus 2 sampai 100 karakter.",
  description: "Keterangan maksimal 500 karakter. Persingkat tulisannya.",
};

export default function CategoryManager({ mediaSiteId, categories, editable }: { mediaSiteId: string; categories: Category[]; editable: boolean }) {
  const router = useRouter();
  const uid = useId();
  const addForm = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [addError, setAddError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  async function send(payload: { action: "create" | "rename" | "delete"; categoryId?: string; name?: string; description?: string }, success: string, fallback: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const create = payload.action === "create";
      const response = await fetch("/api/categories", { method: create ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(create ? { mediaSiteId, name: payload.name, description: payload.description } : { categoryId: payload.categoryId, action: payload.action, name: payload.name, description: payload.description }) });
      const result = await readBody(response);
      if (!response.ok) throw failure(response.status, result, apiFields, fallback);
      setMessage(success);
      router.refresh();
      return true;
    } catch (e) {
      const problem = asFailure(e, fallback);
      if (payload.action === "create") setAddError(problem.message);
      else setError(problem.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const description = String(data.get("description") || "").trim();
    setAddError("");
    if (name.length < 2) {
      setAddError("Tulis nama kategori dulu, minimal 2 huruf. Contoh: Pendidikan.");
      document.getElementById(`${uid}-name`)?.focus();
      return;
    }
    if (await send({ action: "create", name, description }, `Kategori ${name} sudah ditambahkan.`, "Kategori belum tersimpan. Coba lagi sebentar lagi.")) {
      addForm.current?.reset();
      document.getElementById(`${uid}-name`)?.focus();
    }
  }

  function startEdit(category: Category) {
    setEditing(category.id);
    setDraftName(category.name);
    setDraftDescription(category.description);
    setError("");
    setMessage("");
  }

  async function saveEdit(category: Category) {
    const name = draftName.trim();
    if (name.length < 2) {
      setError("Nama kategori terlalu pendek. Tulis minimal 2 huruf.");
      return;
    }
    if (await send({ action: "rename", categoryId: category.id, name, description: draftDescription.trim() }, `Kategori ${name} sudah disimpan.`, "Perubahan belum tersimpan. Coba lagi sebentar lagi.")) setEditing(null);
  }

  function remove(category: Category) {
    if (!window.confirm(`Hapus kategori ${category.name}? Kategori ini kosong, jadi tidak ada naskah yang ikut berubah. Penghapusan tidak bisa dibatalkan, tetapi Anda bisa membuat kategori baru dengan nama yang sama.`)) return;
    void send({ action: "delete", categoryId: category.id }, `Kategori ${category.name} sudah dihapus.`, "Kategori belum terhapus. Coba lagi sebentar lagi.");
  }

  return <div className="stack">
    <div className="form-intro">
      <h3>Kategori</h3>
      <p>Kategori mengelompokkan naskah di menu situs, misalnya Ekonomi atau Olahraga. Satu kategori sudah cukup untuk mulai.</p>
    </div>

    {editable && <form ref={addForm} onSubmit={add} noValidate className="category-add" aria-label="Tambah kategori">
      <div className="field">
        <label htmlFor={`${uid}-name`}>Nama kategori</label>
        <input id={`${uid}-name`} name="name" maxLength={100} placeholder="Pendidikan" autoComplete="off" aria-required="true" aria-invalid={Boolean(addError)} aria-describedby={addError ? `${uid}-add-error` : undefined}/>
      </div>
      <div className="field">
        <label htmlFor={`${uid}-description`}>Keterangan <span className="muted">(boleh kosong)</span></label>
        <input id={`${uid}-description`} name="description" maxLength={500} autoComplete="off"/>
      </div>
      <button type="submit" className={categories.length === 0 ? "btn btn-primary" : "btn"} disabled={busy}>{busy && !editing ? "Menyimpan…" : "Tambah kategori"}</button>
      {addError && <p id={`${uid}-add-error`} className="field-error category-add-error">{addError}</p>}
    </form>}

    {categories.length === 0
      ? <EmptyState title="Belum ada kategori" detail={editable ? "Buat satu kategori dulu, misalnya Berita Umum, supaya naskah punya tempat di menu situs." : "Minta Admin atau Editor membuat kategori pertama."} />
      : <ul className="category-list">
        {categories.map((category) => {
          const used = category._count.articles;
          return <li className="category-row" key={category.id}>
            {editing === category.id
              ? <form className="category-edit" onSubmit={(event) => { event.preventDefault(); void saveEdit(category); }} aria-label={`Ubah kategori ${category.name}`}>
                <div className="field">
                  <label htmlFor={`${uid}-edit-name-${category.id}`}>Nama kategori</label>
                  <input id={`${uid}-edit-name-${category.id}`} value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={100} autoComplete="off" autoFocus/>
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-edit-desc-${category.id}`}>Keterangan</label>
                  <input id={`${uid}-edit-desc-${category.id}`} value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} maxLength={500} autoComplete="off"/>
                </div>
                <div className="actions">
                  <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
                  <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setEditing(null)}>Batal</button>
                </div>
              </form>
              : <>
                <div className="category-copy">
                  <strong>{category.name}</strong>
                  {category.description && <span className="muted">{category.description}</span>}
                  <span className="muted num">{used} naskah</span>
                </div>
                {editable && <div className="category-actions">
                  <div className="actions">
                    <button type="button" className="btn" disabled={busy} onClick={() => startEdit(category)} aria-label={`Ubah ${category.name}`}>Ubah</button>
                    <button type="button" className="btn btn-danger" disabled={busy || used > 0} onClick={() => remove(category)} aria-label={`Hapus ${category.name}`}>Hapus</button>
                  </div>
                  {used > 0 && <span className="field-help">Dipakai {used} naskah, jadi belum bisa dihapus.</span>}
                </div>}
              </>}
          </li>;
        })}
      </ul>}

    {error && <div role="alert" className="notice notice-error">{error}</div>}
    {message && <div role="status" className="notice notice-success">{message}</div>}
  </div>;
}
