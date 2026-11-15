import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { getBlastDetail } from "@/lib/blasts";
import { AUTHOR_TOKEN_PARAM, signAuthorToken } from "@/lib/author-link";
import { blastFailure } from "../../route";

/**
 * Opens the live article of one media. The author (or an admin) is sent with a 2-minute signed token that the media site
 * turns into its own cookie, so the Edit button shows there. The destination comes from the stored publication, never from the request.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const detail = await getBlastDetail(user, (await params).id);
    const mediaId = new URL(request.url).searchParams.get("media");
    const row = detail.media.find((m) => m.mediaSiteId === mediaId) ?? detail.media.find((m) => m.publication?.url);
    const live = row?.publication?.status === "PUBLISHED" ? row.publication.url : null;
    if (!live) return new Response("Berita ini belum tayang di media itu.", { status: 404 });
    const target = new URL(live);
    if (detail.canEdit) target.searchParams.set(AUTHOR_TOKEN_PARAM, await signAuthorToken(user.id, target.host, "2m"));
    return NextResponse.redirect(target, 302);
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) return NextResponse.redirect(new URL("/login", request.url), 302);
    return blastFailure(error);
  }
}
