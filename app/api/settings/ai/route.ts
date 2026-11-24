import { z } from "zod";
import { audit, requireRole, requireSameOrigin } from "@/lib/auth";
import { currentAiKey } from "@/lib/ai";
import { addAiKey, addAiKeysBulk, addPaidProvider, checkAiKey, clearAiSettings, DEFAULT_OPENROUTER_MODEL, listAiModels, makePrimary, OPENROUTER_BASE_URL, OPENROUTER_SOURCE, readAiSettings, removeAiKey, removePaidProvider, resetAiKey, resetPaidProvider, saveActiveSource, saveAiKeyModel, saveAiModel, saveFreeModels, savePaidModel } from "@/lib/ai-settings";
import { readAiKeyStatus } from "@/lib/ai-status";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const MAX_KEYS = 30;
const MAX_PAID = 10;
const keyText = z.string().trim().min(20, "Kunci terlalu pendek. Salin seluruh kunci dari dashboard penyedia.").max(300, "Kunci terlalu panjang.").regex(/^\S+$/, "Kunci tidak boleh berisi spasi.");
const modelText = z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9._:/-]+$/, "Nama model hanya boleh berisi huruf, angka, titik, garis, titik dua, dan garis miring.");
const baseUrlText = z.string().trim().url("Base URL harus berupa URL yang valid.").max(200).regex(/^https?:\/\//, "Base URL harus dimulai dengan http:// atau https://");
const id = z.string().regex(/^[a-f0-9]{12}$/);

// OpenRouter pool
const addSchema = z.object({ action: z.literal("add"), apiKey: keyText, label: z.string().trim().max(40).optional(), model: modelText.optional() });
const bulkSchema = z.object({ action: z.literal("bulk"), apiKeys: z.array(keyText).min(1).max(50) });
const modelSchema = z.object({ action: z.literal("model"), model: modelText });
const keyModelSchema = z.object({ action: z.literal("keymodel"), id, model: modelText });
const idSchema = z.object({ action: z.enum(["remove", "primary", "reset"]), id });
// Paid providers
const paidAddSchema = z.object({ action: z.literal("paid-add"), name: z.string().trim().min(2, "Isi nama penyedia.").max(40), baseUrl: baseUrlText, apiKey: keyText, model: modelText });
const paidModelSchema = z.object({ action: z.literal("paid-model"), id, model: modelText });
const paidIdSchema = z.object({ action: z.enum(["paid-remove", "paid-reset"]), id });
// Shared
const activeSchema = z.object({ action: z.literal("active"), source: z.union([z.literal(OPENROUTER_SOURCE), z.string().regex(/^paid:[a-f0-9]{12}$/)]) });
const checkSchema = z.object({ action: z.literal("check") });
/** Model catalogue: OpenRouter by default, a typed provider (baseUrl + apiKey), or a saved paid provider (paidId). */
const modelsSchema = z.object({ action: z.literal("models"), baseUrl: baseUrlText.optional(), apiKey: keyText.optional(), paidId: id.optional() });
const bodySchema = z.discriminatedUnion("action", [addSchema, bulkSchema, modelSchema, keyModelSchema, idSchema, paidAddSchema, paidModelSchema, paidIdSchema, activeSchema, checkSchema, modelsSchema]);

/** Owner-only. Keys are never returned, only their last four characters. */
async function owner(request: Request, mutating: boolean) {
  if (mutating) requireSameOrigin(request);
  const user = await requireRole("OWNER");
  if (mutating && !rateLimit(`ai-key:${user.id}`, 20, 60 * 1000)) throw Object.assign(new Error("rate"), { plain: "Terlalu banyak percobaan. Tunggu sebentar." });
  return user;
}
const tooMany = (error: unknown) => (error instanceof Error && "plain" in error ? Response.json({ error: String((error as { plain: string }).plain) }, { status: 429 }) : null);
const checkInfo = (check: { label: string; limit: number | null; remaining: number | null }) => ({ label: check.label, limit: check.limit, remaining: check.remaining });
const gone = (what: string) => Response.json({ error: `${what} itu sudah tidak ada. Muat ulang halaman.` }, { status: 404 });

export async function GET(request: Request) {
  try {
    await owner(request, false);
    return Response.json({ status: await readAiKeyStatus() });
  } catch (error) { return jsonError(error); }
}

/**
 * One endpoint, an `action` per change.
 * OpenRouter pool: add (tested first), bulk, model, keymodel, remove, primary, reset.
 * Paid providers: paid-add (tested first), paid-model, paid-remove, paid-reset.
 * Shared: active (which source goes first), check (re-test the source in use), models (read a catalogue).
 */
export async function POST(request: Request) {
  try {
    const user = await owner(request, true);
    const input = bodySchema.parse(await request.json());
    const saved = await readAiSettings();

    if (input.action === "bulk") {
      const total = saved.keys.length;
      if (total >= MAX_KEYS) return Response.json({ error: `Sudah ${MAX_KEYS} kunci tersimpan. Hapus beberapa dulu.` }, { status: 400 });
      const allowed = input.apiKeys.slice(0, MAX_KEYS - total);
      const added = await addAiKeysBulk(user, allowed);
      await audit(user.id, "AI_KEYS_BULK_ADDED", "IntegrationSetting", "bulk", null, { added, total: total + added });
      // Fill the free-model backup pool right away so rotation works without another click. Best effort.
      const list = await listAiModels(allowed[0], OPENROUTER_BASE_URL);
      if (list.ok) await saveFreeModels(list.freeModels);
      return Response.json({ status: await readAiKeyStatus(), added, models: list.ok ? list.models : undefined, freeModels: list.ok ? list.freeModels : undefined });
    }

    if (input.action === "check") {
      const current = await currentAiKey();
      if (!current) return Response.json({ error: "Belum ada kunci AI yang terpasang." }, { status: 409 });
      const check = await checkAiKey(current.apiKey, current.model, current.baseUrl);
      if (!check.ok) return Response.json({ error: check.reason }, { status: 422 });
      return Response.json({ status: await readAiKeyStatus(), check: checkInfo(check) });
    }

    if (input.action === "models") {
      const paid = input.paidId ? saved.paid.find((p) => p.id === input.paidId) : null;
      if (input.paidId && !paid) return gone("Penyedia");
      const baseUrl = paid?.baseUrl || input.baseUrl || OPENROUTER_BASE_URL;
      const key = paid?.apiKey || input.apiKey?.trim() || (baseUrl === OPENROUTER_BASE_URL ? saved.keys.find((row) => row.secret)?.secret : null) || null;
      if (!key) return Response.json({ error: "Tempel kunci API dulu supaya daftar model bisa dibaca." }, { status: 400 });
      const list = await listAiModels(key, baseUrl);
      if (!list.ok) return Response.json({ error: list.reason }, { status: 422 });
      // Only the OpenRouter catalogue feeds the free-model backup pool.
      if (baseUrl === OPENROUTER_BASE_URL) await saveFreeModels(list.freeModels);
      return Response.json({ status: await readAiKeyStatus(), models: list.models, freeModels: list.freeModels });
    }

    if (input.action === "add") {
      if (saved.keys.length >= MAX_KEYS) return Response.json({ error: `Maksimal ${MAX_KEYS} kunci. Hapus yang tidak dipakai dulu.` }, { status: 400 });
      if (saved.keys.some((key) => key.secret === input.apiKey)) return Response.json({ error: "Kunci ini sudah ada di daftar." }, { status: 409 });
      const check = await checkAiKey(input.apiKey, input.model || saved.model || DEFAULT_OPENROUTER_MODEL, OPENROUTER_BASE_URL);
      if (!check.ok) return Response.json({ error: check.reason }, { status: 422 });
      const keyId = await addAiKey(user, input);
      const after = await readAiSettings();
      if (after.keys.find((key) => key.id === keyId)?.secret !== input.apiKey) return Response.json({ error: "Kunci tersimpan tetapi belum terbaca ulang oleh aplikasi. Muat ulang halaman dan coba lagi." }, { status: 500 });
      await audit(user.id, "AI_KEY_ADDED", "IntegrationSetting", keyId, null, { hint: input.apiKey.slice(-4), label: input.label ?? "" });
      return Response.json({ status: await readAiKeyStatus(), check: checkInfo(check) });
    }

    if (input.action === "paid-add") {
      if (saved.paid.length >= MAX_PAID) return Response.json({ error: `Maksimal ${MAX_PAID} penyedia. Hapus yang tidak dipakai dulu.` }, { status: 400 });
      if (input.baseUrl.replace(/\/$/, "") === OPENROUTER_BASE_URL) return Response.json({ error: "Kunci OpenRouter ditambahkan di bagian OpenRouter, bukan di sini." }, { status: 400 });
      const check = await checkAiKey(input.apiKey, input.model, input.baseUrl.replace(/\/$/, ""));
      if (!check.ok) return Response.json({ error: check.reason }, { status: 422 });
      const paidId = await addPaidProvider(user, input);
      // Nothing usable on OpenRouter yet: the new provider starts writing right away.
      const openRouterReady = saved.keys.some((key) => key.secret && key.status !== "rejected");
      if (!openRouterReady && saved.active === OPENROUTER_SOURCE) await saveActiveSource(user, `paid:${paidId}`);
      await audit(user.id, "AI_PAID_PROVIDER_ADDED", "IntegrationSetting", paidId, null, { name: input.name, baseUrl: input.baseUrl, model: input.model, hint: input.apiKey.slice(-4) });
      return Response.json({ status: await readAiKeyStatus(), check: checkInfo(check) });
    }

    if (input.action === "paid-model") {
      const paid = saved.paid.find((p) => p.id === input.id);
      if (!paid) return gone("Penyedia");
      if (!paid.apiKey) return Response.json({ error: "Kunci penyedia ini tidak bisa dibaca lagi. Hapus lalu tambahkan ulang." }, { status: 409 });
      await savePaidModel(user, paid, input.model);
      await audit(user.id, "AI_PAID_MODEL_CHANGED", "IntegrationSetting", input.id, null, { model: input.model });
      return Response.json({ status: await readAiKeyStatus() });
    }

    if (input.action === "paid-remove" || input.action === "paid-reset") {
      if (!saved.paid.some((p) => p.id === input.id)) return gone("Penyedia");
      if (input.action === "paid-remove") {
        await removePaidProvider(input.id);
        if (saved.active === `paid:${input.id}`) await saveActiveSource(user, OPENROUTER_SOURCE);
      } else await resetPaidProvider(input.id);
      await audit(user.id, input.action === "paid-remove" ? "AI_PAID_PROVIDER_REMOVED" : "AI_PAID_PROVIDER_RESET", "IntegrationSetting", input.id, null, {});
      return Response.json({ status: await readAiKeyStatus() });
    }

    if (input.action === "active") {
      if (input.source !== OPENROUTER_SOURCE && !saved.paid.some((p) => `paid:${p.id}` === input.source)) return gone("Penyedia");
      await saveActiveSource(user, input.source);
      await audit(user.id, "AI_ACTIVE_SOURCE_CHANGED", "IntegrationSetting", "ai.active", null, { source: input.source });
      return Response.json({ status: await readAiKeyStatus() });
    }

    if (input.action === "keymodel") {
      if (!saved.keys.some((key) => key.id === input.id)) return gone("Kunci");
      await saveAiKeyModel(user, input.id, input.model);
      await audit(user.id, "AI_KEY_MODEL_CHANGED", "IntegrationSetting", input.id, null, { model: input.model });
      return Response.json({ status: await readAiKeyStatus() });
    }

    if (input.action === "model") {
      await saveAiModel(user, input.model);
      await audit(user.id, "AI_MODEL_CHANGED", "IntegrationSetting", "ai.model", null, { model: input.model });
      return Response.json({ status: await readAiKeyStatus() });
    }

    if (!saved.keys.some((key) => key.id === input.id)) return gone("Kunci");
    if (input.action === "remove") await removeAiKey(input.id);
    else if (input.action === "primary") await makePrimary(input.id);
    else await resetAiKey(input.id);
    await audit(user.id, `AI_KEY_${input.action.toUpperCase()}`, "IntegrationSetting", input.id, null, {});
    return Response.json({ status: await readAiKeyStatus() });
  } catch (error) { return tooMany(error) ?? jsonError(error); }
}

/** Forgets every dashboard key, paid provider and model; the server environment key (if any) is used again. */
export async function DELETE(request: Request) {
  try {
    const user = await owner(request, true);
    await clearAiSettings();
    await audit(user.id, "AI_SETTINGS_CLEARED", "IntegrationSetting", "ai", null, {});
    return Response.json({ status: await readAiKeyStatus() });
  } catch (error) { return tooMany(error) ?? jsonError(error); }
}
