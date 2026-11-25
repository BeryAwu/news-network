import { db } from "@/lib/db";
import { normalizeHostname } from "@/lib/security";

/**
 * Caddy on-demand TLS `ask` endpoint: 200 only for hostnames that are an active, verified media domain,
 * so certificates are never issued for arbitrary names pointed at the server.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("domain");
  if (!raw) return new Response("missing domain", { status: 400 });
  let hostname: string;
  try { hostname = normalizeHostname(raw); } catch { return new Response("invalid domain", { status: 400 }); }
  const known = await db.domain.findFirst({ where: { hostname, isActive: true, verificationStatus: "VERIFIED", mediaSite: { status: "ACTIVE", deletedAt: null } }, select: { id: true } });
  return new Response(known ? "ok" : "unknown domain", { status: known ? 200 : 404 });
}
