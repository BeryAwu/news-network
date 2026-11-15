import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../lib/secrets";

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
