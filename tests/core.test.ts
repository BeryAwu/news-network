import { afterEach, describe, expect, it, vi } from "vitest";

// The dashboard key lives in the database; tests control it here instead of touching one.
type FakeKey = { id: string; secret: string | null; status: "ok" | "cooldown" | "rejected"; cooldownUntil: Date | null };
const saved = vi.hoisted(() => ({ keys: [] as FakeKey[], model: null as string | null, outcomes: [] as { id: string; outcome: unknown }[] }));
vi.mock("../lib/ai-settings", async (original) => ({ ...(await original<typeof import("../lib/ai-settings")>()), readAiSettings: async () => ({ keys: saved.keys.map((key, position) => ({ label: "", hint: "", lastError: "", lastUsedAt: null, position, addedByName: "", ...key })), model: saved.model, provider: null, baseUrl: null, freeModels: [] }), roundRobinKey: async (keys: { secret: string | null; status: string }[]) => keys.find((k) => k.secret && k.status !== "rejected") ?? null, recordKeyOutcome: async (id: string, outcome: unknown) => { saved.outcomes.push({ id, outcome }); } }));
const key = (id: string, secret: string | null, extra: Partial<FakeKey> = {}): FakeKey => ({ id, secret, status: "ok", cooldownUntil: null, ...extra });
import { aiConfiguration, articleDraftSchema, generateDraft, normalizeDraftOutput, plainAiFailure, validateDraftEvidence } from "../lib/ai";
import { checkAiKey, listAiModels, OPENROUTER_BASE_URL } from "../lib/ai-settings";
import { parsePage, robotsAllows } from "../lib/ingest";
import { createEditorialEvidenceSnapshot } from "../lib/editorial-evidence";
import { isPublicIp, normalizeHostname, slugify } from "../lib/security";
import { requireSameOrigin } from "../lib/auth";
import { assetLicenseRequirementError } from "../lib/asset-provenance";
import { getWritingSkill, enabledWritingGuidance } from "../lib/writing-skills";

describe("managed image license evidence requirements", () => {
  it("requires source and license links plus credit for CC BY images", () => {
    const base = { licenseType: "CC_BY", credit: "", attributionText: "" };
    expect(assetLicenseRequirementError(base)).toMatch(/sumber gambar dan teks lisensi/);
    expect(assetLicenseRequirementError({ ...base, sourceUrl: "https://example.test/image.jpg", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" })).toMatch(/atribusi atau nama kreator/);
    expect(assetLicenseRequirementError({ ...base, sourceUrl: "https://example.test/image.jpg", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", attributionText: "Foto: Example / CC BY 4.0" })).toBeNull();
  });
  it("requires evidence for public-domain, AI-generated and other licenses but permits newsroom-owned work", () => {
    expect(assetLicenseRequirementError({ licenseType: "PUBLIC_DOMAIN", credit: "", attributionText: "" })).toMatch(/membuktikan gambar/);
    expect(assetLicenseRequirementError({ licenseType: "AI_GENERATED", credit: "", attributionText: "" })).toMatch(/prompt atau deskripsi/);
    expect(assetLicenseRequirementError({ licenseType: "OTHER", credit: "", attributionText: "" })).toMatch(/dasar izin/);
    expect(assetLicenseRequirementError({ licenseType: "USER_PROVIDED", credit: "Tim foto", attributionText: "" })).toBeNull();
  });
});

describe("structured editorial output validation", () => {
  it("rejects incomplete drafts before they can enter review", () => {
    expect(() => articleDraftSchema.parse({ title: "Too short", body: "x" })).toThrow();
  });
  it("accepts complete drafts with source-fact references", () => {
    const draft = { title: "Pembaruan kebijakan energi nasional", excerpt: "Ringkasan dari narasi dan sumber yang disediakan untuk editor.", body: "Informasi dari narasi sumber. ".repeat(10), suggestedCategory: "Energi", tags: ["energi"], seoTitle: "Pembaruan kebijakan energi nasional", metaDescription: "Ringkasan perkembangan kebijakan dan referensi yang diberikan oleh pengguna.", slugSuggestion: "energi-nasional", imageBrief: "Ilustrasi editorial, bukan foto dokumenter.", claimsUsed: [{ claimText: "Fakta terkait energi", sourceFactIds: ["fact_1"] }], uncertainties: ["Belum diverifikasi mandiri."] };
    expect(articleDraftSchema.parse(draft)).toEqual(draft);
  });
  it("allows cited evidence only when the fact is marked supported", () => {
    const draft = articleDraftSchema.parse({ title: "Pembaruan kebijakan energi nasional", excerpt: "Ringkasan dari narasi dan sumber yang disediakan untuk editor.", body: "Informasi dari narasi sumber. ".repeat(10), suggestedCategory: "Energi", tags: [], seoTitle: "Pembaruan", metaDescription: "Ringkasan perkembangan kebijakan", slugSuggestion: "energi", imageBrief: "Ilustrasi editorial", claimsUsed: [{ claimText: "Fakta didukung sumber.", sourceFactIds: ["fact_1"] }], uncertainties: [] });
    const fact = { id: "fact_1", claimText: "Fakta didukung sumber", supportStatus: "SUPPORTED", evidenceNote: "Pernyataan dalam sumber", sourceReferenceId: "ref_1" };
    const references = [{ id: "ref_1", retrievalStatus: "SUCCESS" }];
    expect(validateDraftEvidence(draft, [fact], references)).toEqual(draft);
    expect(() => validateDraftEvidence(draft, [{ ...fact, supportStatus: "CONFLICTED" }], references)).toThrow(/marked CONFLICTED/);
    expect(() => validateDraftEvidence(draft, [fact], [])).toThrow(/not fetched successfully/);
    expect(() => validateDraftEvidence(draft, [], references)).toThrow(/was not supplied/);
  });
  it("accepts a model reply with null or oversized metadata once normalized, but still rejects a missing body", () => {
    const reply = { title: "Banner Berry jadi syarat seminar KP", excerpt: "Ringkasan singkat untuk pembaca kampus.", body: "Isi berita yang cukup panjang untuk lolos validasi. ".repeat(4), suggestedCategory: null, tags: null, seoTitle: "x".repeat(400), metaDescription: null, slugSuggestion: null, imageBrief: null, claimsUsed: ["Konteks dari narasi."], uncertainties: null };
    const draft = articleDraftSchema.parse(normalizeDraftOutput(reply));
    expect(draft.suggestedCategory).toBe("");
    expect(draft.seoTitle).toHaveLength(180);
    expect(draft.claimsUsed).toEqual([{ claimText: "Konteks dari narasi.", sourceFactIds: [] }]);
    expect(() => articleDraftSchema.parse(normalizeDraftOutput({ ...reply, body: null }))).toThrow();
  });
  it("rejects claims whose evidence links have no source-fact identifier", () => {
    expect(() => articleDraftSchema.parse({ title: "Pembaruan kebijakan energi nasional", excerpt: "Ringkasan informasi yang cukup panjang untuk editor.", body: "Isi artikel berdasarkan narasi yang diberikan. ".repeat(4), suggestedCategory: "Energi", tags: [], seoTitle: "Pembaruan", metaDescription: "Ringkasan", slugSuggestion: "energi", imageBrief: "Ilustrasi editorial", claimsUsed: [{ claimText: "Fakta diklaim tetapi tidak ada evidence ID." }], uncertainties: [] })).toThrow();
  });
});

describe("safe tenant hostname and SSRF address classification", () => {
  it("normalizes hostnames before a tenant lookup", () => {
    expect(normalizeHostname(" WWW.Example.COM. ")).toBe("www.example.com");
    expect(() => normalizeHostname("user@example.com/path")).toThrow();
  });
  it("rejects loopback, private, link-local, carrier-grade NAT, reserved, mapped and non-global IPs", () => {
    for (const address of ["127.0.0.1", "169.254.169.254", "10.0.0.1", "192.168.1.1", "100.64.0.1", "192.0.2.1", "2001:db8::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::1"]) expect(isPublicIp(address), address).toBe(false);
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("2001:4860:4860::8888")).toBe(true);
  });
  it("creates bounded URL-safe slugs without empty output", () => {
    expect(slugify("Banjir & Kebijakan Publik")).toBe("banjir-kebijakan-publik");
    expect(slugify("東京")).toBe("article");
    expect(slugify("x".repeat(200))).toHaveLength(90);
  });
});

describe("bounded source extraction", () => {
  it("caps extracted page text at the configured excerpt boundary", () => {
    const page = parsePage(`<title>Source title</title><article>${"a".repeat(5_000)}</article>`);
    expect(page.text).toHaveLength(2_400);
  });
});

describe("approval-time evidence snapshots", () => {
  it("copies reviewed facts and only successfully retrieved references", () => {
    const brief = {
      facts: [{ id: "fact-1", claimText: "Claim text", supportStatus: "SUPPORTED", evidenceNote: "Confirmed on page", sourceReferenceId: "ref-1" }],
      references: [
        { id: "ref-1", url: "https://example.test/old", canonicalUrl: "https://example.test/story", title: "Story", publisherName: "Example", retrievalStatus: "SUCCESS", retrievedAt: new Date("2026-01-02T03:04:05.000Z") },
        { id: "ref-2", url: "https://example.test/failed", canonicalUrl: null, title: "", publisherName: "", retrievalStatus: "FAILED", retrievedAt: null }
      ]
    };
    const snapshot = createEditorialEvidenceSnapshot(brief);
    brief.facts[0]!.evidenceNote = "Changed after approval";
    expect(snapshot).toEqual({
      sourceFacts: [{ id: "fact-1", claimText: "Claim text", supportStatus: "SUPPORTED", evidenceNote: "Confirmed on page", sourceReferenceId: "ref-1" }],
      sourceReferences: [{ id: "ref-1", url: "https://example.test/story", title: "Story", publisherName: "Example", retrievedAt: "2026-01-02T03:04:05.000Z" }]
    });
  });
  it("drops sourceReferenceId when the referenced fetch did not succeed", () => {
    const brief = {
      facts: [{ id: "fact-2", claimText: "Unverified claim", supportStatus: "UNVERIFIED", evidenceNote: "", sourceReferenceId: "ref-failed" }],
      references: [{ id: "ref-failed", url: "https://example.test/blocked", canonicalUrl: null, title: "", publisherName: "", retrievalStatus: "BLOCKED", retrievedAt: null }]
    };
    const snapshot = createEditorialEvidenceSnapshot(brief);
    expect(snapshot.sourceFacts[0]?.sourceReferenceId).toBeNull();
    expect(snapshot.sourceReferences).toEqual([]);
  });
});

describe("robots.txt reference policy", () => {
  it("blocks denied paths and honors more-specific allow rules", () => {
    const robots = "User-agent: *\nDisallow: /private\nAllow: /private/public$";
    expect(robotsAllows(robots, "/private/account")).toBe(false);
    expect(robotsAllows(robots, "/private/public")).toBe(true);
    expect(robotsAllows(robots, "/news/story")).toBe(true);
  });
  it("uses bot-specific rules before wildcard rules", () => {
    const robots = "User-agent: *\nDisallow: /\n\nUser-agent: NewsNetworkReferenceBot\nAllow: /public";
    expect(robotsAllows(robots, "/public/article")).toBe(true);
    expect(robotsAllows(robots, "/private/article")).toBe(true);
  });
});

describe("same-origin mutation protection", () => {
  it("rejects cross-origin and missing-origin mutation requests", () => {
    expect(() => requireSameOrigin(new Request("https://news.example/api", { headers: { origin: "https://attacker.example", host: "news.example" } }))).toThrow();
    expect(() => requireSameOrigin(new Request("https://news.example/api", { headers: { host: "news.example" } }))).toThrow();
  });
  it("accepts same-origin dashboard mutations", () => {
    expect(() => requireSameOrigin(new Request("https://news.example/api", { headers: { origin: "https://news.example", host: "news.example" } }))).not.toThrow();
  });
});

describe("AI integration readiness", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("enables the deterministic adapter only outside production", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "true");
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(await aiConfiguration()).toMatchObject({ configured: true, mode: "test adapter", provider: "test" });
    vi.stubEnv("NODE_ENV", "production");
    expect(await aiConfiguration()).toMatchObject({ configured: false, mode: "not configured" });
  });
  it("recognizes OpenRouter and defaults to the newsroom drafting model", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false");
    vi.stubEnv("AI_PROVIDER", "openrouter");
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("AI_API_KEY", "configured-token");
    expect(await aiConfiguration()).toMatchObject({ configured: true, mode: "credentials configured", provider: "openrouter", model: "qwen/qwen3-235b-a22b-2507", keySource: "env" });
  });
  it("sends OpenRouter chat completions to its native endpoint with JSON mode and the default model", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false");
    vi.stubEnv("AI_PROVIDER", "openrouter");
    vi.stubEnv("AI_API_KEY", "test-token");
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("AI_BASE_URL", "");
    const request: { url: string; init?: RequestInit } = { url: "" };
    const draft = { title: "Pembaruan layanan transportasi kota", excerpt: "Ringkasan perkembangan yang disampaikan dalam catatan redaksi.", body: "Informasi ini berasal dari narasi pengguna dan masih perlu pemeriksaan editorial. ".repeat(3), suggestedCategory: "Transportasi", tags: [], seoTitle: "Pembaruan layanan transportasi", metaDescription: "Ringkasan informasi transportasi yang diberikan kepada redaksi.", slugSuggestion: "transportasi-kota", imageBrief: "Ilustrasi editorial transportasi kota.", claimsUsed: [], uncertainties: ["Klaim belum diperiksa secara independen."] };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      request.url = String(input);
      request.init = init;
      return Response.json({ choices: [{ message: { content: JSON.stringify(draft) } }], usage: { prompt_tokens: 321, completion_tokens: 88 } });
    }));
    const result = await generateDraft(
      { workingTitle: "Transportasi kota", narrative: "Konteks awal dari editor.", editorNotes: "", sourceSummary: null, references: [], facts: [] },
      { displayName: "Kabar Kota", profile: { niche: "Transportasi", targetAudience: "warga kota", editorialMission: "", toneGuidelines: "", styleGuidelines: "", language: "Indonesian", preferredWordCountMin: 350, preferredWordCountMax: 700 }, categories: [{ name: "Transportasi" }] }
    );
    expect(request.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request.init?.headers).toMatchObject({ authorization: "Bearer test-token", "HTTP-Referer": "http://localhost:3000", "X-OpenRouter-Title": "News Network Management System" });
    expect(JSON.parse(String(request.init?.body))).toMatchObject({ model: "qwen/qwen3-235b-a22b-2507", response_format: { type: "json_object" }, provider: { require_parameters: true, data_collection: "deny" } });
    expect(result).toMatchObject({ provider: "openrouter", model: "qwen/qwen3-235b-a22b-2507", inputTokens: 321, outputTokens: 88 });
  });
  it("does not mislabel unsupported providers as ready", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false");
    vi.stubEnv("AI_PROVIDER", "unknown-provider");
    vi.stubEnv("AI_API_KEY", "present-but-not-supported");
    expect(await aiConfiguration()).toMatchObject({ configured: false, mode: "unsupported provider" });
  });
  it("retries a fabricated fact id with corrective feedback and keeps the draft when the second answer is valid", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false");
    vi.stubEnv("AI_PROVIDER", "openrouter");
    vi.stubEnv("AI_API_KEY", "test-token");
    vi.stubEnv("AI_MODEL", "qwen/qwen3-235b-a22b-2507");
    const base = { excerpt: "Ringkasan kegiatan patroli yang dilaporkan humas.", body: "Patroli digelar di titik rawan. ".repeat(6), suggestedCategory: "Hukum", tags: [], seoTitle: "Patroli Cipta Kondisi", metaDescription: "Laporan humas patroli kamtibmas.", slugSuggestion: "patroli-cipta-kondisi", imageBrief: "Ilustrasi patroli; bukan foto dokumenter.", uncertainties: ["Laporan humas belum diverifikasi mandiri."] };
    const fabricated = { ...base, title: "Patroli Cipta Kondisi Polres Metro Tangerang Kota", claimsUsed: [{ claimText: "Patroli digelar di titik rawan.", sourceFactIds: ["fact-halusan-model"] }] };
    const corrected = { ...base, title: "Patroli Cipta Kondisi Polres Metro Tangerang Kota", claimsUsed: [{ claimText: "Patroli digelar di titik rawan.", sourceFactIds: [] }] };
    const responses = [fabricated, corrected];
    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return Response.json({ choices: [{ message: { content: JSON.stringify(responses.shift()) } }], usage: {} });
    }));
    const result = await generateDraft(
      { workingTitle: "Patroli Cipta Kondisi", narrative: "Polres menggelar patroli.", editorNotes: "", sourceSummary: null, references: [], facts: [] },
      { displayName: "dawda", profile: { niche: "berita lokal", targetAudience: "masyarakat umum", editorialMission: "", toneGuidelines: "", styleGuidelines: "", language: "Indonesian", preferredWordCountMin: 350, preferredWordCountMax: 700 }, categories: [{ name: "Hukum" }] }
    );
    expect(result.draft.claimsUsed[0]?.sourceFactIds).toEqual([]);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toContain("must be fixed");
    expect(bodies[1]).toContain("was not supplied");
    expect(bodies[0]).toContain("MUST have an empty sourceFactIds array");
  });
  it("appends active skill guidance to the drafting requirements", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false");
    vi.stubEnv("AI_PROVIDER", "openrouter");
    vi.stubEnv("AI_API_KEY", "test-token");
    vi.stubEnv("AI_MODEL", "qwen/qwen3-235b-a22b-2507");
    const draft = { title: "Patroli Cipta Kondisi Polres Metro Tangerang Kota", excerpt: "Ringkasan kegiatan patroli yang dilaporkan humas.", body: "Patroli digelar di titik rawan. ".repeat(6), suggestedCategory: "Hukum", tags: ["patroli"], seoTitle: "Patroli Cipta Kondisi", metaDescription: "Laporan humas patroli kamtibmas.", slugSuggestion: "patroli-cipta-kondisi", imageBrief: "Ilustrasi patroli; bukan foto dokumenter.", claimsUsed: [], uncertainties: ["Laporan humas belum diverifikasi mandiri."] };
    vi.stubGlobal("fetch", vi.fn(async () => {
      return Response.json({ choices: [{ message: { content: JSON.stringify(draft) } }], usage: {} });
    }));
    const skill = getWritingSkill("humas-instansi")!;
    await generateDraft(
      { workingTitle: "Patroli Cipta Kondisi", narrative: "Polres menggelar patroli.", editorNotes: "", sourceSummary: null, references: [], facts: [] },
      { displayName: "dawda", profile: { niche: "berita lokal", targetAudience: "masyarakat umum", editorialMission: "", toneGuidelines: "", styleGuidelines: "", language: "Indonesian", preferredWordCountMin: 350, preferredWordCountMax: 700 }, categories: [{ name: "Hukum" }] },
      undefined, undefined, skill.promptGuidance
    );
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const body = String(calls[0]![1]?.body);
    expect(body).toContain(skill.promptGuidance.slice(0, 80));
    expect(body).toContain("Stylistic guidance (skill)");
  });
});

describe("writing skills", () => {
  it("exposes the institutional humas skill with concrete guidance", () => {
    const skill = getWritingSkill("humas-instansi");
    expect(skill).toBeDefined();
    expect(skill!.name).toContain("humas");
    expect(skill!.promptGuidance).toMatch(/judul informatif/i);
    expect(skill!.promptGuidance).toMatch(/jangan menambahkan kutipan, data/i);
  });
  it("returns only enabled active skills' guidance from a media site", async () => {
    const db = {
      mediaWritingSkill: {
        findMany: vi.fn(async ({ where }) => {
          if (where.mediaSiteId === "media-1" && where.enabled === true) {
            return [
              { skill: { promptGuidance: "Skill A guidance" } },
              { skill: { promptGuidance: "Skill B guidance" } },
            ];
          }
          return [];
        }),
      },
    };
    const guidance = await enabledWritingGuidance(db as never, "media-1");
    expect(guidance).toContain("Skill A guidance");
    expect(guidance).toContain("Skill B guidance");
    expect(await enabledWritingGuidance(db as never, "media-2")).toBe("");
  });
});

describe("AI key managed from the dashboard", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); saved.keys = []; saved.model = null; saved.outcomes = []; });
  const draftJson = { title: "Judul berita uji untuk kunci", excerpt: "Ringkasan berita uji yang cukup panjang.", body: "Isi berita uji. ".repeat(20), suggestedCategory: "Umum", tags: [], seoTitle: "s", metaDescription: "m", slugSuggestion: "judul", imageBrief: "", claimsUsed: [], uncertainties: [] };
  const brief = { workingTitle: "Judul", narrative: "n", editorNotes: "", sourceSummary: null, references: [], facts: [] };
  const media = { displayName: "Berita", profile: { niche: "", targetAudience: "", editorialMission: "", toneGuidelines: "", styleGuidelines: "", language: "Indonesian", preferredWordCountMin: 350, preferredWordCountMax: 700 }, categories: [] };

  it("prefers the dashboard key over the server environment, and reports where it came from", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false"); vi.stubEnv("AI_PROVIDER", "openrouter"); vi.stubEnv("AI_API_KEY", "env-key"); vi.stubEnv("AI_MODEL", "");
    saved.keys = [key("a", "dashboard-key-1234")];
    expect(await aiConfiguration()).toMatchObject({ configured: true, provider: "openrouter", keySource: "dashboard" });
  });

  it("works with no server key at all once the owner saved one, and never leaks the key in the public config", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false"); vi.stubEnv("AI_PROVIDER", ""); vi.stubEnv("AI_API_KEY", "");
    expect((await aiConfiguration()).configured).toBe(false);
    saved.keys = [key("a", "dashboard-key-1234")]; saved.model = "qwen/qwen3-32b";
    const config = await aiConfiguration();
    expect(config).toMatchObject({ configured: true, model: "qwen/qwen3-32b", keySource: "dashboard" });
    expect(JSON.stringify(config)).not.toContain("dashboard-key-1234");
  });

  it("sends the NEXT request with the new key and model, without a restart", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false"); vi.stubEnv("AI_PROVIDER", "openrouter"); vi.stubEnv("AI_API_KEY", "old-env-key"); vi.stubEnv("AI_MODEL", "");
    const seen: { auth: string; model: string; url: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { seen.push({ url, auth: String((init.headers as Record<string, string>).authorization), model: JSON.parse(String(init.body)).model }); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(draftJson) } }], usage: {} })); }));
    await generateDraft(brief, media);
    saved.keys = [key("a", "brand-new-key")]; saved.model = "qwen/qwen3-32b";
    await generateDraft(brief, media);
    expect(seen[0]).toMatchObject({ auth: "Bearer old-env-key", model: "qwen/qwen3-235b-a22b-2507" });
    expect(seen[1]).toMatchObject({ auth: "Bearer brand-new-key", model: "qwen/qwen3-32b" });
    expect(seen[1]!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("never sends the dashboard key to a custom base URL", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false"); vi.stubEnv("AI_PROVIDER", "openai-compatible"); vi.stubEnv("AI_API_KEY", "x"); vi.stubEnv("AI_BASE_URL", "https://evil.example/v1");
    saved.keys = [key("a", "brand-new-key")];
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { urls.push(url); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(draftJson) } }] })); }));
    await generateDraft(brief, media);
    expect(urls[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("switches to the next key when one has no credit, and rests the dead key", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false"); vi.stubEnv("AI_PROVIDER", "openrouter"); vi.stubEnv("AI_API_KEY", "env-key"); vi.stubEnv("AI_MODEL", "");
    saved.keys = [key("one", "key-one-key-one-1234"), key("two", "key-two-key-two-5678")];
    const auths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => { const auth = String((init.headers as Record<string, string>).authorization); auths.push(auth); return auth.includes("key-one") ? new Response("{}", { status: 402 }) : new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(draftJson) } }] })); }));
    const result = await generateDraft(brief, media);
    expect(result.draft.title).toBe(draftJson.title);
    expect(auths).toEqual(["Bearer key-one-key-one-1234", "Bearer key-two-key-two-5678"]);
    expect(saved.outcomes).toEqual([{ id: "one", outcome: { httpStatus: 402 } }, { id: "two", outcome: { ok: true } }]);
  });

  it("skips resting and rejected keys, uses the server key last, and stops when every key fails", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false"); vi.stubEnv("AI_PROVIDER", "openrouter"); vi.stubEnv("AI_API_KEY", "env-key"); vi.stubEnv("AI_MODEL", "");
    const later = new Date(Date.now() + 3600_000);
    saved.keys = [key("bad", "rejected-key-0000000", { status: "rejected" }), key("rest", "resting-key-1111111", { status: "cooldown", cooldownUntil: later }), key("gone", null), key("good", "good-key-good-2222")];
    const auths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => { auths.push(String((init.headers as Record<string, string>).authorization)); return new Response("{}", { status: 429 }); }));
    await expect(generateDraft(brief, media)).rejects.toMatchObject({ status: 429 });
    expect(auths).toEqual(["Bearer good-key-good-2222", "Bearer resting-key-1111111", "Bearer env-key"]);
  });

  it("does not burn through keys for an error that is not about the key", async () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false"); vi.stubEnv("AI_PROVIDER", "openrouter"); vi.stubEnv("AI_API_KEY", "");
    saved.keys = [key("a", "key-aaaa-aaaa-aaaa"), key("b", "key-bbbb-bbbb-bbbb")];
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateDraft(brief, media)).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tests a key against OpenRouter and says why it fails, so a bad key is never saved", async () => {
    const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
    vi.stubGlobal("fetch", vi.fn(async () => reply(401)));
    expect(await checkAiKey("bad-key-bad-key-bad-key", "qwen/qwen3-32b", OPENROUTER_BASE_URL)).toMatchObject({ ok: false, reason: expect.stringContaining("tidak mengenali") });
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { calls.push(url); return url.endsWith("/auth/key") ? reply(200, { data: { label: "sk-or-v1-abc…xyz", limit: 10, limit_remaining: 7.5 } }) : reply(402); }));
    expect(await checkAiKey("empty-credit-key-12345", "qwen/qwen3-32b", OPENROUTER_BASE_URL)).toMatchObject({ ok: false, reason: expect.stringContaining("Kredit") });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.endsWith("/auth/key") ? reply(200, { data: { label: "k", limit: 10, limit_remaining: 7.5 } }) : reply(200, { choices: [] }))));
    expect(await checkAiKey("good-key-good-key-good-1", "qwen/qwen3-32b", OPENROUTER_BASE_URL)).toEqual({ ok: true, label: "k", limit: 10, remaining: 7.5 });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await checkAiKey("any-key-any-key-any-key", "m", OPENROUTER_BASE_URL)).toMatchObject({ ok: false, reason: expect.stringContaining("Tidak bisa menghubungi") });
  });

  it("reads the provider model catalogue, dropping duplicates and blank ids", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [
      { id: "ngodeai/glm-5.3-flash" },
      { id: "ngodeai/deepseek-v4.1-flash-1017" },
      { id: "ngodeai/glm-5.3-flash" },
      { id: "  " },
      { id: "" },
      { id: "ngodeai/broken/" },
    ] })));
    expect(await listAiModels("k", "https://llm.ngodeai.net/v1")).toMatchObject({ ok: true, models: ["ngodeai/deepseek-v4.1-flash-1017", "ngodeai/glm-5.3-flash"], freeModels: [] });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [{ id: "a/b" }] }, { status: 401 })));
    expect(await listAiModels("k", "https://x/v1")).toMatchObject({ ok: false, reason: expect.stringContaining("tidak mengenali") });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ nope: true })));
    expect(await listAiModels("k", "https://x/v1")).toMatchObject({ ok: false, reason: expect.stringContaining("daftar model") });
  });

  it("explains a spent or rejected key in plain words", async () => {
    expect(plainAiFailure("AI provider returned HTTP 402.")).toContain("Kredit AI habis");
    expect(plainAiFailure("AI provider returned HTTP 401.")).toContain("ditolak");
    expect(plainAiFailure("AI provider returned HTTP 429.")).toContain("membatasi");
    expect(plainAiFailure("AI provider returned HTTP 404.")).toContain("Model AI yang dipilih tidak ada");
    expect(plainAiFailure("boom")).toBe("Penulisan oleh AI gagal. Coba lagi. Kalau tetap gagal, periksa penyedia dan model di Koneksi layanan.");
  });
});
