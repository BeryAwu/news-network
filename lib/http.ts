import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";

export class UploadError extends Error {}

export function jsonError(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid request.", details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400 });
  if (error instanceof SyntaxError && error.message.includes("JSON")) return NextResponse.json({ error: "Badan permintaan bukan JSON yang valid." }, { status: 400 });
  console.error("Request failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: "Terjadi kesalahan internal. Silakan coba lagi atau hubungi administrator." }, { status: 500 });
}
export async function requestJson<T>(request: Request, schema: { parse(value: unknown): T }) { return schema.parse(await request.json()); }
export function boundedPage(value: string | null | undefined, fallback = 1): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), 10_000);
}
