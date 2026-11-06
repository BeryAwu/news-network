"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ArticleStatus } from "@prisma/client";
import { editorialEvidenceSnapshotSchema } from "@/lib/editorial-evidence";

type Article = {
  id: string;
  status: ArticleStatus;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  seoTitle: string;
  metaDescription: string;
  tags: string[];
  imageBrief: string;
  featuredAssetId: string | null;
  versionNumber: number;
  mediaSite: { id: string; displayName: string; writingSkills: { skill: { id: string; slug: string; name: string; description: string } }[] };
  sourceBrief: {
    workingTitle: string;
    narrative: string;
    references: { id: string; url: string; title: string; retrievalStatus: string; publisherName: string; excerpt: string | null }[];
    facts: { id: string; claimText: string; supportStatus: string; evidenceNote: string; sourceReferenceId: string | null; sourceReference: { id: string; title: string; url: string } | null }[];
  };
  versions: { versionNumber: number; title: string; createdAt: Date; changeType: string; changeSummary: string }[];
  reviews: { decision: string; notes: string; createdAt: Date; articleVersionId: string | null; evidenceSnapshot: unknown }[];
};
type ActionMode = "editor" | "reviewer" | "both" | "viewer";
type AiStatus = { configured: boolean; mode: string; provider: string | null; model: string | null };

export function EditorialActions({ article, mode, ai, skills }: { article: Article; mode: ActionMode; ai: AiStatus; skills: { id: string; slug: string; name: string; description: string; enabled: boolean }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [skillBusy, setSkillBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [skillsState, setSkillsState] = useState(skills);
  const canEdit = mode === "editor" || mode === "both";
  const canReview = mode === "reviewer" || mode === "both";
  const editable = canEdit && article.status !== "PUBLISHED" && article.status !== "REJECTED";
  const testMode = ai.mode === "test adapter";

  async function toggleSkill(skillId: string, enabled: boolean) {
    setSkillBusy(skillId);
    setError("");
    try {
      const response = await fetch("/api/skills", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mediaSiteId: article.mediaSite.id, skillId, enabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Perubahan skill gagal disimpan.");
      setSkillsState((current) => current.map((skill) => skill.id === skillId ? { ...skill, enabled } : skill));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perubahan skill gagal disimpan.");
    } finally {
      setSkillBusy(null);
    }
  }

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Aksi gagal.");
      if (payload.action === "revise") {
        setMessage(testMode
          ? "Mode uji aktif: revisi tidak memakai model AI, hasil hanyalah simulasi. Matikan AI_TEST_ADAPTER untuk memakai AI sungguhan."
          : `Revisi tersimpan. Bukalah "Lihat naskah" untuk melihat hasil versi terbaru.`);
      } else if (payload.action === "edit") {
        setMessage("Versi baru tersimpan. Bukalah \"Lihat naskah\" untuk melihat hasilnya.");
      } else {
        setMessage("Perubahan berhasil disimpan.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aksi gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function edit(data: FormData) {
    await act({
      action: "edit",
      articleId: article.id,
      title: data.get("title"),
      slug: data.get("slug"),
      excerpt: data.get("excerpt"),
      body: data.get("body"),
      seoTitle: data.get("seoTitle"),
      metaDescription: data.get("metaDescription"),
      tags: String(data.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
      imageBrief: data.get("imageBrief"),
      featuredAssetId: article.featuredAssetId,
    });
  }

  function review(decision: "APPROVED" | "NEEDS_CHANGES" | "REJECTED") {
    const notes = (document.getElementById(`notes-${article.id}`) as HTMLTextAreaElement).value;
    void act({ action: "review", articleId: article.id, decision, notes });
  }

  return (
    <div className="editorial-sections">
      <details className="editorial-section" name={`editorial-${article.id}`}>
        <summary><span>Lihat naskah</span><span className="editorial-section-hint">Judul, ringkasan, isi</span></summary>
        <div className="editorial-section-content">
          <div className="notice">
            Status: <strong>{article.status}</strong> · Media: <strong>{article.mediaSite.displayName}</strong>
            {!article.sourceBrief.narrative.trim() && <span> · <span className="badge" style={{ background: "#fef3c7" }}>Draf dari tema — belum diverifikasi</span></span>}
          </div>
          <h3 className="editorial-preview-title">{article.title}</h3>
          <p className="muted">{article.excerpt}</p>
          <div className="editorial-body">{article.body}</div>
        </div>
      </details>

      <details className="editorial-section" name={`editorial-${article.id}`}>
        <summary><span>Sumber &amp; klaim</span><span className="editorial-section-hint">{article.sourceBrief.references.length} sumber · {article.sourceBrief.facts.length} klaim</span></summary>
        <div className="editorial-section-content">
          <h3>Sumber</h3>
          <div className="source-list">
            {article.sourceBrief.references.map((reference) => (
              <div key={reference.id}>
                <a href={reference.url} target="_blank" rel="noreferrer">{reference.title || reference.url}</a> <span className="badge">{reference.retrievalStatus}</span>
                <div className="muted">{reference.publisherName} · {reference.excerpt?.slice(0, 320)}</div>
              </div>
            ))}
            {!article.sourceBrief.references.length && <div className="muted">Belum ada tautan sumber.</div>}
          </div>
          <h3 className="editorial-subheading">Peta klaim</h3>
          <div className="source-list">
            {article.sourceBrief.facts.map((fact) => (
              <div key={fact.id}>
                <span className="badge">{fact.supportStatus}</span> <strong>{fact.claimText}</strong>
                <div className="muted">{fact.sourceReference ? <a href={fact.sourceReference.url} target="_blank" rel="noreferrer">{fact.sourceReference.title || fact.sourceReference.url}</a> : "Narasi yang diberikan pengguna"} · {fact.evidenceNote || "Tanpa catatan evidence."}</div>
              </div>
            ))}
            {!article.sourceBrief.facts.length && <div className="notice notice-warn">Belum ada peta klaim redaksi. Periksa narasi dan sumber sebelum menyetujui.</div>}
          </div>
        </div>
      </details>

      {editable && <details className="editorial-section" name={`editorial-${article.id}`}>
        <summary><span>Edit naskah manual</span><span className="editorial-section-hint">Menyimpan sebagai versi baru</span></summary>
        <form action={edit} className="editorial-section-content">
          <div className="field"><label htmlFor={`title-${article.id}`}>Judul</label><input id={`title-${article.id}`} name="title" defaultValue={article.title} minLength={8} maxLength={180} required /></div>
          <div className="field"><label htmlFor={`slug-${article.id}`}>Slug</label><input id={`slug-${article.id}`} name="slug" defaultValue={article.slug} /></div>
          <div className="field"><label htmlFor={`excerpt-${article.id}`}>Ringkasan</label><textarea id={`excerpt-${article.id}`} name="excerpt" defaultValue={article.excerpt} minLength={12} maxLength={500} required /></div>
          <div className="field"><label htmlFor={`body-${article.id}`}>Isi artikel (teks biasa dengan baris baru)</label><textarea id={`body-${article.id}`} name="body" defaultValue={article.body} minLength={120} maxLength={30000} required style={{ minHeight: 280 }} /></div>
          <div className="grid grid-2">
            <div className="field"><label htmlFor={`seo-${article.id}`}>SEO title</label><input id={`seo-${article.id}`} name="seoTitle" defaultValue={article.seoTitle} /></div>
            <div className="field"><label htmlFor={`meta-${article.id}`}>Meta description</label><input id={`meta-${article.id}`} name="metaDescription" defaultValue={article.metaDescription} /></div>
          </div>
          <div className="field"><label htmlFor={`tags-${article.id}`}>Tag (pisahkan dengan koma)</label><input id={`tags-${article.id}`} name="tags" defaultValue={article.tags.join(", ")} /></div>
          <div className="field"><label htmlFor={`image-${article.id}`}>Brief ilustrasi</label><input id={`image-${article.id}`} name="imageBrief" defaultValue={article.imageBrief} /></div>
          <button disabled={busy} className="btn btn-primary">Simpan versi baru</button>
        </form>
      </details>}

      {editable && <details className="editorial-section" name={`editorial-${article.id}`}>
        <summary><span>Revisi dengan AI</span><span className="editorial-section-hint">Membuat versi baru</span></summary>
        <div className="editorial-section-content">
          <div className={testMode ? "notice notice-warn" : ai.configured ? "notice" : "notice notice-warn"} style={{ marginBottom: 14 }}>
            <strong>{testMode ? "Mode uji aktif" : ai.configured ? "AI tersedia" : "AI belum siap"}</strong>
            {" · "}{ai.provider || "penyedia belum dipilih"}{ai.model ? ` · ${ai.model}` : ""}
            {testMode
              ? ". Klik revisi hanya membuat simulasi, bukan mengganti cara kerja AI. Untuk memakai model sungguhan, set AI_TEST_ADAPTER=false lalu mulai ulang server."
              : ai.configured
                ? ". Model akan diminta menghasilkan versi baru sesuai instruksi. Periksa hasilnya di \"Lihat naskah\"."
                : ". Isi AI_PROVIDER dan AI_API_KEY di environment, lalu mulai ulang server."}
          </div>
          <div className="field"><label htmlFor={`revise-${article.id}`}>Apa yang perlu diubah?</label><textarea id={`revise-${article.id}`} placeholder="Contoh: Ringkas pembukaan tanpa mengubah fakta." /></div>
          <button disabled={busy} className="btn" onClick={() => {
            const instruction = (document.getElementById(`revise-${article.id}`) as HTMLTextAreaElement).value;
            if (!instruction.trim()) { setError("Instruksi revisi wajib diisi."); return; }
            void act({ action: "revise", articleId: article.id, instruction });
          }}>Minta revisi AI</button>
        </div>
      </details>}
      {canEdit && <details className="editorial-section" name={`editorial-${article.id}`}>
        <summary><span>Gaya penulisan AI</span><span className="editorial-section-hint">{skillsState.filter((skill) => skill.enabled).map((skill) => skill.name).join(", ") || "Tidak ada skill aktif"}</span></summary>
        <div className="editorial-section-content">
          <p className="muted">Skill menambah panduan gaya pada prompt AI. Saklar di sini berlaku untuk media <strong>{article.mediaSite.displayName}</strong> dan juga dapat diubah di menu Kelola media.</p>
          <div className="stack" style={{ gap: 10 }}>
            {skillsState.map((skill) => (
              <label key={skill.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" checked={skill.enabled} disabled={skillBusy === skill.id} onChange={(event) => { void toggleSkill(skill.id, event.target.checked); }} style={{ marginTop: 3 }} />
                <span><strong>{skill.name}</strong><span className="muted" style={{ display: "block", fontSize: 13 }}>{skill.description}</span></span>
              </label>
            ))}
            {!skillsState.length && <div className="muted">Belum ada skill tersedia untuk media ini.</div>}
          </div>
        </div>
      </details>}

      <details className="editorial-section" name={`editorial-${article.id}`}>
        <summary><span>Riwayat versi &amp; review</span><span className="editorial-section-hint">Versi {article.versionNumber} · {article.reviews.length} review</span></summary>
        <div className="editorial-section-content">
          <h3>Riwayat versi</h3>
          <div className="source-list">
            {article.versions.map((version) => (
              <div key={version.versionNumber} className="editorial-version-row">
                <span className="badge">v{version.versionNumber} · {version.changeType}</span>
                <span className="muted">{version.changeSummary || version.title}</span>
                {canEdit && article.status !== "PUBLISHED" && version.versionNumber !== article.versionNumber && <button className="btn" disabled={busy} onClick={() => void act({ action: "restore", articleId: article.id, versionNumber: version.versionNumber })}>Pulihkan</button>}
              </div>
            ))}
            {!article.versions.length && <div className="muted">Belum ada riwayat versi.</div>}
          </div>
          <h3 className="editorial-subheading">Catatan review</h3>
          <div className="source-list">
            {article.reviews.map((item, index) => {
              const evidence = editorialEvidenceSnapshotSchema.safeParse(item.evidenceSnapshot).data;
              return (
                <div className="notice" key={`${item.articleVersionId || "review"}-${index}`}>
                  <strong>{item.decision}</strong> · {item.articleVersionId || "versi tidak diketahui"} · {new Date(item.createdAt).toLocaleString("id-ID")}
                  <div>{item.notes || "Tanpa catatan."}</div>
                  <details className="editorial-evidence-details">
                    <summary>Evidence saat review ({evidence?.sourceFacts.length || 0} klaim, {evidence?.sourceReferences.length || 0} sumber)</summary>
                    <div className="source-list">
                      {evidence?.sourceFacts.map((fact) => <div key={fact.id}><span className="badge">{fact.supportStatus}</span> {fact.claimText}<div className="muted">{fact.evidenceNote || "Tanpa catatan evidence."}</div></div>)}
                      {evidence?.sourceReferences.map((reference) => <div key={reference.id}><a href={reference.url} target="_blank" rel="noreferrer">{reference.title || reference.url}</a><div className="muted">{reference.publisherName} · diambil {reference.retrievedAt ? new Date(reference.retrievedAt).toLocaleString("id-ID") : "waktu tidak tercatat"}</div></div>)}
                    </div>
                  </details>
                </div>
              );
            })}
            {!article.reviews.length && <div className="muted">Belum ada keputusan review.</div>}
          </div>
        </div>
      </details>

      {canReview && article.status === "NEEDS_REVIEW" && <details className="editorial-section" name={`editorial-${article.id}`}>
        <summary><span>Tinjau &amp; beri keputusan</span><span className="editorial-section-hint">Setujui, minta perubahan, atau tolak</span></summary>
        <div className="editorial-section-content">
          <div className="field"><label htmlFor={`notes-${article.id}`}>Catatan reviewer</label><textarea id={`notes-${article.id}`} placeholder="Sertakan alasan penolakan atau perubahan yang diminta." /></div>
          <div className="actions">
            <button disabled={busy} className="btn btn-primary" onClick={() => review("APPROVED")}>Setujui</button>
            <button disabled={busy} className="btn" onClick={() => review("NEEDS_CHANGES")}>Minta perubahan</button>
            <button disabled={busy} className="btn btn-danger" onClick={() => review("REJECTED")}>Tolak</button>
          </div>
        </div>
      </details>}

      {error && <div role="alert" className="notice notice-error">{error}</div>}
      {message && <div role="status" className="notice">{message}</div>}
    </div>
  );
}

export function BulkApproval({ articles }: { articles: Article[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const eligible = articles.filter((article) => article.status === "NEEDS_REVIEW");

  async function approve() {
    if (!selected.length) return;
    if (!window.confirm(`Setujui ${selected.length} artikel yang dipilih? Periksa setiap naskah sebelum konfirmasi.`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "bulk-approve", articleIds: selected, confirmation: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Bulk approval gagal.");
      setSelected([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk approval gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <div className="actions"><strong>Pilih artikel yang sudah ditinjau untuk persetujuan batch</strong><span className="badge">{selected.length} dipilih</span><button disabled={!selected.length || busy} className="btn btn-primary" onClick={approve}>Setujui pilihan…</button></div>
      {eligible.map((article) => <label className="checkline" key={article.id}><input type="checkbox" checked={selected.includes(article.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, article.id] : selected.filter((id) => id !== article.id))} /><span><strong>{article.title}</strong><br /><small className="muted">{article.mediaSite.displayName} · {article.status}</small></span></label>)}
      {!eligible.length && <div className="muted">Tidak ada artikel yang menunggu review.</div>}
      {error && <div className="notice notice-error">{error}</div>}
    </div>
  );
}
