import { visibleBriefs, visibleMedia } from "@/lib/dashboard";
import { requireUser } from "@/lib/auth";
import { PageHeading, StatusBadge } from "@/components/ui";
import BriefForm from "@/components/brief-form";
import BriefActions from "@/components/brief-actions";
import FactManager from "@/components/fact-manager";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BriefsPage() {
  const [briefs, media, user] = await Promise.all([visibleBriefs(), visibleMedia(), requireUser()]);
  const canEdit = user.roles.some((assignment) => ["OWNER", "ADMIN", "EDITOR"].includes(assignment.role));
  if (!media.length && canEdit && user.roles.some((assignment) => ["OWNER", "ADMIN"].includes(assignment.role))) redirect("/media?first=1");

  return <>
    <PageHeading title="Brief sumber" subtitle="Catat informasi, referensi, dan media tujuan. Brief ini menjadi dasar naskah yang akan ditinjau sebelum terbit."/>
    {!media.length && <div className="notice notice-warn" style={{ marginBottom: 16 }}>Belum ada media yang bisa Anda akses. Minta pemilik atau administrator newsroom memberi Anda akses.</div>}
    {canEdit && media.length > 0 ? <div className="grid grid-2" style={{ alignItems: "start" }}>
      <BriefForm media={media}/>
      <section className="card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Cara menyiapkan sumber</h2><p className="muted" style={{ lineHeight: 1.6 }}>Tuliskan apa yang Anda ketahui, lalu tambahkan halaman publik yang ingin diperiksa. Pengambilan halaman tidak membuktikan bahwa klaim di dalamnya benar.</p><div className="notice notice-warn">Jika tautan tidak dapat diakses atau isinya masih belum pasti, statusnya akan terlihat pada brief dan perlu diperiksa editor.</div><div style={{ marginTop: 16 }}><strong>{briefs.length}</strong><span className="muted"> brief tersimpan</span></div></section>
    </div> : !canEdit && <div className="notice" style={{ marginBottom: 20 }}>Anda dapat melihat brief untuk media yang ditugaskan. Membuat atau mengubah brief memerlukan peran editor.</div>}

    <section className="stack" style={{ marginTop: 26 }}>
      <div><h2 style={{ margin: 0, fontSize: 18 }}>Brief terbaru</h2><p className="muted">{briefs.length} brief untuk media yang dapat Anda akses.</p></div>
      <div className="table-wrap"><table><thead><tr><th>Topik</th><th>Media</th><th>Tautan sumber</th><th>Naskah</th><th>Status</th><th>Diperbarui</th></tr></thead><tbody>
        {briefs.map((brief) => <tr key={brief.id}>
          <td><strong>{brief.workingTitle}</strong><div className="muted">{brief.narrative.slice(0, 160)}{brief.narrative.length > 160 ? "…" : ""}</div></td>
          <td>{brief.mediaTargets.map((target) => target.mediaSite.displayName).join(", ")}</td>
          <td>{brief.references.length ? brief.references.map((reference) => <div key={reference.id}><a href={reference.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{reference.title || reference.url}</a><div><StatusBadge status={reference.retrievalStatus}/></div></div>) : <span className="muted">Belum ada tautan</span>}</td>
          <td>{brief._count.articles}</td><td><StatusBadge status={brief.status}/></td>
          <td>{brief.updatedAt.toLocaleDateString("id-ID")}{canEdit && <><BriefActions brief={brief}/><FactManager sourceBriefId={brief.id} references={brief.references} facts={brief.facts}/></>}</td>
        </tr>)}
      </tbody></table>{!briefs.length && <div className="empty">{media.length ? "Belum ada brief untuk media ini. Isi formulir di atas untuk memulai." : "Tidak ada brief yang dapat dilihat dari akun ini."}</div>}</div>
    </section>
  </>;
}
