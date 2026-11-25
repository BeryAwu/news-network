import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeHostname } from "@/lib/security";
import { editorialEvidenceSnapshotSchema } from "@/lib/editorial-evidence";
import { DEFAULT_SITE_COLOR } from "@/lib/site-brand";

export const SITE_PAGE_SIZE = 12;

const publishedAssetSchema = z.object({ secureUrl: z.string(), altText: z.string(), caption: z.string(), credit: z.string(), isAiGenerated: z.boolean(), width: z.number(), height: z.number() });

export const publishedSnapshotSchema = z.object({
  /** False when no AI version ever existed for the article. Snapshots from before this field default to true. */
  aiAssisted: z.boolean().default(true),
  /** Name of the account that wrote the story. Older snapshots have none and fall back to the newsroom byline. */
  authorName: z.string().nullable().default(null),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  body: z.string(),
  seoTitle: z.string(),
  metaDescription: z.string(),
  tags: z.array(z.string()),
  imageBrief: z.string(),
  claimsUsed: z.array(z.object({ claimText: z.string(), sourceFactIds: z.array(z.string()) })),
  uncertainties: z.array(z.string()),
  featuredAssetId: z.string().nullable(),
  featuredAsset: publishedAssetSchema.nullable().default(null),
  gallery: z.array(publishedAssetSchema).default([]),
  ...editorialEvidenceSnapshotSchema.shape,
});
export type PublishedSnapshot = z.infer<typeof publishedSnapshotSchema>;

const themeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().catch(null),
  tagline: z.string().max(160).catch(""),
  logoUrl: z.string().url().startsWith("https://res.cloudinary.com/").nullable().catch(null),
});
/** What differs between media sites. A `template` key saved by the old design picker is ignored. */
export interface SiteTheme { primary: string; tagline: string; logoUrl: string | null }
export function parseTheme(raw: unknown): SiteTheme {
  const input = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
  const parsed = themeSchema.parse({ primary: input.primary ?? null, tagline: input.tagline ?? "", logoUrl: input.logoUrl ?? null });
  return { ...parsed, primary: parsed.primary ?? DEFAULT_SITE_COLOR };
}

export async function requestHostname() {
  const raw = (await headers()).get("host");
  if (!raw) return null;
  try { return normalizeHostname(raw.split(":")[0]!); } catch { return null; }
}

/** Public base URL for the current request host (never trusts a client-supplied tenant id). */
export async function requestOrigin() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

/** Resolves the tenant from the request hostname only. Unknown/unverified hosts 404. */
export async function resolveSite(): Promise<Site> {
  const hostname = await requestHostname();
  if (!hostname) notFound();
  const domain = await db.domain.findFirst({
    where: { hostname, isActive: true, verificationStatus: "VERIFIED", mediaSite: { status: "ACTIVE", deletedAt: null } },
    include: { mediaSite: { include: { profile: true, categories: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } } } },
  });
  if (!domain) notFound();
  const media = domain.mediaSite;
  return { domainId: domain.id, hostname, media, theme: parseTheme(media.themeConfig) };
}
export interface Site {
  domainId: string;
  hostname: string;
  media: Prisma.MediaSiteGetPayload<{ include: { profile: true; categories: true } }>;
  theme: SiteTheme;
}

export interface SiteListItem {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date | null;
  category: { name: string; slug: string } | null;
  image: PublishedSnapshot["featuredAsset"];
  /** Account that wrote the story; groups "from the same writer" lists. */
  authorId: string;
  /** Byline shown to readers: the writer's name, or the newsroom byline for older stories. */
  authorName: string;
}

const itemSelect = { publishedAt: true, approvedSnapshot: true, article: { select: { createdById: true, category: { select: { name: true, slug: true } } } } } as const;

function toItem(site: Site, target: { publishedAt: Date | null; approvedSnapshot: unknown; article: { createdById: string; category: { name: string; slug: string } | null } }): SiteListItem | null {
  const parsed = publishedSnapshotSchema.safeParse(target.approvedSnapshot);
  if (!parsed.success) return null;
  const s = parsed.data;
  return { slug: s.slug, title: s.title, excerpt: s.excerpt, publishedAt: target.publishedAt, category: target.article.category, image: s.featuredAsset, authorId: target.article.createdById, authorName: s.authorName || site.media.newsroomByline };
}

export interface ListFilter {
  categoryId?: string;
  q?: string;
  /** Only stories by this account. */
  authorId?: string;
  /** Leave this story out (the one being read). */
  excludeSlug?: string;
  /** Only stories published in the last N days. */
  withinDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function listWhere(site: Site, filter: ListFilter): Prisma.PublicationTargetWhereInput {
  const q = filter.q?.trim();
  return {
    domainId: site.domainId,
    mediaSiteId: site.media.id,
    status: "PUBLISHED",
    ...(filter.withinDays ? { publishedAt: { gte: new Date(Date.now() - filter.withinDays * DAY_MS) } } : {}),
    ...(filter.excludeSlug ? { NOT: { approvedSnapshot: { path: ["slug"], equals: filter.excludeSlug } } } : {}),
    article: {
      archivedAt: null,
      status: "PUBLISHED",
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.authorId ? { createdById: filter.authorId } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { excerpt: { contains: q, mode: "insensitive" } }] } : {}),
    },
  };
}

export async function listPublished(site: Site, opts: ListFilter & { page?: number; take?: number; skip?: number } = {}) {
  const take = opts.take ?? SITE_PAGE_SIZE;
  const page = Math.max(1, Math.min(opts.page ?? 1, 500));
  const where = listWhere(site, opts);
  const [total, rows] = await Promise.all([
    db.publicationTarget.count({ where }),
    db.publicationTarget.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (opts.skip ?? 0) + (page - 1) * take, take, select: itemSelect }),
  ]);
  return { total, page, pages: Math.max(1, Math.ceil(total / take)), items: rows.map((row) => toItem(site, row)).filter((i): i is SiteListItem => i !== null) };
}

/** The stories published just before and just after this one on the same site. */
export async function adjacentPublished(site: Site, publishedAt: Date | null, slug: string) {
  if (!publishedAt) return { previous: null, next: null };
  const base = listWhere(site, { excludeSlug: slug });
  const [previous, next] = await Promise.all([
    db.publicationTarget.findFirst({ where: { ...base, publishedAt: { lt: publishedAt } }, orderBy: { publishedAt: "desc" }, select: itemSelect }),
    db.publicationTarget.findFirst({ where: { ...base, publishedAt: { gt: publishedAt } }, orderBy: { publishedAt: "asc" }, select: itemSelect }),
  ]);
  return { previous: previous ? toItem(site, previous) : null, next: next ? toItem(site, next) : null };
}

export async function findPublished(site: Site, slug: string) {
  const target = await db.publicationTarget.findFirst({
    where: { ...listWhere(site, {}), approvedSnapshot: { path: ["slug"], equals: slug } },
    orderBy: { publishedAt: "desc" },
    select: { publishedAt: true, approvedSnapshot: true, article: { select: { id: true, createdById: true, sourceBriefId: true, sourceBrief: { select: { contentMode: true } }, category: { select: { name: true, slug: true } } } } },
  });
  if (!target) return null;
  const parsed = publishedSnapshotSchema.safeParse(target.approvedSnapshot);
  if (!parsed.success) return null;
  return { snapshot: parsed.data, publishedAt: target.publishedAt, category: target.article.category, articleId: target.article.id, authorId: target.article.createdById, blastId: target.article.sourceBrief.contentMode ? target.article.sourceBriefId : null };
}

export function cloudinaryUrl(url: string, transform: string) {
  return url.includes("/image/upload/") ? url.replace("/image/upload/", `/image/upload/${transform}/`) : url;
}

export function paragraphs(body: string) {
  return body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
