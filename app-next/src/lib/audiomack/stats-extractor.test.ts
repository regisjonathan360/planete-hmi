import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractTrackStats } from "./stats-extractor";

// Mock fetch globally for testing
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createHtmlWithJsonLd(stats: {
  plays?: number;
  likes?: number;
  reposts?: number;
  comments?: number;
}): string {
  const interactions = [];
  if (stats.plays !== undefined) {
    interactions.push({
      "@type": "InteractionCounter",
      interactionType: { "@type": "ListenAction" },
      userInteractionCount: stats.plays.toString(),
    });
  }
  if (stats.likes !== undefined) {
    interactions.push({
      "@type": "InteractionCounter",
      interactionType: { "@type": "LikeAction" },
      userInteractionCount: stats.likes.toString(),
    });
  }
  if (stats.reposts !== undefined) {
    interactions.push({
      "@type": "InteractionCounter",
      interactionType: { "@type": "ShareAction" },
      userInteractionCount: stats.reposts.toString(),
    });
  }
  if (stats.comments !== undefined) {
    interactions.push({
      "@type": "InteractionCounter",
      interactionType: { "@type": "CommentAction" },
      userInteractionCount: stats.comments.toString(),
    });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicRecording",
    name: "Test Track",
    interactionStatistic: interactions,
  };

  return `
    <html><head>
      <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    </head><body><h1>Test Track</h1></body></html>
  `;
}

function createHtmlWithNextData(songData: Record<string, unknown>): string {
  const nextData = {
    props: {
      pageProps: {
        song: songData,
      },
    },
  };

  return `
    <html><head>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>
    </head><body><h1>Test Track</h1></body></html>
  `;
}

function createHtmlWithRawPatterns(stats: {
  plays?: number;
  likes?: number;
  reposts?: number;
  comments?: number;
}): string {
  return `
    <html><body>
      <div>"plays": "${stats.plays ?? 0}"</div>
      <div>"favorites": "${stats.likes ?? 0}"</div>
      <div>"reposts": "${stats.reposts ?? 0}"</div>
      <div>"comment_count": "${stats.comments ?? 0}"</div>
    </body></html>
  `;
}

describe("extractTrackStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts stats from JSON-LD structured data", async () => {
    const html = createHtmlWithJsonLd({
      plays: 150000,
      likes: 5000,
      reposts: 1200,
      comments: 300,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(html),
    });

    const result = await extractTrackStats(
      "https://audiomack.com/artist/song/track"
    );

    expect(result.success).toBe(true);
    expect(result.plays).toBe(150000);
    expect(result.likes).toBe(5000);
    expect(result.reposts).toBe(1200);
    expect(result.comments).toBe(300);
    expect(result.extractedAt).toBeTruthy();
  });

  it("extracts stats from __NEXT_DATA__", async () => {
    const html = createHtmlWithNextData({
      plays: "250000",
      favorites: "8000",
      reposts: "2000",
      comment_count: "500",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(html),
    });

    const result = await extractTrackStats(
      "https://audiomack.com/artist/song/track"
    );

    expect(result.success).toBe(true);
    expect(result.plays).toBe(250000);
    expect(result.likes).toBe(8000);
    expect(result.reposts).toBe(2000);
    expect(result.comments).toBe(500);
  });

  it("extracts stats from raw HTML patterns", async () => {
    const html = createHtmlWithRawPatterns({
      plays: 100000,
      likes: 3000,
      reposts: 800,
      comments: 150,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(html),
    });

    const result = await extractTrackStats(
      "https://audiomack.com/artist/song/track"
    );

    expect(result.success).toBe(true);
    expect(result.plays).toBe(100000);
    expect(result.likes).toBe(3000);
    expect(result.reposts).toBe(800);
    expect(result.comments).toBe(150);
  });

  it("returns failure for 404 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    const result = await extractTrackStats(
      "https://audiomack.com/artist/song/deleted-track"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("404");
    expect(result.plays).toBe(0);
  });

  it("returns failure for network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await extractTrackStats(
      "https://audiomack.com/artist/song/track"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network error");
  });

  it("returns failure for timeout (abort)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("The operation was aborted"));

    const result = await extractTrackStats(
      "https://audiomack.com/artist/song/track"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Timeout");
  });

  it("returns zero stats when HTML has no recognizable patterns", async () => {
    const html = "<html><body><p>Hello world</p></body></html>";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(html),
    });

    const result = await extractTrackStats(
      "https://audiomack.com/artist/song/track"
    );

    expect(result.success).toBe(true);
    expect(result.plays).toBe(0);
    expect(result.likes).toBe(0);
    expect(result.reposts).toBe(0);
    expect(result.comments).toBe(0);
  });

  it("handles HTTP 500 error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const result = await extractTrackStats(
      "https://audiomack.com/artist/song/track"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("500");
  });
});
