import { z } from "zod";
import { requireRole, requireSameOrigin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { deleteBlast, editBlast, getBlastDetail } from "@/lib/blasts";
import { blastFailure } from "../route";

type Ctx = { params: Promise<{ id: string }> };

const editSchema = z.object({
  title: z.string().trim().min(8).max(180).optional(),
  excerpt: z.string().trim().min(12).max(500).optional(),
  body: z.string().trim().min(120).max(30000).optional(),
  seoTitle: z.string().max(180).optional(),
  metaDescription: z.string().max(300).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  featuredAssetId: z.string().min(1).nullable().optional(),
  galleryAssetIds: z.array(z.string().min(1)).max(4).optional(),
});

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER", "PUBLISHER");
    return Response.json(await getBlastDetail(user, (await params).id));
  } catch (error) { return blastFailure(error); }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    if (!rateLimit(`blast-edit:${user.id}`, 30, 60 * 1000)) return Response.json({ error: "Terlalu banyak perubahan. Tunggu sebentar." }, { status: 429 });
    const input = editSchema.parse(await request.json());
    return Response.json(await editBlast(user, (await params).id, input));
  } catch (error) { return blastFailure(error); }
}

/** Deletes the berita: off every media first, then hidden from the list. */
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    await deleteBlast(user, (await params).id);
    return Response.json({ ok: true });
  } catch (error) { return blastFailure(error); }
}
