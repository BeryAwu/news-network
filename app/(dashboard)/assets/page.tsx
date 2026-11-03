import { visibleMedia, visibleArticles } from "@/lib/dashboard";
import { hasNetworkWideScope, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeading, StatusBadge } from "@/components/ui";
import AssetUploader from "@/components/asset-uploader";
import AssetPicker from "@/components/asset-picker";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const [media, articles, user] = await Promise.all([visibleMedia(), visibleArticles(), requireUser()]);
  const canManageAssets = user.roles.some((assignment) => ["OWNER", "ADMIN", "EDITOR"].includes(assignment.role));
  const networkScope = await hasNetworkWideScope(user.id);
  const assets = await db.asset.findMany({ where: { deletedAt: null, ...(networkScope ? {} : { mediaSite: { mediaScopes: { some: { userId: user.id } } } }) }, include: { mediaSite: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } });
  const cloudConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

  return <>
    <PageHeading title="Pustaka gambar" subtitle="Lihat gambar yang dapat digunakan dan catatan izinnya. Unggah hanya gambar yang hak penggunaannya sudah dipastikan."/>
    <div className={cloudConfigured ? "notice" : "notice notice-warn"} style={{ marginBottom: 18 }}><strong>Cloudinary: {cloudConfigured ? "kredensial tersedia" : "perlu disiapkan"}</strong>{!cloudConfigured && " — Unggahan belum tersedia; file gambar tidak disimpan di server aplikasi."}</div>
    {!canManageAssets && <div className="notice" style={{ marginBottom: 16 }}>Peran Anda hanya dapat melihat pustaka gambar. Minta editor atau administrator mengunggah dan menautkan gambar.</div>}
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      {canManageAssets ? <AssetUploader media={media}/> : <div className="card empty">Unggah dan pengaitan gambar hanya tersedia bagi editor dan administrator newsroom.</div>}
      <div className="stack"><div className="notice notice-warn">Gunakan gambar dengan izin yang jelas. Google Images bukan bukti lisensi. Identitas Cloudinary, URL, ukuran dan catatan izin disimpan bersama aset.</div>{canManageAssets && assets.length > 0 && <AssetPicker articles={articles.filter((article) => ["DRAFT", "NEEDS_REVIEW", "APPROVED"].includes(article.status))} assets={assets}/>}</div>
    </div>
    <section className="stack" style={{ marginTop: 26 }}>
      <div><h2 style={{ margin: 0, fontSize: 18 }}>Aset tersimpan</h2><p className="muted">{assets.length} gambar dalam pustaka media yang dapat Anda akses.</p></div>
      {assets.length ? <div className="grid grid-3">{assets.map((asset) => <article className="card" key={asset.id}>
        <Image src={asset.secureUrl} alt={asset.altText} width={asset.width} height={asset.height} sizes="(max-width: 600px) 100vw, (max-width: 950px) 50vw, 33vw" style={{ width: "100%", height: 175, objectFit: "cover", borderRadius: 8 }}/>
        <div style={{ marginTop: 12 }}><strong>{asset.altText || asset.originalFilename}</strong><p className="muted">{asset.mediaSite?.displayName || "Media bersama"} · {asset.width}×{asset.height} · {Math.round(asset.bytes / 1024)} KB</p><div className="actions"><StatusBadge status={asset.licenseType}/>{asset.isAiGenerated && <StatusBadge status="AI_GENERATED"/>}</div>{asset.credit && <p className="muted">Kredit: {asset.credit}</p>}<details className="asset-technical-details"><summary>Detail file</summary><p className="muted">ID Cloudinary: {asset.cloudinaryPublicId}</p></details></div>
      </article>)}</div> : <div className="card empty">Belum ada gambar. Setelah media dibuat dan izin dipastikan, gambar dapat diunggah ke pustaka di atas.</div>}
    </section>
  </>;
}
