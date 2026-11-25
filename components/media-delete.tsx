"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Trash2 } from "lucide-react";
import { asFailure, failure, readBody } from "@/components/plain-errors";

const fallback = "Media belum bisa dihapus. Coba lagi sebentar lagi.";

/** Owner/admin only. Deleting needs the media name typed back, because every story on it goes offline. */
export default function MediaDelete({ mediaSiteId, name, articleCount }: { mediaSiteId: string; name: string; articleCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = typed.trim() === name.trim();

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/media", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaSiteId }) });
      if (!response.ok) throw failure(response.status, await readBody(response), {}, fallback);
      router.push("/media?dihapus=1");
      router.refresh();
    } catch (problem) {
      setError(asFailure(problem, fallback).message);
      setBusy(false);
    }
  }

  return (
    <section className="card stack media-danger" aria-labelledby="media-delete-title">
      <div className="stack-sm">
        <h2 id="media-delete-title">Hapus media</h2>
        <p className="muted">Semua berita di {name} ({articleCount} artikel) langsung dihapus dari situsnya, alamat situsnya berhenti melayani, dan media ini hilang dari semua daftar. Berita yang sama di media lain tetap tayang. Riwayatnya tetap tersimpan untuk catatan redaksi.</p>
      </div>
      {!open ? (
        <div className="actions"><button type="button" className="btn btn-danger" onClick={() => setOpen(true)}><Trash2 size={18} aria-hidden="true" />Hapus media ini</button></div>
      ) : (
        <div className="stack-sm">
          <div className="field">
            <label htmlFor="media-delete-confirm">Ketik <strong>{name}</strong> untuk memastikan</label>
            <input id="media-delete-confirm" type="text" autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} disabled={busy} />
          </div>
          {error && <div role="alert" className="notice notice-error"><CircleAlert size={18} aria-hidden="true" /><span>{error}</span></div>}
          <div className="actions">
            <button type="button" className="btn btn-danger" disabled={!matches || busy} onClick={() => void remove()}>{busy ? "Menghapus…" : "Ya, hapus media"}</button>
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => { setOpen(false); setTyped(""); setError(""); }}>Batal</button>
          </div>
        </div>
      )}
    </section>
  );
}
