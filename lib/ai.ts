import { z } from "zod";
import { createHash } from "node:crypto";
import { attemptOrder, DEFAULT_OPENROUTER_MODEL, OPENROUTER_BASE_URL, readAiSettings, recordKeyOutcome, roundRobinKey } from "@/lib/ai-settings";

export const PROMPT_VERSION = "news-draft-id-v3";
export const articleDraftSchema = z.object({ title: z.string().min(8).max(180), excerpt: z.string().min(12).max(500), body: z.string().min(120).max(30000), suggestedCategory: z.string().max(100), tags: z.array(z.string().max(40)).max(12), seoTitle: z.string().max(180), metaDescription: z.string().max(300), slugSuggestion: z.string().max(140), imageBrief: z.string().max(1000), claimsUsed: z.array(z.object({ claimText: z.string().min(1).max(500), sourceFactIds: z.array(z.string().max(80)).max(10) })).max(50), uncertainties: z.array(z.string().max(500)).max(50) });
export type ArticleDraft = z.infer<typeof articleDraftSchema>;
export class IntegrationNotConfigured extends Error { constructor(integration: string) { super(`${integration} is not configured. Add server-side credentials in the environment settings.`); } }
/** Raised when model output cites evidence that does not exist or is not verified. Retryable with corrective feedback. */
export class DraftEvidenceValidationError extends Error { readonly problems: string[]; constructor(problems: string[]) { super(`The AI cited evidence the newsroom cannot verify: ${problems.join("; ")}.`); this.problems = problems; } }
export interface EvidenceFact { id: string; claimText: string; supportStatus: string; evidenceNote: string; sourceReferenceId: string | null }
export function validateDraftEvidence(draft: ArticleDraft, facts: EvidenceFact[], references: { id: string; retrievalStatus: string }[]) {
  const knownFacts = new Map(facts.map((fact) => [fact.id, fact]));
  const fetchedReferences = new Set(references.filter((reference) => reference.retrievalStatus === "SUCCESS").map((reference) => reference.id));
  const problems: string[] = [];
  for (const [index, claim] of draft.claimsUsed.entries()) for (const factId of claim.sourceFactIds) {
    const fact = knownFacts.get(factId);
    if (!fact) { problems.push(`claimsUsed[${index}] references fact id "${factId}" which was not supplied; remove it or use only the provided fact ids`); continue; }
    if (fact.supportStatus !== "SUPPORTED") { problems.push(`claimsUsed[${index}] cites fact "${factId}" marked ${fact.supportStatus}; only SUPPORTED facts may support a claim`); continue; }
    if (!fact.sourceReferenceId || !fetchedReferences.has(fact.sourceReferenceId)) problems.push(`claimsUsed[${index}] cites fact "${factId}" whose source reference was not fetched successfully`);
  }
  if (problems.length) throw new DraftEvidenceValidationError(problems);
  return draft;
}
/** Safe to hand to pages and clients: never contains a key. */
export interface AiConfiguration { configured: boolean; mode: string; provider: string | null; model: string | null; keySource: "dashboard" | "env" | null; baseUrl: string | null }
/** One key to try, in order. `id` is the dashboard key id, or null for the server environment key. */
interface AiCandidate { id: string | null; apiKey: string; provider: string; baseUrl: string; model: string | null }
interface AiCredentials extends AiConfiguration { candidates: AiCandidate[]; fallbackModel: string; freeModels: string[] }

/** Dashboard keys (healthy first) come before the server environment key; read fresh on every call. */
async function resolveAi(): Promise<AiCredentials> {
  const test = process.env.AI_TEST_ADAPTER === "true" && process.env.NODE_ENV !== "production";
  if (test) return { configured: true, mode: "test adapter", provider: "test", model: "deterministic-test-v1", baseUrl: null, keySource: null, candidates: [], fallbackModel: "", freeModels: [] };
  const saved = await readAiSettings();
  const envProvider = process.env.AI_PROVIDER?.trim().toLowerCase() || "";
  const allUsable = saved.keys.filter((k) => k.secret && k.status !== "rejected");
  const primary = await roundRobinKey(allUsable);
  const provider = saved.provider || "openrouter";
  const baseUrl = saved.baseUrl || (provider === "openrouter" ? OPENROUTER_BASE_URL : "https://api.openai.com/v1");
  const dashboard: AiCandidate[] = primary
    ? [{ id: primary.id, apiKey: primary.secret as string, provider, baseUrl, model: primary.model },
       ...allUsable.filter((k) => k.id !== primary.id).map((k): AiCandidate => ({ id: k.id, apiKey: k.secret as string, provider, baseUrl, model: k.model }))]
    : [];
  const supported = envProvider === "openai" || envProvider === "openai-compatible" || envProvider === "openrouter";
  const envCandidates: AiCandidate[] = supported && process.env.AI_API_KEY ? [{ id: null, apiKey: process.env.AI_API_KEY, provider: envProvider, baseUrl: process.env.AI_BASE_URL || (envProvider === "openrouter" ? OPENROUTER_BASE_URL : "https://api.openai.com/v1"), model: null }] : [];
  const candidates = [...dashboard, ...envCandidates];
  const resolvedProvider = candidates[0]?.provider ?? (envProvider || null);
  const resolvedBaseUrl = candidates[0]?.baseUrl ?? null;
  const fallbackModel = process.env.AI_FALLBACK_MODEL || (resolvedProvider === "openrouter" || !resolvedProvider ? "qwen/qwen3-32b" : saved.model || "");
  const envModel = resolvedProvider === "openrouter" || !dashboard.length ? process.env.AI_MODEL : "";
  const model = saved.model || envModel || (resolvedProvider === "openrouter" ? DEFAULT_OPENROUTER_MODEL : null);
  const mode = candidates.length ? "credentials configured" : !envProvider ? "not configured" : !supported ? "unsupported provider" : "not configured";
  return { configured: candidates.length > 0, mode, provider: resolvedProvider, model, baseUrl: resolvedBaseUrl, keySource: dashboard.length ? "dashboard" : envCandidates.length ? "env" : null, candidates, fallbackModel, freeModels: saved.freeModels };
}
export async function aiConfiguration(): Promise<AiConfiguration> {
  const { configured, mode, provider, model, baseUrl, keySource } = await resolveAi();
  return { configured, mode, provider, model, baseUrl, keySource };
}

/** The key tried first right now plus the model and baseUrl, for the owner re-check button. Never sent to a browser. */
export async function currentAiKey(): Promise<{ apiKey: string; model: string; baseUrl: string } | null> {
  const config = await resolveAi();
  const first = config.candidates[0];
  if (!first) return null;
  return { apiKey: first.apiKey, model: config.model || DEFAULT_OPENROUTER_MODEL, baseUrl: first.baseUrl };
}

/** Thrown when the AI provider answers with a non-2xx status. The message keeps the old wording. */
export class AiProviderError extends Error { constructor(public readonly status: number, model?: string) { super(`AI provider returned HTTP ${status}${model ? ` for model ${model}` : ""}.`); } }

/** Plain Indonesian reason for a failed AI run, from the stored technical message. */
export function plainAiFailure(message: string | null | undefined): string {
  const status = message?.match(/HTTP (\d{3})/)?.[1];
  if (status === "401" || status === "403") return "Kunci AI ditolak penyedia. Pemilik bisa menggantinya di Koneksi layanan, lalu coba lagi.";
  if (status === "402") return "Kredit AI habis. Pemilik bisa mengisi kredit atau mengganti kunci di Koneksi layanan, lalu coba lagi.";
  if (status === "404") return "Model AI yang dipilih tidak ada di penyedia. Ganti nama model di Koneksi layanan (misalnya ngodeai/glm-5.3-flash), lalu coba lagi.";
  if (status === "429") return "Penyedia AI membatasi permintaan. Tunggu beberapa menit, lalu coba lagi.";
  if (message && /not configured/i.test(message)) return "Layanan AI belum disiapkan. Pemilik bisa memasang kunci di Koneksi layanan.";
  if (message && /timeout|abort/i.test(message)) return "Penyedia AI terlalu lama menjawab. Coba lagi, atau pilih model yang lebih cepat di Koneksi layanan.";
  return "Penulisan oleh AI gagal. Coba lagi. Kalau tetap gagal, periksa penyedia dan model di Koneksi layanan.";
}
interface ArticleRevisionContext { title: string; excerpt: string; body: string; seoTitle: string; metaDescription: string; tags: string[]; imageBrief: string }
interface AiBrief { workingTitle: string; narrative: string; editorNotes: string; sourceSummary: string | null; references: { id: string; url: string; title: string; publisherName: string; excerpt: string | null; retrievalStatus: string }[]; facts: { id: string; claimText: string; supportStatus: string; evidenceNote: string; sourceReferenceId: string | null }[] }
interface AiMedia { displayName: string; profile: { niche: string; targetAudience: string; editorialMission: string; toneGuidelines: string; styleGuidelines: string; language: string; preferredWordCountMin: number; preferredWordCountMax: number }; categories: { name: string }[] }
function promptInput(brief: AiBrief, media: AiMedia, instruction?: string, currentArticle?: ArticleRevisionContext, guidance?: string) {
  const factsRule = brief.facts.length
    ? `For every factual assertion in claimsUsed, include the exact supplied claimText and only sourceFactIds from the provided facts (${brief.facts.map((fact) => fact.id).join(", ")}). Empty sourceFactIds are allowed only for user narrative context.`
    : "No source facts were supplied for this brief, so every claimsUsed entry MUST have an empty sourceFactIds array; never invent or guess fact ids.";
  const { preferredWordCountMin: minWords, preferredWordCountMax: maxWords } = media.profile;
  const lengthRule = `Aim for ${minWords} to ${maxWords} words in the article body when the supplied material supports that length.`;
  const requirements = "Write in Indonesian. Follow the revision instruction exactly — you may restructure, shorten, expand, rephrase, change tone, or rewrite any part of the article. The only hard limit: never invent specific proper names, statistics, dates, or direct quotes that are not present in the supplied narrative or reference excerpts. " + lengthRule + " " + factsRule + " If the supplied narrative is empty, compose an original news narrative from the workingTitle using only the media profile and general, verifiable public context; flag every assumption as an uncertainty. Return only JSON matching the requested fields." + (guidance ? `\n\nStylistic guidance (skill): ${guidance}` : "");
  return { brief: { workingTitle: brief.workingTitle, narrative: brief.narrative, editorNotes: brief.editorNotes, sourceSummary: brief.sourceSummary, references: brief.references.map(({ id, url, title, publisherName, excerpt, retrievalStatus }) => ({ id, url, title, publisherName, excerpt, retrievalStatus })), facts: brief.facts }, media: { name: media.displayName, profile: media.profile, categories: media.categories.map(({ name }) => name) }, currentArticle: currentArticle ?? null, revisionInstruction: instruction ?? null, requirements };
}
function testDraft(input: ReturnType<typeof promptInput>): ArticleDraft {
  const evidence = [input.brief.narrative, ...input.brief.references.filter((reference) => reference.retrievalStatus === "SUCCESS" && reference.excerpt).map((reference) => `${reference.title}: ${reference.excerpt}`), ...(input.currentArticle ? [input.currentArticle.body] : [])].filter(Boolean);
  const evidenceText = evidence.join("\n\n").slice(0, 9000);
  const topic = input.brief.workingTitle;
  const angle = input.media.profile.niche ? ` Dari sudut ${input.media.profile.niche}, pembahasan ini juga relevan bagi ${input.media.profile.targetAudience || "pembaca"}.` : "";
  const body = (evidenceText ? `${evidenceText}\n\n` : "") + `${angle}\n\nCatatan redaksi: naskah ini dibuat dengan adapter uji deterministik, bukan layanan AI produksi. Narasi disusun dari tema yang diberikan dan belum diverifikasi.`.slice(0, 30000);
  return articleDraftSchema.parse({ title: `${topic} — ${input.media.name}`, excerpt: `${topic}. Draf uji ini disusun dari konteks yang diberikan dan memerlukan pemeriksaan redaksi.`, body, suggestedCategory: input.media.categories[0] ?? "Umum", tags: [], seoTitle: topic, metaDescription: `Informasi yang disediakan tentang ${topic}; periksa sumber dan konteks sebelum diterbitkan.`, slugSuggestion: topic, imageBrief: `Ilustrasi editorial yang relevan dengan ${topic}; jangan disajikan sebagai foto dokumenter.`, claimsUsed: input.brief.narrative ? [{ claimText: "Konteks berasal dari narasi yang diberikan oleh pengguna.", sourceFactIds: [] }] : [], uncertainties: ["Konten dihasilkan oleh adapter uji; belum diverifikasi oleh layanan AI maupun redaksi.", ...input.brief.references.filter((reference) => reference.retrievalStatus !== "SUCCESS").map((reference) => `Referensi tidak berhasil diverifikasi: ${reference.url}`)] });
}
export async function generateDraft(brief: AiBrief, media: AiMedia, instruction?: string, currentArticle?: ArticleRevisionContext, guidance?: string) {
  const config = await resolveAi();
  if (!config.configured || !config.provider) throw new IntegrationNotConfigured("AI provider");
  if (config.provider === "test") return draftWith(config, null, brief, media, instruction, currentArticle, guidance);
  let failure: unknown = null;
  for (const candidate of config.candidates) {
    try {
      const result = await draftWith(config, candidate, brief, media, instruction, currentArticle, guidance);
      if (candidate.id) await recordKeyOutcome(candidate.id, { ok: true });
      return result;
    } catch (error) {
      if (!(error instanceof AiProviderError)) throw error;
      failure = error;
      if (candidate.id) await recordKeyOutcome(candidate.id, { httpStatus: error.status });
      // Only a problem with the key itself moves on to the next key; any other provider error would repeat.
      if (![401, 402, 403, 429].includes(error.status)) throw error;
    }
  }
  throw failure;
}
async function draftWith(config: AiCredentials, candidate: AiCandidate | null, brief: AiBrief, media: AiMedia, instruction?: string, currentArticle?: ArticleRevisionContext, guidance?: string) {
  const provider = candidate?.provider ?? config.provider as string;
  const input = promptInput(brief, media, instruction, currentArticle, guidance);
  const started = Date.now();
  if (provider === "test") return { draft: testDraft(input), provider, model: config.model || "deterministic-test-v1", promptVersion: PROMPT_VERSION, latencyMs: Date.now() - started, inputHash: createHash("sha256").update(JSON.stringify(input)).digest("hex"), inputTokens: null as number | null, outputTokens: null as number | null, changeSummary: "Adapter uji deterministik; verifikasi editorial tetap diwajibkan." };
  const base = candidate?.baseUrl ?? "";
  // If no model is explicitly set, pick a random free model; otherwise use configured model
  const autoModel = config.freeModels.length > 0 ? config.freeModels[Math.floor(Math.random() * config.freeModels.length)] : "gpt-4o-mini";
  const primaryModel = candidate?.model || config.model || autoModel;
  // Build model rotation list: primary first, then shuffled free models (skip duplicates)
  const freePool = config.freeModels.filter((m) => m !== primaryModel).sort(() => Math.random() - 0.5);
  const modelQueue = [primaryModel, ...freePool];
  const firstAttemptMessage = `${JSON.stringify(input)}\n\nReturn JSON with title, excerpt, body, suggestedCategory, tags, seoTitle, metaDescription, slugSuggestion, imageBrief, claimsUsed as {claimText,sourceFactIds} objects, and uncertainties.`;
  let likelyError: string | null = null;
  const lastError = await (async () => {
    for (let mi = 0; mi < Math.min(modelQueue.length, 6); mi += 1) {
      const attemptModel = modelQueue[mi];
      let response: Response;
      try {
        response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${candidate?.apiKey}`, "content-type": "application/json", ...(provider === "openrouter" ? { "HTTP-Referer": process.env.ADMIN_BASE_URL || "http://localhost:3000", "X-OpenRouter-Title": "News Network Management System" } : {}) }, signal: AbortSignal.timeout(90000), body: JSON.stringify({ model: attemptModel, temperature: 0.4, max_tokens: 3000, response_format: { type: "json_object" }, ...(provider === "openrouter" ? { provider: { require_parameters: true, data_collection: "deny" } } : {}), messages: [{ role: "system", content: input.requirements }, { role: "user", content: mi === 0 ? firstAttemptMessage : likelyError ? `${firstAttemptMessage}\n\nYour previous response failed validation with these errors, and must be fixed:\n${JSON.stringify({ errors: likelyError }, null, 2)}` : firstAttemptMessage }] }) });
      } catch {
        // Network error or timeout — try next free model
        likelyError = `Model ${attemptModel} timed out or unreachable.`;
        continue;
      }
      // 524/429/503 = slow/busy — try next model; 401/402/403/404 = key/model issue — throw
      if (response.status === 524 || response.status === 429 || response.status === 503) { likelyError = `Model ${attemptModel} returned ${response.status}.`; continue; }
      if (!response.ok) throw new AiProviderError(response.status, attemptModel);
      const result = await response.json() as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      const content = result.choices?.[0]?.message?.content;
      if (!content) { likelyError = "AI provider returned no structured article."; continue; }
      let parsed: unknown;
      try { parsed = JSON.parse(content); } catch { likelyError = "The provider did not return valid JSON."; continue; }
      try {
        const draft = validateDraftEvidence(articleDraftSchema.parse(parsed), brief.facts, brief.references);
        return { draft, provider, model: attemptModel, promptVersion: PROMPT_VERSION, latencyMs: Date.now() - started, inputHash: createHash("sha256").update(JSON.stringify(input)).digest("hex"), inputTokens: result.usage?.prompt_tokens ?? null, outputTokens: result.usage?.completion_tokens ?? null, changeSummary: instruction ? `AI revision requested: ${instruction}` : "Initial AI article draft." };
      } catch (error) {
        const retryable = error instanceof DraftEvidenceValidationError || (error instanceof Error && (error.message.includes("Too small") || error.message.includes("Invalid input")));
        if (retryable) {
          likelyError = error instanceof DraftEvidenceValidationError ? `${error.message} Fix every problem listed above before resubmitting.` : error.message;
          continue;
        }
        throw error;
      }
    }
    throw new Error(likelyError ?? "AI provider returned an invalid structured article after all model attempts.");
  })();
  return lastError;
}
