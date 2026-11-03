import { hash } from "bcryptjs";
import { db } from "../lib/db";
async function main() {
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  const name = process.env.SEED_OWNER_NAME?.trim() || "Newsroom Owner";
  if (!email || !password || password.length < 14) throw new Error("Set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD (at least 14 characters) to seed an owner.");
  const user = await db.user.upsert({ where: { email }, update: {}, create: { email, name, passwordHash: await hash(password, 12) } });
  await db.userRole.upsert({ where: { userId_role: { userId: user.id, role: "OWNER" } }, update: {}, create: { userId: user.id, role: "OWNER" } });
  console.log(`Owner account ready: ${email}`);
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Owner seed failed."); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); });
