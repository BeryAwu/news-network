import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";
export function jsonError(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid request.", details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400 });
  console.error("Request failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
}
export async function requestJson<T>(request: Request, schema: { parse(value: unknown): T }) { return schema.parse(await request.json()); }
