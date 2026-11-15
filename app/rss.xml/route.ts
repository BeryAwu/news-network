import { listPublished, requestOrigin, resolveSite, xmlEscape } from "@/lib/site";

export async function GET() {
  const site = await resolveSite();
  const origin = await requestOrigin();
  const { items } = await listPublished(site, { take: 30 });
  const entries = items.map((i) => `<item><title>${xmlEscape(i.title)}</title><link>${xmlEscape(`${origin}/articles/${i.slug}`)}</link><guid isPermaLink="true">${xmlEscape(`${origin}/articles/${i.slug}`)}</guid>${i.publishedAt ? `<pubDate>${i.publishedAt.toUTCString()}</pubDate>` : ""}${i.category ? `<category>${xmlEscape(i.category.name)}</category>` : ""}<description>${xmlEscape(i.excerpt)}</description></item>`).join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${xmlEscape(site.media.displayName)}</title><link>${xmlEscape(origin + "/")}</link><description>${xmlEscape(site.media.description || site.theme.tagline || site.media.displayName)}</description><language>${xmlEscape(site.media.defaultLocale)}</language>${entries}</channel></rss>`;
  return new Response(body, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
