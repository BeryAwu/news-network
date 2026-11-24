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
  /** Per-key model override; null means the OpenRouter model. */
  model: string | null;
}

/** A paid provider as the owner sees it: no key, only its last four characters. */
export interface PaidProviderView {
  id: string;
  name: string;
  hint: string;
  baseUrl: string;
  model: string;
  status: KeyStatus;
  unreadable: boolean;
  cooldownUntil: string | null;
  lastError: string;
  lastUsedAt: string | null;
}

/** What the owner sees about AI keys. Never contains a full key. */
export interface AiKeyStatus {
  configured: boolean;
  source: "dashboard" | "env" | null;
  /** "openrouter" or "paid:<id>": the source tried first. */
  active: string;
  /** Name of the provider the next request starts with. */
  provider: string | null;
  /** Model the next request starts with. */
  model: string | null;
  /** The OpenRouter pool's model; per-key overrides win. */
  openRouterModel: string | null;
  envKey: boolean;
  keys: AiKeyView[];
  paid: PaidProviderView[];
  testMode: boolean;
  /** Number of free OpenRouter models cached for auto-rotation. */
  freeModelCount: number;
}

export async function readAiKeyStatus(): Promise<AiKeyStatus> {
  const [config, saved] = await Promise.all([aiConfiguration(), readAiSettings()]);
  return {
    configured: config.configured && config.mode !== "test adapter",
    source: config.keySource,
    active: saved.active,
    provider: config.provider,
    model: config.model,
    openRouterModel: saved.model,
    envKey: Boolean(process.env.AI_API_KEY) && ["openai", "openai-compatible", "openrouter"].includes(process.env.AI_PROVIDER?.trim().toLowerCase() ?? ""),
    keys: saved.keys.map((key) => ({ id: key.id, label: key.label, hint: key.hint, status: key.status, unreadable: key.secret === null, cooldownUntil: key.cooldownUntil?.toISOString() ?? null, lastError: key.lastError, lastUsedAt: key.lastUsedAt?.toISOString() ?? null, addedByName: key.addedByName, model: key.model })),
    paid: saved.paid.map((p) => ({ id: p.id, name: p.name, hint: p.hint, baseUrl: p.baseUrl, model: p.model, status: p.status, unreadable: p.apiKey === null, cooldownUntil: p.cooldownUntil?.toISOString() ?? null, lastError: p.lastError, lastUsedAt: p.lastUsedAt?.toISOString() ?? null })),
    testMode: config.mode === "test adapter",
    freeModelCount: saved.freeModels.length,
  };
}
