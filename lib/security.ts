import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

export function normalizeHostname(input: string) {
  const host = input.trim().toLowerCase().replace(/\.$/, "");
  if (!host || host.length > 253 || host.includes("/") || host.includes("\\") || host.includes("@")) throw new Error("Invalid hostname.");
  const ascii = new URL(`http://${host}`).hostname;
  if (!ascii || ascii.length > 253 || ascii.includes("..")) throw new Error("Invalid hostname.");
  return ascii;
}
function publicAddress(address: string) {
  const parsed = ipaddr.parse(address);
  if (parsed.range() !== "unicast") return false;
  if (parsed.kind() === "ipv4") return true;
  return !["ipv4Mapped", "rfc6052", "rfc6145", "6to4", "teredo", "reserved", "benchmarking", "uniqueLocal", "linkLocal", "loopback", "unspecified", "multicast", "deprecatedSiteLocal", "discard"].includes(parsed.range());
}
export function isPublicIp(address: string) { return isIP(address) !== 0 && publicAddress(address); }
export async function assertPublicHttpUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Only credential-free HTTP/HTTPS references are allowed.");
  const host = normalizeHostname(url.hostname);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Private hostnames are not allowed.");
  if (isIP(host)) {
    if (!isPublicIp(host)) throw new Error("Private or reserved IP addresses are not allowed.");
  } else {
    const records = await lookup(host, { all: true, verbatim: true });
    if (records.length === 0 || records.some(({ address }) => !isPublicIp(address))) throw new Error("Reference hostname resolves to a private or reserved address.");
  }
  return url;
}
export function slugify(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "article";
}
