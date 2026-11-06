import { visibleArticles } from "@/lib/dashboard";
import { hasNetworkWideScope, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeading } from "@/components/ui";
import PublishActions from "@/components/publish-actions";

export const dynamic = "force-dynamic";

export default async function PublishingPage() {
  const [articles, user] = await Promise.all([visibleArticles(), requireUser()]);
  const networkScope = await hasNetworkWideScope(user.id);
  const canPublish = user.roles.some((assignment) => ["OWNER", "ADMIN", "PUBLISHER"].includes(assignment.role));
  const targets = await db.publicationTarget.findMany({ where: networkScope ? {} : { mediaSite: { mediaScopes: { some: { userId: user.id } } } }, include: { article: { select: { id: true, title: true } }, mediaSite: { select: { id: true, displayName: true } }, domain: { select: { hostname: true } }, attempts: { orderBy: { attemptNumber: "desc" }, take: 3 } }, orderBy: { createdAt: "desc" }, take: 200 });
  const approvedArticles = articles.filter((article) => article.status === "APPROVED");
  const sites = await db.mediaSite.findMany({ where: { id: { in: approvedArticles.map((article) => article.mediaSiteId) } }, include: { domains: { where: { isActive: true, verificationStatus: "VERIFIED" } } } });
  const withDomains = approvedArticles.map((article) => ({ ...article, mediaSite: { displayName: article.mediaSite.displayName, domains: sites.find((site) => site.id === article.mediaSiteId)?.domains.map(({ hostname }) => ({ hostname })) || [] } }));
  return <><PageHeading title="Pusat publikasi" subtitle="Lihat hasil tiap domain tujuan. Naskah yang siap dapat diterbitkan oleh pemilik, admin, atau penerbit."/><section className="card stack"><div className="form-intro"><span className="eyebrow">Kesiapan terbit</span><h2>Ringkasan naskah yang disetujui</h2><p className="muted">Pemeriksaan cepat sebelum publikasi: persetujuan versi terkini dan ketersediaan domain terverifikasi.</p></div>{withDomains.length?<div className="source-list">{withDomains.map((article)=>{const approvedOk=article.status==="APPROVED";const domainsOk=article.mediaSite.domains.length>0;const ready=approvedOk&&domainsOk;return <div key={article.id} className="actions" style={{justifyContent:"space-between"}}><span><strong>{article.title}</strong><br/><small className="muted">{article.mediaSite.displayName} · v{article.versionNumber}</small></span><span className="actions"><span className={ready?"badge":"badge"} style={{background:ready?"#dcfce7":approvedOk?"#fef3c7":"#fee2e2"}}>{ready?"Siap terbit":!approvedOk?"Menunggu persetujuan":domainsOk?"Domain terverifikasi tersedia":"Belum ada domain terverifikasi"}</span></span></div>;})}</div>:<div className="empty">Belum ada naskah berstatus disetujui. Setujui naskah di halaman tinjauan terlebih dahulu.</div>}</section><PublishActions articles={withDomains} targets={targets as never} canPublish={canPublish}/></>;
}
