import { requireUser } from "@/lib/auth";
import { dashboardSnapshot } from "@/lib/dashboard";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const snapshot = await dashboardSnapshot(user.id);
    return Response.json(snapshot, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error);
  }
}
