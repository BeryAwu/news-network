import { db } from "@/lib/db";
import { hasNetworkWideScope } from "@/lib/auth";

export interface MediaStat {
  mediaSiteId: string;
  mediaName: string;
  hostnames: string[];
  publishedTotal: number;
  publishedInRange: number;
  lastPublishedAt: Date | null;
  waiting: number;
  ready: number;
}

export interface PublishedRow {
  publishedAt: Date;
  mediaName: string;
  title: string;
  url: string;
}

export interface ReportRange { from?: Date; to?: Date }

async function visibleMediaWhere(userId: string) {
  return { deletedAt: null, ...((await hasNetworkWideScope(userId)) ? {} : { mediaScopes: { some: { userId } } }) };
}

/** Parses YYYY-MM-DD as a whole Asia/Jakarta day; `end` makes it the last millisecond of that day. */
export function parseReportDate(value: string | null, end = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** One entry per visible media: how many stories are live, how many in the range, and what is waiting. */
export async function mediaStats(userId: string, range: ReportRange = {}): Promise<MediaStat[]> {
  const mediaWhere = await visibleMediaWhere(userId);
  const media = await db.mediaSite.findMany({
    where: mediaWhere,
    select: { id: true, displayName: true, domains: { where: { isActive: true, verificationStatus: "VERIFIED" }, select: { hostname: true } } },
    orderBy: { displayName: "asc" },
  });
  const ids = media.map((m) => m.id);
  const base = { mediaSiteId: { in: ids }, archivedAt: null };
  const rangeFilter = range.from || range.to ? { publishedAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {};
  const [live, inRange, waiting, ready] = await Promise.all([
    db.article.groupBy({ by: ["mediaSiteId"], where: { ...base, status: "PUBLISHED" }, _count: { _all: true }, _max: { publishedAt: true } }),
    db.article.groupBy({ by: ["mediaSiteId"], where: { ...base, status: "PUBLISHED", ...rangeFilter }, _count: { _all: true } }),
    db.article.groupBy({ by: ["mediaSiteId"], where: { ...base, status: { in: ["NEEDS_REVIEW", "IN_REVISION"] } }, _count: { _all: true } }),
    db.article.groupBy({ by: ["mediaSiteId"], where: { ...base, status: "APPROVED" }, _count: { _all: true } }),
  ]);
  const pick = <T extends { mediaSiteId: string }>(rows: T[], id: string) => rows.find((row) => row.mediaSiteId === id);
  return media.map((m) => ({
    mediaSiteId: m.id,
    mediaName: m.displayName,
    hostnames: m.domains.map((d) => d.hostname),
    publishedTotal: pick(live, m.id)?._count._all ?? 0,
    publishedInRange: pick(inRange, m.id)?._count._all ?? 0,
    lastPublishedAt: pick(live, m.id)?._max.publishedAt ?? null,
    waiting: pick(waiting, m.id)?._count._all ?? 0,
    ready: pick(ready, m.id)?._count._all ?? 0,
  }));
}

/** Every live publication (one per article and address), newest first, for the export. */
export async function publishedRows(userId: string, range: ReportRange, mediaIds?: string[]): Promise<PublishedRow[]> {
  const mediaWhere = await visibleMediaWhere(userId);
  const targets = await db.publicationTarget.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { not: null, ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) },
      mediaSite: { ...mediaWhere, ...(mediaIds?.length ? { id: { in: mediaIds } } : {}) },
      article: { archivedAt: null, status: "PUBLISHED" },
    },
    orderBy: { publishedAt: "desc" },
    take: 20000,
    select: { publishedAt: true, remoteUrl: true, approvedSnapshot: true, mediaSite: { select: { displayName: true } } },
  });
  return targets.flatMap((t) => {
    const snapshot = t.approvedSnapshot as { title?: unknown } | null;
    const title = typeof snapshot?.title === "string" ? snapshot.title : "";
    return t.publishedAt && t.remoteUrl ? [{ publishedAt: t.publishedAt, mediaName: t.mediaSite.displayName, title, url: t.remoteUrl }] : [];
  });
}
