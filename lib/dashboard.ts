import { db } from "@/lib/db";
import { canAccessMedia, hasNetworkWideScope, requireUser } from "@/lib/auth";

export async function visibleMedia() {
  const user = await requireUser();
  const globalScope = await hasNetworkWideScope(user.id);
  return db.mediaSite.findMany({ where: { deletedAt: null, ...(globalScope ? {} : { mediaScopes: { some: { userId: user.id } } }) }, include: { profile: true, domains: true, _count: { select: { articles: true, assets: true } } }, orderBy: { createdAt: "desc" } });
}
export async function visibleArticles(options: { mediaSiteId?: string; status?: string; page?: number; limit?: number } = {}) {
  const user = await requireUser();
  if (options.mediaSiteId && !(await canAccessMedia(user.id, options.mediaSiteId))) return [];
  const globalScope = await hasNetworkWideScope(user.id);
  const limit = Math.min(options.limit ?? 100, 200);
  const page = Math.max(options.page ?? 1, 1);
  return db.article.findMany({
    where: { ...(options.mediaSiteId ? { mediaSiteId: options.mediaSiteId } : globalScope ? {} : { mediaSite: { mediaScopes: { some: { userId: user.id } } } }), ...(options.status ? { status: options.status as never } : {}), archivedAt: null },
    include: { mediaSite: { select: { id: true, displayName: true, slug: true, writingSkills: { where: { enabled: true, skill: { isActive: true } }, select: { skill: { select: { id: true, slug: true, name: true, description: true } } } } } }, sourceBrief: { select: { id: true, workingTitle: true, narrative: true, references: { select: { id: true, url: true, title: true, publisherName: true, retrievalStatus: true, excerpt: true } }, facts: { select: { id: true, claimText: true, supportStatus: true, evidenceNote: true, sourceReferenceId: true, sourceReference: { select: { id: true, title: true, url: true } } } } } }, featuredAsset: true, versions: { orderBy: { versionNumber: "desc" }, take: 10 }, reviews: { orderBy: { createdAt: "desc" }, take: 5 }, publicationTargets: { orderBy: { createdAt: "desc" }, take: 20 } },
    orderBy: { updatedAt: "desc" }, skip: (page - 1) * limit, take: limit
  });
}
export async function visibleArticlesPage(options: { mediaSiteId?: string; status?: string; page?: number; limit?: number; q?: string } = {}) {
  const user = await requireUser();
  if (options.mediaSiteId && !(await canAccessMedia(user.id, options.mediaSiteId))) return { items: [], hasMore: false };
  const globalScope = await hasNetworkWideScope(user.id);
  const limit = Math.min(options.limit ?? 100, 200);
  const page = Math.max(options.page ?? 1, 1);
  const q = options.q?.trim();
  const rows = await db.article.findMany({
    where: { ...(options.mediaSiteId ? { mediaSiteId: options.mediaSiteId } : globalScope ? {} : { mediaSite: { mediaScopes: { some: { userId: user.id } } } }), ...(options.status ? { status: options.status as never } : {}), ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { excerpt: { contains: q, mode: "insensitive" } }] } : {}), archivedAt: null },
    include: { mediaSite: { select: { id: true, displayName: true, slug: true, writingSkills: { where: { enabled: true, skill: { isActive: true } }, select: { skill: { select: { id: true, slug: true, name: true, description: true } } } } } }, sourceBrief: { select: { id: true, workingTitle: true, narrative: true, references: { select: { id: true, url: true, title: true, publisherName: true, retrievalStatus: true, excerpt: true } }, facts: { select: { id: true, claimText: true, supportStatus: true, evidenceNote: true, sourceReferenceId: true, sourceReference: { select: { id: true, title: true, url: true } } } } } }, featuredAsset: true, versions: { orderBy: { versionNumber: "desc" }, take: 10 }, reviews: { orderBy: { createdAt: "desc" }, take: 5 }, publicationTargets: { orderBy: { createdAt: "desc" }, take: 20 } },
    orderBy: { updatedAt: "desc" }, skip: (page - 1) * limit, take: limit + 1
  });
  const hasMore = rows.length > limit;
  return { items: rows.slice(0, limit), hasMore };
}
export async function visibleBriefs() {
  const user = await requireUser();
  const globalScope = await hasNetworkWideScope(user.id);
  return db.sourceBrief.findMany({ where: { archivedAt: null, ...(globalScope ? {} : { mediaTargets: { some: { mediaSite: { mediaScopes: { some: { userId: user.id } } } } } }) }, include: { references: true, facts: { include: { sourceReference: { select: { id: true, url: true, title: true } } }, orderBy: { createdAt: "asc" } }, mediaTargets: { include: { mediaSite: true } }, _count: { select: { articles: true } } }, orderBy: { updatedAt: "desc" }, take: 100 });
}

export interface DashboardSnapshot {
  checkedAt: string;
  counts: {
    mediaSites: number;
    activeMediaSites: number;
    verifiedDomains: number;
    approvedArticlesWithoutReadyDomain: number;
    sourceBriefs: number;
    articles: number;
    articleStatuses: Record<string, number>;
    publicationStatuses: Record<string, number>;
  };
  charts: {
    /** Articles published per day, oldest first, Asia/Jakarta days. */
    publishedPerDay: { date: string; count: number }[];
    perMedia: { mediaName: string; published: number; waiting: number; approved: number }[];
  };
  generatingDrafts: number;
  reviewQueue: number;
  latestTargets: {
    id: string;
    articleTitle: string;
    mediaName: string;
    hostname: string;
    status: string;
    updatedAt: string;
    lastErrorMessage: string | null;
  }[];
}

export async function dashboardSnapshot(userId: string): Promise<DashboardSnapshot> {
  const globalScope = await hasNetworkWideScope(userId);
  const mediaWhere = { deletedAt: null, ...(globalScope ? {} : { mediaScopes: { some: { userId } } }) };
  const articleScope = globalScope ? {} : { mediaSite: { mediaScopes: { some: { userId } } } };
  const briefScope = globalScope ? {} : { mediaTargets: { some: { mediaSite: { mediaScopes: { some: { userId } } } } } };
  const targetScope = globalScope ? {} : { mediaSite: { mediaScopes: { some: { userId } } } };
  const approvedArticleDomainScope = {
    mediaSite: {
      ...(globalScope ? {} : { mediaScopes: { some: { userId } } }),
      domains: { none: { isActive: true, verificationStatus: "VERIFIED" as const } }
    }
  };
  const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);
  const visibleMediaIds = globalScope ? null : (await db.mediaAccess.findMany({ where: { userId }, select: { mediaSiteId: true } })).map((row) => row.mediaSiteId);
  const [mediaSites, activeMediaSites, verifiedDomains, approvedArticlesWithoutReadyDomain, sourceBriefs, articleGroups, publicationGroups, latestTargets, publishedRows, mediaStatusGroups, generatingDrafts] = await Promise.all([
    db.mediaSite.count({ where: mediaWhere }),
    db.mediaSite.count({ where: { ...mediaWhere, status: "ACTIVE" } }),
    db.domain.count({ where: { mediaSite: mediaWhere, isActive: true, verificationStatus: "VERIFIED" } }),
    db.article.count({ where: { ...articleScope, ...approvedArticleDomainScope, archivedAt: null, status: "APPROVED" } }),
    db.sourceBrief.count({ where: { archivedAt: null, ...briefScope } }),
    db.article.groupBy({ by: ["status"], where: { ...articleScope, archivedAt: null }, _count: { _all: true } }),
    db.publicationTarget.groupBy({ by: ["status"], where: targetScope, _count: { _all: true } }),
    db.publicationTarget.findMany({
      where: targetScope,
      select: { id: true, status: true, updatedAt: true, lastErrorMessage: true, article: { select: { title: true } }, mediaSite: { select: { displayName: true } }, domain: { select: { hostname: true } } },
      orderBy: { updatedAt: "desc" }, take: 6
    }),
    db.publicationTarget.findMany({ where: { ...targetScope, status: "PUBLISHED", publishedAt: { gte: since } }, select: { publishedAt: true }, take: 5000 }),
    db.article.groupBy({ by: ["mediaSiteId", "status"], where: { ...articleScope, archivedAt: null }, _count: { _all: true } }),
    db.aiGenerationRun.count({ where: { operation: "GENERATE_ARTICLE", status: "PENDING", ...(visibleMediaIds ? { mediaSiteId: { in: visibleMediaIds } } : {}) } })
  ]);
  const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const perDay = new Map<string, number>();
  for (let i = 13; i >= 0; i -= 1) perDay.set(dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000)), 0);
  for (const row of publishedRows) { const key = row.publishedAt ? dayKey(row.publishedAt) : null; if (key && perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1); }
  const mediaNames = new Map((await db.mediaSite.findMany({ where: { id: { in: [...new Set(mediaStatusGroups.map((group) => group.mediaSiteId))] } }, select: { id: true, displayName: true } })).map((media) => [media.id, media.displayName]));
  const perMediaMap = new Map<string, { mediaName: string; published: number; waiting: number; approved: number }>();
  for (const group of mediaStatusGroups) {
    const entry = perMediaMap.get(group.mediaSiteId) ?? { mediaName: mediaNames.get(group.mediaSiteId) ?? "Media", published: 0, waiting: 0, approved: 0 };
    if (group.status === "PUBLISHED") entry.published += group._count._all;
    else if (group.status === "NEEDS_REVIEW" || group.status === "IN_REVISION") entry.waiting += group._count._all;
    else if (group.status === "APPROVED") entry.approved += group._count._all;
    perMediaMap.set(group.mediaSiteId, entry);
  }
  const articleStatuses = Object.fromEntries(articleGroups.map(({ status, _count }) => [status, _count._all]));
  const publicationStatuses = Object.fromEntries(publicationGroups.map(({ status, _count }) => [status, _count._all]));
  return {
    checkedAt: new Date().toISOString(),
    counts: {
      mediaSites,
      activeMediaSites,
      verifiedDomains,
      approvedArticlesWithoutReadyDomain,
      sourceBriefs,
      articles: Object.values(articleStatuses).reduce((sum, count) => sum + count, 0),
      articleStatuses,
      publicationStatuses
    },
    charts: { publishedPerDay: [...perDay].map(([date, count]) => ({ date, count })), perMedia: [...perMediaMap.values()].sort((a, b) => b.published + b.waiting + b.approved - (a.published + a.waiting + a.approved)) },
    generatingDrafts,
    reviewQueue: await reviewQueueCount(userId),
    latestTargets: latestTargets.map((target) => ({
      id: target.id,
      articleTitle: target.article.title,
      mediaName: target.mediaSite.displayName,
      hostname: target.domain.hostname,
      status: target.status,
      updatedAt: target.updatedAt.toISOString(),
      lastErrorMessage: target.lastErrorMessage
    }))
  };
}

/** Blasts (one news item each) that have content waiting to be checked and published, within the user's scope. Legacy per-media briefs count once per brief too. */
export async function reviewQueueCount(userId: string): Promise<number> {
  const globalScope = await hasNetworkWideScope(userId);
  const groups = await db.article.groupBy({
    by: ["sourceBriefId"],
    where: { archivedAt: null, status: { in: ["NEEDS_REVIEW", "IN_REVISION", "APPROVED"] }, ...(globalScope ? {} : { createdById: userId }) },
  });
  return groups.length;
}
