"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerationControls({ briefs, ai }: { briefs: { id: string; workingTitle: string; articlesCount: number }[]; ai: { configured: boolean; mode: string; provider: string | null; model: string | null } }) {
  const router = useRouter();
  const [briefId, setBriefId] = useState(briefs[0]?.id || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!briefId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/articles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "generate", sourceBriefId: briefId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Draf tidak dapat dibuat.");
      const outcomes = result.outcomes as { status: string; title?: string; error?: string }[];
      const created = outcomes.filter((outcome) => outcome.title).length;
      const skipped = outcomes.filter((outcome) => !outcome.title).map((outcome) => outcome.error || outcome.status);
      setMessage(`${created} draf tersimpan dan menunggu tinjauan${skipped.length ? `. ${skipped.length} draf tidak dibuat: ${skipped.join("; ")}` : "."}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draf tidak dapat dibuat.");
    } finally {
      setBusy(false);
    }
  }

  const testMode = ai.mode === "test adapter";
  const aiReady = ai.configured && !testMode;
  const aiLabel = testMode ? "Mode uji aktif" : aiReady ? "Kredensial AI tersedia" : "AI belum disiapkan";

  return <section className="card stack">
    <div className="form-intro"><span className="eyebrow">Persiapan naskah</span><h2>Buat draf untuk media</h2><p className="muted">Pilih brief. Sistem menyiapkan draf untuk tiap media yang dipilih, lalu tim redaksi tetap meninjau sumber dan isinya.</p></div>
    <div className={aiReady ? "notice" : "notice notice-warn"}><strong>{aiLabel}</strong>{ai.provider && ` · ${ai.provider}`} {ai.model && `· ${ai.model}`} {!aiReady && (testMode ? ". Mode uji hanya menghasilkan simulasi, bukan model AI sungguhan. Set AI_TEST_ADAPTER=false di environment dan mulai ulang server untuk memakai AI produksi." : ". Siapkan penyedia AI di Integrasi sebelum membuat draf.")}</div>
    <div className="field"><label htmlFor="draft-source-brief">Pilih brief sumber</label><select className="draft-brief-select" id="draft-source-brief" value={briefId} onChange={(event) => setBriefId(event.target.value)}><option value="">Pilih informasi sumber…</option>{briefs.map((brief) => <option key={brief.id} value={brief.id}>{brief.workingTitle} · {brief.articlesCount} naskah tersimpan</option>)}</select></div>
    {briefs.length === 0 && <div className="muted">Belum ada brief yang dapat digunakan. Tambahkan informasi di halaman Brief sumber.</div>}
    <div className="actions"><button disabled={!briefId || !aiReady || busy} className="btn btn-primary" onClick={generate}>{busy ? "Menyiapkan draf…" : "Buat draf untuk tiap media"}</button></div>
    {message && <div className="notice" role="status">{message}</div>}
    {error && <div className="notice notice-error" role="alert">{error}</div>}
  </section>;
}
