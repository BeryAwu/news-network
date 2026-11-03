import { z } from "zod";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, requireSameOrigin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });
export async function POST(request: Request) { try { requireSameOrigin(request); if (!process.env.DATABASE_URL) return Response.json({ error: "PostgreSQL is not configured.", setupUrl: "/setup?issue=database" }, { status: 503 }); const input = schema.parse(await request.json()); const user = await db.user.findUnique({ where: { email: input.email.toLowerCase() }, include: { roles: true } }); if (!user || user.status !== "ACTIVE" || !(await compare(input.password, user.passwordHash))) return Response.json({ error: "Email atau kata sandi tidak valid." }, { status: 401 }); await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }); await createSession(user.id); return Response.json({ id: user.id, name: user.name, email: user.email, roles: user.roles.map((assignment) => assignment.role) }); } catch (e) { return jsonError(e); } }
