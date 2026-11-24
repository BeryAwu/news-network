import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

const KEY_PREFIX = "ai.key.";
const KEY_MODEL = "ai.model";
const KEY_MODEL_PREFIX = "ai.keymodel.";
const KEY_FREE_MODELS = "ai.freeModels";
const KEY_PROVIDER = "ai.provider";
const KEY_BASE_URL = "ai.baseUrl";
const KEY_INDEX = "ai.keyIndex";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_OPENROUTER_MODEL = "qwen/qwen3-235b-a22b-2507";

export type KeyStatus = "ok" | "cooldown" | "rejected";

/** One OpenRouter key the owner saved in the dashboard. `secret` is null when it can no longer be decrypted. */
export interface StoredAiKey {
  id: string;
  label: string;
  hint: string;
  secret: string | null;
  status: KeyStatus;
  cooldownUntil: Date | null;
  lastError: string;
  lastUsedAt: Date | null;
  position: number;
  addedByName: string;
  /** Per-key model override; null means fall back to global ai.model. */
  model: string | null;
}

export interface AiSettings { keys: StoredAiKey[]; model: string | null; provider: string | null; baseUrl: string | null; freeModels: string[] }

const EMPTY: AiSettings = { keys: [], model: null, provider: null, baseUrl: null, freeModels: [] };

/** Read fresh on every call, so a change is used by the very next request in any process. Never throws. */
export async function readAiSettings(): Promise<AiSettings> {
  try {
    const rows = await db.integrationSetting.findMany({ where: { OR: [{ key: { startsWith: KEY_PREFIX } }, { key: { startsWith: KEY_MODEL_PREFIX } }, { key: KEY_MODEL }, { key: KEY_FREE_MODELS }, { key: KEY_PROVIDER }, { key: KEY_BASE_URL }] } });
    const modelRow = rows.find((row) => row.key === KEY_MODEL);
    const providerRow = rows.find((row) => row.key === KEY_PROVIDER);
    const baseUrlRow = rows.find((row) => row.key === KEY_BASE_URL);
    const freeModelsRow = rows.find((row) => row.key === KEY_FREE_MODELS);
    const freeModels: string[] = freeModelsRow ? JSON.parse(decryptSecret(freeModelsRow.value) ?? "[]") : [];
    const keyModelMap = new Map(rows.filter((row) => row.key.startsWith(KEY_MODEL_PREFIX)).map((row) => [row.key.slice(KEY_MODEL_PREFIX.length), decryptSecret(row.value)]));
    const keys = rows
      .filter((row) => row.key.startsWith(KEY_PREFIX))
      .map((row): StoredAiKey => ({ id: row.key.slice(KEY_PREFIX.length), label: row.label, hint: row.hint, secret: decryptSecret(row.value), status: (row.status as KeyStatus) || "ok", cooldownUntil: row.cooldownUntil, lastError: row.lastError, lastUsedAt: row.lastUsedAt, position: row.position, addedByName: row.updatedByName, model: keyModelMap.get(row.key.slice(KEY_PREFIX.length)) ?? null }))
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    return { keys, model: modelRow ? decryptSecret(modelRow.value) : null, provider: providerRow ? decryptSecret(providerRow.value) : null, baseUrl: baseUrlRow ? decryptSecret(baseUrlRow.value) : null, freeModels };
  } catch { return EMPTY; }
}

/**
 * The order in which keys are tried: healthy keys first (a cooldown that has passed counts as healthy),
 * then keys still cooling down (tried anyway as a last resort), and never rejected or unreadable ones.
 */
export function attemptOrder(keys: StoredAiKey[], now = new Date()): StoredAiKey[] {
  const readable = keys.filter((key) => key.secret && key.status !== "rejected");
  const healthy = readable.filter((key) => key.status === "ok" || !key.cooldownUntil || key.cooldownUntil <= now);
  const cooling = readable.filter((key) => !healthy.includes(key)).sort((a, b) => (a.cooldownUntil?.getTime() ?? 0) - (b.cooldownUntil?.getTime() ?? 0));
  return [...healthy, ...cooling];
}

export async function addAiKey(by: { name: string }, input: { apiKey: string; label?: string }) {
  const existing = await db.integrationSetting.findMany({ where: { key: { startsWith: KEY_PREFIX } }, select: { position: true } });
  const id = randomBytes(6).toString("hex");
  await db.integrationSetting.create({ data: { key: KEY_PREFIX + id, value: encryptSecret(input.apiKey), hint: input.apiKey.slice(-4), label: (input.label ?? "").trim().slice(0, 40), position: existing.length ? Math.max(...existing.map((row) => row.position)) + 1 : 0, updatedByName: by.name } });
  return id;
}

/** Adds multiple keys at once, skipping duplicates. Returns count of actually added keys. */
export async function addAiKeysBulk(by: { name: string }, apiKeys: string[]): Promise<number> {
  const existing = await db.integrationSetting.findMany({ where: { key: { startsWith: KEY_PREFIX } } });
  const existingSecrets = new Set(existing.map((row) => decryptSecret(row.value)).filter(Boolean));
  const maxPos = existing.length ? Math.max(...existing.map((row) => row.position)) : -1;
  const toAdd = [...new Set(apiKeys)].filter((k) => !existingSecrets.has(k));
  if (!toAdd.length) return 0;
  await db.integrationSetting.createMany({ data: toAdd.map((apiKey, i) => ({ key: KEY_PREFIX + randomBytes(6).toString("hex"), value: encryptSecret(apiKey), hint: apiKey.slice(-4), label: "", position: maxPos + 1 + i, updatedByName: by.name })) });
  return toAdd.length;
}

/** Atomically increments round-robin index and returns the next usable key. Never throws. */
export async function roundRobinKey(keys: StoredAiKey[]): Promise<StoredAiKey | null> {
  const usable = keys.filter((k) => k.secret && k.status !== "rejected");
  if (!usable.length) return null;
  try {
    const row = await db.integrationSetting.upsert({ where: { key: KEY_INDEX }, create: { key: KEY_INDEX, value: "0", updatedByName: "system" }, update: { value: String((parseInt((await db.integrationSetting.findUnique({ where: { key: KEY_INDEX } }))?.value ?? "0", 10) + 1) % usable.length) } });
    const idx = parseInt(row.value, 10) % usable.length;
    return usable[idx];
  } catch { return usable[0]; }
}

export async function removeAiKey(id: string) {
  await db.integrationSetting.deleteMany({ where: { key: { in: [KEY_PREFIX + id, KEY_MODEL_PREFIX + id] } } });
}

/** Makes this key the first one tried; the others keep their relative order. */
export async function makePrimary(id: string) {
  const rows = await db.integrationSetting.findMany({ where: { key: { startsWith: KEY_PREFIX } }, orderBy: [{ position: "asc" }, { key: "asc" }], select: { key: true } });
  const order = [KEY_PREFIX + id, ...rows.map((row) => row.key).filter((key) => key !== KEY_PREFIX + id)];
  await db.$transaction(order.map((key, position) => db.integrationSetting.update({ where: { key }, data: { position } })));
}

/** Puts a cooling or rejected key back in rotation (after the owner fixed it, or to try it again). */
export async function resetAiKey(id: string) {
  await db.integrationSetting.update({ where: { key: KEY_PREFIX + id }, data: { status: "ok", cooldownUntil: null, lastError: "" } });
}

export async function saveAiKeyModel(by: { name: string }, id: string, model: string) {
  await db.integrationSetting.upsert({ where: { key: KEY_MODEL_PREFIX + id }, create: { key: KEY_MODEL_PREFIX + id, value: encryptSecret(model), updatedByName: by.name }, update: { value: encryptSecret(model), updatedByName: by.name } });
}

export async function saveFreeModels(models: string[]) {
  const value = encryptSecret(JSON.stringify(models.slice(0, 500)));
  await db.integrationSetting.upsert({ where: { key: KEY_FREE_MODELS }, create: { key: KEY_FREE_MODELS, value, updatedByName: "system" }, update: { value, updatedByName: "system" } });
}

export async function saveAiModel(by: { name: string }, model: string) {
  await db.integrationSetting.upsert({ where: { key: KEY_MODEL }, create: { key: KEY_MODEL, value: encryptSecret(model), updatedByName: by.name }, update: { value: encryptSecret(model), updatedByName: by.name } });
}

export async function saveAiProvider(by: { name: string }, provider: string, baseUrl: string) {
  await db.$transaction([
    db.integrationSetting.upsert({ where: { key: KEY_PROVIDER }, create: { key: KEY_PROVIDER, value: encryptSecret(provider), updatedByName: by.name }, update: { value: encryptSecret(provider), updatedByName: by.name } }),
    db.integrationSetting.upsert({ where: { key: KEY_BASE_URL }, create: { key: KEY_BASE_URL, value: encryptSecret(baseUrl), updatedByName: by.name }, update: { value: encryptSecret(baseUrl), updatedByName: by.name } }),
  ]);
}

/** Forgets every dashboard key and the model; the server environment takes over again. */
export async function clearAiSettings() {
  await db.integrationSetting.deleteMany({ where: { OR: [{ key: { startsWith: KEY_PREFIX } }, { key: { startsWith: KEY_MODEL_PREFIX } }, { key: KEY_MODEL }, { key: KEY_FREE_MODELS }, { key: KEY_PROVIDER }, { key: KEY_BASE_URL }] } });
}

const HOUR = 60 * 60 * 1000;

/** What a failed call means for the key. 402/429 are temporary; 401/403 need the owner. Anything else leaves the key alone. */
export function keyConsequence(status: number, now = new Date()): { status: KeyStatus; cooldownUntil: Date | null; lastError: string } | null {
  if (status === 402) return { status: "cooldown", cooldownUntil: new Date(now.getTime() + 6 * HOUR), lastError: "Kredit habis" };
  if (status === 429) return { status: "cooldown", cooldownUntil: new Date(now.getTime() + 5 * 60 * 1000), lastError: "Kena batas permintaan" };
  if (status === 401 || status === 403) return { status: "rejected", cooldownUntil: null, lastError: "Kunci ditolak penyedia" };
  return null;
}

/** Best effort: a bookkeeping failure must never break the article being written. */
export async function recordKeyOutcome(id: string, outcome: { ok: true } | { httpStatus: number }) {
  try {
    if ("ok" in outcome) {
      await db.integrationSetting.updateMany({ where: { key: KEY_PREFIX + id }, data: { status: "ok", cooldownUntil: null, lastError: "", lastUsedAt: new Date() } });
      return;
    }
    const consequence = keyConsequence(outcome.httpStatus);
    if (consequence) await db.integrationSetting.updateMany({ where: { key: KEY_PREFIX + id }, data: consequence });
  } catch { /* ignored on purpose */ }
}

export type KeyCheck =
  | { ok: true; label: string; limit: number | null; remaining: number | null }
  | { ok: false; reason: string };

export type ModelList =
  | { ok: true; models: string[]; freeModels: string[] }
  | { ok: false; reason: string };

/** Reads the provider's own catalogue from GET {baseUrl}/models (OpenRouter and OpenAI-compatible both return { data: [{ id }] }). */
export async function listAiModels(apiKey: string, baseUrl: string): Promise<ModelList> {
  const headers = { authorization: `Bearer ${apiKey}`, "content-type": "application/json" };
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) return { ok: false, reason: REASONS[response.status] ?? `Penyedia menjawab dengan kode ${response.status} saat meminta daftar model.` };
    const body = await response.json() as unknown;
    const rows = Array.isArray(body) ? body as unknown[] : ((body as { data?: unknown }).data as unknown[] | undefined);
    if (!Array.isArray(rows)) return { ok: false, reason: "Penyedia tidak mengembalikan daftar model yang bisa dibaca." };
    const isFree = (row: unknown) => {
      const p = (row as { pricing?: Record<string, unknown> }).pricing;
      if (!p) return false;
      return String(p.prompt ?? "1") === "0" && String(p.completion ?? "1") === "0";
    };
    const toId = (row: unknown): string | null => {
      const id = typeof row === "string" ? row : (row as { id?: unknown }).id;
      if (typeof id !== "string" || !id.trim() || id.trim().endsWith("/")) return null;
      return id.trim();
    };
    const seen = new Set<string>();
    const models: string[] = [];
    const freeModels: string[] = [];
    for (const row of rows) {
      const id = toId(row);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      models.push(id);
      if (isFree(row)) freeModels.push(id);
    }
    models.sort((a, b) => a.localeCompare(b));
    freeModels.sort((a, b) => a.localeCompare(b));
    if (!models.length) return { ok: false, reason: "Penyedia tidak mengembalikan model apa pun untuk kunci ini." };
    return { ok: true, models: models.slice(0, 2000), freeModels: freeModels.slice(0, 2000) };
  } catch {
    return { ok: false, reason: "Tidak bisa mengambil daftar model. Periksa base URL dan koneksi internet server." };
  }
}

const REASONS: Record<number, string> = {
  401: "Penyedia API tidak mengenali kunci ini. Periksa lagi, pastikan tidak ada spasi, lalu salin ulang dari dashboard penyedia.",
  402: "Kredit pada kunci ini habis. Isi kredit di dashboard penyedia atau pakai kunci lain.",
  403: "Kunci ini ditolak penyedia. Buat kunci baru di dashboard penyedia.",
  404: "Model yang dipilih tidak ditemukan di penyedia. Periksa penulisan nama modelnya.",
  429: "Penyedia sedang membatasi permintaan. Tunggu beberapa menit lalu coba lagi.",
};

/** Proves a key works: checks auth (credit info if available), then makes one tiny completion with the chosen model. */
export async function checkAiKey(apiKey: string, model: string, baseUrl: string): Promise<KeyCheck> {
  const headers = { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "HTTP-Referer": process.env.ADMIN_BASE_URL || "http://localhost:3000", "X-Title": "Newsroom" };
  const isOpenRouter = baseUrl.includes("openrouter.ai");
  try {
    let label = "";
    let limit: number | null = null;
    let remaining: number | null = null;
    if (isOpenRouter) {
      const info = await fetch(`${baseUrl}/auth/key`, { headers, signal: AbortSignal.timeout(15000) });
      if (!info.ok) return { ok: false, reason: REASONS[info.status] ?? `Penyedia menjawab dengan kode ${info.status}. Coba lagi sebentar lagi.` };
      const data = (await info.json() as { data?: { label?: string; limit?: number | null; limit_remaining?: number | null } }).data ?? {};
      label = data.label ?? "";
      limit = data.limit ?? null;
      remaining = data.limit_remaining ?? null;
    }
    const completion = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers, body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: "user", content: "Balas dengan satu kata: OK" }] }), signal: AbortSignal.timeout(30000) });
    if (!completion.ok) return { ok: false, reason: REASONS[completion.status] ?? `Kunci dikenali, tetapi model ${model} belum bisa dipakai (kode ${completion.status}).` };
    return { ok: true, label, limit, remaining };
  } catch {
    return { ok: false, reason: "Tidak bisa menghubungi penyedia API dari server. Periksa alamat base URL dan koneksi internet server, lalu coba lagi." };
  }
}
