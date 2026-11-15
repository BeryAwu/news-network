import { aiConfiguration } from "@/lib/ai";
import { readAiOverride } from "@/lib/ai-settings";

/** What the owner sees about the AI key. Contains only the last four characters of the key. */
export interface AiKeyStatus {
  configured: boolean;
  source: "dashboard" | "env" | null;
  provider: string | null;
  model: string | null;
  /** Last four characters of the dashboard key, or "" when the key comes from the server environment. */
  hint: string;
  updatedAt: string | null;
  updatedByName: string;
  /** A dashboard key exists but cannot be read (SESSION_SECRET was changed): the owner must enter it again. */
  unreadable: boolean;
  testMode: boolean;
}

export async function readAiKeyStatus(): Promise<AiKeyStatus> {
  const [config, override] = await Promise.all([aiConfiguration(), readAiOverride()]);
  return {
    configured: config.configured && config.mode !== "test adapter",
    source: config.keySource,
    provider: config.provider,
    model: config.model,
    hint: config.keySource === "dashboard" ? override.hint : "",
    updatedAt: override.updatedAt?.toISOString() ?? null,
    updatedByName: override.updatedByName,
    unreadable: override.unreadable,
    testMode: config.mode === "test adapter",
  };
}
