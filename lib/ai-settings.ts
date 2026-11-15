import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

const KEY_API = "ai.openrouter.apiKey";
const KEY_MODEL = "ai.model";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_OPENROUTER_MODEL = "qwen/qwen3-235b-a22b-2507";

/** What the owner saved in the dashboard. Every field is empty when nothing is saved or the database cannot be read. */
export interface AiOverride {
  apiKey: string | null;
  model: string | null;
  /** Last characters of the key; safe to show. */
  hint: string;
  updatedAt: Date | null;
  updatedByName: string;
  /** True when a key is stored but cannot be decrypted (SESSION_SECRET changed). */
  unreadable: boolean;
}

const EMPTY: AiOverride = { apiKey: null, model: null, hint: "", updatedAt: null, updatedByName: "", unreadable: false };

/** Read fresh on every call, so a new key is used by the very next request in any process. Never throws. */
export async function readAiOverride(): Promise<AiOverride> {
  try {
    const rows = await db.integrationSetting.findMany({ where: { key: { in: [KEY_API, KEY_MODEL] } } });
    const keyRow = rows.find((row) => row.key === KEY_API);
    const modelRow = rows.find((row) => row.key === KEY_MODEL);
    const apiKey = keyRow ? decryptSecret(keyRow.value) : null;
    return {
      apiKey,
      model: modelRow ? decryptSecret(modelRow.value) : null,
      hint: apiKey && keyRow ? keyRow.hint : "",
      updatedAt: keyRow?.updatedAt ?? modelRow?.updatedAt ?? null,
      updatedByName: keyRow?.updatedByName ?? modelRow?.updatedByName ?? "",
      unreadable: Boolean(keyRow && !apiKey),
    };
  } catch { return EMPTY; }
}

export async function saveAiSettings(by: { name: string }, input: { apiKey?: string; model?: string }) {
  if (input.apiKey) {
    await db.integrationSetting.upsert({
      where: { key: KEY_API },
      create: { key: KEY_API, value: encryptSecret(input.apiKey), hint: input.apiKey.slice(-4), updatedByName: by.name },
      update: { value: encryptSecret(input.apiKey), hint: input.apiKey.slice(-4), updatedByName: by.name },
    });
  }
  if (input.model) {
    await db.integrationSetting.upsert({
      where: { key: KEY_MODEL },
      create: { key: KEY_MODEL, value: encryptSecret(input.model), updatedByName: by.name },
      update: { value: encryptSecret(input.model), updatedByName: by.name },
    });
  }
}

/** Removes the dashboard key and model; the server environment takes over again. */
export async function clearAiSettings() {
  await db.integrationSetting.deleteMany({ where: { key: { in: [KEY_API, KEY_MODEL] } } });
}

export type KeyCheck =
  | { ok: true; label: string; limit: number | null; remaining: number | null }
  | { ok: false; reason: string };

const REASONS: Record<number, string> = {
  401: "OpenRouter tidak mengenali kunci ini. Periksa lagi, pastikan tidak ada spasi, lalu salin ulang dari openrouter.ai/settings/keys.",
  402: "Kredit OpenRouter pada kunci ini habis. Isi kredit di openrouter.ai atau pakai kunci lain.",
  403: "Kunci ini ditolak OpenRouter. Buat kunci baru di openrouter.ai/settings/keys.",
  404: "Model yang dipilih tidak ditemukan di OpenRouter. Periksa penulisan nama modelnya.",
  429: "OpenRouter sedang membatasi permintaan. Tunggu beberapa menit lalu coba lagi.",
};

/** Proves a key works: asks OpenRouter who it belongs to (and how much credit is left), then makes one tiny completion with the chosen model. */
export async function checkOpenRouterKey(apiKey: string, model: string): Promise<KeyCheck> {
  const headers = { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "HTTP-Referer": process.env.ADMIN_BASE_URL || "http://localhost:3000", "X-Title": "Newsroom" };
  try {
    const info = await fetch(`${OPENROUTER_BASE_URL}/auth/key`, { headers, signal: AbortSignal.timeout(15000) });
    if (!info.ok) return { ok: false, reason: REASONS[info.status] ?? `OpenRouter menjawab dengan kode ${info.status}. Coba lagi sebentar lagi.` };
    const data = (await info.json() as { data?: { label?: string; limit?: number | null; limit_remaining?: number | null } }).data ?? {};
    const completion = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, { method: "POST", headers, body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: "user", content: "Balas dengan satu kata: OK" }] }), signal: AbortSignal.timeout(30000) });
    if (!completion.ok) return { ok: false, reason: REASONS[completion.status] ?? `Kunci dikenali, tetapi model ${model} belum bisa dipakai (kode ${completion.status}).` };
    return { ok: true, label: data.label ?? "", limit: data.limit ?? null, remaining: data.limit_remaining ?? null };
  } catch {
    return { ok: false, reason: "Tidak bisa menghubungi OpenRouter dari server. Periksa koneksi internet server, lalu coba lagi." };
  }
}
