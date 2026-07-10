import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTikTokAuthorizationUrl,
  fetchTikTokUserProfile,
  revokeTikTokAccessToken,
  TikTokUserApiError,
} from "../user-api";

beforeEach(() => {
  vi.stubEnv("TIKTOK_CLIENT_KEY", "client-key");
  vi.stubEnv("TIKTOK_CLIENT_SECRET", "client-secret");
  vi.stubEnv("TIKTOK_REDIRECT_URI", "https://example.com/api/tiktok/callback");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("TikTok user API", () => {
  it("builds an authorization URL with the required scopes and state", () => {
    const url = buildTikTokAuthorizationUrl("random-state");

    expect(url.origin + url.pathname).toBe(
      "https://www.tiktok.com/v2/auth/authorize/"
    );
    expect(url.searchParams.get("client_key")).toBe("client-key");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.com/api/tiktok/callback"
    );
    expect(url.searchParams.get("state")).toBe("random-state");
    expect(url.searchParams.get("scope")?.split(",")).toEqual([
      "user.info.basic",
      "user.info.profile",
      "user.info.stats",
      "video.list",
    ]);
  });

  it("accepts TikTok's empty successful revoke response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    await expect(revokeTikTokAccessToken("access-token")).resolves.toBeUndefined();
  });

  it("surfaces the OAuth error returned by a failed revoke", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: "invalid_request",
            error_description: "Malformed token.",
            log_id: "log-123",
          },
          { status: 400 }
        )
      )
    );

    await expect(revokeTikTokAccessToken("access-token")).rejects.toMatchObject({
      code: "invalid_request",
      logId: "log-123",
    });
  });

  it("classifies an invalid access token as requiring authorization", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: "access_token_invalid",
              message: "The access token is invalid.",
              log_id: "log-456",
            },
          },
          { status: 401 }
        )
      )
    );

    try {
      await fetchTikTokUserProfile("expired-token", ["user.info.basic"]);
      throw new Error("Expected fetchTikTokUserProfile to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(TikTokUserApiError);
      expect((error as TikTokUserApiError).requiresReauthorization).toBe(true);
      expect((error as TikTokUserApiError).logId).toBe("log-456");
    }
  });
});
