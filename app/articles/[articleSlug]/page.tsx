import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import Image from "next/image";
import { db } from "@/lib/db";
import { normalizeHostname } from "@/lib/security";
import { z } from "zod";
import { editorialEvidenceSnapshotSchema } from "@/lib/editorial-evidence";
const articleSnapshot = z.object({ title: z.string(), slug: z.string(), excerpt: z.string(), body: z.string(), seoTitle: z.string(), metaDescription: z.string(), tags: z.array(z.string()), imageBrief: z.string(), claimsUsed: z.array(z.object({ claimText: z.string(), sourceFactIds: z.array(z.string()) })), uncertainties: z.array(z.string()), featuredAssetId: z.string().nullable(), featuredAsset: z.object({ secureUrl: z.string(), altText: z.string(), caption: z.string(), credit: z.string(), isAiGenerated: z.boolean(), width: z.number(), height: z.number() }).nullable().default(null), ...editorialEvidenceSnapshotSchema.shape });
export default async function PublicDomainArticlePage({ params }: { params: Promise<{ articleSlug: string }> }) {
  const { articleSlug } = await params;
  const hostHeader = (await headers()).get("host");
  if (!hostHeader) notFound();
  let hostname: string;
  try { hostname = normalizeHostname(hostHeader.split(":")[0]!); } catch { notFound(); }
  const domain = await db.domain.findFirst({ where: { hostname, isActive: true, verificationStatus: "VERIFIED", mediaSite: { status: "ACTIVE" } }, include: { mediaSite: true } });
  if (!domain) notFound();
  const target = await db.publicationTarget.findFirst({ where: { domainId: domain.id, status: "PUBLISHED", approvedSnapshot: { path: ["slug"], equals: articleSlug } }, include: { assets: { where: { role: "FEATURED" }, include: { asset: true } } } });
  if (!target) notFound();
  const snapshot = articleSnapshot.parse(target.approvedSnapshot);
  const asset = snapshot.featuredAsset;
  const theme = domain.mediaSite.themeConfig as { primary?: string };
  return <main className="article-content"><Link href="/" style={{ color: theme.primary || "#176b4a", fontWeight: 700 }}>{domain.mediaSite.displayName}</Link><div style={{ marginTop: 30, color: theme.primary || "#176b4a", fontSize: 12 }}>{domain.mediaSite.displayName} · {target.publishedAt?.toLocaleDateString("id-ID")}</div><h1>{snapshot.title}</h1><p style={{ fontSize: 19, color: "#65726c" }}>{snapshot.excerpt}</p>{asset && <figure style={{ margin: "28px 0" }}><Image src={asset.secureUrl} alt={asset.altText} width={asset.width} height={asset.height} sizes="(max-width: 760px) 100vw, 760px"/>{(asset.caption || asset.credit) && <figcaption style={{ color: "#65726c", fontSize: 12, marginTop: 7 }}>{asset.caption} {asset.credit}{asset.isAiGenerated && " · Ilustrasi generatif AI"}</figcaption>}</figure>}<div>{snapshot.body.split(/\n\s*\n/).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}</div>{snapshot.claimsUsed.length>0&&<section style={{marginTop:26}}><h2 style={{fontSize:18}}>Dasar klaim</h2><ul>{snapshot.claimsUsed.map((claim,index)=><li key={`${claim.claimText}-${index}`}><p>{claim.claimText}</p>{claim.sourceFactIds.length?claim.sourceFactIds.map((factId)=>{const fact=snapshot.sourceFacts.find((item)=>item.id===factId);const source=fact?.sourceReferenceId?snapshot.sourceReferences.find((item)=>item.id===fact.sourceReferenceId):undefined;return <span key={factId} className="badge">{fact?.supportStatus||"UNVERIFIED"}{source&&<> · <a href={/^https?:\/\//i.test(source.url) ? source.url : undefined} target="_blank" rel="noreferrer">{source.publisherName||source.title||source.url}</a></>}</span>;}):<span className="badge">Narasi pengguna · belum diverifikasi independen</span>}</li>)}</ul></section>}{snapshot.sourceReferences.length>0&&<section style={{marginTop:30}}><h2 style={{fontSize:18}}>Referensi</h2><ul>{snapshot.sourceReferences.map((source)=><li key={source.id}><a href={/^https?:\/\//i.test(source.url) ? source.url : undefined} target="_blank" rel="noreferrer">{source.title||source.url}</a>{source.publisherName&&` — ${source.publisherName}`}</li>)}</ul></section>}<div style={{ marginTop: 35, paddingTop: 20, borderTop: "1px solid #e2e8e4", color: "#65726c", fontSize: 13 }}>Oleh {domain.mediaSite.newsroomByline}{domain.mediaSite.publisherDisclosure && <p>{domain.mediaSite.publisherDisclosure}</p>}{domain.mediaSite.ownershipDisclosure && <p>{domain.mediaSite.ownershipDisclosure}</p>}Diterbitkan {target.publishedAt?.toLocaleString("id-ID")}</div></main>;
}
