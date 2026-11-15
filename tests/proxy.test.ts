import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { proxy } from "../proxy";
import { AUTHOR_COOKIE, AUTHOR_TOKEN_PARAM, signAuthorToken, verifyAuthorToken } from "../lib/author-link";

const SECRET = "x".repeat(40);

beforeAll(() => { process.env.SESSION_SECRET = SECRET; });
afterEach(() => { delete process.env.APP_MODE; delete process.env.ADMIN_BASE_URL; });

async function status(mode: string, path: string, host = "news.example.com") {
  process.env.APP_MODE = mode;
  process.env.ADMIN_BASE_URL = "https://admin.example.com";
  return (await proxy(new NextRequest(`http://x${path}`, { headers: { host } }))).status;
}

describe("content security policy", () => {
  it("allows scripts only via a fresh per-request nonce, never unsafe-inline", async () => {
    process.env.APP_MODE = "all";
    const csp = async () => (await proxy(new NextRequest("http://x/login", { headers: { host: "localhost" } }))).headers.get("content-security-policy") ?? "";
    const [a, b] = [await csp(), await csp()];
    const scriptSrc = (value: string) => value.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    expect(scriptSrc(a)).toMatch(/'nonce-[^']+'/);
    expect(scriptSrc(a)).not.toContain("unsafe-inline");
    expect(scriptSrc(a)).not.toBe(scriptSrc(b));
  });
});

describe("APP_MODE split deployments", () => {
  it("public mode serves only the public site routes", async () => {
    for (const path of ["/", "/articles/a-slug", "/kategori/ekonomi", "/rss.xml", "/sitemap.xml", "/robots.txt", "/domain-check"]) expect(await status("public", path)).toBe(200);
    for (const path of ["/dashboard", "/login", "/api/auth/login", "/api/articles", "/articles", "/articles/a/b"]) expect(await status("public", path)).toBe(404);
  });

  it("admin mode answers only on the admin host", async () => {
    expect(await status("admin", "/dashboard", "admin.example.com")).toBe(200);
    expect(await status("admin", "/", "news.example.com")).toBe(404);
  });

  it("defaults to serving everything for local development", async () => {
    expect(await status("all", "/dashboard", "localhost:3000")).toBe(200);
  });
});

describe("author sign-in link on a media site", () => {
  const open = async (token: string, host = "news.example.com") => {
    process.env.APP_MODE = "public";
    return proxy(new NextRequest(`http://x/articles/a-slug?${AUTHOR_TOKEN_PARAM}=${token}`, { headers: { host } }));
  };

  it("trades a valid token for a host-bound cookie and removes it from the address", async () => {
    const response = await open(await signAuthorToken("user-1", "news.example.com", "2m"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://x/articles/a-slug");
    const cookie = response.cookies.get(AUTHOR_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(await verifyAuthorToken(cookie!.value, "news.example.com")).toBe("user-1");
  });

  it("sets no cookie for a token made for another host, a forged one, or an expired one", async () => {
    const otherHost = await open(await signAuthorToken("user-1", "other.example.com", "2m"));
    const forged = await open(await new SignJWT({ host: "news.example.com" }).setProtectedHeader({ alg: "HS256" }).setSubject("user-1").setAudience("nnms-author-link").setExpirationTime("2m").sign(new TextEncoder().encode("y".repeat(40))));
    const expired = await open(await signAuthorToken("user-1", "news.example.com", "-1m"));
    for (const response of [otherHost, forged, expired]) {
      expect(response.status).toBe(302);
      expect(response.cookies.get(AUTHOR_COOKIE)).toBeUndefined();
    }
  });

  it("cannot be used as a dashboard session token", async () => {
    const token = await signAuthorToken("user-1", "news.example.com", "2m");
    await expect(jwtVerify(token, new TextEncoder().encode(SECRET))).rejects.toThrow();
  });
});
