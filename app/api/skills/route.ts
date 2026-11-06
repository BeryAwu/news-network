import { z } from "zod";
import { db } from "@/lib/db";
import { requireMediaAccess, requireRole, requireSameOrigin } from "@/lib/auth";
import { jsonError } from "@/lib/http";

const toggleInput = z.object({ mediaSiteId: z.string().min(1), skillId: z.string().min(1), enabled: z.boolean() });

export async function GET(request: Request) {
  try {
    const user = await requireRole("OWNER", "ADMIN", "EDITOR", "REVIEWER", "PUBLISHER");
    const params = new URL(request.url).searchParams;
    const mediaSiteId = params.get("mediaSiteId");
    if (mediaSiteId) await requireMediaAccess(user.id, mediaSiteId);
    const skills = await db.writingSkill.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    const rows = mediaSiteId
      ? await db.mediaWritingSkill.findMany({ where: { mediaSiteId }, select: { skillId: true, enabled: true } })
      : [];
    const enabledBySkill = new Map(rows.map((row) => [row.skillId, row.enabled]));
    return Response.json({
      skills: skills.map((skill) => ({
        id: skill.id,
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        enabled: enabledBySkill.get(skill.id) ?? false,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    const input = toggleInput.parse(await request.json());
    await requireMediaAccess(user.id, input.mediaSiteId);
    const skill = await db.writingSkill.findUnique({ where: { id: input.skillId }, select: { id: true, isActive: true } });
    if (!skill || !skill.isActive) return Response.json({ error: "Skill tidak ditemukan." }, { status: 404 });
    await db.mediaWritingSkill.upsert({
      where: { mediaSiteId_skillId: { mediaSiteId: input.mediaSiteId, skillId: input.skillId } },
      create: { mediaSiteId: input.mediaSiteId, skillId: input.skillId, enabled: input.enabled },
      update: { enabled: input.enabled },
    });
    await db.auditLog.create({ data: {
      actorUserId: user.id, mediaSiteId: input.mediaSiteId,
      action: input.enabled ? "WRITING_SKILL_ENABLED" : "WRITING_SKILL_DISABLED",
      entityType: "WritingSkill", entityId: input.skillId, metadata: { skillId: input.skillId },
    } });
    return Response.json({ enabled: input.enabled });
  } catch (error) {
    return jsonError(error);
  }
}
