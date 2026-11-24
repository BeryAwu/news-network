import { z } from "zod";
import { audit, requireRole, requireSameOrigin } from "@/lib/auth";
import { aiConfiguration, currentAiKey } from "@/lib/ai";
import { addAiKey, checkAiKey, clearAiSettings, DEFAULT_OPENROUTER_MODEL, listAiModels, makePrimary, OPENROUTER_BASE_URL, readAiSettings, removeAiKey, resetAiKey, saveAiModel, saveAiProvider } from "@/lib/ai-settings";
import { readAiKeyStatus } from "@/lib/ai-status";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const MAX_KEYS = 8;
const keyText = z.string().trim().min(20, "Kunci terlalu pendek. Salin seluruh kunci dari dashboard penyedia.").max(300, "Kunci terlalu panjang.").regex(/^\S+$/, "Kunci tidak boleh berisi spasi.");
const modelText = z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9._:/-]+$/, "Nama model hanya boleh berisi huruf, angka, titik, garis, titik dua, dan garis miring.");
const baseUrlText = z.string().trim().url("Base URL harus berupa URL yang valid.").max(200).regex(/^https?:\/\//, "Base URL harus dimulai dengan http:// atau https://");
const addSchema = z.object({ action: z.literal("add"), apiKey: keyText, label: z.string().trim().max(40).optional(), baseUrl: baseUrlText.optional(), model: modelText.optional() });
const modelSchema = z.object({ action: z.literal("model"), model: modelText });
const providerSchema = z.object({ action: z.literal("provider"), provider: z.enum(["openrouter", "openai-compatible", "openai"]), baseUrl: baseUrlText });
const idSchema = z.object({ action: z.enum(["remove", "primary", "reset"]), id: z.string().regex(/^[a-f0-9]{12}$/) });
const checkSchema = z.object({ action: z.literal("check") });
const modelsSchema = z.object({ action: z.literal("models"), baseUrl: baseUrlText.optional(), apiKey: keyText.optional() });
const bodySchema = z.discriminatedUnion("action", [addSchema, modelSchema, providerSchema, idSchema, checkSchema, modelsSchema]);

/** Owner-only. Keys are never returned, only their last four characters. */
async function owner(request: Request, mutating: boolean) {
  if (mutating) requireSameOrigin(request);
  const user = await requireRole("OWNER");
  if (mutating && !rateLimit(`ai-key:${user.id}`, 20, 60 * 1000)) throw Object.assign(new Error("rate"), { plain: "Terlalu banyak percobaan. Tunggu sebentar." });
  return user;
}
const tooMany = (error: unknown) => (error instanceof Error && "plain" in error ? Response.json({ error: String((error as { plain: string }).plain) }, { status: 429 }) : null);
const checkInfo = (check: { label: string; limit: number | null; remaining: number | null }) => ({ label: check.label, limit: check.limit, remaining: check.remaining });

export async function GET(request: Request) {
  try {
    await owner(request, false);
    return Response.json({ status: await readAiKeyStatus() });
  } catch (error) { return jsonError(error); }
}

/**
 * One endpoint, an `action` per change:
 * add (tested first, saved only if it works, then read back), model, remove, primary (try this key first), reset (put a resting key back), check (re-test the key in use).
 */
export async function POST(request: Request) {
  try {
    const user = await owner(request, true);
    const input = bodySchema.parse(await request.json());
    const saved = await readAiSettings();

    if (input.action === "check") {
      const current = await currentAiKey();
      if (!current) return Response.json({ error: "Belum ada kunci AI yang terpasang." }, { status: 409 });
      const check = await checkAiKey(current.apiKey, current.model, current.baseUrl);
      if (!check.ok) return Response.json({ error: check.reason }, { status: 422 });
      return Response.json({ status: await readAiKeyStatus(), check: checkInfo(check) });
    }

    if (input.action === "models") {
      const key = input.apiKey?.trim() || saved.keys.find((row) => row.secret)?.secret || null;
      if (!key) return Response.json({ error: "Tempel kunci API dulu, atau simpan satu kunci supaya daftar model bisa dibaca." }, { status: 400 });
      const baseUrl = input.baseUrl || saved.baseUrl || OPENROUTER_BASE_URL;
      const list = await listAiModels(key, baseUrl);
      if (!list.ok) return Response.json({ error: list.reason }, { status: 422 });
      return Response.json({ models: list.models, freeModels: list.freeModels });
    }

    if (input.action === "add") {
      if (saved.keys.length >= MAX_KEYS) return Response.json({ error: `Maksimal ${MAX_KEYS} kunci. Hapus yang tidak dipakai dulu.` }, { status: 400 });
      if (saved.keys.some((key) => key.secret === input.apiKey)) return Response.json({ error: "Kunci ini sudah ada di daftar." }, { status: 409 });
      const config = await aiConfiguration();
      const baseUrl = input.baseUrl || saved.baseUrl || config.baseUrl || OPENROUTER_BASE_URL;
      const model = input.model || saved.model || config.model || DEFAULT_OPENROUTER_MODEL;
      const check = await checkAiKey(input.apiKey, model, baseUrl);
      if (!check.ok) return Response.json({ error: check.reason }, { status: 422 });
      const id = await addAiKey(user, input);
      const after = await readAiSettings();
      if (after.keys.find((key) => key.id === id)?.secret !== input.apiKey) return Response.json({ error: "Kunci tersimpan tetapi belum terbaca ulang oleh aplikasi. Muat ulang halaman dan coba lagi." }, { status: 500 });
      await audit(user.id, "AI_KEY_ADDED", "IntegrationSetting", id, null, { hint: input.apiKey.slice(-4), label: input.label ?? "" });
      return Response.json({ status: await readAiKeyStatus(), check: checkInfo(check) });
    }

    if (input.action === "provider") {
      await saveAiProvider(user, input.provider, input.baseUrl);
      await audit(user.id, "AI_PROVIDER_CHANGED", "IntegrationSetting", "ai.provider", null, { provider: input.provider, baseUrl: input.baseUrl });
      return Response.json({ status: await readAiKeyStatus() });
    }

    if (input.action === "model") {
      const current = await currentAiKey();
      if (!current) return Response.json({ error: "Pasang kunci AI dulu sebelum mengganti model." }, { status: 400 });
      const check = await checkAiKey(current.apiKey, input.model, current.baseUrl);
      if (!check.ok) return Response.json({ error: check.reason }, { status: 422 });
      await saveAiModel(user, input.model);
      await audit(user.id, "AI_MODEL_CHANGED", "IntegrationSetting", "ai.model", null, { model: input.model });
      const status = await readAiKeyStatus();
      if (status.model !== input.model) return Response.json({ error: "Model tersimpan tetapi belum terbaca ulang. Muat ulang halaman dan coba lagi." }, { status: 500 });
      return Response.json({ status });
    }

    if (!saved.keys.some((key) => key.id === input.id)) return Response.json({ error: "Kunci itu sudah tidak ada. Muat ulang halaman." }, { status: 404 });
    if (input.action === "remove") await removeAiKey(input.id);
    else if (input.action === "primary") await makePrimary(input.id);
    else await resetAiKey(input.id);
    await audit(user.id, `AI_KEY_${input.action.toUpperCase()}`, "IntegrationSetting", input.id, null, {});
    return Response.json({ status: await readAiKeyStatus() });
  } catch (error) { return tooMany(error) ?? jsonError(error); }
}

/** Forgets every dashboard key and the model; the server environment key (if any) is used again. */
export async function DELETE(request: Request) {
  try {
    const user = await owner(request, true);
    await clearAiSettings();
    await audit(user.id, "AI_SETTINGS_CLEARED", "IntegrationSetting", "ai", null, {});
    return Response.json({ status: await readAiKeyStatus() });
  } catch (error) { return tooMany(error) ?? jsonError(error); }
}
