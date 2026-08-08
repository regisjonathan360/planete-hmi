import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

async function createStorageWith(client: { rpc: ReturnType<typeof vi.fn>; from: ReturnType<typeof vi.fn> }) {
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => client,
  }));
  const { createSnapshotStorage } = await import("../snapshot-supabase-storage");
  return createSnapshotStorage();
}

describe("snapshot Supabase storage", () => {
  it("appelle get_latest_snapshots_before et convertit les bigint texte", async () => {
    const rpc = vi.fn(async () => ({
      data: [{
        youtube_video_id: "00000000-0000-0000-0000-000000000001",
        view_count: "1200",
        like_count: "34",
        comment_count: null,
        availability_status: "available",
        observed_at: "2026-07-21T00:00:00Z",
      }],
      error: null,
    }));
    const storage = await createStorageWith({ rpc, from: vi.fn() });
    const result = await storage.getLatestSnapshotsBefore(
      ["00000000-0000-0000-0000-000000000001"],
      "2026-07-21T00:00:00Z"
    );

    expect(rpc).toHaveBeenCalledWith("get_latest_snapshots_before", {
      p_video_ids: ["00000000-0000-0000-0000-000000000001"],
      p_before_or_at: "2026-07-21T00:00:00Z",
    });
    expect(result.values().next().value).toMatchObject({
      viewCount: 1200,
      likeCount: 34,
      commentCount: null,
    });
  });

  it("appelle la RPC du dernier snapshot réellement available", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const storage = await createStorageWith({ rpc, from: vi.fn() });
    await storage.getLatestAvailableSnapshotsBefore(
      ["00000000-0000-0000-0000-000000000001"],
      "2026-07-21T00:00:00Z"
    );
    expect(rpc).toHaveBeenCalledWith("get_latest_available_snapshots_before", {
      p_video_ids: ["00000000-0000-0000-0000-000000000001"],
      p_before_or_at: "2026-07-21T00:00:00Z",
    });
  });

  it("transmet le fencing token et le payload des snapshots", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ success: true, inserted_count: 1, skipped_count: 0 }],
      error: null,
    }));
    const storage = await createStorageWith({ rpc, from: vi.fn() });
    const result = await storage.fencedInsertSnapshots(
      "youtube_hmi_weekly_delta",
      "2026-07-14::2026-07-21",
      "owner-token",
      "00000000-0000-0000-0000-000000000010",
      [{
        youtubeVideoId: "00000000-0000-0000-0000-000000000011",
        syncRunId: "00000000-0000-0000-0000-000000000010",
        viewCount: 100,
        likeCount: 10,
        commentCount: 2,
        availabilityStatus: "available",
        source: "youtube_data_api_v3",
        error: null,
      }]
    );

    expect(rpc).toHaveBeenCalledWith(
      "fenced_insert_youtube_snapshots",
      expect.objectContaining({
        p_period_key: "2026-07-14::2026-07-21",
        p_owner_token: "owner-token",
        p_snapshots: [expect.objectContaining({ view_count: 100 })],
      })
    );
    expect(result).toEqual({ success: true, insertedCount: 1, skippedCount: 0 });
  });

  it("transmet total_views et eligible_video_count au brouillon", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ success: true, edition_id: "edition-1", message: "ok" }],
      error: null,
    }));
    const storage = await createStorageWith({ rpc, from: vi.fn() });
    await storage.fencedUpsertDraft(
      "youtube_hmi_weekly_delta",
      "2026-07-14::2026-07-21",
      "owner-token",
      "00000000-0000-0000-0000-000000000010",
      "00000000-0000-0000-0000-000000000020",
      "2026-07-14",
      "2026-07-21",
      [{
        youtube_video_id: "00000000-0000-0000-0000-000000000040",
        track_id: "00000000-0000-0000-0000-000000000030",
        metric_value: 500,
        raw_artist_text: "Artist",
        raw_track_title: "Track",
        delta_views: 500,
        delta_likes: 20,
        delta_comments: 3,
        total_views: 1500,
        eligible_video_count: 2,
      }],
      "draft",
      null
    );

    expect(rpc).toHaveBeenCalledWith(
      "fenced_upsert_youtube_draft",
      expect.objectContaining({
        p_owner_token: "owner-token",
        p_entries: [expect.objectContaining({
          total_views: 1500,
          eligible_video_count: 2,
        })],
      })
    );
  });

  it("remonte les erreurs Supabase", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "database unavailable?key=AIzaSecretValue12345678901234567890" },
    }));
    const storage = await createStorageWith({ rpc, from: vi.fn() });
    await expect(storage.getLatestSnapshotsBefore(
      ["00000000-0000-0000-0000-000000000001"],
      "2026-07-21T00:00:00Z"
    )).rejects.toThrow("database unavailable");
    await storage.getLatestSnapshotsBefore(
      ["00000000-0000-0000-0000-000000000001"],
      "2026-07-21T00:00:00Z"
    ).catch((error: unknown) => {
      expect(String(error)).not.toContain("AIzaSecretValue");
    });
  });

  it("applique les trois filtres d'éligibilité", async () => {
    let eqCount = 0;
    const query: Record<string, unknown> = {};
    const eq = vi.fn(() => {
      eqCount += 1;
      if (eqCount === 3) {
        return Promise.resolve({
          data: [{
            id: "video-internal",
            video_id: "youtube-id",
            channel_id: "channel-id",
            track_id: null,
            source_title: "Vidéo test",
            display_title: null,
            source_thumbnail_url: "https://i.ytimg.com/test.jpg",
            display_thumbnail_url: null,
            published_at: "2026-07-01T00:00:00Z",
            video_type: "OFFICIAL_MUSIC_VIDEO",
            youtube_channels: { channel_title: "Chaîne test" },
          }],
          error: null,
        });
      }
      return query;
    });
    query.select = vi.fn(() => query);
    query.eq = eq;
    const from = vi.fn(() => query);
    const storage = await createStorageWith({ rpc: vi.fn(), from });

    const videos = await storage.getEligibleVideos();
    expect(from).toHaveBeenCalledWith("youtube_videos");
    expect(eq).toHaveBeenNthCalledWith(1, "is_active", true);
    expect(eq).toHaveBeenNthCalledWith(2, "review_status", "APPROVED");
    expect(eq).toHaveBeenNthCalledWith(3, "is_eligible", true);
    expect(videos[0].trackId).toBeNull();
    expect(videos[0].channelTitle).toBe("Chaîne test");
  });
});
