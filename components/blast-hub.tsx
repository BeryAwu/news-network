"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CircleAlert, CircleCheck, ExternalLink, LoaderCircle, PenLine } from "lucide-react";
import { PageHeading, StatusBadge } from "@/components/ui";
import BlastDraftView from "@/components/blast-draft-view";
import BlastEditForm from "@/components/blast-edit-form";
import BlastResultView from "@/components/blast-result-view";
import { BlastHubSkeleton } from "@/components/blast-skeletons";
import { OriginalNarrative } from "@/components/blast-preview";
import { callApi, formatWhen, messageOf, statusInfo } from "@/components/blast-format";
import type { BlastContent, BlastDetail } from "@/lib/blast-types";

type Skipped = { mediaName: string; reason: string };
type WithContent = BlastDetail & { content: BlastContent };

const POLL_MS = 4000;
const loadFallback = "Berita belum bisa dimuat. Periksa koneksi internet, lalu coba lagi.";

function hasContent(detail: BlastDetail): detail is WithContent {
  return detail.content !== null;
}

function headingFor(detail: BlastDetail, editing: boolean) {
  const title = detail.content?.title ?? "";
  if (editing) return { title: "Edit berita", subtitle: "Ubah isi berita, lalu simpan. Satu perubahan berlaku untuk semua media." };
  switch (detail.status) {
    case "GENERATING": return { title: "Berita sedang ditulis", subtitle: "AI sedang menulis dari narasi Anda." };
    case "FAILED": return { title: "Berita belum jadi", subtitle: "AI tidak berhasil menulis berita ini." };
    case "DRAFT": return { title: "Periksa berita ini", subtitle: "Baca, ubah kalau perlu, lalu terbitkan ke semua media sekaligus." };
    case "SCHEDULED": return { title: "Berita terjadwal", subtitle: title };
    case "PUBLISHED":
    case "PARTIAL": return { title: "Hasil penerbitan", subtitle: title };
    default: return { title: "Berita lama", subtitle: title };
  }
}

export default function BlastHub({ id }: { id: string }) {
  const [detail, setDetail] = useState<BlastDetail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [flash, setFlash] = useState("");
  const [skipped, setSkipped] = useState<Skipped[]>([]);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryError, setRetryError] = useState("");
  /** Bumped whenever an action returns fresh data, so a slower poll that started earlier cannot overwrite it. */
  const version = useRef(0);
  const base = `/api/blasts/${encodeURIComponent(id)}`;

  const load = useCallback(async (signal?: AbortSignal) => {
    const started = version.current;
    try {
      const data = await callApi<BlastDetail>(`/api/blasts/${encodeURIComponent(id)}`, loadFallback, { signal });
      if (signal?.aborted || started !== version.current) return;
      setDetail(data);
      setProblem(null);
    } catch (error) {
      if (signal?.aborted || started !== version.current) return;
      setProblem(messageOf(error, loadFallback));
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    callApi<BlastDetail>(`/api/blasts/${encodeURIComponent(id)}`, loadFallback, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setDetail(data);
        setProblem(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setProblem(messageOf(error, loadFallback));
      });
    return () => controller.abort();
  }, [id]);

  const polling = detail !== null && (detail.status === "GENERATING" || detail.media.some((item) => item.publication?.status === "QUEUED" || item.publication?.status === "PUBLISHING"));
  useEffect(() => {
    if (!polling) return;
    const controller = new AbortController();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(controller.signal); }, POLL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [polling, load]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [editing]);

  function apply(next: BlastDetail) {
    version.current += 1;
    setDetail(next);
    setProblem(null);
  }

  async function publish(scheduledAt?: string): Promise<string | null> {
    setBusy(true);
    try {
      const result = await callApi<{ detail: BlastDetail; skipped?: Skipped[] }>(`${base}/publish`, "Berita belum bisa diterbitkan. Coba lagi sebentar lagi. Kalau tetap gagal, hubungi admin.", { method: "POST", body: scheduledAt ? { scheduledAt } : {} });
      apply(result.detail);
      setSkipped(result.skipped ?? []);
      setScheduledFor(scheduledAt ?? null);
      setFlash("");
      window.scrollTo({ top: 0 });
      return null;
    } catch (error) {
      return messageOf(error, "Berita belum bisa diterbitkan. Coba lagi sebentar lagi. Kalau tetap gagal, hubungi admin.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish(): Promise<string | null> {
    setBusy(true);
    try {
      apply(await callApi<BlastDetail>(`${base}/unpublish`, "Berita belum bisa ditarik. Coba lagi sebentar lagi.", { method: "POST" }));
      setSkipped([]);
      setScheduledFor(null);
      setFlash("Berita sudah ditarik dari semua media. Isinya tetap tersimpan. Anda bisa mengeditnya atau menerbitkannya lagi.");
      window.scrollTo({ top: 0 });
      return null;
    } catch (error) {
      return messageOf(error, "Berita belum bisa ditarik. Coba lagi sebentar lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setBusy(true);
    setRetryError("");
    setFlash("");
    try {
      await callApi<{ ok: boolean }>(`${base}/retry`, "Berita belum bisa ditulis ulang. Coba lagi sebentar lagi.", { method: "POST" });
      await load();
      window.scrollTo({ top: 0 });
    } catch (error) {
      setRetryError(messageOf(error, "Berita belum bisa ditulis ulang. Coba lagi sebentar lagi."));
    } finally {
      setBusy(false);
    }
  }

  function saved(next: BlastDetail) {
    apply(next);
    setEditing(false);
    const text = next.status === "PUBLISHED" || next.status === "PARTIAL"
      ? "Perubahan tersimpan dan sudah tayang di semua media. Alamat berita di web tidak berubah."
      : next.status === "SCHEDULED"
        ? "Perubahan tersimpan. Berita tayang sesuai jadwal dengan isi yang baru."
        : "Perubahan tersimpan. Baca lagi beritanya, lalu terbitkan.";
    setFlash(text);
  }

  const back = (
    <Link className="btn btn-quiet btn-sm bl-back" href="/blasts"><ChevronLeft size={18} aria-hidden="true" />Kembali ke Daftar berita</Link>
  );

  if (!detail) {
    if (!problem) return <BlastHubSkeleton />;
    return (
      <div className="bl-column">
        {back}
        <PageHeading title="Berita tidak bisa dibuka" />
        <div role="alert" className="notice notice-error">
          <CircleAlert size={18} aria-hidden="true" />
          <div className="stack-sm">
            <span>{problem}</span>
            <div className="actions">
              <button type="button" className="btn" onClick={() => { setProblem(null); void load(); }}>Coba lagi</button>
              <Link className="btn btn-quiet" href="/blasts">Ke Daftar berita</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const full = hasContent(detail) ? detail : null;
  const canEditNow = full !== null && detail.canEdit && (detail.status === "DRAFT" || detail.status === "PUBLISHED" || detail.status === "PARTIAL" || detail.status === "SCHEDULED");
  const showForm = editing && canEditNow;
  const { title, subtitle } = headingFor(detail, showForm);
  const info = statusInfo[detail.status];

  let body: React.ReactNode;
  if (showForm && full) {
    body = <BlastEditForm blastId={detail.id} content={full.content} live={detail.status !== "DRAFT"} onSaved={saved} onCancel={() => setEditing(false)} />;
  } else if (detail.status === "GENERATING") {
    body = (
      <>
        <section className="card card-soft bl-progress" aria-live="polite">
          <LoaderCircle size={28} className="bl-spin" aria-hidden="true" />
          <div className="stack">
            <div className="stack-sm">
              <h2>Mohon tunggu sebentar</h2>
              <p>AI sedang menulis berita Anda, biasanya 1 sampai 2 menit. Anda boleh meninggalkan halaman ini. Beritanya tetap jadi, dan Anda bisa membukanya lagi dari Daftar berita.</p>
            </div>
            <div className="actions"><Link className="btn" href="/blasts">Kembali ke Daftar berita</Link></div>
          </div>
        </section>
        <OriginalNarrative text={detail.originalNarrative} />
      </>
    );
  } else if (detail.status === "FAILED") {
    const reason = detail.generation?.error ?? "AI tidak berhasil menulis berita ini, dan penyebabnya tidak diketahui.";
    body = (
      <>
        <div role="alert" className="notice notice-error">
          <CircleAlert size={18} aria-hidden="true" />
          <div className="stack-sm">
            <strong>Berita ini gagal dibuat.</strong>
            <span>{reason}</span>
            <span>Tidak ada yang terbit. Topik dan narasi Anda tetap tersimpan, jadi Anda bisa mencoba lagi tanpa mengetik ulang.</span>
          </div>
        </div>
        {retryError && (
          <div role="alert" className="notice notice-error">
            <CircleAlert size={18} aria-hidden="true" />
            <span>{retryError}</span>
          </div>
        )}
        <div className="bl-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void retry()}>
            <LoaderCircle size={18} aria-hidden="true" className={busy ? "bl-spin" : undefined} />
            {busy ? "Mencoba lagi…" : "Coba lagi tulis dengan AI"}
          </button>
          <Link className="btn" href="/briefs">
            <PenLine size={18} aria-hidden="true" />Buat ulang dari nol
          </Link>
        </div>
        <p className="muted">
          <strong>Coba lagi</strong> memakai topik, narasi, dan gaya yang sama, lalu menulis ulang dengan AI.{" "}
          <strong>Buat ulang dari nol</strong> membuka Tulis berita supaya Anda bisa mengubah narasi lebih dulu sebelum menulis.
        </p>
        <OriginalNarrative text={detail.originalNarrative} open />
      </>
    );
  } else if (detail.status === "LEGACY") {
    body = (
      <>
        <div className="notice">
          <CircleAlert size={18} aria-hidden="true" />
          <span>Ini berita lama. Teksnya berbeda di setiap media, jadi halaman ini hanya untuk dilihat. Berita baru memakai satu teks untuk semua media.</span>
        </div>
        <section className="card stack" aria-labelledby="bl-legacy-title">
          <h2 id="bl-legacy-title">Status di setiap media</h2>
          <ul className="bl-rows">
            {detail.media.map((item) => {
              const url = item.publication?.status === "PUBLISHED" ? item.publication.url : null;
              return (
                <li key={item.mediaSiteId}>
                  <div className="bl-row-head">
                    <div className="bl-row-name">
                      <strong>{item.name}</strong>
                      <span className="bl-host">{item.hostname ?? "Alamat situs belum dikonfirmasi"}</span>
                    </div>
                    {item.articleStatus ? <StatusBadge status={item.articleStatus} /> : <span className="badge">Belum ada naskah</span>}
                  </div>
                  {url && (
                    <div className="actions">
                      <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer">Buka di situs<ExternalLink size={16} aria-hidden="true" /></a>
                      <span className="bl-host">{url}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <OriginalNarrative text={detail.originalNarrative} />
      </>
    );
  } else if (full && detail.status === "DRAFT") {
    body = <BlastDraftView detail={full} busy={busy} skipped={skipped} onPublish={publish} onEdit={() => { setFlash(""); setEditing(true); }} />;
  } else if (full) {
    body = <BlastResultView detail={full} busy={busy} scheduledFor={scheduledFor} onPublish={() => publish()} onUnpublish={unpublish} onEdit={() => { setFlash(""); setEditing(true); }} />;
  } else {
    body = (
      <div role="alert" className="notice notice-error">
        <CircleAlert size={18} aria-hidden="true" />
        <span>Isi berita belum tersedia. Muat ulang halaman ini. Kalau tetap kosong, hubungi admin.</span>
      </div>
    );
  }

  return (
    <div className="bl-column">
      {back}
      <PageHeading title={title} subtitle={subtitle} />
      <div className="bl-meta">
        <span className={`badge ${info.badge}`.trim()}>{info.label}</span>
        <span>Penulis: {detail.author.name}</span>
        <span>{formatWhen(detail.createdAt)}</span>
      </div>
      {flash && (
        <div role="status" className="notice notice-success">
          <CircleCheck size={18} aria-hidden="true" />
          <span>{flash}</span>
        </div>
      )}
      {problem && (
        <div role="status" className="notice notice-warn">
          <CircleAlert size={18} aria-hidden="true" />
          <span>Halaman belum bisa diperbarui: {problem} Tampilan di bawah mungkin belum yang terbaru.</span>
        </div>
      )}
      {body}
    </div>
  );
}
