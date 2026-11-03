"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string; slug: string; description: string; isActive: boolean; _count: { articles: number } };

export default function CategoryManager({ mediaSiteId, categories, editable }: { mediaSiteId: string; categories: Category[]; editable: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(payload: Record<string, string>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/categories", { method: payload.action === "create" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload.action === "create" ? { mediaSiteId, name: payload.name, description: payload.description } : { categoryId: payload.categoryId, action: payload.action, name: payload.name, description: payload.description }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kategori tidak dapat diperbarui.");
      setMessage("Kategori tersimpan.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kategori tidak dapat diperbarui.");
    } finally {
      setBusy(false);
    }
  }

  return <details className="category-manager">
    <summary>{editable ? "Kelola kategori redaksi" : "Kategori media"}</summary>
    {editable && <form className="category-create-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get("name") || "").trim(); const description = String(form.get("description") || "").trim(); void send({ action: "create", name, description }); event.currentTarget.reset(); }}>
      <div className="field"><label htmlFor={`category-name-${mediaSiteId}`}>Nama kategori</label><input id={`category-name-${mediaSiteId}`} name="name" minLength={2} maxLength={100} required placeholder="Contoh: Pendidikan"/></div>
      <div className="field"><label htmlFor={`category-description-${mediaSiteId}`}>Keterangan (opsional)</label><input id={`category-description-${mediaSiteId}`} name="description" maxLength={500}/></div>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Menyimpan…" : "Tambah kategori"}</button>
    </form>}
    <div className="category-list">{categories.map((category) => <div className="category-row" key={category.id}>
      <div><strong>{category.name}</strong>{category.description && <span className="muted">{category.description}</span>}<small className="muted">{category._count.articles} naskah</small></div>
      {editable && <div className="actions"><button className="btn" disabled={busy} onClick={() => { const name = window.prompt("Nama kategori baru", category.name)?.trim(); if (name && name !== category.name) void send({ action: "rename", categoryId: category.id, name }); }}>Ubah nama</button><button className="btn btn-danger" disabled={busy || category._count.articles > 0} title={category._count.articles > 0 ? "Kategori yang digunakan naskah belum dapat dihapus." : undefined} onClick={() => { if (window.confirm(`Hapus kategori ${category.name}?`)) void send({ action: "delete", categoryId: category.id }); }}>Hapus</button></div>}
    </div>)}{!categories.length && <div className="muted">Belum ada kategori.</div>}</div>
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {message && <div className="notice" role="status">{message}</div>}
  </details>;
}
