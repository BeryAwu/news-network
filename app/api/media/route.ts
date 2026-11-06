import { z } from "zod";
import { db } from "@/lib/db";
import { hasNetworkWideScope, requireRole, requireSameOrigin } from "@/lib/auth";
import { boundedPage, jsonError } from "@/lib/http";
import { normalizeHostname, slugify } from "@/lib/security";

const mediaInput = z.object({ name: z.string().min(2).max(120), displayName: z.string().min(2).max(120), slug: z.string().max(80).optional(), hostname: z.string().max(253).optional(), niche: z.string().max(500).default(""), targetAudience: z.string().max(500).default(""), editorialMission: z.string().max(1000).default(""), toneGuidelines: z.string().max(1000).default(""), styleGuidelines: z.string().max(1000).default(""), language: z.string().max(30).default("Indonesian"), publisherDisclosure: z.string().max(1500).default(""), ownershipDisclosure: z.string().max(1500).default(""), newsroomByline: z.string().min(2).max(120) });
const updateMediaInput = z.object({ mediaSiteId: z.string().min(1), name: z.string().min(2).max(120), displayName: z.string().min(2).max(120), slug: z.string().min(2).max(80), niche: z.string().max(500).default(""), targetAudience: z.string().max(500).default(""), editorialMission: z.string().max(1000).default(""), toneGuidelines: z.string().max(1000).default(""), styleGuidelines: z.string().max(1000).default(""), language: z.string().max(30).default("Indonesian"), publisherDisclosure: z.string().max(1500).default(""), ownershipDisclosure: z.string().max(1500).default(""), newsroomByline: z.string().min(2).max(120), status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "DISABLED"]).optional() });
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN");
    const input = updateMediaInput.parse(await request.json());
    if (!(await hasNetworkWideScope(user.id))) {
      const scope = await db.mediaAccess.findUnique({ where: { userId_mediaSiteId: { userId: user.id, mediaSiteId: input.mediaSiteId } } });
      if (!scope) return Response.json({ error: "Media access denied." }, { status: 403 });
    }
    const existing = await db.mediaSite.findUnique({ where: { id: input.mediaSiteId }, include: { profile: true } });
    if (!existing) return Response.json({ error: "Media not found." }, { status: 404 });
    if (existing.slug !== input.slug) {
      const publicArticles = await db.article.count({ where: { mediaSiteId: existing.id, status: "PUBLISHED" } });
      if (publicArticles) return Response.json({ error: "Published media cannot change its public slug." }, { status: 409 });
    }
    const updated = await db.$transaction(async (tx) => {
      const media = await tx.mediaSite.update({ where: { id: existing.id }, data: { name: input.name, displayName: input.displayName, slug: input.slug, publisherDisclosure: input.publisherDisclosure, ownershipDisclosure: input.ownershipDisclosure, newsroomByline: input.newsroomByline, ...(input.status ? { status: input.status } : {}) } });
      await tx.mediaProfile.upsert({ where: { mediaSiteId: existing.id }, create: { mediaSiteId: existing.id, niche: input.niche, targetAudience: input.targetAudience, editorialMission: input.editorialMission, toneGuidelines: input.toneGuidelines, styleGuidelines: input.styleGuidelines, language: input.language }, update: { niche: input.niche, targetAudience: input.targetAudience, editorialMission: input.editorialMission, toneGuidelines: input.toneGuidelines, styleGuidelines: input.styleGuidelines, language: input.language } });
      await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: existing.id, action: "MEDIA_PROFILE_UPDATED", entityType: "MediaSite", entityId: existing.id, metadata: { slug: input.slug } } });
      return media;
    });
    return Response.json(updated);
  } catch (error) { return jsonError(error); }
}
export async function GET(request: Request) { try { const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER", "PUBLISHER"); const params = new URL(request.url).searchParams; const page = boundedPage(params.get("page")); const all = await hasNetworkWideScope(user.id); const media = await db.mediaSite.findMany({ where: all ? {} : { mediaScopes: { some: { userId: user.id } } }, include: { profile: true, domains: true, _count: { select: { articles: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 200, take: 200 }); return Response.json(media); } catch (e) { return jsonError(e); } }
export async function POST(request: Request) { try { requireSameOrigin(request); const user = await requireRole("OWNER", "ADMIN"); const parsed = mediaInput.parse(await request.json()); const slug = slugify(parsed.slug || parsed.name); const hostname = parsed.hostname ? normalizeHostname(parsed.hostname) : null; const slugConflict = await db.mediaSite.findUnique({ where: { slug } }); if (slugConflict) return Response.json({ error: "Slug media sudah digunakan. Pilih nama lain." }, { status: 409 }); if (hostname) { const hostConflict = await db.domain.findUnique({ where: { hostname } }); if (hostConflict) return Response.json({ error: "Hostname sudah terdaftar pada media lain." }, { status: 409 }); } const media = await db.$transaction(async (tx) => { const created = await tx.mediaSite.create({ data: { name: parsed.name, slug, displayName: parsed.displayName, publisherDisclosure: parsed.publisherDisclosure, ownershipDisclosure: parsed.ownershipDisclosure, newsroomByline: parsed.newsroomByline, profile: { create: { niche: parsed.niche, targetAudience: parsed.targetAudience, editorialMission: parsed.editorialMission, toneGuidelines: parsed.toneGuidelines, styleGuidelines: parsed.styleGuidelines, language: parsed.language } }, ...(hostname ? { domains: { create: { hostname } } } : {}) } }); await tx.mediaAccess.upsert({ where: { userId_mediaSiteId: { userId: user.id, mediaSiteId: created.id } }, create: { userId: user.id, mediaSiteId: created.id }, update: {} }); await tx.auditLog.create({ data: { actorUserId: user.id, mediaSiteId: created.id, action: "MEDIA_CREATED", entityType: "MediaSite", entityId: created.id, metadata: { slug, hostname } } }); return created; }); return Response.json(media, { status: 201 }); } catch (e) { return jsonError(e); } }
