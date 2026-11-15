import { SignJWT, jwtVerify } from "jose";

/**
 * Short signed tokens that let a media site show the "Edit" button to the author.
 * They use a key derived from SESSION_SECRET with a different label, so they can never be
 * accepted as a dashboard session cookie (and the other way round).
 */
const AUDIENCE = "nnms-author-link";

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(`${secret}::author-link`);
}

export const AUTHOR_COOKIE = "nnms_author";
export const AUTHOR_TOKEN_PARAM = "author-token";

/** `host` binds the token to one media hostname; `ttl` is a jose duration such as "2m" or "30d". */
export async function signAuthorToken(userId: string, host: string, ttl: string) {
  return new SignJWT({ host: host.toLowerCase() }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setAudience(AUDIENCE).setIssuedAt().setExpirationTime(ttl).sign(key());
}

/** Returns the user id when the token is valid for this host, otherwise null. */
export async function verifyAuthorToken(token: string, host: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { audience: AUDIENCE });
    if (typeof payload.sub !== "string" || payload.host !== host.toLowerCase()) return null;
    return payload.sub;
  } catch { return null; }
}
