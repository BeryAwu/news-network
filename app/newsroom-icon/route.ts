import { newsroomIconSvg } from "@/lib/newsroom-mark";

export function GET() {
  return new Response(newsroomIconSvg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
