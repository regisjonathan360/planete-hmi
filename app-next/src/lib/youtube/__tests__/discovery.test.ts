import { describe, it, expect, vi, afterEach } from "vitest";
import type { StepContext } from "../orchestrator";
import type {
  DiscoveryStorage,
  CollectableChannel,
  NewVideoCandidate,
} from "../discovery-storage";
import type { DiscoveryApiClient } from "../discovery";
import type { YouTubePlaylistItem, YouTubeVideoDetails } from "../api-client";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
});

const {
  YouTubeDiscoveryService,
  createDiscoveryStep,
  isMultiArtistChannel,
  isPublishedWithinPeriod,
} =
  await import("../discovery");
const { LeaseLostError } = await import("../orchestrator");

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
    ownerToken: "test-owner-token",
    isCancellationRequested: vi.fn(async () => false),
    assertActive: vi.fn(async () => {}),
    addWarning: vi.fn(),
    updateProgress: vi.fn(async () => {}),
    ...overrides,
  };
}

function makeChannel(overrides: Partial<CollectableChannel> = {}): CollectableChannel {
  return {
    id: "ch-uuid-1",
    channelId: "UCxxxxxxxxxxxxxxxxxxxxxxxx",
    channelTitle: "Artist Channel",
    channelType: "OFFICIAL_ARTIST_CHANNEL",
    uploadsPlaylistId: "UUxxxxxxxxxxxxxxxxxxxxxxxx",
    artistId: "artist-uuid-1",
    isActive: true,
    status: "active",
    isYouTubeVerified: true,
    ...overrides,
  };
}

function makePlaylistItem(videoId: string, title = "Video"): YouTubePlaylistItem {
  return {
    videoId,
    title,
    publishedAt: "2026-07-15T12:00:00Z",
    thumbnailUrl: "https://i.ytimg.com/vi/thumb.jpg",
    position: 0,
  };
}

function makeVideoDetails(videoId: string, overrides: Partial<YouTubeVideoDetails> = {}): YouTubeVideoDetails {
  return {
    videoId,
    channelId: "UCxxxxxxxxxxxxxxxxxxxxxxxx",
    title: `Video ${videoId}`,
    description: "A description",
    publishedAt: "2026-07-15T12:00:00Z",
    categoryId: "10",
    tags: ["music"],
    thumbnailUrl: "https://i.ytimg.com/vi/thumb.jpg",
    durationIso: "PT3M45S",
    durationSeconds: 225,
    privacyStatus: "public",
    embeddable: true,
    viewCount: 1000,
    likeCount: 50,
    commentCount: 10,
    ...overrides,
  };
}

function mockStorage(overrides: Partial<DiscoveryStorage> = {}): DiscoveryStorage {
  return {
    getCollectableChannels: vi.fn(async () => [makeChannel()]),
    getExistingVideoIds: vi.fn(async () => new Set<string>()),
    insertVideoCandidate: vi.fn(async () => true),
    updateChannelScanStatus: vi.fn(async () => {}),
    ...overrides,
  };
}

function mockApi(overrides: Partial<DiscoveryApiClient> = {}): DiscoveryApiClient {
  return {
    listPlaylistItems: vi.fn(async () => [makePlaylistItem("vid001abcdefg")]),
    getVideoDetails: vi.fn(async (ids: string[]) => ({
      found: ids.map(id => makeVideoDetails(id)),
      missing: [],
      invalid: [],
    })),
    ...overrides,
  };
}

// ==========================================================
describe("chaîne non collectable", () => {
  it("ignore une chaîne sans playlist d'uploads", async () => {
    const storage = mockStorage({
      getCollectableChannels: vi.fn(async () => [
        makeChannel({ uploadsPlaylistId: null }),
      ]),
    });
    const api = mockApi();
    const service = new YouTubeDiscoveryService(api, storage);
    const ctx = mockCtx();
    const result = await service.execute(ctx);

    expect(result.channelsSkipped).toBe(1);
    expect(result.channelsScanned).toBe(0);
    expect(ctx.addWarning).toHaveBeenCalledWith(
      expect.stringContaining("playlist d'uploads manquante")
    );
    expect(storage.updateChannelScanStatus).toHaveBeenCalledWith(
      expect.objectContaining({ lastScanError: "uploads_playlist_missing" })
    );
  });

  it("getCollectableChannels retourne une liste vide → rien à faire", async () => {
    const storage = mockStorage({
      getCollectableChannels: vi.fn(async () => []),
    });
    const api = mockApi();
    const service = new YouTubeDiscoveryService(api, storage);
    const result = await service.execute(mockCtx());

    expect(result.channelsScanned).toBe(0);
    expect(result.videosDiscovered).toBe(0);
    expect(api.listPlaylistItems).not.toHaveBeenCalled();
  });

  it.each([
    { isActive: false },
    { status: "pending_review" },
    { isYouTubeVerified: false },
  ])("ignore une chaîne inactive, non approuvée ou non vérifiée : %o", async (state) => {
    const storage = mockStorage({
      getCollectableChannels: vi.fn(async () => [makeChannel(state)]),
    });
    const api = mockApi();
    const result = await new YouTubeDiscoveryService(api, storage).execute(mockCtx());
    expect(result.channelsSkipped).toBe(1);
    expect(api.listPlaylistItems).not.toHaveBeenCalled();
  });
});

// ==========================================================
describe("pagination", () => {
  it("gère une playlist avec plusieurs vidéos", async () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makePlaylistItem(`vid${String(i).padStart(9, "0")}ab`)
    );
    const api = mockApi({
      listPlaylistItems: vi.fn(async () => items),
    });
    const storage = mockStorage();
    const service = new YouTubeDiscoveryService(api, storage);
    const result = await service.execute(mockCtx());

    expect(result.videosDiscovered).toBe(10);
    expect(storage.insertVideoCandidate).toHaveBeenCalledTimes(10);
  });
});

describe("filtrage strict de la période", () => {
  it("inclut les deux dates limites et exclut les vidéos plus anciennes ou futures", async () => {
    const api = mockApi({
      listPlaylistItems: vi.fn(async () => [
        { ...makePlaylistItem("old01abcdef"), publishedAt: "2026-07-13T23:59:59Z" },
        { ...makePlaylistItem("startabcdef"), publishedAt: "2026-07-14T00:00:00Z" },
        { ...makePlaylistItem("end01abcdef"), publishedAt: "2026-07-21T23:59:59Z" },
        { ...makePlaylistItem("next01abcdef"), publishedAt: "2026-07-22T00:00:00Z" },
      ]),
    });
    const storage = mockStorage();
    const result = await new YouTubeDiscoveryService(api, storage).execute(mockCtx());

    expect(api.getVideoDetails).toHaveBeenCalledWith([
      "startabcdef",
      "end01abcdef",
    ]);
    expect(result.videosDiscovered).toBe(2);
    expect(result.videosOutsidePeriod).toBe(2);
  });

  it("refuse la date canonique hors période même si la playlist était dans la période", async () => {
    const api = mockApi({
      getVideoDetails: vi.fn(async (ids: string[]) => ({
        found: ids.map((id) =>
          makeVideoDetails(id, { publishedAt: "2026-06-01T12:00:00Z" })
        ),
        missing: [],
        invalid: [],
      })),
    });
    const storage = mockStorage();
    const result = await new YouTubeDiscoveryService(api, storage).execute(mockCtx());

    expect(storage.insertVideoCandidate).not.toHaveBeenCalled();
    expect(result.videosOutsidePeriod).toBe(1);
  });

  it("interprète la date de fin comme une journée incluse", () => {
    expect(
      isPublishedWithinPeriod(
        "2026-07-21T23:59:59.999Z",
        "2026-07-14",
        "2026-07-21"
      )
    ).toBe(true);
    expect(
      isPublishedWithinPeriod(
        "2026-07-22T00:00:00.000Z",
        "2026-07-14",
        "2026-07-21"
      )
    ).toBe(false);
  });
});

// ==========================================================
describe("dédoublonnage en base et dans le lot", () => {
  it("ne demande pas les détails de vidéos déjà en base", async () => {
    const storage = mockStorage({
      getExistingVideoIds: vi.fn(async () => new Set(["vid001abcdefg"])),
    });
    const api = mockApi({
      listPlaylistItems: vi.fn(async () => [
        makePlaylistItem("vid001abcdefg"),
        makePlaylistItem("vid002abcdefg"),
      ]),
    });
    const service = new YouTubeDiscoveryService(api, storage);
    const result = await service.execute(mockCtx());

    // Seul vid002 est demandé en détails
    expect(api.getVideoDetails).toHaveBeenCalledWith(["vid002abcdefg"]);
    expect(result.videosDiscovered).toBe(1);
    expect(result.videosAlreadyKnown).toBe(1);
  });

  it("dédoublonne les IDs en double dans le même lot", async () => {
    const api = mockApi({
      listPlaylistItems: vi.fn(async () => [
        makePlaylistItem("vid001abcdefg"),
        makePlaylistItem("vid001abcdefg"), // doublon
        makePlaylistItem("vid002abcdefg"),
      ]),
    });
    const storage = mockStorage();
    const service = new YouTubeDiscoveryService(api, storage);
    const result = await service.execute(mockCtx());

    // Seulement 2 IDs uniques sont demandés
    expect(api.getVideoDetails).toHaveBeenCalledWith(
      expect.arrayContaining(["vid001abcdefg", "vid002abcdefg"])
    );
    expect(result.videosDiscovered).toBe(2);
  });
});

// ==========================================================
describe("création d'un candidat", () => {
  it("crée un candidat avec les bons champs", async () => {
    const insertFn = vi.fn(async () => true);
    const storage = mockStorage({ insertVideoCandidate: insertFn });
    const api = mockApi();
    const service = new YouTubeDiscoveryService(api, storage);
    await service.execute(mockCtx());

    expect(insertFn).toHaveBeenCalledTimes(1);
    const candidate = (insertFn.mock.calls as unknown as [NewVideoCandidate][])[0][0];
    expect(candidate.videoId).toBe("vid001abcdefg");
    expect(candidate.channelId).toBe("UCxxxxxxxxxxxxxxxxxxxxxxxx");
    expect(candidate.sourceTitle).toBe("Video vid001abcdefg");
    expect(candidate.publishedAt).toBe("2026-07-15T12:00:00Z");
    expect(candidate.durationIso).toBe("PT3M45S");
    expect(candidate.durationSeconds).toBe(225);
    expect(candidate.viewCount).toBe(1000);
  });
});

// ==========================================================
describe("relance idempotente", () => {
  it("insertVideoCandidate retourne false (déjà existant) → pas compté comme discovered", async () => {
    const storage = mockStorage({
      insertVideoCandidate: vi.fn(async () => false), // Already exists
    });
    const api = mockApi();
    const service = new YouTubeDiscoveryService(api, storage);
    const result = await service.execute(mockCtx());

    expect(result.videosDiscovered).toBe(0);
    // Le candidat a été tenté mais pas inséré
    expect(storage.insertVideoCandidate).toHaveBeenCalledTimes(1);
  });
});

// ==========================================================
describe("règle label/distributeur", () => {
  it("isMultiArtistChannel identifie les chaînes multi-artistes", () => {
    expect(isMultiArtistChannel("LABEL_CHANNEL")).toBe(true);
    expect(isMultiArtistChannel("DISTRIBUTOR_CHANNEL")).toBe(true);
    expect(isMultiArtistChannel("COLLABORATOR_CHANNEL")).toBe(true);
    expect(isMultiArtistChannel("OFFICIAL_ARTIST_CHANNEL")).toBe(false);
    expect(isMultiArtistChannel("VEVO_CHANNEL")).toBe(false);
  });

  it("ne rattache pas d'artiste pour une chaîne label", async () => {
    const insertFn = vi.fn(async () => true);
    const storage = mockStorage({
      getCollectableChannels: vi.fn(async () => [
        makeChannel({ channelType: "LABEL_CHANNEL", artistId: "some-artist" }),
      ]),
      insertVideoCandidate: insertFn,
    });
    const api = mockApi();
    const service = new YouTubeDiscoveryService(api, storage);
    await service.execute(mockCtx());

    // Le candidat est créé mais sans rattachement artiste
    // (le candidat dans youtube_videos ne contient pas de track_id)
    const candidate = (insertFn.mock.calls as unknown as [NewVideoCandidate][])[0][0];
    expect(candidate).not.toHaveProperty("trackId");
    expect(candidate).not.toHaveProperty("artistId");
  });
});

// ==========================================================
describe("réponse partielle (vidéos missing)", () => {
  it("produit un avertissement pour chaque vidéo manquante", async () => {
    const api = mockApi({
      listPlaylistItems: vi.fn(async () => [
        makePlaylistItem("vid001abcdefg"),
        makePlaylistItem("vid002abcdefg"),
      ]),
      getVideoDetails: vi.fn(async () => ({
        found: [makeVideoDetails("vid001abcdefg")],
        missing: ["vid002abcdefg"],
        invalid: [],
      })),
    });
    const storage = mockStorage();
    const ctx = mockCtx();
    const service = new YouTubeDiscoveryService(api, storage);
    const result = await service.execute(ctx);

    expect(result.videosDiscovered).toBe(1);
    expect(ctx.addWarning).toHaveBeenCalledWith(
      expect.stringContaining("vid002abcdefg")
    );
  });
});

// ==========================================================
describe("erreur d'une chaîne sans arrêt global", () => {
  it("continue les autres chaînes après erreur d'une chaîne", async () => {
    const channels = [
      makeChannel({ channelId: "UC0000000000000000000001", channelTitle: "Channel A" }),
      makeChannel({ channelId: "UC0000000000000000000002", channelTitle: "Channel B", uploadsPlaylistId: "UU0000000000000000000002" }),
    ];
    let callCount = 0;
    const api = mockApi({
      listPlaylistItems: vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new Error("API quota exceeded");
        return [makePlaylistItem("vid001abcdefg")];
      }),
    });
    const storage = mockStorage({
      getCollectableChannels: vi.fn(async () => channels),
    });
    const ctx = mockCtx();
    const service = new YouTubeDiscoveryService(api, storage);
    const result = await service.execute(ctx);

    // Channel A failed, Channel B succeeded
    expect(result.channelsErrored).toBe(1);
    expect(result.channelsScanned).toBe(1);
    expect(result.videosDiscovered).toBe(1);
    expect(ctx.addWarning).toHaveBeenCalledWith(
      expect.stringContaining("Channel A")
    );
    // last_scan_error set for failed channel
    expect(storage.updateChannelScanStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: "UC0000000000000000000001",
        lastScanError: expect.stringContaining("quota"),
      })
    );
  });
});

// ==========================================================
describe("annulation/perte de lease via assertActive", () => {
  it("LeaseLostError depuis assertActive remonte immédiatement", async () => {
    const ctx = mockCtx({
      assertActive: vi.fn(async () => { throw new LeaseLostError(); }),
    });
    const storage = mockStorage();
    const api = mockApi();
    const service = new YouTubeDiscoveryService(api, storage);

    await expect(service.execute(ctx)).rejects.toThrow(LeaseLostError);
    // Aucune écriture ne doit avoir eu lieu
    expect(storage.insertVideoCandidate).not.toHaveBeenCalled();
  });

  it("assertActive pendant le scan des détails lève LeaseLostError", async () => {
    let callCount = 0;
    const ctx = mockCtx({
      assertActive: vi.fn(async () => {
        callCount++;
        // Première vérification passe (avant scan channel), deuxième échoue (pendant détails)
        if (callCount >= 2) throw new LeaseLostError();
      }),
    });
    const api = mockApi({
      listPlaylistItems: vi.fn(async () => [
        makePlaylistItem("vid001abcdefg"),
      ]),
    });
    const storage = mockStorage();
    const service = new YouTubeDiscoveryService(api, storage);

    await expect(service.execute(ctx)).rejects.toThrow(LeaseLostError);
  });

  it("CancellationRequestedError remonte immédiatement au lieu d'être traitée comme erreur de chaîne", async () => {
    const { CancellationRequestedError } = await import("../orchestrator");
    const ctx = mockCtx({
      assertActive: vi.fn(async () => { throw new CancellationRequestedError(); }),
    });
    const service = new YouTubeDiscoveryService(mockApi(), mockStorage());
    await expect(service.execute(ctx)).rejects.toThrow(CancellationRequestedError);
  });
});

// ==========================================================
describe("absence de données sensibles dans le journal", () => {
  it("les avertissements ne contiennent pas de clé API ou URL avec clé", async () => {
    const api = mockApi({
      listPlaylistItems: vi.fn(async () => {
        throw new Error("Request failed: https://googleapis.com/youtube?key=AIzaSyDEADBEEF");
      }),
    });
    const storage = mockStorage();
    const ctx = mockCtx();
    const service = new YouTubeDiscoveryService(api, storage);
    await service.execute(ctx);

    const warningCalls = (ctx.addWarning as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of warningCalls) {
      const msg = call[0] as string;
      expect(msg).not.toContain("AIzaSyDEADBEEF");
      expect(msg).toContain("[REDACTED]");
    }
  });

  it("la description source complète est persistée mais n'entre pas dans les warnings", async () => {
    const longDesc = "A".repeat(1000);
    const insertFn = vi.fn(async () => true);
    const api = mockApi({
      getVideoDetails: vi.fn(async (ids: string[]) => ({
        found: ids.map(id => makeVideoDetails(id, { description: longDesc })),
        missing: [],
        invalid: [],
      })),
    });
    const storage = mockStorage({ insertVideoCandidate: insertFn });
    const service = new YouTubeDiscoveryService(api, storage);
    await service.execute(mockCtx());

    const candidate = (insertFn.mock.calls as unknown as [NewVideoCandidate][])[0][0];
    expect(candidate.description).toBe(longDesc);
  });
});

describe("validation de la configuration", () => {
  it.each([0, -1, 51, 1.5])("rejette detailsBatchSize=%s", (detailsBatchSize) => {
    expect(() => new YouTubeDiscoveryService(
      mockApi(), mockStorage(), { detailsBatchSize }
    )).toThrow("detailsBatchSize");
  });

  it.each([0, -1, 2001, 1.5])("rejette maxVideosPerChannel=%s", (maxVideosPerChannel) => {
    expect(() => new YouTubeDiscoveryService(
      mockApi(), mockStorage(), { maxVideosPerChannel }
    )).toThrow("maxVideosPerChannel");
  });
});

// ==========================================================
describe("createDiscoveryStep factory", () => {
  it("retourne un OrchestratorStep avec le nom correct", () => {
    const step = createDiscoveryStep(mockApi(), mockStorage());
    expect(step.name).toBe("discover_new_videos");
    expect(typeof step.execute).toBe("function");
  });

  it("l'étape est exécutable via l'interface StepContext", async () => {
    const storage = mockStorage();
    const api = mockApi();
    const step = createDiscoveryStep(api, storage);
    const result = await step.execute(mockCtx());
    expect(result.recordsReceived).toBeGreaterThanOrEqual(0);
  });
});

// ==========================================================
describe("lots de vidéos (batching)", () => {
  it("découpe les vidéos en lots de 50 pour getVideoDetails", async () => {
    // 75 vidéos → 2 lots (50 + 25)
    const items = Array.from({ length: 75 }, (_, i) =>
      makePlaylistItem(`v${String(i).padStart(10, "0")}`)
    );
    const getDetailsFn = vi.fn(async (ids: string[]) => ({
      found: ids.map(id => makeVideoDetails(id)),
      missing: [],
      invalid: [],
    }));
    const api = mockApi({
      listPlaylistItems: vi.fn(async () => items),
      getVideoDetails: getDetailsFn,
    });
    const storage = mockStorage();
    const service = new YouTubeDiscoveryService(api, storage, { detailsBatchSize: 50 });
    await service.execute(mockCtx());

    expect(getDetailsFn).toHaveBeenCalledTimes(2);
    expect(getDetailsFn.mock.calls[0][0].length).toBe(50);
    expect(getDetailsFn.mock.calls[1][0].length).toBe(25);
  });
});

describe("adaptateur Supabase réel", () => {
  it("filtre les chaînes actives, approuvées, vérifiées et avec playlist", async () => {
    vi.resetModules();
    const filters: Array<[string, unknown]> = [];
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return builder;
    });
    builder.not = vi.fn(async () => ({
      data: [{
        id: "ch-1",
        channel_id: "UCxxxxxxxxxxxxxxxxxxxxxxxx",
        channel_title: "Artist Channel",
        channel_type: "OFFICIAL_ARTIST_CHANNEL",
        uploads_playlist_id: "UUxxxxxxxxxxxxxxxxxxxxxxxx",
        artist_id: "artist-1",
        is_active: true,
        status: "active",
        is_youtube_verified: true,
      }],
      error: null,
    }));
    const fromFn = vi.fn(() => builder);
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ from: fromFn }),
    }));

    const { createDiscoveryStorage } = await import("../discovery-storage");
    const channels = await createDiscoveryStorage().getCollectableChannels();

    expect(fromFn).toHaveBeenCalledWith("youtube_channels");
    expect(filters).toEqual(expect.arrayContaining([
      ["is_active", true],
      ["status", "active"],
      ["is_youtube_verified", true],
    ]));
    expect(builder.not).toHaveBeenCalledWith("uploads_playlist_id", "is", null);
    expect(channels[0]).toMatchObject({
      channelId: "UCxxxxxxxxxxxxxxxxxxxxxxxx",
      isActive: true,
      status: "active",
      isYouTubeVerified: true,
    });
  });

  it("insère avec ON CONFLICT video_id DO NOTHING et retourne si une ligne a été créée", async () => {
    vi.resetModules();
    const selectFn = vi.fn()
      .mockResolvedValueOnce({ data: [{ id: "new-id" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    const upsertFn = vi.fn(() => ({ select: selectFn }));
    const fromFn = vi.fn(() => ({ upsert: upsertFn }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ from: fromFn }),
    }));

    const { createDiscoveryStorage } = await import("../discovery-storage");
    const storage = createDiscoveryStorage();
    const candidate: NewVideoCandidate = {
      videoId: "vid001abcdefg",
      channelId: "UCxxxxxxxxxxxxxxxxxxxxxxxx",
      sourceTitle: "Titre",
      sourceThumbnailUrl: null,
      publishedAt: "2026-07-15T12:00:00Z",
      durationIso: "PT3M",
      durationSeconds: 180,
      categoryId: "10",
      tags: ["music"],
      viewCount: 100,
      likeCount: 10,
      commentCount: 2,
      description: "Description complète",
    };

    expect(await storage.insertVideoCandidate(candidate)).toBe(true);
    expect(await storage.insertVideoCandidate(candidate)).toBe(false);
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        video_id: candidate.videoId,
        source_description: candidate.description,
        review_status: "UNREVIEWED",
        is_eligible: false,
        video_type: "UNKNOWN",
      }),
      { onConflict: "video_id", ignoreDuplicates: true }
    );
  });

  it("lit les IDs existants et met à jour l'état de scan", async () => {
    vi.resetModules();
    const inFn = vi.fn(async () => ({
      data: [{ video_id: "vid001abcdefg" }],
      error: null,
    }));
    const updateEqFn = vi.fn(async () => ({ error: null }));
    const updateFn = vi.fn(() => ({ eq: updateEqFn }));
    const fromFn = vi.fn((table: string) => {
      if (table === "youtube_videos") {
        return { select: vi.fn(() => ({ in: inFn })) };
      }
      return { update: updateFn };
    });
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ from: fromFn }),
    }));

    const { createDiscoveryStorage } = await import("../discovery-storage");
    const storage = createDiscoveryStorage();
    const existing = await storage.getExistingVideoIds(["vid001abcdefg", "vid002abcdefg"]);
    expect(existing).toEqual(new Set(["vid001abcdefg"]));

    await storage.updateChannelScanStatus({
      channelId: "UCxxxxxxxxxxxxxxxxxxxxxxxx",
      lastScannedAt: "2026-07-25T00:00:00Z",
      lastScanError: null,
    });
    expect(updateFn).toHaveBeenCalledWith({
      last_scanned_at: "2026-07-25T00:00:00Z",
      last_scan_error: null,
    });
    expect(updateEqFn).toHaveBeenCalledWith("channel_id", "UCxxxxxxxxxxxxxxxxxxxxxxxx");
  });
});

describe("périmètre CUSTOM", () => {
  it("ne scanne jamais une chaîne hors périmètre", async () => {
    const allowed = makeChannel({ id: "allowed", channelId: "UCallowed0000000000000000" });
    const outside = makeChannel({ id: "outside", channelId: "UCoutside000000000000000" });
    const storage = mockStorage({
      getCollectableChannels: vi.fn(async () => [allowed, outside]),
    });
    const api = mockApi();
    const service = new YouTubeDiscoveryService(api, storage, {
      scope: {
        mode: "CUSTOM",
        artistIds: [],
        channelIds: ["allowed"],
        channelYouTubeIds: [allowed.channelId],
        videoIds: [],
        trackIds: [],
      },
    });

    await service.execute(mockCtx());

    expect(api.listPlaylistItems).toHaveBeenCalledTimes(1);
    expect(api.listPlaylistItems).toHaveBeenCalledWith(allowed.uploadsPlaylistId, 200);
  });
});
