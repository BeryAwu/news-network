"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui";

type ArticleOption = { id: string; title: string; mediaSite: { displayName: string; domains: { hostname: string }[] } };
type Target = { id: string; status: string; article: { id: string; title: string }; mediaSite: { displayName: string }; domain: { hostname: string }; scheduledAt: Date | null; publishedAt: Date | null; createdAt: Date; attemptCount: number; lastErrorMessage: string | null; remoteUrl: string | null };

function queueModeLabel(mode: string) {
  if (mode === "bullmq") return "masuk antrean";
  if (mode === "scheduled-needs-worker") return "jadwal tersimpan; worker belum aktif";
  return "diproses langsung";
}
function displayTime(value: Date | null) {
  return value ? new Date(value).toLocaleString("id-ID") : "—";
}

export default function PublishActions({ articles, targets, canPublish }: { articles: ArticleOption[]; targets: Target[]; canPublish: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const eligible = articles.filter((article) => article.mediaSite.domains.length > 0);
  const selectedDomainCount = selected.reduce((count, id) => count + (eligible.find((article) => article.id === id)?.mediaSite.domains.length || 0), 0);
  const failedTargets = targets.filter((target) => target.status === "FAILED");

  async function publish() {
    if (!selected.length) return;
    const schedule = scheduledAt ? new Date(scheduledAt) : null;
    if (schedule && schedule.getTime() <= Date.now()) {
      setError("Pilih waktu di masa depan, atau kosongkan jadwal untuk menerbitkan sekarang.");
      return;
    }
    const action = schedule ? `Jadwalkan ${selected.length} naskah untuk ${selectedDomainCount} domain pada ${schedule.toLocaleString("id-ID")}` : `Terbitkan ${selected.length} naskah ke ${selectedDomainCount} domain sekarang`;
    if (!window.confirm(`${action}? Pastikan semua naskah sudah ditinjau dan disetujui.`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish", articleIds: selected, ...(schedule ? { scheduledAt: schedule.toISOString() } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Publikasi gagal disiapkan.");
      setMessage(`${result.targets.length} tujuan ${queueModeLabel(result.queueMode)}.`);
      setSelected([]);
      setScheduledAt("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publikasi gagal disiapkan.");
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (!failedTargets.length || !window.confirm(`Coba ulang ${failedTargets.length} publikasi yang gagal? Setiap domain akan diproses terpisah.`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "retry", targetIds: failedTargets.map(({ id }) => id) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Publikasi gagal dicoba ulang.");
      setMessage(`${failedTargets.length} publikasi dimasukkan kembali untuk dicoba.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publikasi gagal dicoba ulang.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="stack">
    <section className="card stack">
      <div className="form-intro"><span className="eyebrow">Naskah dan riwayat</span><h2>{canPublish ? "Pilih naskah untuk diterbitkan" : "Riwayat publikasi"}</h2><p className="muted">{canPublish ? "Hanya naskah yang sudah disetujui dan memiliki domain terverifikasi yang bisa dipilih. Tiap domain memiliki hasil publikasi sendiri." : "Anda dapat melihat hasil publikasi untuk media yang ditugaskan. Menjalankan publikasi memerlukan peran penerbit atau administrator."}</p></div>
      {!canPublish ? null : eligible.length > 0 ? eligible.map((article) => <label className="checkline publish-choice" key={article.id}>
        <input type="checkbox" checked={selected.includes(article.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, article.id] : selected.filter((id) => id !== article.id))}/>
        <span className="publish-choice-copy"><strong>{article.title}</strong><small>{article.mediaSite.displayName} · {article.mediaSite.domains.map(({ hostname }) => hostname).join(", ")}</small></span>
      </label>) : <div className="empty publish-empty"><strong>Belum ada naskah yang siap diterbitkan</strong><span>Setujui naskah di halaman tinjauan dan pastikan media memiliki domain yang sudah diverifikasi.</span><a className="btn" href="/editorial">Buka tinjauan naskah</a></div>}

      {canPublish && <><details className="schedule-options"><summary>Atur jadwal (opsional)</summary><div className="field" style={{ marginTop: 13, marginBottom: 0 }}><label htmlFor="publish-schedule">Waktu publikasi menurut zona waktu perangkat ini</label><input id="publish-schedule" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)}/><small className="muted">Jadwal perlu Redis dan worker aktif. Tanpa keduanya, jadwal tercatat tetapi tidak berjalan otomatis.</small></div></details>

      <div className="publish-actions-row"><span className="badge">{selected.length} naskah · {selectedDomainCount} domain</span><button disabled={busy || !selected.length} className="btn btn-primary" onClick={publish}>{busy ? "Menyiapkan…" : scheduledAt ? "Simpan jadwal" : "Terbitkan sekarang"}</button><button disabled={busy || !failedTargets.length} className="btn" onClick={retry}>Coba ulang yang gagal ({failedTargets.length})</button></div>
      {error && <div role="alert" className="notice notice-error">{error}</div>}
      {message && <div role="status" className="notice">{message}</div>}</>}
    </section>

    <section className="stack">
      <div><h2 style={{ margin: 0, fontSize: 18 }}>Riwayat publikasi</h2><p className="muted">Status dan percobaan tiap domain tersimpan terpisah.</p></div>
      <div className="table-wrap"><table><thead><tr><th>Naskah</th><th>Media / domain</th><th>Status</th><th>Diperbarui</th><th>Percobaan</th><th>Pesan / tautan</th></tr></thead><tbody>
        {targets.map((target) => <tr key={target.id}><td>{target.article.title}</td><td>{target.mediaSite.displayName}<div className="muted">{target.domain.hostname}</div></td><td><StatusBadge status={target.status}/></td><td>{displayTime(target.scheduledAt || target.publishedAt || target.createdAt)}</td><td>{target.attemptCount}</td><td>{target.lastErrorMessage || (target.remoteUrl ? <a href={target.remoteUrl} target="_blank" rel="noreferrer">Buka hasil</a> : "Belum ada hasil")}</td></tr>)}
      </tbody></table>{!targets.length && <div className="empty">Belum ada riwayat. Tujuan publikasi akan muncul setelah naskah disetujui.</div>}</div>
    </section>
  </div>;
}
