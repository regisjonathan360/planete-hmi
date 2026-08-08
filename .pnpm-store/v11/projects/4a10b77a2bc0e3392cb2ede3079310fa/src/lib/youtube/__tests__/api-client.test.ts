import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

beforeEach(() => { process.env.YOUTUBE_API_KEY = "fake-key-for-test"; });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.YOUTUBE_API_KEY;
});

const {
  validateChannel,
  resolveChannelUrl,
  parseYouTubeChannelReference,
  listPlaylistItems,
  getVideoDetails,
  YouTubeApiError,
} =
  await import("../api-client");

function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  let callIndex = 0;
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return { ok: resp.status >= 200 && resp.status < 300, status: resp.status, json: async () => resp.body } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function mockFetchTimeout() {
  vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); }));
}

function mockFetchNetworkError() {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
}

// Valid channel ID (UC + 22 chars)
const VALID_CHANNEL = "UCuAXFkgsw1L7xaCfnd5JJOw";
const VALID_VIDEO = "dQw4w9WgXcQ";
const VALID_PLAYLIST = "UUuAXFkgsw1L7xaCfnd5JJOw";

function channelResponse(items: unknown[] = [{ snippet: { title: "Ch", thumbnails: {} }, contentDetails: { relatedPlaylists: { uploads: "UUtest1234567890abcdefgh" } }, statistics: { subscriberCount: "100", videoCount: "5" } }]) {
  return { status: 200, body: { items } };
}

function videoItem(id: string) {
  return {
    id,
    snippet: { channelId: VALID_CHANNEL, channelTitle: "T", title: "V", description: "", publishedAt: "2026-01-01T00:00:00Z", categoryId: "10", tags: [], thumbnails: { default: { url: "https://i.ytimg.com/t.jpg", width: 120, height: 90 } } },
    contentDetails: { duration: "PT3M30S" },
    status: { privacyStatus: "public", embeddable: true },
    statistics: { viewCount: "1000" },
  };
}

// ==========================================================
// validateChannel
// ==========================================================
describe("validateChannel", () => {
  it("retourne les infos d'une chaîne valide", async () => {
    mockFetch([channelResponse()]);
    const r = await validateChannel(VALID_CHANNEL);
    expect(r.channelId).toBe(VALID_CHANNEL);
    expect(r.title).toBe("Ch");
    expect(r.subscriberCount).toBe(100);
  });

  it("erreur not_found si items vide", async () => {
    mockFetch([channelResponse([])]);
    await expect(validateChannel(VALID_CHANNEL)).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejette un ID invalide (ZodError)", async () => {
    await expect(validateChannel("bad")).rejects.toThrow();
  });

  it("erreur invalid_response si réponse malformée", async () => {
    mockFetch([{ status: 200, body: "not json object" }]);
    await expect(validateChannel(VALID_CHANNEL)).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("resolveChannelUrl", () => {
  it("reconnaît les URLs /channel/UC...", () => {
    expect(
      parseYouTubeChannelReference(`https://www.youtube.com/channel/${VALID_CHANNEL}`)
    ).toEqual({ kind: "id", value: VALID_CHANNEL });
  });

  it("résout une URL @handle avec channels.list forHandle", async () => {
    const fetchFn = mockFetch([channelResponse([{
      id: VALID_CHANNEL,
      snippet: { title: "Artiste HMI", customUrl: "@artistehmi", thumbnails: {} },
      contentDetails: { relatedPlaylists: { uploads: VALID_PLAYLIST } },
      statistics: { subscriberCount: "250", videoCount: "12" },
    }])]);

    const result = await resolveChannelUrl("https://youtube.com/@artistehmi/videos");
    expect(result.channelId).toBe(VALID_CHANNEL);
    expect(result.title).toBe("Artiste HMI");
    expect(new URL(fetchFn.mock.calls[0][0] as string).searchParams.get("forHandle"))
      .toBe("@artistehmi");
  });

  it("résout une ancienne URL /user/ avec forUsername", async () => {
    const fetchFn = mockFetch([channelResponse([{
      id: VALID_CHANNEL,
      snippet: { title: "Ancienne chaîne", thumbnails: {} },
      contentDetails: { relatedPlaylists: {} },
    }])]);

    await resolveChannelUrl("https://www.youtube.com/user/anciennom");
    expect(new URL(fetchFn.mock.calls[0][0] as string).searchParams.get("forUsername"))
      .toBe("anciennom");
  });

  it("essaie handle puis username pour une ancienne URL personnalisée", async () => {
    const fetchFn = mockFetch([
      channelResponse([]),
      channelResponse([{
        id: VALID_CHANNEL,
        snippet: { title: "Chaîne historique", thumbnails: {} },
        contentDetails: { relatedPlaylists: {} },
      }]),
    ]);

    const result = await resolveChannelUrl("https://www.youtube.com/anciennom");

    expect(result.channelId).toBe(VALID_CHANNEL);
    expect(new URL(fetchFn.mock.calls[0][0] as string).searchParams.get("forHandle"))
      .toBe("@anciennom");
    expect(new URL(fetchFn.mock.calls[1][0] as string).searchParams.get("forUsername"))
      .toBe("anciennom");
  });

  it("refuse les URLs de vidéo et les anciennes URLs /c/ ambiguës", async () => {
    await expect(resolveChannelUrl("https://youtu.be/dQw4w9WgXcQ"))
      .rejects.toMatchObject({ code: "unsupported_channel_url" });
    await expect(resolveChannelUrl("https://youtube.com/c/nompersonnalise"))
      .rejects.toMatchObject({ code: "unsupported_channel_url" });
  });

  it("signale une réponse sans identifiant de chaîne", async () => {
    mockFetch([channelResponse()]);
    await expect(resolveChannelUrl("https://youtube.com/@artistehmi"))
      .rejects.toMatchObject({ code: "invalid_response" });
  });
});

// ==========================================================
// listPlaylistItems
// ==========================================================
describe("listPlaylistItems", () => {
  it("pagine correctement", async () => {
    mockFetch([
      { status: 200, body: { items: Array.from({ length: 50 }, (_, i) => ({ snippet: { title: `V${i}`, position: i, thumbnails: {} }, contentDetails: { videoId: `${VALID_VIDEO.slice(0, 10)}${String.fromCharCode(97 + (i % 26))}` } })), nextPageToken: "p2" } },
      { status: 200, body: { items: Array.from({ length: 10 }, (_, i) => ({ snippet: { title: `V${50 + i}`, position: 50 + i, thumbnails: {} }, contentDetails: { videoId: `${VALID_VIDEO.slice(0, 10)}${String.fromCharCode(97 + ((50 + i) % 26))}` } })) } },
    ]);
    const r = await listPlaylistItems(VALID_PLAYLIST);
    expect(r.length).toBe(60);
  });

  it("respecte maxItems", async () => {
    mockFetch([{ status: 200, body: { items: Array.from({ length: 50 }, (_, i) => ({ snippet: { title: `V${i}`, position: i, thumbnails: {} }, contentDetails: { videoId: VALID_VIDEO } })), nextPageToken: "more" } }]);
    const r = await listPlaylistItems(VALID_PLAYLIST, 30);
    expect(r.length).toBe(30);
  });

  it("rejette un playlistId invalide", async () => {
    await expect(listPlaylistItems("bad!")).rejects.toThrow();
  });

  it("rejette maxItems invalide (0)", async () => {
    await expect(listPlaylistItems(VALID_PLAYLIST, 0)).rejects.toMatchObject({ code: "invalid_params" });
  });

  it("rejette maxItems invalide (>2000)", async () => {
    await expect(listPlaylistItems(VALID_PLAYLIST, 5000)).rejects.toMatchObject({ code: "invalid_params" });
  });

  it("erreur invalid_response si réponse malformée", async () => {
    mockFetch([{ status: 200, body: 42 }]);
    await expect(listPlaylistItems(VALID_PLAYLIST)).rejects.toMatchObject({ code: "invalid_response" });
  });
});

// ==========================================================
// getVideoDetails
// ==========================================================
describe("getVideoDetails", () => {
  it("récupère une vidéo avec statistiques", async () => {
    mockFetch([{ status: 200, body: { items: [videoItem(VALID_VIDEO)], pageInfo: { totalResults: 1, resultsPerPage: 1 } } }]);
    const { found, missing, invalid } = await getVideoDetails([VALID_VIDEO]);
    expect(found).toHaveLength(1);
    expect(found[0].durationSeconds).toBe(210);
    expect(found[0].viewCount).toBe(1000);
    expect(missing).toHaveLength(0);
    expect(invalid).toHaveLength(0);
  });

  it("sépare IDs invalides des IDs manquants (privés/supprimés)", async () => {
    mockFetch([{ status: 200, body: { items: [videoItem(VALID_VIDEO)], pageInfo: { totalResults: 1, resultsPerPage: 1 } } }]);
    const { found, missing, invalid } = await getVideoDetails([VALID_VIDEO, "xxxxxxxxxxx", "BAD!"]);
    expect(found).toHaveLength(1);
    expect(missing).toContain("xxxxxxxxxxx"); // Valide mais absent = privé/supprimé
    expect(invalid).toContain("BAD!"); // Invalide syntaxiquement
  });

  it("découpe en lots de 50 IDs distincts et envoie 50+25", async () => {
    const ids = Array.from({ length: 75 }, (_, i) => {
      // Générer 75 IDs valides distincts de 11 chars
      const base = "aAbBcCdDeEf";
      const suffix = i.toString(36).padStart(2, "0");
      return base.slice(0, 9) + suffix.slice(0, 2);
    });
    const fetchFn = mockFetch([
      { status: 200, body: { items: [], pageInfo: { totalResults: 0, resultsPerPage: 50 } } },
      { status: 200, body: { items: [], pageInfo: { totalResults: 0, resultsPerPage: 50 } } },
    ]);
    await getVideoDetails(ids);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    // Vérifier que le premier appel a 50 IDs et le second 25
    const url1 = (fetchFn.mock.calls[0][0] as string);
    const url2 = (fetchFn.mock.calls[1][0] as string);
    const ids1 = new URL(url1).searchParams.get("id")!.split(",");
    const ids2 = new URL(url2).searchParams.get("id")!.split(",");
    expect(ids1).toHaveLength(50);
    expect(ids2).toHaveLength(25);
  });

  it("vidéo valide absente = privée/supprimée (dans missing)", async () => {
    mockFetch([{ status: 200, body: { items: [], pageInfo: { totalResults: 0, resultsPerPage: 50 } } }]);
    const { found, missing, invalid } = await getVideoDetails([VALID_VIDEO]);
    expect(found).toHaveLength(0);
    expect(missing).toEqual([VALID_VIDEO]);
    expect(invalid).toHaveLength(0);
  });

  it("erreur 403 quota", async () => {
    mockFetch([{ status: 403, body: { error: { errors: [{ reason: "quotaExceeded" }] } } }]);
    await expect(getVideoDetails([VALID_VIDEO])).rejects.toMatchObject({ code: "quota_exceeded", isQuotaExhausted: true });
  });

  it("erreur 403 forbidden (pas quota)", async () => {
    mockFetch([{ status: 403, body: { error: { errors: [{ reason: "forbidden" }] } } }]);
    const err = await getVideoDetails([VALID_VIDEO]).catch((e) => e);
    expect(err).toBeInstanceOf(YouTubeApiError);
    expect(err.code).toBe("forbidden");
    expect(err.isQuotaExhausted).toBe(false);
  });

  it("erreur 404", async () => {
    mockFetch([{ status: 404, body: {} }]);
    await expect(getVideoDetails([VALID_VIDEO])).rejects.toMatchObject({ code: "not_found" });
  });

  it("réponse 200 malformée", async () => {
    mockFetch([{ status: 200, body: { broken: true } }]);
    await expect(getVideoDetails([VALID_VIDEO])).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("retourne vide pour une liste vide", async () => {
    const { found, missing, invalid } = await getVideoDetails([]);
    expect(found).toHaveLength(0);
    expect(missing).toHaveLength(0);
    expect(invalid).toHaveLength(0);
  });
});

// ==========================================================
// Erreurs globales
// ==========================================================
describe("erreurs globales", () => {
  it("clé API absente", async () => {
    delete process.env.YOUTUBE_API_KEY;
    await expect(validateChannel(VALID_CHANNEL)).rejects.toMatchObject({ code: "config_missing" });
  });

  it("clé API invalide (400 keyInvalid)", async () => {
    mockFetch([{ status: 400, body: { error: { errors: [{ reason: "keyInvalid" }] } } }]);
    await expect(validateChannel(VALID_CHANNEL)).rejects.toMatchObject({ code: "invalid_key", isInvalidKey: true });
  });

  it("timeout", async () => {
    mockFetchTimeout();
    await expect(validateChannel(VALID_CHANNEL)).rejects.toMatchObject({ code: "timeout", retryable: true });
  });

  it("erreur réseau", async () => {
    mockFetchNetworkError();
    await expect(validateChannel(VALID_CHANNEL)).rejects.toMatchObject({ code: "network_error", retryable: true });
  });
});

// ==========================================================
// YouTubeApiError
// ==========================================================
describe("YouTubeApiError", () => {
  it("isQuotaExhausted uniquement pour quota_exceeded", () => {
    expect(new YouTubeApiError("", "quota_exceeded", 403).isQuotaExhausted).toBe(true);
    expect(new YouTubeApiError("", "forbidden", 403).isQuotaExhausted).toBe(false);
  });

  it("isNotFound", () => {
    expect(new YouTubeApiError("", "not_found", 404).isNotFound).toBe(true);
  });

  it("isInvalidKey", () => {
    expect(new YouTubeApiError("", "invalid_key", 400).isInvalidKey).toBe(true);
    expect(new YouTubeApiError("", "bad_request", 400).isInvalidKey).toBe(false);
  });
});
