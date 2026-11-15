"use client";

import "@/app/css/team.css";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { asFailure, failure, readBody } from "@/components/plain-errors";

type MediaOption = { id: string; displayName: string; address: string };

const SAME_FAILURE = "Daftar media belum tersimpan. Coba lagi sebentar lagi.";

export default function UserMedia({ userId, name, current, media, networkWide, canEdit }: {
  userId: string;
  name: string;
  current: string[];
  media: MediaOption[];
  networkWide: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const currentOptions = media.filter((item) => current.includes(item.id));
  const empty = current.length === 0;

  function openPanel() {
    setPicked(current);
    setError("");
    setMessage("");
    setOpen(true);
  }

  function toggle(id: string) {
    setPicked((list) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, action: "set-media", mediaSiteIds: picked }) });
      const result = await readBody(response);
      if (!response.ok) throw failure(response.status, result, {}, SAME_FAILURE);
      setOpen(false);
      setMessage(`Daftar media ${name} diperbarui`);
      router.refresh();
    } catch (e) {
      setError(asFailure(e, SAME_FAILURE).message);
    } finally {
      setBusy(false);
    }
  }

  if (networkWide) {
    return <div className="member-media">
      <h3>Media yang dipakai</h3>
      <div className="media-chips"><span className="badge badge-blue">Semua media</span></div>
    </div>;
  }

  return <div className="member-media">
    <h3>Media yang dipakai</h3>
    <div className="media-chips">
      {empty
        ? <span className="badge badge-yellow">Belum ada media: pengguna ini belum bisa menulis berita</span>
        : currentOptions.map((item) => <span className="badge" key={item.id}>{item.displayName}</span>)}
    </div>
    {canEdit && !open && <div className="actions">
      <button type="button" className={empty ? "btn btn-primary" : "btn"} onClick={openPanel}>Atur media</button>
    </div>}
    {canEdit && open && <div className="media-editor" role="group" aria-labelledby={`${uid}-title`}>
      <strong id={`${uid}-title`}>Pilih media untuk {name}</strong>
      {media.length
        ? <div className="media-editor-list">{media.map((item) => <label className="checkline" key={item.id}>
          <input type="checkbox" checked={picked.includes(item.id)} onChange={() => toggle(item.id)} disabled={busy}/>
          <span><b>{item.displayName}</b>{item.address && <small>{item.address}</small>}</span>
        </label>)}</div>
        : <div className="notice notice-warn">Belum ada media. Tambahkan media di halaman Media saya dulu.</div>}
      <p className="muted num">{picked.length} dari {media.length} media dipilih</p>
      <p className="muted">Pengguna tidak bisa mengubah daftar ini sendiri. Hanya pemilik.</p>
      {error && <div role="alert" className="notice notice-error">{error}</div>}
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
        <button type="button" className="btn" onClick={() => setOpen(false)} disabled={busy}>Batal</button>
      </div>
    </div>}
    {canEdit && !open && <p className="muted">Pengguna tidak bisa mengubah daftar ini sendiri. Hanya pemilik.</p>}
    {message && <div role="status" className="notice notice-success">{message}</div>}
  </div>;
}
