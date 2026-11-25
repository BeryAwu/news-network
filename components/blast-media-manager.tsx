"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Globe } from "lucide-react";
import { callApi, messageOf } from "@/components/blast-format";
import type { BlastDetail, BlastMediaChange } from "@/lib/blast-types";

const fallback = "Pilihan media belum bisa disimpan. Coba lagi sebentar lagi.";

function stateOf(detail: BlastDetail, mediaId: string) {
  const row = detail.media.find((m) => m.mediaSiteId === mediaId);
  if (!row) return null;
  if (row.publication?.status === "PUBLISHED") return { live: true, text: "Tayang" };
  if (row.publication?.status === "SCHEDULED") return { live: false, text: "Terjadwal" };
  if (row.publication?.status === "QUEUED" || row.publication?.status === "PUBLISHING") return { live: false, text: "Sedang terbit" };
  return { live: false, text: "Belum terbit" };
}

/**
 * "Media tujuan": which media carry this berita. Unchecking a media that shows the story takes it off that site;
 * checking a new one gives it the current text, and puts it live right away when the berita is already live.
 * The parent keys this component on the saved media list, so a save or refresh starts it fresh from server data.
 */
export default function BlastMediaManager({ detail, onChanged }: { detail: BlastDetail; onChanged: (result: BlastMediaChange, message: string) => void }) {
  const current = useMemo(() => detail.media.map((m) => m.mediaSiteId), [detail.media]);
  const [picked, setPicked] = useState<string[]>(current);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const allBox = useRef<HTMLInputElement>(null);

  // Media already on the berita stay listed even if they are no longer in the user's own list.
  const options = useMemo(() => {
    const known = new Map(detail.availableMedia.map((m) => [m.id, m]));
    for (const row of detail.media) if (!known.has(row.mediaSiteId)) known.set(row.mediaSiteId, { id: row.mediaSiteId, name: row.name, hostname: row.hostname });
    return [...known.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [detail.availableMedia, detail.media]);

  const allPicked = options.length > 0 && options.every((o) => picked.includes(o.id));
  const somePicked = picked.length > 0 && !allPicked;
  useEffect(() => { if (allBox.current) allBox.current.indeterminate = somePicked; }, [somePicked]);

  const added = picked.filter((id) => !current.includes(id));
  const removed = current.filter((id) => !picked.includes(id));
  const removedLive = removed.filter((id) => stateOf(detail, id)?.live);
  const changed = added.length > 0 || removed.length > 0;
  const nameOf = (id: string) => options.find((o) => o.id === id)?.name ?? "media";
  const anyLive = detail.media.some((m) => m.publication?.status === "PUBLISHED");

  function toggle(id: string) {
    setError("");
    setConfirming(false);
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    setError("");
    setConfirming(false);
    setPicked(allPicked ? [] : options.map((o) => o.id));
  }

  async function save() {
    if (!picked.length) { setError("Pilih minimal satu media. Untuk menghapus berita dari semua media, pakai Hapus berita di bawah."); return; }
    if (removedLive.length && !confirming) { setConfirming(true); return; }
    setBusy(true);
    setError("");
    try {
      const result = await callApi<BlastMediaChange>(`/api/blasts/${encodeURIComponent(detail.id)}/media`, fallback, { method: "PUT", body: { mediaSiteIds: picked } });
      const parts = [
        result.added ? `${result.added} media ditambahkan${anyLive ? " dan langsung diterbitkan" : ""}` : "",
        result.removed ? `${result.removed} media dilepas${removedLive.length ? "; beritanya sudah dihapus dari situs media itu" : ""}` : "",
      ].filter(Boolean);
      onChanged(result, `Pilihan media tersimpan: ${parts.join(", ")}.`);
    } catch (problem) {
      setError(messageOf(problem, fallback));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <section className="card stack bl-targets" aria-labelledby="bl-targets-title">
      <div className="stack-sm">
        <h2 id="bl-targets-title"><Globe size={20} aria-hidden="true" /> Media tujuan</h2>
        <p className="muted">Centang media yang memuat berita ini. Hapus centang untuk mencabut berita dari media itu; kalau sudah tayang, beritanya langsung dihapus dari situsnya.</p>
      </div>

      {options.length === 0
        ? <p className="muted">Belum ada media yang bisa dipilih. Tambahkan media di Media saya.</p>
        : (
          <fieldset className="bl-targets-list" disabled={busy || !detail.canEdit}>
            <legend className="visually-hidden">Pilih media</legend>
            <label className="bl-target bl-target-all">
              <input ref={allBox} type="checkbox" checked={allPicked} onChange={toggleAll} />
              <span><strong>Pilih semua</strong><small>{picked.length} dari {options.length} media dipilih</small></span>
            </label>
            {options.map((option) => {
              const state = stateOf(detail, option.id);
              const checked = picked.includes(option.id);
              const pending = checked !== current.includes(option.id);
              return (
                <label key={option.id} className={`bl-target${pending ? " is-pending" : ""}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(option.id)} />
                  <span>
                    <strong>{option.name}</strong>
                    <small>{option.hostname ?? "Alamat situs belum dikonfirmasi"}</small>
                  </span>
                  <span className={`badge${pending ? (checked ? "" : " badge-red") : state?.live ? " badge-green" : ""}`}>
                    {pending ? (checked ? "Akan ditambahkan" : state?.live ? "Akan dihapus dari situs" : "Akan dilepas") : state?.text ?? "Tidak dipilih"}
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

      {confirming && (
        <div role="alert" className="notice notice-warn">
          <CircleAlert size={18} aria-hidden="true" />
          <span>Berita ini sedang tayang di {removedLive.map(nameOf).join(", ")}. Kalau disimpan, beritanya langsung dihapus dari situs itu. Tekan Simpan sekali lagi untuk melanjutkan.</span>
        </div>
      )}
      {error && (
        <div role="alert" className="notice notice-error">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {detail.canEdit && (
        <div className="bl-actions">
          <button type="button" className={`btn${confirming ? " btn-danger" : " btn-primary"}`} disabled={busy || !changed} onClick={() => void save()}>
            {busy ? "Menyimpan…" : confirming ? "Ya, simpan dan hapus dari situs" : "Simpan pilihan media"}
          </button>
          {changed && !busy && <button type="button" className="btn btn-quiet" onClick={() => { setPicked(current); setConfirming(false); setError(""); }}>Batal</button>}
          {!changed && <span className="muted"><CircleCheck size={16} aria-hidden="true" /> Sesuai pilihan tersimpan</span>}
        </div>
      )}
    </section>
  );
}
