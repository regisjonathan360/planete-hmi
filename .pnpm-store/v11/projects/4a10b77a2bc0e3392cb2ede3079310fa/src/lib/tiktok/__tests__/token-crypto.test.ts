import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptTikTokToken,
  encryptTikTokToken,
  isTikTokTokenEncryptionConfigured,
} from "../token-crypto";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("TikTok token encryption", () => {
  it("round-trips a token without storing it in clear text", () => {
    vi.stubEnv("TIKTOK_TOKEN_ENCRYPTION_KEY", TEST_KEY);

    const encrypted = encryptTikTokToken("secret-access-token");

    expect(encrypted).not.toContain("secret-access-token");
    expect(decryptTikTokToken(encrypted)).toBe("secret-access-token");
  });

  it("uses a fresh IV for every encrypted value", () => {
    vi.stubEnv("TIKTOK_TOKEN_ENCRYPTION_KEY", TEST_KEY);

    expect(encryptTikTokToken("same-token")).not.toBe(
      encryptTikTokToken("same-token")
    );
  });

  it("rejects a value encrypted with another key", () => {
    vi.stubEnv("TIKTOK_TOKEN_ENCRYPTION_KEY", TEST_KEY);
    const encrypted = encryptTikTokToken("secret-access-token");
    vi.stubEnv(
      "TIKTOK_TOKEN_ENCRYPTION_KEY",
      Buffer.alloc(32, 9).toString("base64")
    );

    expect(() => decryptTikTokToken(encrypted)).toThrow();
  });

  it("validates the configured key length", () => {
    vi.stubEnv("TIKTOK_TOKEN_ENCRYPTION_KEY", "too-short");
    expect(isTikTokTokenEncryptionConfigured()).toBe(false);

    vi.stubEnv("TIKTOK_TOKEN_ENCRYPTION_KEY", TEST_KEY);
    expect(isTikTokTokenEncryptionConfigured()).toBe(true);
  });
});
