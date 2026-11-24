import { z } from "zod";
import { createHash } from "node:crypto";
import { attemptOrder, DEFAULT_OPENROUTER_MODEL, OPENROUTER_BASE_URL, OPENROUTER_SOURCE, readAiSettings, recordKeyOutcome, roundRobinKey } from "@/lib/ai-settings";

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
/**
 * One key to try, in order. `id` is what recordKeyOutcome needs (OpenRouter key id or "paid:<id>"), null for the server key.
 * `source` groups keys of one provider: a non-key failure skips the rest of that source and moves to the next one.
 * `provider` drives request behaviour ("openrouter" adds its headers and free-model rotation); `label` is what people see.
 */
interface AiCandidate { id: string | null; source: string; provider: string; label: string; apiKey: string; baseUrl: string; model: string }
interface AiCredentials extends AiConfiguration { candidates: AiCandidate[]; freeModels: string[] }

/** OpenRouter keys tried per request; the pool still rotates across requests. */
const OPENROUTER_KEYS_PER_REQUEST = 2;

/**
 * The active source goes first, the other dashboard sources are backups, the server key is last. Read fresh on every call.
 * OpenRouter keys are only ever sent to OpenRouter; a paid provider's key only to its own base URL.
 */
async function resolveAi(advanceRotation = false): Promise<AiCredentials> {
  const test = process.env.AI_TEST_ADAPTER === "true" && process.env.NODE_ENV !== "production";
  if (test) return { configured: true, mode: "test adapter", provider: "test", model: "deterministic-test-v1", baseUrl: null, keySource: null, candidates: [], freeModels: [] };
  const saved = await readAiSettings();
  const envProvider = process.env.AI_PROVIDER?.trim().toLowerCase() || "";
  // Healthy OpenRouter keys take turns per request; keys still cooling down stay at the back as a last resort.
  const ordered = attemptOrder(saved.keys);
  const now = new Date();
  const healthy = ordered.filter((k) => k.status === "ok" || !k.cooldownUntil || k.cooldownUntil <= now);
  const first = (await roundRobinKey(healthy, advanceRotation)) ?? ordered[0] ?? null;
  const openRouter = (first ? [first, ...ordered.filter((k) => k.id !== first.id)] : []).slice(0, OPENROUTER_KEYS_PER_REQUEST)
    .map((k): AiCandidate => ({ id: k.id, source: OPENROUTER_SOURCE, provider: "openrouter", label: "openrouter", apiKey: k.secret as string, baseUrl: OPENROUTER_BASE_URL, model: k.model || saved.model || DEFAULT_OPENROUTER_MODEL }));
  const paid = saved.paid
    .filter((p) => p.apiKey && p.baseUrl && p.model && p.status !== "rejected")
    .sort((a, b) => Number(Boolean(a.cooldownUntil && a.cooldownUntil > now)) - Number(Boolean(b.cooldownUntil && b.cooldownUntil > now)))
    .map((p): AiCandidate => ({ id: `paid:${p.id}`, source: `paid:${p.id}`, provider: "openai-compatible", label: p.name || "penyedia berbayar", apiKey: p.apiKey as string, baseUrl: p.baseUrl, model: p.model }));
  const dashboard = [...openRouter, ...paid].sort((a, b) => Number(b.source === saved.active) - Number(a.source === saved.active));
  const supported = envProvider === "openai" || envProvider === "openai-compatible" || envProvider === "openrouter";
  const envModel = process.env.AI_MODEL || (envProvider === "openrouter" ? saved.model || DEFAULT_OPENROUTER_MODEL : "gpt-4o-mini");
  const envCandidates: AiCandidate[] = supported && process.env.AI_API_KEY ? [{ id: null, source: "env", provider: envProvider, label: envProvider, apiKey: process.env.AI_API_KEY, baseUrl: process.env.AI_BASE_URL || (envProvider === "openrouter" ? OPENROUTER_BASE_URL : "https://api.openai.com/v1"), model: envModel }] : [];
  const candidates = [...dashboard, ...envCandidates];
  const lead = candidates[0];
  const mode = candidates.length ? "credentials configured" : !envProvider ? "not configured" : !supported ? "unsupported provider" : "not configured";
  return { configured: candidates.length > 0, mode, provider: lead?.label ?? (envProvider || null), model: lead?.model ?? null, baseUrl: lead?.baseUrl ?? null, keySource: dashboard.length ? "dashboard" : envCandidates.length ? "env" : null, candidates, freeModels: saved.freeModels };
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
  return { apiKey: first.apiKey, model: first.model, baseUrl: first.baseUrl };
}

/** Thrown when the AI provider answers with a non-2xx status. The message keeps the old wording. */
export class AiProviderError extends Error { constructor(public readonly status: number, model?: string, tried?: string) { super(`AI provider returned HTTP ${status}${model ? ` for model ${model}` : ""}.${tried ? ` Tried: ${tried}` : ""}`); } }

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
  const config = await resolveAi(true);
  if (!config.configured || !config.provider) throw new IntegrationNotConfigured("AI provider");
  if (config.mode === "test adapter") return draftWith(config, null, brief, media, instruction, currentArticle, guidance);
  let failure: unknown = null;
  /** Sources that failed for a reason other than the key: their other keys would fail the same way. */
  const exhausted = new Set<string>();
  for (const candidate of config.candidates) {
    if (exhausted.has(candidate.source)) continue;
    try {
      const result = await draftWith(config, candidate, brief, media, instruction, currentArticle, guidance);
      if (candidate.id) await recordKeyOutcome(candidate.id, { ok: true });
      return result;
    } catch (error) {
      // Report why the active source failed; a backup's own failure (often the server key) would hide the real cause.
      failure ??= error;
      if (error instanceof AiProviderError && candidate.id) await recordKeyOutcome(candidate.id, { httpStatus: error.status });
      // A key problem tries the next key. Anything else (slow, broken output, server error) moves on to the next source.
      const keyProblem = error instanceof AiProviderError && [401, 402, 403, 429].includes(error.status);
      if (!keyProblem) exhausted.add(candidate.source);
    }
  }
  throw failure;
}
/** A slow model is abandoned after this long and the next model is tried. */
const MODEL_ATTEMPT_TIMEOUT_MS = 60000;
/** Time one key may spend trying models. Instant refusals (busy, unsupported) cost little, so many models fit; slow ones use it up. */
const KEY_TIME_BUDGET_MS = 150000;
/** Hard cap on models tried with one key, even when every refusal is instant. */
const MAX_MODEL_ATTEMPTS = 10;
/**
 * Upper bound, not a target: billing counts tokens actually written. Reasoning models spend ~3,000 tokens thinking
 * before the article; a 3,000 cap cut them off with an empty answer (finish_reason "length").
 */
const MAX_OUTPUT_TOKENS = 8000;
const DRAFT_STRING_FIELDS = ["title", "excerpt", "body", "suggestedCategory", "seoTitle", "metaDescription", "slugSuggestion", "imageBrief"] as const;
const OPTIONAL_FIELD_LIMITS = { suggestedCategory: 100, seoTitle: 180, metaDescription: 300, slugSuggestion: 140, imageBrief: 1000 };

/** Some models wrap JSON in a ```json fence even with response_format set. */
function stripJsonFence(content: string) {
  return content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

/** Models often send null or omit optional fields; coerce them to the empty values the schema expects. Required text is still validated. */
export function normalizeDraftOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  for (const field of DRAFT_STRING_FIELDS) if (out[field] === null || out[field] === undefined) out[field] = "";
  // Metadata fields are safe to cut to their limit; title/excerpt/body are left for the schema to judge.
  for (const [field, max] of Object.entries(OPTIONAL_FIELD_LIMITS)) if (typeof out[field] === "string") out[field] = (out[field] as string).slice(0, max);
  const strings = (value: unknown, maxItems: number, maxLength: number) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, maxItems).map((item) => item.slice(0, maxLength)) : [];
  out.tags = strings(out.tags, 12, 40);
  out.uncertainties = strings(out.uncertainties, 50, 500);
  out.claimsUsed = Array.isArray(out.claimsUsed)
    ? (out.claimsUsed as unknown[]).flatMap((claim) => {
        if (typeof claim === "string") return claim.trim() ? [{ claimText: claim, sourceFactIds: [] }] : [];
        if (!claim || typeof claim !== "object") return [];
        const { claimText, sourceFactIds } = claim as { claimText?: unknown; sourceFactIds?: unknown };
        if (typeof claimText !== "string" || !claimText.trim()) return [];
        return [{ claimText: claimText.slice(0, 500), sourceFactIds: Array.isArray(sourceFactIds) ? sourceFactIds.filter((id): id is string => typeof id === "string").slice(0, 10) : [] }];
      }).slice(0, 50)
    : [];
  return out;
}

async function draftWith(config: AiCredentials, candidate: AiCandidate | null, brief: AiBrief, media: AiMedia, instruction?: string, currentArticle?: ArticleRevisionContext, guidance?: string) {
  const provider = candidate?.provider ?? config.provider as string;
  const input = promptInput(brief, media, instruction, currentArticle, guidance);
  const started = Date.now();
  if (!candidate) return { draft: testDraft(input), provider, model: config.model || "deterministic-test-v1", promptVersion: PROMPT_VERSION, latencyMs: Date.now() - started, inputHash: createHash("sha256").update(JSON.stringify(input)).digest("hex"), inputTokens: null as number | null, outputTokens: null as number | null, changeSummary: "Adapter uji deterministik; verifikasi editorial tetap diwajibkan." };
  const base = candidate.baseUrl;
  // The chosen model goes first. Only OpenRouter has the free pool to rotate into; a paid provider sticks to its own model.
  const freePool = provider === "openrouter" ? config.freeModels.filter((m) => m !== candidate.model).sort(() => Math.random() - 0.5) : [];
  const modelQueue = [candidate.model, ...freePool];
  const firstAttemptMessage = `${JSON.stringify(input)}\n\nReturn JSON with title, excerpt, body, suggestedCategory, tags, seoTitle, metaDescription, slugSuggestion, imageBrief, claimsUsed as {claimText,sourceFactIds} objects, and uncertainties.`;
  let likelyError: string | null = null;
  let lastStatus: number | null = null;
  /** Validation problems from the previous answer, sent back so the model can correct itself. */
  let feedback: string | null = null;
  const corrected = new Set<string>();
  /** "model: reason" per attempt, kept in the run log so a failure can be traced without guessing. */
  const tried: string[] = [];
  const skip = (model: string, reason: string) => { likelyError = reason; tried.push(`${model}: ${reason.replace(`Model ${model}`, "").replace(/^[:\s]+/, "")}`); };
  // A model that answered but broke the format gets one corrective retry before the next model is tried.
  const correctOrMoveOn = (model: string, mi: number, problem: string) => {
    skip(model, problem.slice(0, 160));
    likelyError = problem;
    feedback = problem;
    if (!corrected.has(model)) { corrected.add(model); modelQueue.splice(mi + 1, 0, model); }
  };
  const lastError = await (async () => {
    for (let mi = 0; mi < Math.min(modelQueue.length, MAX_MODEL_ATTEMPTS); mi += 1) {
      const remaining = KEY_TIME_BUDGET_MS - (Date.now() - started);
      if (remaining < 5000) break;
      const attemptModel = modelQueue[mi];
      let response: Response;
      try {
        response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${candidate?.apiKey}`, "content-type": "application/json", ...(provider === "openrouter" ? { "HTTP-Referer": process.env.ADMIN_BASE_URL || "http://localhost:3000", "X-OpenRouter-Title": "News Network Management System" } : {}) }, signal: AbortSignal.timeout(Math.min(MODEL_ATTEMPT_TIMEOUT_MS, remaining)), body: JSON.stringify({ model: attemptModel, temperature: 0.4, max_tokens: MAX_OUTPUT_TOKENS, response_format: { type: "json_object" }, ...(provider === "openrouter" ? { provider: { require_parameters: true, data_collection: "deny" } } : {}), messages: [{ role: "system", content: input.requirements }, { role: "user", content: feedback ? `${firstAttemptMessage}\n\nYour previous response failed validation with these errors, and must be fixed:\n${JSON.stringify({ errors: feedback }, null, 2)}` : firstAttemptMessage }] }) });
      } catch {
        // Network error or timeout — try next free model
        skip(attemptModel, `Model ${attemptModel}: timeout or unreachable.`);
        continue;
      }
      // 401/402/403 are about the key: stop so generateDraft moves to the next key. Anything else is this model being slow, busy, or unavailable: try the next model.
      if ([401, 402, 403].includes(response.status)) throw new AiProviderError(response.status, attemptModel, tried.join("; "));
      if (!response.ok) { lastStatus = response.status; skip(attemptModel, `Model ${attemptModel} returned ${response.status}.`); continue; }
      let result: { choices?: { message?: { content?: string }; finish_reason?: string }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      // The timeout also covers reading the body: a model that starts answering but writes too slowly is abandoned here.
      try { result = await response.json(); } catch { skip(attemptModel, `Model ${attemptModel}: timeout or unreachable.`); continue; }
      const content = result.choices?.[0]?.message?.content;
      if (!content) { skip(attemptModel, `AI provider returned no structured article (finish: ${result.choices?.[0]?.finish_reason ?? "unknown"}).`); continue; }
      let parsed: unknown;
      try { parsed = normalizeDraftOutput(JSON.parse(stripJsonFence(content))); } catch { correctOrMoveOn(attemptModel, mi, "The provider did not return valid JSON."); continue; }
      try {
        const draft = validateDraftEvidence(articleDraftSchema.parse(parsed), brief.facts, brief.references);
        return { draft, provider: candidate.label, model: attemptModel, promptVersion: PROMPT_VERSION, latencyMs: Date.now() - started, inputHash: createHash("sha256").update(JSON.stringify(input)).digest("hex"), inputTokens: result.usage?.prompt_tokens ?? null, outputTokens: result.usage?.completion_tokens ?? null, changeSummary: instruction ? `AI revision requested: ${instruction}` : "Initial AI article draft." };
      } catch (error) {
        const retryable = error instanceof DraftEvidenceValidationError || (error instanceof Error && (error.message.includes("Too small") || error.message.includes("Invalid input")));
        if (retryable) {
          correctOrMoveOn(attemptModel, mi, error instanceof DraftEvidenceValidationError ? `${error.message} Fix every problem listed above before resubmitting.` : error.message);
          continue;
        }
        throw error;
      }
    }
    // Every model answered with an HTTP error: report it as a provider error so 429 still cools the key down and the next key is tried.
    const summary = tried.join("; ");
    if (lastStatus !== null && /returned \d{3}\.$/.test(likelyError ?? "")) throw new AiProviderError(lastStatus, modelQueue[0], summary);
    throw new Error(`${likelyError ?? "AI provider returned an invalid structured article after all model attempts."}${summary ? ` Tried: ${summary}` : ""}`);
  })();
  return lastError;
}
