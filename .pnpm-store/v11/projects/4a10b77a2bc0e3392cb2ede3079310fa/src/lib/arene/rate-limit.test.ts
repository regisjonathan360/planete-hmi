import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  checkApiRateLimit,
  resetApiRateStore,
} from "./rate-limit";

describe("checkRateLimit", () => {
  describe("comment rate limiting (1 per 10s)", () => {
    it("allows a comment when no recent timestamps", () => {
      const result = checkRateLimit("member-1", "comment", []);
      expect(result).toEqual({ allowed: true });
    });

    it("allows a comment when last comment was more than 10s ago", () => {
      const now = new Date();
      const oldTimestamp = new Date(now.getTime() - 11_000); // 11s ago
      const result = checkRateLimit("member-1", "comment", [oldTimestamp]);
      expect(result).toEqual({ allowed: true });
    });

    it("rejects a comment when last comment was within 10s", () => {
      const now = new Date();
      const recentTimestamp = new Date(now.getTime() - 3_000); // 3s ago
      const result = checkRateLimit("member-1", "comment", [recentTimestamp]);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryAfterSeconds).toBeGreaterThan(0);
        expect(result.retryAfterSeconds).toBeLessThanOrEqual(10);
      }
    });

    it("computes correct retry time for comment", () => {
      const now = new Date();
      const recentTimestamp = new Date(now.getTime() - 5_000); // 5s ago
      const result = checkRateLimit("member-1", "comment", [recentTimestamp]);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        // Should need to wait ~5 more seconds (10s window - 5s elapsed)
        expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(4);
        expect(result.retryAfterSeconds).toBeLessThanOrEqual(6);
      }
    });

    it("allows comment when there is an old timestamp outside window", () => {
      const now = new Date();
      const oldTimestamp = new Date(now.getTime() - 15_000); // 15s ago, outside window
      const result = checkRateLimit("member-1", "comment", [oldTimestamp]);
      expect(result).toEqual({ allowed: true });
    });
  });

  describe("reaction rate limiting (10 per 60s)", () => {
    it("allows a reaction when fewer than 10 recent timestamps", () => {
      const now = new Date();
      const timestamps = Array.from(
        { length: 9 },
        (_, i) => new Date(now.getTime() - i * 1000)
      );
      const result = checkRateLimit("member-1", "reaction", timestamps);
      expect(result).toEqual({ allowed: true });
    });

    it("rejects reaction when 10 timestamps within 60s", () => {
      const now = new Date();
      const timestamps = Array.from(
        { length: 10 },
        (_, i) => new Date(now.getTime() - i * 1000)
      );
      const result = checkRateLimit("member-1", "reaction", timestamps);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryAfterSeconds).toBeGreaterThan(0);
        expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
      }
    });

    it("allows reaction when old timestamps have fallen out of 60s window", () => {
      const now = new Date();
      const timestamps = Array.from(
        { length: 10 },
        (_, i) => new Date(now.getTime() - 61_000 - i * 1000) // all older than 61s
      );
      const result = checkRateLimit("member-1", "reaction", timestamps);
      expect(result).toEqual({ allowed: true });
    });

    it("allows reaction with mix of old and recent timestamps under limit", () => {
      const now = new Date();
      const oldTimestamps = Array.from(
        { length: 5 },
        (_, i) => new Date(now.getTime() - 70_000 - i * 1000) // outside window
      );
      const recentTimestamps = Array.from(
        { length: 5 },
        (_, i) => new Date(now.getTime() - i * 2000) // within window
      );
      const result = checkRateLimit("member-1", "reaction", [
        ...oldTimestamps,
        ...recentTimestamps,
      ]);
      expect(result).toEqual({ allowed: true });
    });

    it("rejects reaction when exactly 10 are within window", () => {
      const now = new Date();
      const timestamps = Array.from(
        { length: 10 },
        (_, i) => new Date(now.getTime() - i * 5000) // spread over 45s, all within 60s
      );
      const result = checkRateLimit("member-1", "reaction", timestamps);
      expect(result.allowed).toBe(false);
    });
  });
});

describe("checkApiRateLimit", () => {
  beforeEach(() => {
    resetApiRateStore();
  });

  it("allows the first request from a new IP", () => {
    const result = checkApiRateLimit("192.168.1.1", null);
    expect(result).toEqual({ allowed: true });
  });

  it("allows requests up to 60 per minute per IP", () => {
    for (let i = 0; i < 59; i++) {
      const result = checkApiRateLimit("192.168.1.1", null);
      expect(result.allowed).toBe(true);
    }
    // 60th request should still be allowed
    const result = checkApiRateLimit("192.168.1.1", null);
    expect(result.allowed).toBe(true);
  });

  it("rejects the 61st request from the same IP within a minute", () => {
    for (let i = 0; i < 60; i++) {
      checkApiRateLimit("192.168.1.1", null);
    }
    const result = checkApiRateLimit("192.168.1.1", null);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.reason).toContain("IP");
    }
  });

  it("allows requests from different IPs independently", () => {
    for (let i = 0; i < 60; i++) {
      checkApiRateLimit("192.168.1.1", null);
    }
    // Different IP should still be allowed
    const result = checkApiRateLimit("192.168.1.2", null);
    expect(result.allowed).toBe(true);
  });

  it("allows member writes up to 30 per minute", () => {
    for (let i = 0; i < 29; i++) {
      const result = checkApiRateLimit(`ip-${i}`, "member-1");
      expect(result.allowed).toBe(true);
    }
    // 30th write should still be allowed
    const result = checkApiRateLimit("ip-29", "member-1");
    expect(result.allowed).toBe(true);
  });

  it("rejects the 31st write from the same member within a minute", () => {
    for (let i = 0; i < 30; i++) {
      checkApiRateLimit(`ip-${i}`, "member-1");
    }
    const result = checkApiRateLimit("ip-30", "member-1");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.reason).toContain("membre");
    }
  });

  it("checks IP limit before member limit", () => {
    // Fill up IP limit with a single IP
    for (let i = 0; i < 60; i++) {
      checkApiRateLimit("single-ip", `member-${i}`);
    }
    // Next request from same IP should fail with IP reason
    const result = checkApiRateLimit("single-ip", "new-member");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("IP");
    }
  });

  it("allows anonymous requests (null memberId) without member check", () => {
    // Anonymous requests only check IP limit
    for (let i = 0; i < 60; i++) {
      const result = checkApiRateLimit("anon-ip", null);
      expect(result.allowed).toBe(true);
    }
    // 61st should fail on IP
    const result = checkApiRateLimit("anon-ip", null);
    expect(result.allowed).toBe(false);
  });
});
