import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireMediaAccess, requireRole, requireSameOrigin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { slugify } from "@/lib/security";
const createSchema = z.object({ mediaSiteId: z.string().min(1), name: z.string().trim().min(2).max(100), description: z.string().max(500).default("") });
const updateSchema = z.object({ categoryId: z.string().min(1), action: z.enum(["rename", "delete"]), name: z.string().trim().min(2).max(100).optional(), description: z.string().max(500).optional() });
export async function GET(request: Request) {
  try {
    const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER", "PUBLISHER");
    const mediaSiteId = z.string().min(1).parse(new URL(request.url).searchParams.get("mediaSiteId"));
    await requireMediaAccess(user.id, mediaSiteId);
    const categories = await db.category.findMany({ where: { mediaSiteId }, include: { _count: { select: { articles: true } } }, orderBy: { sortOrder: "asc" } });
    return Response.json(categories);
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    const input = createSchema.parse(await request.json());
    await requireMediaAccess(user.id, input.mediaSiteId);
    const site = await db.mediaSite.findUnique({ where: { id: input.mediaSiteId }, select: { id: true } });
    if (!site) return Response.json({ error: "Media not found." }, { status: 404 });
    const slug = slugify(input.name);
    const duplicate = await db.category.findFirst({ where: { mediaSiteId: input.mediaSiteId, slug } });
    if (duplicate) return Response.json({ error: "A category with this name already exists." }, { status: 409 });
    const category = await db.category.create({ data: { mediaSiteId: input.mediaSiteId, name: input.name, slug, description: input.description, sortOrder: await db.category.count({ where: { mediaSiteId: input.mediaSiteId } }) } });
    await audit(user.id, "CATEGORY_CREATED", "Category", category.id, input.mediaSiteId, { slug: category.slug });
    return Response.json(category, { status: 201 });
  } catch (error) { return jsonError(error); }
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    const input = updateSchema.parse(await request.json());
    const category = await db.category.findUnique({ where: { id: input.categoryId } });
    if (!category) return Response.json({ error: "Category not found." }, { status: 404 });
    await requireMediaAccess(user.id, category.mediaSiteId);
    if (input.action === "rename") {
      if (!input.name) return Response.json({ error: "Category name is required." }, { status: 400 });
      const slug = slugify(input.name);
      const duplicate = await db.category.findFirst({ where: { mediaSiteId: category.mediaSiteId, slug, NOT: { id: category.id } } });
      if (duplicate) return Response.json({ error: "A category with this name already exists." }, { status: 409 });
      const updated = await db.category.update({ where: { id: category.id }, data: { name: input.name, slug, ...(input.description !== undefined ? { description: input.description } : {}) } });
      await audit(user.id, "CATEGORY_UPDATED", "Category", updated.id, updated.mediaSiteId, { slug: updated.slug });
      return Response.json(updated);
    }
    const usage = await db.article.count({ where: { categoryId: category.id, archivedAt: null } });
    if (usage) return Response.json({ error: `Category is used by ${usage} article(s); reassign them before deleting.` }, { status: 409 });
    await db.category.delete({ where: { id: category.id } });
    await audit(user.id, "CATEGORY_DELETED", "Category", category.id, category.mediaSiteId);
    return Response.json({ deleted: category.id });
  } catch (error) { return jsonError(error); }
}
