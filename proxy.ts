import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTHOR_COOKIE, AUTHOR_TOKEN_PARAM, signAuthorToken, verifyAuthorToken } from "@/lib/author-link";

/**
 * APP_MODE splits one codebase into two deployments:
 *  - `admin`  serves only the dashboard host (ADMIN_BASE_URL); every other host gets 404.
 *  - `public` serves only the public news-site routes; dashboard pages and the API are 404.
 *  - `all`    (default) serves both, for local development.
 */
const PUBLIC_PATHS = [/^\/$/, /^\/articles\/[^/]+$/, /^\/kategori\/[^/]+$/, /^\/sitemap\.xml$/, /^\/rss\.xml$/, /^\/robots\.txt$/, /^\/domain-check$/, /^\/site-icon$/];

/** Per-request CSP: Next.js reads the nonce from this header and stamps it on its inline bootstrap scripts. */
function withCsp(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://res.cloudinary.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/** A dashboard link carries a short token; trade it for a host-bound cookie and drop it from the URL. */
async function authorLogin(request: NextRequest) {
  const token = request.nextUrl.searchParams.get(AUTHOR_TOKEN_PARAM);
  if (!token) return null;
  const host = request.headers.get("host") ?? "";
  const userId = await verifyAuthorToken(token, host);
  const clean = request.nextUrl.clone();
  clean.searchParams.delete(AUTHOR_TOKEN_PARAM);
  const response = NextResponse.redirect(clean, 302);
  if (userId) response.cookies.set(AUTHOR_COOKIE, await signAuthorToken(userId, host, "30d"), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}

export async function proxy(request: NextRequest) {
  const mode = process.env.APP_MODE || "all";
  if (mode !== "admin" && /^\/articles\/[^/]+$/.test(request.nextUrl.pathname)) {
    const login = await authorLogin(request);
    if (login) return login;
  }
  if (mode === "public") {
    return PUBLIC_PATHS.some((pattern) => pattern.test(request.nextUrl.pathname)) ? withCsp(request) : new NextResponse("Not found", { status: 404 });
  }
  if (mode === "admin") {
    const adminHost = new URL(process.env.ADMIN_BASE_URL || "http://localhost:3000").host.toLowerCase();
    const host = (request.headers.get("host") ?? "").toLowerCase();
    if (host !== adminHost) return new NextResponse("Not found", { status: 404 });
  }
  return withCsp(request);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
