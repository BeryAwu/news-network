import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { lookup } from "node:dns/promises";
import { createHash } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { assertPublicHttpUrl, isPublicIp } from "@/lib/security";

const MAX_BYTES = 1_000_000;
const MAX_EXCERPT_CHARS = 2_400;
const MAX_REDIRECTS = 3;
const BOT_NAME = "NewsNetworkReferenceBot";
const ROBOTS_USER_AGENT = `${BOT_NAME}/1.0 (+editorial reference ingestion)`;

export function robotsAllows(robots: string, pathname: string, userAgent = BOT_NAME) {
  const groups: { agents: string[]; rules: { allowed: boolean; pattern: string }[] }[] = [];
  let group: { agents: string[]; rules: { allowed: boolean; pattern: string }[] } = { agents: [], rules: [] };
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0]?.trim() ?? "";
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (directive === "user-agent") {
      if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; }
      group.agents.push(value.toLowerCase());
      continue;
    }
    if ((directive === "allow" || directive === "disallow") && value && group.agents.length) group.rules.push({ allowed: directive === "allow", pattern: value });
  }
  if (group.agents.length) groups.push(group);
  const agent = userAgent.toLowerCase();
  const matching = groups.filter((candidate) => candidate.agents.some((name) => name !== "*" && agent.includes(name)));
  const selected = matching.length ? matching : groups.filter((candidate) => candidate.agents.includes("*"));
  const path = pathname || "/";
  let best: { allowed: boolean; length: number } | null = null;
  for (const rule of selected.flatMap((candidate) => candidate.rules)) {
    const terminal = rule.pattern.endsWith("$");
    const rawPattern = terminal ? rule.pattern.slice(0, -1) : rule.pattern;
    const expression = rawPattern.replace(/([.+?^${}()|[\]\\])/g, "\\$1").replace(/\*/g, ".*");
    const matches = new RegExp(`^${expression}${terminal ? "$" : ""}`).test(path);
    if (!matches) continue;
    const specificity = rule.pattern.replace(/[\*$]/g, "").length;
    if (!best || specificity > best.length || (specificity === best.length && rule.allowed)) best = { allowed: rule.allowed, length: specificity };
  }
  return best?.allowed ?? true;
}

export function parsePage(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").trim() ?? "";
  const publishedAtText = html.match(/<meta[^>]+(?:property|name)=["'](?:article:published_time|datePublished|pubdate)["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? "";
  const candidateDate = publishedAtText ? new Date(publishedAtText) : null;
  const publishedAt = candidateDate && Number.isFinite(candidateDate.getTime()) ? candidateDate : null;
  const description = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() ?? "";
  const publisher = html.match(/<meta[^>]+(?:name|property)=["'](?:publisher|og:site_name)["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() ?? "";
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)?.[1] ?? "";
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<(?:br|\/p|\/div|\/h[1-6]|\/li|\/article|\/section)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim().slice(0, MAX_EXCERPT_CHARS);
  return { title: title.slice(0, 500), description: description.slice(0, 1000), publisher: publisher.slice(0, 250), canonical: canonical.slice(0, 2000), publishedAt, text };
}
interface FetchResult { status: number; headers: IncomingHttpHeaders; body: string }
async function pinnedGet(url: URL, address: string, family: number, acceptedTypes: string[]): Promise<FetchResult> {
  const { promise, resolve, reject } = Promise.withResolvers<FetchResult>();
  const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, { method: "GET", timeout: 8000, headers: { "user-agent": ROBOTS_USER_AGENT, accept: acceptedTypes.join(",") }, lookup: (_hostname, _options, callback) => callback(null, address, family) }, (response) => {
    const status = response.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) { response.resume(); resolve({ status, headers: response.headers, body: "" }); return; }
    const type = response.headers["content-type"]?.toLowerCase() ?? "";
    if (!acceptedTypes.some((accepted) => type.includes(accepted))) { response.resume(); resolve({ status, headers: response.headers, body: "" }); return; }
    const chunks: Buffer[] = []; let bytes = 0;
    response.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > MAX_BYTES) { request.destroy(new Error("Reference exceeds the 1 MB limit.")); return; } chunks.push(chunk); });
    response.on("end", () => resolve({ status, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }));
    response.on("error", reject);
  });
  request.on("timeout", () => request.destroy(new Error("Reference request timed out.")));
  request.on("error", reject);
  request.end();
  return promise;
}
async function safeRequest(input: URL, acceptedTypes: string[], checkRedirectPolicy?: (url: URL) => Promise<void>) {
  let url = input;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length) throw new Error("Reference host could not be resolved.");
    await assertPublicHttpUrl(url.href);
    const answer = addresses.find(({ address }) => isPublicIp(address));
    if (!answer) throw new Error("Reference resolved to an unsafe address.");
    const response = await pinnedGet(url, answer.address, answer.family, acceptedTypes);
    if (![301, 302, 303, 307, 308].includes(response.status)) return { url, response };
    if (!response.headers.location || redirects === MAX_REDIRECTS) throw new Error("Reference exceeded the redirect limit.");
    const nextUrl = await assertPublicHttpUrl(new URL(response.headers.location, url).href);
    await checkRedirectPolicy?.(nextUrl);
    url = nextUrl;
  }
  throw new Error("Reference exceeded the redirect limit.");
}
async function checkRobots(url: URL) {
  const robotsUrl = new URL("/robots.txt", url.origin);
  const { url: finalRobotsUrl, response } = await safeRequest(robotsUrl, ["text/plain"]);
  if (finalRobotsUrl.origin !== robotsUrl.origin) throw new Error("The site's robots policy redirected to another origin; reference fetch is blocked.");
  if (response.status === 404) return;
  if (response.status === 401 || response.status === 403) throw new Error("Reference fetch is blocked by the site's robots/access policy.");
  if (response.status < 200 || response.status >= 300 || !response.body) throw new Error("The site's robots policy could not be verified; reference fetch is blocked.");
  if (!robotsAllows(response.body, `${url.pathname}${url.search}`)) throw new Error("Reference path is disallowed by robots.txt.");
}
export async function fetchReference(raw: string) {
  const requestedUrl = await assertPublicHttpUrl(raw);
  await checkRobots(requestedUrl);
  const { url, response } = await safeRequest(requestedUrl, ["text/html", "application/xhtml+xml"], checkRobots);
  if (response.status < 200 || response.status >= 300) throw new Error(`Reference server returned HTTP ${response.status}.`);
  if (!response.body) throw new Error("Reference is not an accessible HTML page.");
  const page = parsePage(response.body);
  let canonicalUrl = url.href;
  if (page.canonical) {
    try {
      const candidate = new URL(page.canonical, url);
      if (candidate.protocol === "http:" || candidate.protocol === "https:") canonicalUrl = candidate.href;
    } catch { /* Ignore malformed canonical metadata; the successfully fetched URL is authoritative. */ }
  }
  return { canonicalUrl, title: page.title, publisherName: page.publisher, publishedAt: page.publishedAt, excerpt: page.text || page.description, httpStatus: response.status, retrievedAt: new Date(), contentHash: createHash("sha256").update(response.body).digest("hex") };
}
