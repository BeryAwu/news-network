import { clearSession, requireSameOrigin } from "@/lib/auth";
export async function POST(request: Request) { requireSameOrigin(request); await clearSession(); return Response.json({ ok: true }); }