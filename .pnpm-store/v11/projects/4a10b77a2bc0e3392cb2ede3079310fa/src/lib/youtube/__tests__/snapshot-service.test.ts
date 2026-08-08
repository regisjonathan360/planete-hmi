import { describe, it, expect, vi, afterEach } from "vitest";
import type { StepContext } from "../orchestrator";
import type {
  SnapshotStorage,
  EligibleVideo,
  ExistingSnapshot,
  NewSnapshot,
  DraftEntry,
  FencedDraftResult,
  FencedSnapshotResult,
} from "../snapshot-storage";
import type { SnapshotApiClient } from "../snapshot-service";
import type { YouTubeVideoDetails } from "../api-client";

vi.mock("server-only", () => ({}));

afterEach(() => { vi.restoreAllMocks(); });

const { RefreshAndSnapshotService, ComputeDraftService, mapPrivacyStatus } = await import("../snapshot-service");
const { LeaseLostError, CancellationRequestedError } = await import("../orchestrator");

// ============================================================
// Helpers
// ============================================================

function mockCtx(overrides: Partial<StepContext> = {}): StepContext {
  return {
    runId: "run-001",
    sourceKey: "youtube_hmi_weekly_delta",
    periodKey: "2026-07-14::2026-07-21",
    periodStart: "2026-07-14",
    periodEnd: "2026-07-21",
    ownerToken: "real-owner-token-from-k3",
    isCancellationRequested: vi.fn(async () => false),
    assertActive: vi.fn(async () => {}),
    addWarning: vi.fn(),
    updateProgress: vi.fn(async () => {}),
    ...overrides,
  };
}

function makeVideo(id: string, videoId: string, trackId: string): EligibleVideo {
  return { id, videoId, channelId: "UCxxxxxxxxxxxxxxxxxxxxxxxx", trackId, publishedAt: "2026-01-01T00:00:00Z", videoType: "OFFICIAL_MUSIC_VIDEO" };
}

function makeDetail(videoId: string, views = 1000): YouTubeVideoDetails {
  return { videoId, channelId: "UCxxxxxxxxxxxxxxxxxxxxxxxx", title: `Video ${videoId}`, description: "desc", publishedAt: "2026-01-01T00:00:00Z", categoryId: "10", tags: [], thumbnailUrl: null, durationIso: "PT3M", durationSeconds: 180, privacyStatus: "public", embeddable: true, viewCount: views, likeCount: 50, commentCount: 10 };
}

function mockStorage(overrides: Partial<SnapshotStorage> = {}): SnapshotStorage {
  return {
    getEligibleVideos: vi.fn(async () => [makeVideo("v1", "vid00000001a", "track-1")]),
    getSnapshotsByRunId: vi.fn(async () => new Map()),
    fencedInsertSnapshots: vi.fn(async (): Promise<FencedSnapshotResult> => ({ success: true, insertedCount: 1, skippedCount: 0 })),
    getLatestSnapshotsBefore: vi.fn(async () => new Map([
      ["v1", { youtubeVideoId: "v1", viewCount: 500, likeCount: 20, commentCount: 5, availabilityStatus: "available", observedAt: "2026-07-13T00:00:00Z" }],
    ])),
    getLatestSnapshotsBeforeEnd: vi.fn(async () => new Map([
      ["v1", { youtubeVideoId: "v1", viewCount: 1000, likeCount: 50, commentCount: 10, availabilityStatus: "available", observedAt: "2026-07-20T00:00:00Z" }],
    ])),
    getLatestAvailableSnapshotsBefore: vi.fn(async () => new Map([
      ["v1", { youtubeVideoId: "v1", viewCount: 500, likeCount: 20, commentCount: 5, availabilityStatus: "available", observedAt: "2026-07-13T00:00:00Z" }],
    ])),
    getTrackMetadata: vi.fn(async () => new Map([
      ["track-1", { title: "Song A", artistNames: "Artist A", releaseDate: "2026-01-01" }],
    ])),
    fencedUpsertDraft: vi.fn(async (): Promise<FencedDraftResult> => ({ success: true, editionId: "ed-1", message: "ok" })),
    ...overrides,
  };
}

function mockApi(overrides: Partial<SnapshotApiClient> = {}): SnapshotApiClient {
  return {
    getVideoDetails: vi.fn(async (ids: string[]) => ({ found: ids.map(id => makeDetail(id)), missing: [], invalid: [] })),
    ...overrides,
  };
}

// ==========================================================
describe("RefreshAndSnapshotService", () => {
  it("lots de 50+25 : 2 appels API", async () => {
    const videos = Array.from({ length: 75 }, (_, i) => makeVideo(`v${i}`, `vid${String(i).padStart(9, "0")}ab`, `t${i}`));
    const fencedFn = vi.fn(async (_s: string, _p: string, _o: string, _r: string, snaps: NewSnapshot[]): Promise<FencedSnapshotResult> => ({ success: true, insertedCount: snaps.length, skippedCount: 0 }));
    const storage = mockStorage({ getEligibleVideos: vi.fn(async () => videos), fencedInsertSnapshots: fencedFn });
    const api = mockApi();
    const service = new RefreshAndSnapshotService(api, storage);
    await service.execute(mockCtx());
    expect(api.getVideoDetails).toHaveBeenCalledTimes(2);
    expect(fencedFn).toHaveBeenCalledTimes(2);
  });

  it("snapshot créé avec les bons champs via fenced insert", async () => {
    const fencedFn = vi.fn(async (_s: string, _p: string, _o: string, _r: string, snaps: NewSnapshot[]): Promise<FencedSnapshotResult> => ({ success: true, insertedCount: snaps.length, skippedCount: 0 }));
    const storage = mockStorage({ fencedInsertSnapshots: fencedFn });
    const service = new RefreshAndSnapshotService(mockApi(), storage);
    await service.execute(mockCtx());
    const snaps = (fencedFn.mock.calls as unknown as [string, string, string, string, NewSnapshot[]][])[0][4];
    expect(snaps[0].youtubeVideoId).toBe("v1");
    expect(snaps[0].viewCount).toBe(1000);
    expect(snaps[0].source).toBe("youtube_data_api_v3");
  });

  it("reprise idempotente : skip les vidéos déjà snapshotées", async () => {
    const fencedFn = vi.fn(async (): Promise<FencedSnapshotResult> => ({ success: true, insertedCount: 0, skippedCount: 0 }));
    const storage = mockStorage({
      getSnapshotsByRunId: vi.fn(async () => new Map([["v1", { youtubeVideoId: "v1", viewCount: 500, likeCount: 20, commentCount: 5, availabilityStatus: "available", observedAt: "2026-07-20T00:00:00Z" }]])),
      fencedInsertSnapshots: fencedFn,
    });
    const service = new RefreshAndSnapshotService(mockApi(), storage);
    const result = await service.execute(mockCtx());
    expect(mockApi().getVideoDetails).not.toHaveBeenCalled();
    expect(fencedFn).not.toHaveBeenCalled();
    expect(result.recordsNormalized).toBe(1);
  });

  it("fenced insert refusé → LeaseLostError", async () => {
    const storage = mockStorage({
      fencedInsertSnapshots: vi.fn(async (): Promise<FencedSnapshotResult> => ({ success: false, insertedCount: 0, skippedCount: 0 })),
    });
    const service = new RefreshAndSnapshotService(mockApi(), storage);
    await expect(service.execute(mockCtx())).rejects.toThrow(LeaseLostError);
  });

  it("vidéo indisponible : avertissement sans faux compteurs zéro dans le calcul", async () => {
    const fencedFn = vi.fn(async (_s: string, _p: string, _o: string, _r: string, snaps: NewSnapshot[]): Promise<FencedSnapshotResult> => ({ success: true, insertedCount: snaps.length, skippedCount: 0 }));
    const api = mockApi({ getVideoDetails: vi.fn(async () => ({ found: [], missing: ["vid00000001a"], invalid: [] })) });
    const ctx = mockCtx();
    const storage = mockStorage({ fencedInsertSnapshots: fencedFn });
    const service = new RefreshAndSnapshotService(api, storage);
    await service.execute(ctx);
    expect(ctx.addWarning).toHaveBeenCalledWith(expect.stringContaining("vid00000001a"));
    const snaps = (fencedFn.mock.calls as unknown as [string, string, string, string, NewSnapshot[]][])[0][4];
    expect(snaps[0].availabilityStatus).toBe("unavailable");
    expect(snaps[0].error).toBe("video_unavailable");
    expect(snaps[0].viewCount).toBe(500);
  });

  it("vidéo indisponible sans historique fiable : aucun faux snapshot zéro", async () => {
    const fencedFn = vi.fn(async (): Promise<FencedSnapshotResult> => ({
      success: true, insertedCount: 0, skippedCount: 0,
    }));
    const api = mockApi({
      getVideoDetails: vi.fn(async () => ({
        found: [], missing: ["vid00000001a"], invalid: [],
      })),
    });
    const storage = mockStorage({
      getLatestAvailableSnapshotsBefore: vi.fn(async () => new Map()),
      fencedInsertSnapshots: fencedFn,
    });
    const result = await new RefreshAndSnapshotService(api, storage).execute(mockCtx());
    expect(fencedFn).not.toHaveBeenCalled();
    expect(result.recordsRejected).toBe(1);
  });

  it.each([
    ["public", "available"],
    ["unlisted", "available"],
    ["private", "private"],
  ] as const)("mappe privacyStatus %s vers %s", (input, expected) => {
    expect(mapPrivacyStatus(input)).toBe(expected);
  });

  it("perte de lease via assertActive remonte immédiatement", async () => {
    const ctx = mockCtx({ assertActive: vi.fn(async () => { throw new LeaseLostError(); }) });
    const service = new RefreshAndSnapshotService(mockApi(), mockStorage());
    await expect(service.execute(ctx)).rejects.toThrow(LeaseLostError);
  });

  it("CancellationRequestedError remonte immédiatement", async () => {
    const ctx = mockCtx({ assertActive: vi.fn(async () => { throw new CancellationRequestedError(); }) });
    const service = new RefreshAndSnapshotService(mockApi(), mockStorage());
    await expect(service.execute(ctx)).rejects.toThrow(CancellationRequestedError);
  });

  it("erreur API avec clé dans le message → sanitisée", async () => {
    const api = mockApi({ getVideoDetails: vi.fn(async () => { throw new Error("https://googleapis.com/youtube?key=AIzaSyDEADBEEF123456789012345678901234567"); }) });
    const ctx = mockCtx();
    const service = new RefreshAndSnapshotService(api, mockStorage());
    await service.execute(ctx);
    const warnings = (ctx.addWarning as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0] as string);
    for (const w of warnings) {
      expect(w).not.toContain("AIzaSy");
      expect(w).not.toContain("DEADBEEF");
    }
  });

  it("ownerToken utilisé est celui du contexte K3", async () => {
    const fencedFn = vi.fn(async (): Promise<FencedSnapshotResult> => ({ success: true, insertedCount: 1, skippedCount: 0 }));
    const storage = mockStorage({ fencedInsertSnapshots: fencedFn });
    const service = new RefreshAndSnapshotService(mockApi(), storage);
    await service.execute(mockCtx());
    expect(fencedFn).toHaveBeenCalledWith("youtube_hmi_weekly_delta", "2026-07-14::2026-07-21", "real-owner-token-from-k3", "run-001", expect.any(Array));
  });
});

// ==========================================================
describe("ComputeDraftService", () => {
  const CONFIG = { chartSourceId: "cs-1" };

  it("classe séparément plusieurs vidéos d’une même chanson", async () => {
    const videos = [makeVideo("v1", "vid0000000a1", "track-1"), makeVideo("v2", "vid0000000a2", "track-1")];
    const startSnaps = new Map<string, ExistingSnapshot>([
      ["v1", { youtubeVideoId: "v1", viewCount: 100, likeCount: 10, commentCount: 2, availabilityStatus: "available", observedAt: "2026-07-13T00:00:00Z" }],
      ["v2", { youtubeVideoId: "v2", viewCount: 200, likeCount: 20, commentCount: 4, availabilityStatus: "available", observedAt: "2026-07-13T00:00:00Z" }],
    ]);
    const endSnaps = new Map<string, ExistingSnapshot>([
      ["v1", { youtubeVideoId: "v1", viewCount: 600, likeCount: 30, commentCount: 5, availabilityStatus: "available", observedAt: "2026-07-20T00:00:00Z" }],
      ["v2", { youtubeVideoId: "v2", viewCount: 800, likeCount: 40, commentCount: 8, availabilityStatus: "available", observedAt: "2026-07-20T00:00:00Z" }],
    ]);
    const draftFn = vi.fn(async (): Promise<FencedDraftResult> => ({ success: true, editionId: "ed-1", message: "ok" }));
    const storage = mockStorage({ getEligibleVideos: vi.fn(async () => videos), getLatestSnapshotsBefore: vi.fn(async () => startSnaps), getLatestSnapshotsBeforeEnd: vi.fn(async () => endSnaps), fencedUpsertDraft: draftFn });
    const service = new ComputeDraftService(storage, CONFIG);
    await service.execute(mockCtx());
    const entries = (draftFn.mock.calls as unknown as [string, string, string, string, string, string, string, DraftEntry[], string, string | null][])[0][7];
    expect(entries.length).toBe(2);
    expect(entries.map((entry) => entry.youtube_video_id)).toEqual(["v2", "v1"]);
    expect(entries.map((entry) => entry.delta_views)).toEqual([600, 500]);
  });

  it("vidéo publiée pendant la période utilise zéro comme départ", async () => {
    const videos = [makeVideo("v1", "vid0000000a1", "track-1")];
    videos[0].publishedAt = "2026-07-15T00:00:00Z";
    const draftFn = vi.fn(async (): Promise<FencedDraftResult> => ({ success: true, editionId: "ed-1", message: "ok" }));
    const storage = mockStorage({
      getEligibleVideos: vi.fn(async () => videos),
      getLatestSnapshotsBefore: vi.fn(async () => new Map()),
      getLatestSnapshotsBeforeEnd: vi.fn(async () => new Map([["v1", { youtubeVideoId: "v1", viewCount: 5000, likeCount: 100, commentCount: 20, availabilityStatus: "available", observedAt: "2026-07-20T00:00:00Z" }]])),
      fencedUpsertDraft: draftFn,
    });
    const service = new ComputeDraftService(storage, CONFIG);
    await service.execute(mockCtx());
    const entries = (draftFn.mock.calls as unknown as [string, string, string, string, string, string, string, DraftEntry[], string, string | null][])[0][7];
    expect(entries[0].delta_views).toBe(5000);
  });

  it("ancienne vidéo sans snapshot de départ → exclue + needs_review", async () => {
    const draftFn = vi.fn(async (): Promise<FencedDraftResult> => ({ success: true, editionId: "ed-1", message: "ok" }));
    const ctx = mockCtx();
    const storage = mockStorage({ getLatestSnapshotsBefore: vi.fn(async () => new Map()), fencedUpsertDraft: draftFn });
    const service = new ComputeDraftService(storage, CONFIG);
    await service.execute(ctx);
    const entries = (draftFn.mock.calls as unknown as [string, string, string, string, string, string, string, DraftEntry[], string, string | null][])[0][7];
    expect(entries.length).toBe(0);
    const status = (draftFn.mock.calls as unknown as [string, string, string, string, string, string, string, DraftEntry[], string, string | null][])[0][8];
    expect(status).toBe("needs_review");
  });

  it("snapshot de fin manquant → avertissement + needs_review", async () => {
    const draftFn = vi.fn(async (): Promise<FencedDraftResult> => ({ success: true, editionId: "ed-1", message: "ok" }));
    const ctx = mockCtx();
    const storage = mockStorage({ getLatestSnapshotsBeforeEnd: vi.fn(async () => new Map()), fencedUpsertDraft: draftFn });
    const service = new ComputeDraftService(storage, CONFIG);
    await service.execute(ctx);
    expect(ctx.addWarning).toHaveBeenCalledWith(expect.stringContaining("snapshot de fin manquant"));
    const status = (draftFn.mock.calls as unknown as [string, string, string, string, string, string, string, DraftEntry[], string, string | null][])[0][8];
    expect(status).toBe("needs_review");
  });

  it("compteur diminué → avertissement + needs_review", async () => {
    const endSnaps = new Map<string, ExistingSnapshot>([["v1", { youtubeVideoId: "v1", viewCount: 100, likeCount: 5, commentCount: 1, availabilityStatus: "available", observedAt: "2026-07-20T00:00:00Z" }]]);
    const draftFn = vi.fn(async (): Promise<FencedDraftResult> => ({ success: true, editionId: "ed-1", message: "ok" }));
    const ctx = mockCtx();
    const storage = mockStorage({ getLatestSnapshotsBeforeEnd: vi.fn(async () => endSnaps), fencedUpsertDraft: draftFn });
    const service = new ComputeDraftService(storage, CONFIG);
    await service.execute(ctx);
    expect(ctx.addWarning).toHaveBeenCalledWith(expect.stringContaining("compteur diminué"));
  });

  it("vidéo indisponible dans le snapshot de fin → exclue du calcul", async () => {
    const endSnaps = new Map<string, ExistingSnapshot>([["v1", { youtubeVideoId: "v1", viewCount: 1000, likeCount: 50, commentCount: 10, availabilityStatus: "unavailable", observedAt: "2026-07-20T00:00:00Z" }]]);
    const draftFn = vi.fn(async (): Promise<FencedDraftResult> => ({ success: true, editionId: "ed-1", message: "ok" }));
    const ctx = mockCtx();
    const storage = mockStorage({ getLatestSnapshotsBeforeEnd: vi.fn(async () => endSnaps), fencedUpsertDraft: draftFn });
    const service = new ComputeDraftService(storage, CONFIG);
    await service.execute(ctx);
    const entries = (draftFn.mock.calls as unknown as [string, string, string, string, string, string, string, DraftEntry[], string, string | null][])[0][7];
    expect(entries.length).toBe(0);
    expect(ctx.addWarning).toHaveBeenCalledWith(expect.stringContaining("indisponible"));
  });

  it("aucune anomalie → statut draft", async () => {
    const draftFn = vi.fn(async (): Promise<FencedDraftResult> => ({ success: true, editionId: "ed-1", message: "ok" }));
    const storage = mockStorage({ fencedUpsertDraft: draftFn });
    const service = new ComputeDraftService(storage, CONFIG);
    await service.execute(mockCtx());
    const status = (draftFn.mock.calls as unknown as [string, string, string, string, string, string, string, DraftEntry[], string, string | null][])[0][8];
    expect(status).toBe("draft");
  });

  it("refus de modifier une édition publiée", async () => {
    const storage = mockStorage({ fencedUpsertDraft: vi.fn(async (): Promise<FencedDraftResult> => ({ success: false, editionId: "ed-pub", message: "edition_published" })) });
    const service = new ComputeDraftService(storage, CONFIG);
    await expect(service.execute(mockCtx())).rejects.toThrow("publiée");
  });

  it("écriture refusée après perte du lease", async () => {
    const storage = mockStorage({ fencedUpsertDraft: vi.fn(async (): Promise<FencedDraftResult> => ({ success: false, editionId: null, message: "lease_invalid" })) });
    const service = new ComputeDraftService(storage, CONFIG);
    await expect(service.execute(mockCtx())).rejects.toThrow(LeaseLostError);
  });

  it("ownerToken du contexte K3 est transmis au draft fencé", async () => {
    const draftFn = vi.fn(async (): Promise<FencedDraftResult> => ({ success: true, editionId: "ed-1", message: "ok" }));
    const storage = mockStorage({ fencedUpsertDraft: draftFn });
    const service = new ComputeDraftService(storage, CONFIG);
    await service.execute(mockCtx());
    // 3e argument = ownerToken
    const ownerArg = (draftFn.mock.calls as unknown as unknown[][])[0][2];
    expect(ownerArg).toBe("real-owner-token-from-k3");
  });

  it("total_views inclus dans les entrées pour l'aperçu", async () => {
    const draftFn = vi.fn(async (): Promise<FencedDraftResult> => ({ success: true, editionId: "ed-1", message: "ok" }));
    const storage = mockStorage({ fencedUpsertDraft: draftFn });
    const service = new ComputeDraftService(storage, CONFIG);
    await service.execute(mockCtx());
    const entries = (draftFn.mock.calls as unknown as [string, string, string, string, string, string, string, DraftEntry[], string, string | null][])[0][7];
    expect(entries[0]).toHaveProperty("total_views");
    expect(entries[0].total_views).toBeGreaterThan(0);
  });
});

describe("périmètre CUSTOM", () => {
  it("n'envoie à YouTube que les vidéos ciblées", async () => {
    const target = makeVideo("v1", "vid00000001a", "track-1");
    const outside = makeVideo("v2", "vid00000002b", "track-2");
    const storage = mockStorage({
      getEligibleVideos: vi.fn(async () => [target, outside]),
    });
    const api = mockApi();
    const service = new RefreshAndSnapshotService(api, storage, {
      mode: "CUSTOM",
      artistIds: [],
      channelIds: [],
      channelYouTubeIds: [],
      videoIds: ["v1"],
      trackIds: [],
    });

    await service.execute(mockCtx());

    expect(api.getVideoDetails).toHaveBeenCalledTimes(1);
    expect(api.getVideoDetails).toHaveBeenCalledWith([target.videoId]);
  });
});
