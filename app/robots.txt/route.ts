import { requestHostname, requestOrigin } from "@/lib/site";
import { db } from "@/lib/db";

export async function GET() {
  const hostname = await requestHostname();
  const origin = await requestOrigin();
  const isPublic = hostname
    ? Boolean(await db.domain.findFirst({ where: { hostname, isActive: true, verificationStatus: "VERIFIED", mediaSite: { status: "ACTIVE" } }, select: { id: true } }))
    : false;
  const body = isPublic
    ? `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, s-maxage=300" } });
}
