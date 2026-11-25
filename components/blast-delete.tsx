"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Trash2 } from "lucide-react";
import { callApi, messageOf } from "@/components/blast-format";

const fallback = "Berita belum bisa dihapus. Coba lagi sebentar lagi.";

/** Deletes the berita after an explicit second press: it comes off every media and leaves the list. */
export default function BlastDelete({ blastId, live }: { blastId: string; live: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await callApi<{ ok: boolean }>(`/api/blasts/${encodeURIComponent(blastId)}`, fallback, { method: "DELETE" });
      router.push("/blasts?dihapus=1");
      router.refresh();
    } catch (problem) {
      setError(messageOf(problem, fallback));
      setBusy(false);
    }
  }

  return (
    <section className="card stack bl-danger" aria-labelledby="bl-delete-title">
      <div className="stack-sm">
        <h2 id="bl-delete-title">Hapus berita</h2>
        <p className="muted">{live ? "Berita ini langsung dihapus dari semua situs media yang memuatnya, lalu hilang dari Daftar berita." : "Berita ini hilang dari Daftar berita."} Riwayat perubahannya tetap tersimpan untuk catatan redaksi.</p>
      </div>
      {error && <div role="alert" className="notice notice-error"><CircleAlert size={18} aria-hidden="true" /><span>{error}</span></div>}
      {confirming ? (
        <div role="alert" className="notice notice-warn">
          <CircleAlert size={18} aria-hidden="true" />
          <div className="stack-sm">
            <span>Yakin hapus berita ini{live ? " dari semua media" : ""}? Tindakan ini tidak bisa dibatalkan dari layar ini.</span>
            <div className="actions">
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void remove()}>{busy ? "Menghapus…" : "Ya, hapus berita"}</button>
              <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setConfirming(false)}>Batal</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="btn btn-danger" onClick={() => { setError(""); setConfirming(true); }}><Trash2 size={18} aria-hidden="true" />Hapus berita</button>
        </div>
      )}
    </section>
  );
}
