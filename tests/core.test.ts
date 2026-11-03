import { afterEach, describe, expect, it, vi } from "vitest";
import { aiConfiguration, articleDraftSchema, generateDraft, validateDraftEvidence } from "../lib/ai";
import { parsePage, robotsAllows } from "../lib/ingest";
import { createEditorialEvidenceSnapshot } from "../lib/editorial-evidence";
import { isPublicIp, normalizeHostname, slugify } from "../lib/security";
import { requireSameOrigin } from "../lib/auth";
import { assetLicenseRequirementError } from "../lib/asset-provenance";

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
    expect(() => validateDraftEvidence(draft, [{ ...fact, supportStatus: "CONFLICTED" }], references)).toThrow(/conflicted|unverified/);
    expect(() => validateDraftEvidence(draft, [fact], [])).toThrow(/unfetched/);
    expect(() => validateDraftEvidence(draft, [], references)).toThrow(/unknown/);
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
  it("enables the deterministic adapter only outside production", () => {
    vi.stubEnv("AI_TEST_ADAPTER", "true");
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(aiConfiguration()).toMatchObject({ configured: true, mode: "test adapter", provider: "test" });
    vi.stubEnv("NODE_ENV", "production");
    expect(aiConfiguration()).toMatchObject({ configured: false, mode: "not configured" });
  });
  it("recognizes OpenRouter and defaults to the newsroom drafting model", () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false");
    vi.stubEnv("AI_PROVIDER", "openrouter");
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("AI_API_KEY", "configured-token");
    expect(aiConfiguration()).toMatchObject({ configured: true, mode: "credentials configured", provider: "openrouter", model: "qwen/qwen3-235b-a22b-2507" });
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
  it("does not mislabel unsupported providers as ready", () => {
    vi.stubEnv("AI_TEST_ADAPTER", "false");
    vi.stubEnv("AI_PROVIDER", "unknown-provider");
    vi.stubEnv("AI_API_KEY", "present-but-not-supported");
    expect(aiConfiguration()).toMatchObject({ configured: false, mode: "unsupported provider" });
  });
});
