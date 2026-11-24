import { markSvg } from "@/lib/logo-mark";
import { requestHostname, resolveSite } from "@/lib/site";
import { newsroomIconSvg } from "@/lib/newsroom-mark";

/** The tab icon of a media site: its logo mark with its first letter, in its own colour. Unknown hosts get the neutral Newsroom icon. */
export async function GET() {
  const headers = { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=3600" };
  if (!(await requestHostname())) return new Response(newsroomIconSvg, { headers });
  try {
    const site = await resolveSite();
    return new Response(markSvg(site.theme.primary, site.media.displayName), { headers });
  } catch {
    return new Response(newsroomIconSvg, { headers });
  }
}
