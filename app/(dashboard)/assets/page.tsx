import Link from "next/link";
import Image from "next/image";
import { CircleAlert } from "lucide-react";
import { visibleMedia, visibleArticles } from "@/lib/dashboard";
import { hasNetworkWideScope, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState, PageHeading } from "@/components/ui";
import AssetUploader from "@/components/asset-uploader";
import AssetPicker from "@/components/asset-picker";
import "@/app/css/assets.css";

export const dynamic = "force-dynamic";

const licenseWords: Record<string, string> = {
  USER_PROVIDED: "Milik sendiri atau izin langsung",
  CC0: "Lisensi terbuka (CC0)",
  CC_BY: "Lisensi terbuka (CC BY), sebut pembuatnya",
  CC_BY_SA: "Lisensi terbuka (CC BY-SA), sebut pembuatnya",
  PUBLIC_DOMAIN: "Domain publik",
  AI_GENERATED: "Ilustrasi buatan AI",
  OTHER: "Izin khusus",
};

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ media?: string }> }) {
  const { media: mediaParam } = await searchParams;
  const [media, articles, user] = await Promise.all([visibleMedia(), visibleArticles(), requireUser()]);
  const canManageAssets = user.roles.some((assignment) => ["OWNER", "ADMIN", "EDITOR"].includes(assignment.role));
  const networkScope = await hasNetworkWideScope(user.id);
  const assets = await db.asset.findMany({ where: { deletedAt: null, ...(networkScope ? {} : { mediaSite: { mediaScopes: { some: { userId: user.id } } } }) }, include: { mediaSite: { select: { displayName: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  const cloudConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const activeMedia = media.find((item) => item.id === mediaParam);
  const shown = activeMedia ? assets.filter((asset) => asset.mediaSiteId === activeMedia.id) : assets;
  const countFor = (mediaId: string) => assets.filter((asset) => asset.mediaSiteId === mediaId).length;

  return <>
    <PageHeading title="Pustaka gambar" subtitle="Gambar untuk naskah Anda, lengkap dengan catatan dari mana gambarnya dan bagaimana izinnya."/>
    {!cloudConfigured && <div className="notice notice-warn" role="status"><CircleAlert size={20} aria-hidden="true"/><span>Penyimpanan gambar belum disiapkan di server, jadi gambar baru belum bisa diunggah. Minta admin mengisi kunci Cloudinary. <Link href="/monitoring">Lihat kesehatan sistem</Link></span></div>}

    {canManageAssets
      ? media.length > 0
        ? <AssetUploader media={media.map(({ id, displayName }) => ({ id, displayName }))} cloudConfigured={cloudConfigured}/>
        : <EmptyState title="Belum ada media" detail="Gambar disimpan per media. Tambahkan media dulu, lalu unggah gambarnya." href="/media" label="Tambah media"/>
      : <div className="notice" role="status">Akun Anda hanya bisa melihat pustaka gambar. Untuk mengunggah atau memasang gambar, minta editor atau admin.</div>}

    <section className="card stack" id="pustaka" aria-labelledby="pustaka-title">
      <div className="stack-sm">
        <h2 id="pustaka-title">Gambar tersimpan</h2>
        <p className="muted">{assets.length > 0 ? `${shown.length} gambar${activeMedia ? ` di ${activeMedia.displayName}` : " di semua media Anda"}.` : "Belum ada gambar di pustaka."}</p>
      </div>
      {media.length > 1 && assets.length > 0 && <nav className="tabs" aria-label="Filter menurut media">
        <Link className="tab" href="/assets#pustaka" aria-current={activeMedia ? undefined : "true"}>Semua media<span className="badge num">{assets.length}</span></Link>
        {media.map((item) => <Link key={item.id} className="tab" href={`/assets?media=${item.id}#pustaka`} aria-current={activeMedia?.id === item.id ? "true" : undefined}>{item.displayName}<span className="badge num">{countFor(item.id)}</span></Link>)}
      </nav>}
      {shown.length === 0
        ? <EmptyState title={assets.length > 0 ? "Media ini belum punya gambar" : "Belum ada gambar"} detail={canManageAssets ? "Unggah gambar pertama lewat formulir di atas." : "Minta editor atau admin mengunggah gambar."} href={assets.length > 0 ? "/assets#pustaka" : undefined} label={assets.length > 0 ? "Lihat semua media" : undefined}/>
        : <ul className="asset-grid">
          {shown.map((asset) => <li className="asset-tile" key={asset.id}>
            <div className="asset-frame"><Image src={asset.secureUrl} alt={asset.altText || asset.caption || asset.originalFilename} fill sizes="(max-width: 40rem) 100vw, (max-width: 60rem) 50vw, 280px"/></div>
            <div className="asset-body stack-sm">
              <strong>{asset.caption || asset.altText || asset.originalFilename}</strong>
              <span className="muted">{asset.mediaSite?.displayName || "Media bersama"}</span>
              <dl className="asset-facts">
                <div><dt>Izin</dt><dd>{licenseWords[asset.licenseType] ?? asset.licenseType}</dd></div>
                {(asset.credit || asset.attributionText) && <div><dt>Kredit</dt><dd>{asset.credit || asset.attributionText}</dd></div>}
                {asset.sourceUrl && <div><dt>Sumber</dt><dd><a href={asset.sourceUrl} target="_blank" rel="noreferrer">{new URL(asset.sourceUrl).hostname}</a></dd></div>}
              </dl>
              <details className="asset-detail"><summary>Detail file</summary><span className="muted num">{asset.width} x {asset.height} px, {Math.round(asset.bytes / 1024)} KB, {asset.format.toUpperCase()}</span></details>
            </div>
          </li>)}
        </ul>}
    </section>

    {canManageAssets && assets.length > 0 && <AssetPicker articles={articles.filter((article) => ["DRAFT", "NEEDS_REVIEW", "APPROVED"].includes(article.status))} assets={assets}/>}
  </>;
}
