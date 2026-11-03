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
  const targets = await db.publicationTarget.findMany({ where: networkScope ? {} : { mediaSite: { mediaScopes: { some: { userId: user.id } } } }, include: { article: { select: { id: true, title: true } }, mediaSite: { select: { id: true, displayName: true } }, domain: { select: { hostname: true } }, attempts: { orderBy: { attemptNumber: "desc" }, take: 3 } }, orderBy: { createdAt: "desc" } });
  const approvedArticles = articles.filter((article) => article.status === "APPROVED");
  const sites = await db.mediaSite.findMany({ where: { id: { in: approvedArticles.map((article) => article.mediaSiteId) } }, include: { domains: { where: { isActive: true, verificationStatus: "VERIFIED" } } } });
  const withDomains = approvedArticles.map((article) => ({ ...article, mediaSite: { displayName: article.mediaSite.displayName, domains: sites.find((site) => site.id === article.mediaSiteId)?.domains.map(({ hostname }) => ({ hostname })) || [] } }));
  return <><PageHeading title="Pusat publikasi" subtitle="Lihat hasil tiap domain tujuan. Naskah yang siap dapat diterbitkan oleh pemilik, admin, atau penerbit."/><PublishActions articles={withDomains} targets={targets as never} canPublish={canPublish}/></>;
}
