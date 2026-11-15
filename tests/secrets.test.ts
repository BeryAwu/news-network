import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../lib/secrets";
import { keyConsequence } from "../lib/ai-settings";

beforeAll(() => { process.env.SESSION_SECRET = "a-long-secret-for-tests-".repeat(2); });
afterEach(() => { process.env.SESSION_SECRET = "a-long-secret-for-tests-".repeat(2); });

describe("stored secrets", () => {
  it("round-trips a key and never stores it as plain text", () => {
    const blob = encryptSecret("sk-or-v1-abcdef1234567890");
    expect(blob).not.toContain("sk-or-v1");
    expect(decryptSecret(blob)).toBe("sk-or-v1-abcdef1234567890");
  });

  it("uses a fresh nonce each time", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("returns null for a tampered blob, another version, junk, or after SESSION_SECRET changes", () => {
    const blob = encryptSecret("sk-or-v1-abcdef1234567890");
    const [v, iv, tag, body] = blob.split(".");
    expect(decryptSecret([v, iv, tag, Buffer.from("tampered").toString("base64")].join("."))).toBeNull();
    expect(decryptSecret(["v2", iv, tag, body].join("."))).toBeNull();
    expect(decryptSecret("not-a-blob")).toBeNull();
    process.env.SESSION_SECRET = "a-different-long-secret-".repeat(2);
    expect(decryptSecret(blob)).toBeNull();
  });
});

describe("key rotation rules", () => {
  it("maps provider failures to a rest period or a rejection, and ignores unrelated errors", async () => {
    
    const now = new Date("2026-01-01T00:00:00Z");
    expect(keyConsequence(402, now)).toMatchObject({ status: "cooldown", cooldownUntil: new Date("2026-01-01T06:00:00Z") });
    expect(keyConsequence(429, now)).toMatchObject({ status: "cooldown", cooldownUntil: new Date("2026-01-01T00:05:00Z") });
    expect(keyConsequence(401, now)).toMatchObject({ status: "rejected", cooldownUntil: null });
    expect(keyConsequence(500, now)).toBeNull();
  });
});
