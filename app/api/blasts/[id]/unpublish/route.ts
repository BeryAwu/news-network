import { requireRole, requireSameOrigin } from "@/lib/auth";
import { unpublishBlast } from "@/lib/blasts";
import { blastFailure } from "../../route";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "PUBLISHER");
    return Response.json(await unpublishBlast(user, (await params).id));
  } catch (error) { return blastFailure(error); }
}
