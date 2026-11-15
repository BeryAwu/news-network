"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, Download, ExternalLink, FileSpreadsheet, FileText, LoaderCircle, Pencil, RefreshCw } from "lucide-react";
import Link from "next/link";
import BlastCopyLinks from "@/components/blast-copy-links";
import { BlastPreview, OriginalNarrative } from "@/components/blast-preview";
import { formatWhen, publicationInfo } from "@/components/blast-format";
import type { BlastContent, BlastDetail, BlastMedia } from "@/lib/blast-types";

interface Props {
  detail: BlastDetail & { content: BlastContent };
  busy: boolean;
  /** When this person scheduled the publication in this visit, so the banner can name the time. */
  scheduledFor: string | null;
  /** Publishing again retries every media that has not gone live. Resolves to a plain error sentence or null. */
  onPublish: () => Promise<string | null>;
  onUnpublish: () => Promise<string | null>;
  onEdit: () => void;
}

function reasonFor(item: BlastMedia) {
  if (item.publication?.error) return item.publication.error;
  if (!item.canPublish) return item.problem ?? "Media ini belum bisa menerima berita.";
  if (item.publication?.status === "QUEUED" || item.publication?.status === "PUBLISHING") return "Sedang dikirim ke media ini.";
  if (item.publication?.status === "SCHEDULED") return "Menunggu waktu tayang yang dijadwalkan.";
  if (item.publication?.status === "CANCELLED") return "Penerbitan di media ini dibatalkan.";
  return "Berita belum dikirim ke media ini.";
}

/** PUBLISHED, PARTIAL and SCHEDULED: the result, the live links, the downloads, and the follow-up actions. */
export default function BlastResultView({ detail, busy, scheduledFor, onPublish, onUnpublish, onEdit }: Props) {
  const { media, content } = detail;
  const base = `/api/blasts/${encodeURIComponent(detail.id)}`;
  const live = media.filter((item) => item.publication?.status === "PUBLISHED" && item.publication.url);
  const notLive = media.filter((item) => item.publication?.status !== "PUBLISHED");
  const sending = media.some((item) => item.publication?.status === "QUEUED" || item.publication?.status === "PUBLISHING");
  const [confirmPull, setConfirmPull] = useState(false);
  const [pullError, setPullError] = useState("");
  const [retryError, setRetryError] = useState("");

  async function retry() {
    setRetryError("");
    const problem = await onPublish();
    if (problem) setRetryError(problem);
  }

  async function pull() {
    setPullError("");
    const problem = await onUnpublish();
    if (problem) setPullError(problem);
  }

  const scheduledText = scheduledFor ? formatWhen(scheduledFor) : "";

  return (
    <>
      {detail.status === "PUBLISHED" && (
        <div role="status" className="notice notice-success">
          <CircleCheck size={18} aria-hidden="true" />
          <span><strong>Berita Anda sudah tayang di {live.length} media.</strong> Link-nya ada di bawah.</span>
        </div>
      )}
      {detail.status === "PARTIAL" && (
        <div role="status" className="notice notice-warn">
          <CircleAlert size={18} aria-hidden="true" />
          <span><strong>Berita tayang di {live.length} dari {media.length} media.</strong> Media lainnya belum tayang. Penyebabnya ada di bagian Belum tayang di bawah.</span>
        </div>
      )}
      {detail.status === "SCHEDULED" && (
        <div role="status" className="notice">
          <CircleCheck size={18} aria-hidden="true" />
          <span><strong>{scheduledText ? `Berita dijadwalkan tayang pada ${scheduledText}.` : "Berita sudah dijadwalkan."}</strong> Berita tayang otomatis pada waktunya. Link muncul di halaman ini setelah berita tayang.</span>
        </div>
      )}
      {sending && (
        <div role="status" className="notice">
          <LoaderCircle size={18} className="bl-spin" aria-hidden="true" />
          <span>Berita sedang dikirim ke media. Halaman ini diperbarui sendiri, jadi Anda tidak perlu memuat ulang.</span>
        </div>
      )}

      {live.length > 0 && (
        <section className="card stack" aria-labelledby="bl-links-title">
          <h2 id="bl-links-title">Link berita yang sudah tayang</h2>
          <ul className="bl-rows">
            {live.map((item) => (
              <li key={item.mediaSiteId}>
                <div className="bl-row-head">
                  <div className="bl-row-name">
                    <strong>{item.name}</strong>
                    <span className="bl-host">{item.publication?.url}</span>
                  </div>
                  <a className="btn btn-sm" href={`${base}/open?media=${encodeURIComponent(item.mediaSiteId)}`} target="_blank" rel="noreferrer">
                    Buka di situs<ExternalLink size={16} aria-hidden="true" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <hr className="divider" />
          <BlastCopyLinks urls={detail.links.map((link) => link.url)} />
        </section>
      )}

      {live.length > 0 && (
        <section className="card stack" aria-labelledby="bl-downloads-title">
          <h2 id="bl-downloads-title">Unduh hasilnya</h2>
          <div className="bl-download">
            <a className="btn" href={`${base}/links?format=xlsx`}><FileSpreadsheet size={18} aria-hidden="true" />Unduh Excel</a>
            <span className="muted">Tabel berisi nomor, nama media, judul, dan link setiap berita yang tayang.</span>
          </div>
          <div className="bl-download">
            <a className="btn" href={`${base}/report?format=docx`}><FileText size={18} aria-hidden="true" />Unduh laporan Word</a>
            <span className="muted">Laporan berisi nama penulis, tanggal, judul, teks akhir, narasi asli, dan semua link. Bisa Anda sunting lagi.</span>
          </div>
          <div className="bl-download">
            <a className="btn" href={`${base}/report?format=pdf`}><Download size={18} aria-hidden="true" />Unduh laporan PDF</a>
            <span className="muted">Isi laporan yang sama dengan Word, dalam bentuk siap cetak atau kirim.</span>
          </div>
        </section>
      )}

      {notLive.length > 0 && (
        <section className="card stack" aria-labelledby="bl-notlive-title">
          <h2 id="bl-notlive-title">Belum tayang</h2>
          <ul className="bl-rows">
            {notLive.map((item) => {
              const state = item.publication?.status;
              const info = state ? publicationInfo[state] : null;
              const canRetry = detail.canPublish && item.canPublish && (!state || state === "FAILED" || state === "CANCELLED");
              return (
                <li key={item.mediaSiteId}>
                  <div className="bl-row-head">
                    <div className="bl-row-name">
                      <strong>{item.name}</strong>
                      <span className="bl-host">{item.hostname ?? "Alamat situs belum dikonfirmasi"}</span>
                    </div>
                    <span className={`badge ${info?.badge ?? "badge-yellow"}`.trim()}>{info?.label ?? "Belum dikirim"}</span>
                  </div>
                  <p className="bl-reason">
                    <span>{reasonFor(item)}</span>
                    {!item.canPublish && <Link href="/media">Perbaiki di Media saya</Link>}
                  </p>
                  {canRetry && (
                    <div className="actions">
                      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void retry()}><RefreshCw size={16} aria-hidden="true" />{busy ? "Mencoba…" : "Coba lagi"}</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {retryError && (
            <div role="alert" className="notice notice-error">
              <CircleAlert size={18} aria-hidden="true" />
              <span>{retryError}</span>
            </div>
          )}
        </section>
      )}

      <details className="card bl-details">
        <summary>Baca isi berita</summary>
        <div className="bl-details-body"><BlastPreview content={content} authorName={detail.author.name} /></div>
      </details>

      <OriginalNarrative text={detail.originalNarrative} />

      <section className="card stack" aria-labelledby="bl-fix-title">
        <h2 id="bl-fix-title">Ada yang salah di berita?</h2>
        {detail.canEdit ? (
          <>
            <p>Anda bisa memperbaikinya. Perubahan langsung tayang di semua media sekaligus, dan alamat berita di web tidak berubah.</p>
            <div className="bl-actions">
              <button type="button" className="btn" onClick={onEdit}><Pencil size={18} aria-hidden="true" />Edit berita</button>
            </div>
          </>
        ) : (
          <p className="muted">Hanya penulis berita, admin, atau pemilik yang bisa mengedit berita ini. Minta mereka memperbaikinya.</p>
        )}
        {detail.canPublish && (
          <>
            <hr className="divider" />
            {confirmPull ? (
              <div role="group" aria-labelledby="bl-pull-title" className="notice notice-warn bl-panel">
                <CircleAlert size={18} aria-hidden="true" />
                <div className="stack-sm">
                  <strong id="bl-pull-title">Tarik berita ini dari semua media?</strong>
                  <span>Berita hilang dari semua media, dan pembaca tidak bisa membukanya lagi. Isinya tetap tersimpan di sini. Anda bisa mengedit dan menerbitkannya lagi.</span>
                  <div className="actions">
                    <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void pull()}>{busy ? "Menarik…" : "Ya, tarik berita"}</button>
                    <button type="button" className="btn" disabled={busy} onClick={() => { setConfirmPull(false); setPullError(""); }}>Batal</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bl-actions">
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmPull(true)}>Tarik dari semua media</button>
              </div>
            )}
            {pullError && (
              <div role="alert" className="notice notice-error">
                <CircleAlert size={18} aria-hidden="true" />
                <span>{pullError}</span>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
