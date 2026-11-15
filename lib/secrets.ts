import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encrypts secrets stored in the database. The key is derived from SESSION_SECRET with a purpose label,
 * so a database dump alone does not reveal them. Rotating SESSION_SECRET makes old values unreadable
 * (decryptSecret returns null and the owner is asked to enter the key again).
 */
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return Buffer.from(hkdfSync("sha256", secret, "nnms", "integration-settings", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

/** Returns null for anything that is not a valid v1 blob made with the current key. */
export function decryptSecret(blob: string): string | null {
  try {
    const [version, iv, tag, body] = blob.split(".");
    if (version !== "v1" || !iv || !tag || !body) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
  } catch { return null; }
}
