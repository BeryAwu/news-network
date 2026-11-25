import { db } from "@/lib/db";

export class MediaAdminError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

/**
 * Deletes a media for good from the newsroom's point of view, without destroying its history:
 * every story on it is taken down, its articles are archived and dropped from their berita,
 * its domains go offline, and it disappears from every list. Articles, versions and the audit
 * trail stay in the database. The slug and hostnames are renamed so a new media can reuse them.
 */
export async function deleteMedia(actor: { id: string; name: string }, mediaSiteId: string) {
  const media = await db.mediaSite.findFirst({ where: { id: mediaSiteId, deletedAt: null }, include: { domains: { select: { id: true, hostname: true } } } });
  if (!media) throw new MediaAdminError("Media tidak ditemukan atau sudah dihapus.", 404);
  const now = new Date();
  const tag = media.id.slice(-6);
  return db.$transaction(async (tx) => {
    const live = await tx.publicationTarget.updateMany({
      where: { mediaSiteId, status: { in: ["PUBLISHED", "QUEUED", "SCHEDULED", "PUBLISHING", "FAILED"] } },
      data: { status: "CANCELLED", lastErrorCode: "MEDIA_DELETED", lastErrorMessage: `Media dihapus oleh ${actor.name}.` },
    });
    const archived = await tx.article.updateMany({ where: { mediaSiteId, archivedAt: null }, data: { archivedAt: now, status: "ARCHIVED", publishedAt: null } });
    await tx.sourceBriefMedia.deleteMany({ where: { mediaSiteId } });
    for (const domain of media.domains) {
      await tx.domain.update({ where: { id: domain.id }, data: { isActive: false, isCanonical: false, hostname: `dihapus-${tag}-${domain.id.slice(-6)}.${domain.hostname}`.slice(0, 253) } });
    }
    await tx.mediaSite.update({ where: { id: mediaSiteId }, data: { deletedAt: now, status: "DISABLED", slug: `${media.slug}-dihapus-${tag}`.slice(0, 80) } });
    await tx.auditLog.create({ data: { actorUserId: actor.id, mediaSiteId, action: "MEDIA_DELETED", entityType: "MediaSite", entityId: mediaSiteId, metadata: { displayName: media.displayName, slug: media.slug, hostnames: media.domains.map((d) => d.hostname), withdrawn: live.count, articlesArchived: archived.count } } });
    return { withdrawn: live.count, articlesArchived: archived.count };
  });
}
