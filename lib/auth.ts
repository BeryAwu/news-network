import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

const COOKIE = "nnms_session";
function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(secret);
}
export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(sessionKey());
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
}
export async function clearSession() { (await cookies()).delete(COOKIE); }
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    if (typeof payload.sub !== "string") return null;
    return await db.user.findFirst({ where: { id: payload.sub, status: "ACTIVE" }, include: { roles: true, mediaScopes: true } });
  } catch { return null; }
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AuthError("Authentication required.", 401);
  return user;
}
export class AuthError extends Error { constructor(message: string, public readonly status = 403) { super(message); } }
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) throw new AuthError("A same-origin request is required.", 403);
  try {
    const originUrl = new URL(origin);
    if (!["http:", "https:"].includes(originUrl.protocol) || originUrl.host.toLowerCase() !== host.toLowerCase()) throw new AuthError("A same-origin request is required.", 403);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("A same-origin request is required.", 403);
  }
}
export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!user.roles.some((assignment) => assignment.role === "OWNER" || roles.includes(assignment.role))) throw new AuthError("Insufficient role.", 403);
  return user;
}
export async function hasNetworkWideScope(userId: string) {
  const global = await db.userRole.findFirst({ where: { userId, role: { in: ["OWNER", "ADMIN"] } } });
  return Boolean(global);
}
export async function canAccessMedia(userId: string, mediaSiteId: string) {
  if (await hasNetworkWideScope(userId)) return true;
  const scoped = await db.mediaAccess.findUnique({ where: { userId_mediaSiteId: { userId, mediaSiteId } } });
  return Boolean(scoped);
}
export async function requireMediaAccess(userId: string, mediaSiteId: string) {
  if (!(await canAccessMedia(userId, mediaSiteId))) throw new AuthError("You do not have access to this media site.", 403);
}
export async function hasAnyRole(userId: string, roles: Role[]) {
  return Boolean(await db.userRole.findFirst({ where: { userId, role: { in: roles } } }));
}
export async function audit(actorUserId: string | null, action: string, entityType: string, entityId: string, mediaSiteId?: string | null, metadata: Record<string, unknown> = {}) {
  await db.auditLog.create({ data: { actorUserId, action, entityType, entityId, mediaSiteId: mediaSiteId ?? null, metadata: JSON.parse(JSON.stringify(metadata)) } });
}
