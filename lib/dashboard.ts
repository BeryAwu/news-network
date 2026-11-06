import { db } from "@/lib/db";
import { canAccessMedia, hasNetworkWideScope, requireUser } from "@/lib/auth";

export async function visibleMedia() {
  const user = await requireUser();
  const globalScope = await hasNetworkWideScope(user.id);
  return db.mediaSite.findMany({ where: globalScope ? {} : { mediaScopes: { some: { userId: user.id } } }, include: { profile: true, domains: true, _count: { select: { articles: true, assets: true } } }, orderBy: { createdAt: "desc" } });
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
  const mediaWhere = globalScope ? {} : { mediaScopes: { some: { userId } } };
  const articleScope = globalScope ? {} : { mediaSite: { mediaScopes: { some: { userId } } } };
  const briefScope = globalScope ? {} : { mediaTargets: { some: { mediaSite: { mediaScopes: { some: { userId } } } } } };
  const targetScope = globalScope ? {} : { mediaSite: { mediaScopes: { some: { userId } } } };
  const approvedArticleDomainScope = {
    mediaSite: {
      ...(globalScope ? {} : { mediaScopes: { some: { userId } } }),
      domains: { none: { isCanonical: true, isActive: true, verificationStatus: "VERIFIED" as const } }
    }
  };
  const [mediaSites, activeMediaSites, verifiedDomains, approvedArticlesWithoutReadyDomain, sourceBriefs, articleGroups, publicationGroups, latestTargets] = await Promise.all([
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
    })
  ]);
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
