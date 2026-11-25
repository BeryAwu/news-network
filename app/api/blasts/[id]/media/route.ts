import { z } from "zod";
import { requireRole, requireSameOrigin } from "@/lib/auth";
import { setBlastMedia } from "@/lib/blasts";
import { blastFailure } from "../../route";

const bodySchema = z.object({ mediaSiteIds: z.array(z.string().min(1)).max(200) });

/** Sets the media that carry this berita. Unchecked media lose it (taken off their site); newly checked ones get it. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    const { mediaSiteIds } = bodySchema.parse(await request.json());
    return Response.json(await setBlastMedia(user, (await params).id, mediaSiteIds));
  } catch (error) { return blastFailure(error); }
}
