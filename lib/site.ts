import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeHostname } from "@/lib/security";
import { editorialEvidenceSnapshotSchema } from "@/lib/editorial-evidence";

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
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).catch("#176b4a"),
  tagline: z.string().max(160).catch(""),
  logoUrl: z.string().url().startsWith("https://res.cloudinary.com/").nullable().catch(null),
});
export type SiteTheme = z.infer<typeof themeSchema>;
export function parseTheme(raw: unknown): SiteTheme {
  const input = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
  return themeSchema.parse({ primary: input.primary, tagline: input.tagline ?? "", logoUrl: input.logoUrl ?? null });
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
    where: { hostname, isActive: true, verificationStatus: "VERIFIED", mediaSite: { status: "ACTIVE" } },
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
}

function toItem(target: { publishedAt: Date | null; approvedSnapshot: unknown; article: { category: { name: string; slug: string } | null } }): SiteListItem | null {
  const parsed = publishedSnapshotSchema.safeParse(target.approvedSnapshot);
  if (!parsed.success) return null;
  const s = parsed.data;
  return { slug: s.slug, title: s.title, excerpt: s.excerpt, publishedAt: target.publishedAt, category: target.article.category, image: s.featuredAsset };
}

function listWhere(site: Site, filter: { categoryId?: string; q?: string }) {
  const q = filter.q?.trim();
  return {
    domainId: site.domainId,
    mediaSiteId: site.media.id,
    status: "PUBLISHED" as const,
    article: {
      archivedAt: null,
      status: "PUBLISHED" as const,
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { excerpt: { contains: q, mode: "insensitive" as const } }] } : {}),
    },
  };
}

export async function listPublished(site: Site, opts: { page?: number; categoryId?: string; q?: string; take?: number } = {}) {
  const take = opts.take ?? SITE_PAGE_SIZE;
  const page = Math.max(1, Math.min(opts.page ?? 1, 500));
  const where = listWhere(site, opts);
  const [total, rows] = await Promise.all([
    db.publicationTarget.count({ where }),
    db.publicationTarget.findMany({
      where, orderBy: { publishedAt: "desc" }, skip: (page - 1) * take, take,
      select: { publishedAt: true, approvedSnapshot: true, article: { select: { category: { select: { name: true, slug: true } } } } },
    }),
  ]);
  return { total, page, pages: Math.max(1, Math.ceil(total / take)), items: rows.map(toItem).filter((i): i is SiteListItem => i !== null) };
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
