import { db } from "@/lib/db";
import { publishedSnapshotSchema, requestOrigin, resolveSite, xmlEscape } from "@/lib/site";

export async function GET() {
  const site = await resolveSite();
  const origin = await requestOrigin();
  const targets = await db.publicationTarget.findMany({
    where: { domainId: site.domainId, mediaSiteId: site.media.id, status: "PUBLISHED", article: { archivedAt: null, status: "PUBLISHED" } },
    orderBy: { publishedAt: "desc" }, take: 5000, select: { publishedAt: true, approvedSnapshot: true },
  });
  const urls = [
    `<url><loc>${xmlEscape(origin + "/")}</loc></url>`,
    ...site.media.categories.map((c) => `<url><loc>${xmlEscape(`${origin}/kategori/${c.slug}`)}</loc></url>`),
    ...targets.flatMap((t) => {
      const s = publishedSnapshotSchema.safeParse(t.approvedSnapshot);
      return s.success ? [`<url><loc>${xmlEscape(`${origin}/articles/${s.data.slug}`)}</loc>${t.publishedAt ? `<lastmod>${t.publishedAt.toISOString()}</lastmod>` : ""}</url>`] : [];
    }),
  ];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
