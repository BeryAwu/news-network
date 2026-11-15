import { resolve4, resolve6 } from "node:dns/promises";
import { requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeHostname } from "@/lib/security";

/** Tells an admin whether a hostname already resolves to this deployment's public IP (a hint, never a gate). */
export async function GET(request: Request) {
  try {
    const user = await requireRole("OWNER", "ADMIN");
    if (!rateLimit(`dns-check:${user.id}`, 20, 60 * 1000)) return Response.json({ error: "Terlalu banyak pengecekan. Tunggu sebentar." }, { status: 429 });
    const raw = new URL(request.url).searchParams.get("hostname") ?? "";
    let hostname: string;
    try { hostname = normalizeHostname(raw); } catch { return Response.json({ error: "Alamat tidak valid." }, { status: 400 }); }
    const expected = process.env.PUBLIC_SERVER_IP?.trim() || null;
    const lookup = async (fn: (name: string) => Promise<string[]>) => { try { return await fn(hostname); } catch { return [] as string[]; } };
    const addresses = [...(await lookup(resolve4)), ...(await lookup(resolve6))];
    return Response.json({ hostname, addresses, expected, pointsHere: expected ? addresses.includes(expected) : null });
  } catch (error) { return jsonError(error); }
}
