import { aiConfiguration } from "@/lib/ai";
import { readAiSettings, type KeyStatus } from "@/lib/ai-settings";

export interface AiKeyView {
  id: string;
  label: string;
  hint: string;
  status: KeyStatus;
  unreadable: boolean;
  cooldownUntil: string | null;
  lastError: string;
  lastUsedAt: string | null;
  addedByName: string;
  /** Per-key model override; null means global fallback. */
  model: string | null;
}

/** What the owner sees about AI keys. Never contains a full key. */
export interface AiKeyStatus {
  configured: boolean;
  source: "dashboard" | "env" | null;
  provider: string | null;
  baseUrl: string | null;
  model: string | null;
  envKey: boolean;
  keys: AiKeyView[];
  testMode: boolean;
  /** Number of free models cached for auto-rotation. */
  freeModelCount: number;
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
    keys: saved.keys.map((key) => ({ id: key.id, label: key.label, hint: key.hint, status: key.status, unreadable: key.secret === null, cooldownUntil: key.cooldownUntil?.toISOString() ?? null, lastError: key.lastError, lastUsedAt: key.lastUsedAt?.toISOString() ?? null, addedByName: key.addedByName, model: key.model })),
    testMode: config.mode === "test adapter",
    freeModelCount: saved.freeModels.length,
  };
}
