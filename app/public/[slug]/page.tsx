import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolvePublicMedia } from "@/lib/tenant";
import { db } from "@/lib/db";
import { normalizeHostname } from "@/lib/security";
export default async function PublicMediaHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const media = await resolvePublicMedia(slug);
  const hostHeader = (await headers()).get("host");
  if (!hostHeader) notFound();
  let hostname: string;
  try { hostname = normalizeHostname(hostHeader.split(":")[0]!); } catch { notFound(); }
  const domain = await db.domain.findFirst({ where: { hostname, mediaSiteId: media.id, isActive: true, verificationStatus: "VERIFIED" }, select: { id: true } });
  if (!domain) notFound();
  const articles = await db.article.findMany({ where: { mediaSiteId: media.id, status: "PUBLISHED", archivedAt: null, publicationTargets: { some: { domainId: domain.id, status: "PUBLISHED" } } }, include: { featuredAsset: true, category: true }, orderBy: { publishedAt: "desc" }, take: 30 });
  const theme = media.themeConfig as { primary?: string };
  return <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 22px" }}><header style={{ borderBottom: "1px solid #e2e8e4", padding: "18px 0", display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center" }}><Link href="/" style={{ fontWeight: 800, fontSize: 24, color: theme.primary || "#176b4a" }}>{media.displayName}</Link><span style={{ color: "#65726c" }}>{media.publisherDisclosure}</span></header><nav style={{ padding: "15px 0", display: "flex", gap: 18 }}>{media.categories.map((category) => <Link key={category.id} href={`#${category.slug}`}>{category.name}</Link>)}</nav><section style={{ padding: "34px 0" }}><h1 style={{ fontSize: 34, marginBottom: 8 }}>{media.displayName}</h1><p style={{ color: "#65726c" }}>{media.profile?.editorialMission || media.description}</p></section>{articles.map((article) => <article key={article.id} style={{ padding: "22px 0", borderTop: "1px solid #e2e8e4", display: "grid", gridTemplateColumns: article.featuredAsset ? "220px 1fr" : "1fr", gap: 22 }}>{article.featuredAsset && <Image src={article.featuredAsset.secureUrl} alt={article.featuredAsset.altText} width={article.featuredAsset.width} height={article.featuredAsset.height} sizes="220px" style={{ width: 220, height: 145, objectFit: "cover", borderRadius: 8 }} />}<div><small style={{ color: "#176b4a" }}>{article.category?.name || media.displayName} · {article.publishedAt?.toLocaleDateString("id-ID")}</small><h2 style={{ fontSize: 22, margin: "8px 0" }}><Link href={`/articles/${article.slug}`}>{article.title}</Link></h2><p style={{ color: "#65726c", lineHeight: 1.6 }}>{article.excerpt}</p></div></article>)}{!articles.length && <div style={{ padding: 50, textAlign: "center", color: "#65726c" }}>Belum ada artikel terbit.</div>}<footer style={{ borderTop: "1px solid #e2e8e4", padding: "24px 0", color: "#65726c", fontSize: 13 }}><p>{media.ownershipDisclosure}</p><p>Byline newsroom: {media.newsroomByline} · Kontak penerbit untuk koreksi dan pertanyaan editorial.</p></footer></main>;
}
