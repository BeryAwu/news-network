import { aiConfiguration } from "@/lib/ai";
import { readAiSettings, type KeyStatus } from "@/lib/ai-settings";

export interface AiKeyView {
  id: string;
  label: string;
  /** Last four characters only. */
  hint: string;
  status: KeyStatus;
  /** The key cannot be decrypted (SESSION_SECRET changed): the owner must add it again. */
  unreadable: boolean;
  cooldownUntil: string | null;
  lastError: string;
  lastUsedAt: string | null;
  addedByName: string;
}

/** What the owner sees about AI keys. Never contains a full key. */
export interface AiKeyStatus {
  configured: boolean;
  /** Where the next AI call gets its key. */
  source: "dashboard" | "env" | null;
  provider: string | null;
  baseUrl: string | null;
  model: string | null;
  /** The server environment has a key too; it is the last fallback. */
  envKey: boolean;
  keys: AiKeyView[];
  testMode: boolean;
}

export async function readAiKeyStatus(): Promise<AiKeyStatus> {
  const [config, saved] = await Promise.all([aiConfiguration(), readAiSettings()]);
  return {
    configured: config.configured && config.mode !== "test adapter",
    source: config.keySource,
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    envKey: Boolean(process.env.AI_API_KEY) && ["openai", "openai-compatible", "openrouter"].includes(process.env.AI_PROVIDER?.trim().toLowerCase() ?? ""),
    keys: saved.keys.map((key) => ({ id: key.id, label: key.label, hint: key.hint, status: key.status, unreadable: key.secret === null, cooldownUntil: key.cooldownUntil?.toISOString() ?? null, lastError: key.lastError, lastUsedAt: key.lastUsedAt?.toISOString() ?? null, addedByName: key.addedByName })),
    testMode: config.mode === "test adapter",
  };
}
