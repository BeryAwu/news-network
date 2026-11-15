"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarClock, CircleAlert, Pencil, Send } from "lucide-react";
import { BlastPreview, OriginalNarrative } from "@/components/blast-preview";
import { listNames } from "@/components/blast-format";
import type { BlastDetail, BlastContent } from "@/lib/blast-types";

type Panel = "confirm" | "schedule" | null;
type Skipped = { mediaName: string; reason: string };

const noopSubscribe = () => () => {};
function deviceZoneName() {
  return new Intl.DateTimeFormat("id-ID", { timeZoneName: "long" }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value ?? "";
}

interface Props {
  detail: BlastDetail & { content: BlastContent };
  busy: boolean;
  skipped: Skipped[];
  /** Resolves to a plain error sentence, or null when the publish call worked. */
  onPublish: (scheduledAt?: string) => Promise<string | null>;
  onEdit: () => void;
}

/** DRAFT: read the berita exactly as readers see it, see which media get it, then publish with one button. */
export default function BlastDraftView({ detail, busy, skipped, onPublish, onEdit }: Props) {
  const { content, media } = detail;
  const ready = media.filter((item) => item.canPublish);
  const blocked = media.filter((item) => !item.canPublish);
  const names = listNames(ready.map((item) => item.name));
  const zoneName = useSyncExternalStore(noopSubscribe, deviceZoneName, () => "");
  const [panel, setPanel] = useState<Panel>(null);
  const [when, setWhen] = useState("");
  const [whenError, setWhenError] = useState("");
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (panel) panelRef.current?.focus(); }, [panel]);

  function open(next: Panel) {
    setError("");
    setWhenError("");
    setPanel(next);
  }

  async function publishNow() {
    setError("");
    const problem = await onPublish();
    if (problem) setError(problem);
    else setPanel(null);
  }

  async function publishLater() {
    setError("");
    if (!when) { setWhenError("Isi tanggal dan jam tayang, atau pilih terbitkan sekarang."); return; }
    const date = new Date(when);
    if (Number.isNaN(date.getTime())) { setWhenError("Tanggal dan jam tidak dikenali. Pilih lagi dari kotak tanggal."); return; }
    if (date.getTime() <= Date.now() + 60 * 1000) { setWhenError("Waktu tayang sudah lewat atau terlalu dekat. Pilih waktu di masa depan."); return; }
    setWhenError("");
    const problem = await onPublish(date.toISOString());
    if (problem) setError(problem);
    else setPanel(null);
  }

  return (
    <>
      <div className="notice">
        <CircleAlert size={18} aria-hidden="true" />
        <span>Baca berita di bawah. Seperti inilah pembaca akan melihatnya, dan isinya sama di semua media. Kalau sudah benar, tekan Terbitkan di bagian bawah.</span>
      </div>

      <section className="card" aria-label="Isi berita">
        <BlastPreview content={content} authorName={detail.author.name} />
      </section>

      <section className="card stack" aria-labelledby="bl-targets-title">
        <div className="stack-sm">
          <h2 id="bl-targets-title">Media yang menerima berita ini</h2>
          <p className="muted">Media yang tandanya kuning tidak ikut terbit sampai masalahnya diperbaiki.</p>
        </div>
        <ul className="bl-rows">
          {media.map((item) => (
            <li key={item.mediaSiteId}>
              <div className="bl-row-head">
                <div className="bl-row-name">
                  <strong>{item.name}</strong>
                  <span className="bl-host">{item.hostname ?? "Alamat situs belum dikonfirmasi"}</span>
                </div>
                {item.canPublish
                  ? <span className="badge badge-green">Siap terbit</span>
                  : <span className="badge badge-yellow"><CircleAlert size={16} aria-hidden="true" />Belum bisa terbit</span>}
              </div>
              {!item.canPublish && (
                <p className="bl-reason">
                  <span>{item.problem ?? "Media ini belum bisa menerima berita."}</span>
                  <Link href="/media">Perbaiki di Media saya</Link>
                </p>
              )}
              {item.publication?.status === "FAILED" && item.publication.error && (
                <p className="bl-reason">Percobaan terbit sebelumnya gagal: {item.publication.error}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <OriginalNarrative text={detail.originalNarrative} />

      <section className="card stack" aria-label="Terbitkan berita">
        {skipped.length > 0 && (
          <div role="status" className="notice notice-warn">
            <CircleAlert size={18} aria-hidden="true" />
            <div className="stack-sm">
              <strong>Berita belum tayang di media berikut.</strong>
              <ul>{skipped.map((item) => <li key={item.mediaName}>{item.mediaName}: {item.reason}</li>)}</ul>
            </div>
          </div>
        )}

        {!detail.canPublish ? (
          <div className="notice notice-warn">
            <CircleAlert size={18} aria-hidden="true" />
            <span>Akun Anda tidak punya izin menerbitkan. Minta pemilik atau admin menerbitkan berita ini.</span>
          </div>
        ) : ready.length === 0 ? (
          <div className="notice notice-warn">
            <CircleAlert size={18} aria-hidden="true" />
            <span>Belum ada media yang bisa menerima berita ini. Konfirmasi alamat situs di <Link href="/media">Media saya</Link>, lalu muat ulang halaman ini.</span>
          </div>
        ) : panel === "confirm" ? (
          <div ref={panelRef} tabIndex={-1} role="group" aria-labelledby="bl-confirm-title" className="notice bl-panel">
            <Send size={18} aria-hidden="true" />
            <div className="stack-sm">
              <strong id="bl-confirm-title">Berita ini akan tayang di: {names}. Lanjut?</strong>
              <span>Berita langsung bisa dibaca di semua media itu. Anda bisa menariknya lagi nanti, dan isinya tetap tersimpan.</span>
              <div className="actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void publishNow()}>{busy ? "Menerbitkan…" : "Ya, terbitkan"}</button>
                <button type="button" className="btn" disabled={busy} onClick={() => open(null)}>Batal</button>
              </div>
            </div>
          </div>
        ) : panel === "schedule" ? (
          <div ref={panelRef} tabIndex={-1} role="group" aria-labelledby="bl-schedule-title" className="notice bl-panel">
            <CalendarClock size={18} aria-hidden="true" />
            <div className="stack-sm">
              <strong id="bl-schedule-title">Pilih kapan berita ini tayang</strong>
              <div className="field bl-datetime">
                <label htmlFor="bl-when">Tanggal dan jam tayang</label>
                <input id="bl-when" type="datetime-local" value={when} onChange={(event) => { setWhen(event.target.value); setWhenError(""); }} aria-invalid={Boolean(whenError)} aria-describedby={whenError ? "bl-when-error" : "bl-when-help"} />
                {whenError
                  ? <span id="bl-when-error" role="alert" className="field-error">{whenError}</span>
                  : <span id="bl-when-help" className="field-help">{zoneName ? `Waktu mengikuti perangkat Anda, yaitu ${zoneName}.` : "Waktu mengikuti zona waktu perangkat Anda."}</span>}
              </div>
              <span>Pada waktu itu berita tayang otomatis di: {names}.</span>
              <div className="actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void publishLater()}>{busy ? "Menjadwalkan…" : "Jadwalkan tayang"}</button>
                <button type="button" className="btn" disabled={busy} onClick={() => open(null)}>Batal</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="stack-sm">
            <div className="bl-actions">
              <button type="button" className="btn btn-primary" onClick={() => open("confirm")}><Send size={20} aria-hidden="true" />Terbitkan ke {ready.length} media</button>
            </div>
            {blocked.length > 0 && <p className="field-help">{blocked.length} media dilewati karena belum bisa menerima berita. Penjelasannya ada di daftar media di atas.</p>}
          </div>
        )}

        {error && (
          <div role="alert" className="notice notice-error">
            <CircleAlert size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {panel === null && (
          <>
            <hr className="divider" />
            <div className="bl-actions">
              {detail.canEdit && <button type="button" className="btn" onClick={onEdit}><Pencil size={18} aria-hidden="true" />Edit berita</button>}
              {detail.canPublish && ready.length > 0 && <button type="button" className="btn btn-quiet btn-sm" onClick={() => open("schedule")}><CalendarClock size={18} aria-hidden="true" />Jadwalkan…</button>}
            </div>
            {!detail.canEdit && <p className="field-help">Hanya penulis berita, admin, atau pemilik yang bisa mengedit berita ini.</p>}
          </>
        )}
      </section>
    </>
  );
}
