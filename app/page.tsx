import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { normalizeHostname } from "@/lib/security";
export default async function Home() {
  const hostHeader = (await headers()).get("host");
  if (!hostHeader) notFound();
  let hostname: string;
  try { hostname = normalizeHostname(hostHeader.split(":")[0]!); } catch { notFound(); }
  const adminBase = process.env.ADMIN_BASE_URL || "http://localhost:3000";
  if (hostname === normalizeHostname(new URL(adminBase).hostname)) {
    if (!process.env.DATABASE_URL) redirect("/setup?issue=database");
    redirect("/dashboard");
  }
  if (!process.env.DATABASE_URL) notFound();
  const domain = await db.domain.findFirst({ where: { hostname, isActive: true, verificationStatus: "VERIFIED", mediaSite: { status: "ACTIVE" } }, select: { mediaSite: { select: { slug: true } } } });
  if (!domain) notFound();
  redirect(`/public/${domain.mediaSite.slug}`);
}
