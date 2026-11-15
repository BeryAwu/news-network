import { z } from "zod";
import { audit, requireRole, requireSameOrigin } from "@/lib/auth";
import { currentOpenRouterKey, aiConfiguration } from "@/lib/ai";
import { checkOpenRouterKey, clearAiSettings, DEFAULT_OPENROUTER_MODEL, readAiOverride, saveAiSettings } from "@/lib/ai-settings";
import { readAiKeyStatus } from "@/lib/ai-status";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const saveSchema = z.object({
  apiKey: z.string().trim().min(20, "Kunci terlalu pendek. Salin seluruh kunci dari OpenRouter.").max(300, "Kunci terlalu panjang.").regex(/^\S+$/, "Kunci tidak boleh berisi spasi.").optional(),
  model: z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9._:/-]+$/, "Nama model hanya boleh berisi huruf, angka, titik, garis, titik dua, dan garis miring.").optional(),
});
const actionSchema = z.object({ action: z.literal("check") });

/** Owner-only: the AI key shown here is never returned, only its last four characters. */
async function owner(request: Request, mutating: boolean) {
  if (mutating) requireSameOrigin(request);
  const user = await requireRole("OWNER");
  if (mutating && !rateLimit(`ai-key:${user.id}`, 10, 60 * 1000)) throw Object.assign(new Error("rate"), { plain: "Terlalu banyak percobaan. Tunggu sebentar." });
  return user;
}
const tooMany = (error: unknown) => (error instanceof Error && "plain" in error ? Response.json({ error: String((error as { plain: string }).plain) }, { status: 429 }) : null);

export async function GET(request: Request) {
  try {
    await owner(request, false);
    return Response.json({ status: await readAiKeyStatus() });
  } catch (error) { return jsonError(error); }
}

/** Tests the key (and model) against OpenRouter first. Only a key that works is saved; then the saved state is read back. */
export async function PUT(request: Request) {
  try {
    const user = await owner(request, true);
    const input = saveSchema.parse(await request.json());
    if (!input.apiKey && !input.model) return Response.json({ error: "Isi kunci API atau nama model yang ingin diganti." }, { status: 400 });
    const current = await currentOpenRouterKey();
    const override = await readAiOverride();
    const apiKey = input.apiKey ?? current?.apiKey;
    if (!apiKey) return Response.json({ error: "Belum ada kunci yang bisa dipakai. Tempel kunci API OpenRouter." }, { status: 400 });
    const model = input.model ?? override.model ?? current?.model ?? DEFAULT_OPENROUTER_MODEL;
    const check = await checkOpenRouterKey(apiKey, model);
    if (!check.ok) return Response.json({ error: check.reason }, { status: 422 });
    await saveAiSettings(user, { apiKey: input.apiKey, model: input.model });
    await audit(user.id, "AI_SETTINGS_UPDATED", "IntegrationSetting", "ai", null, { keyChanged: Boolean(input.apiKey), hint: input.apiKey?.slice(-4) ?? null, model });
    const [after, config, status] = await Promise.all([readAiOverride(), aiConfiguration(), readAiKeyStatus()]);
    const keyOk = !input.apiKey || (after.apiKey === input.apiKey && config.keySource === "dashboard");
    const modelOk = !input.model || config.model === input.model;
    if (!keyOk || !modelOk) return Response.json({ error: "Pengaturan tersimpan tetapi belum terbaca ulang oleh aplikasi. Muat ulang halaman dan coba lagi." }, { status: 500 });
    return Response.json({ status, check: { label: check.label, limit: check.limit, remaining: check.remaining } });
  } catch (error) { return tooMany(error) ?? jsonError(error); }
}

/** Re-tests whatever key is in use right now, whether it came from the dashboard or the server environment. */
export async function POST(request: Request) {
  try {
    await owner(request, true);
    actionSchema.parse(await request.json());
    const current = await currentOpenRouterKey();
    if (!current) return Response.json({ error: "Belum ada kunci OpenRouter yang terpasang." }, { status: 409 });
    const check = await checkOpenRouterKey(current.apiKey, current.model);
    if (!check.ok) return Response.json({ error: check.reason }, { status: 422 });
    return Response.json({ status: await readAiKeyStatus(), check: { label: check.label, limit: check.limit, remaining: check.remaining } });
  } catch (error) { return tooMany(error) ?? jsonError(error); }
}

/** Forgets the dashboard key and model; the server environment key (if any) is used again. */
export async function DELETE(request: Request) {
  try {
    const user = await owner(request, true);
    await clearAiSettings();
    await audit(user.id, "AI_SETTINGS_CLEARED", "IntegrationSetting", "ai", null, {});
    return Response.json({ status: await readAiKeyStatus() });
  } catch (error) { return tooMany(error) ?? jsonError(error); }
}
