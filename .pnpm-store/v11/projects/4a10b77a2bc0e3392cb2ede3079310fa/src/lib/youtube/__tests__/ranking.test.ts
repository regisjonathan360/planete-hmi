import { describe, expect, it } from "vitest";
import {
  aggregateYouTubePerformancesByTrack,
  calculateYouTubeVideoPerformance,
  rankYouTubeVideos,
  rankYouTubeTracks,
} from "../ranking";
import type {
  YouTubeMetricSnapshot,
  YouTubeTrackedVideo,
  YouTubeVideoPeriodInput,
} from "../types";

function video(
  overrides: Partial<YouTubeTrackedVideo> = {}
): YouTubeTrackedVideo {
  return {
    videoId: "video000001",
    trackId: "track-1",
    sourceTitle: "Titre source",
    displayTitle: null,
    channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    publishedAt: "2026-07-01T00:00:00.000Z",
    videoType: "OFFICIAL_MUSIC_VIDEO",
    verificationStatus: "APPROVED",
    eligibilityStatus: "ELIGIBLE",
    isAvailable: true,
    ...overrides,
  };
}

function snapshot(
  videoId: string,
  capturedAt: string,
  views: number,
  likes: number | null = 0,
  comments: number | null = 0
): YouTubeMetricSnapshot {
  return {
    videoId,
    capturedAt,
    viewCount: views,
    likeCount: likes,
    commentCount: comments,
    availabilityStatus: "AVAILABLE",
  };
}

function periodInput(
  overrides: Partial<YouTubeVideoPeriodInput> = {}
): YouTubeVideoPeriodInput {
  const trackedVideo = overrides.video ?? video();
  return {
    video: trackedVideo,
    periodStart: "2026-07-17T00:00:00.000Z",
    periodEnd: "2026-07-24T00:00:00.000Z",
    startSnapshot: snapshot(
      trackedVideo.videoId,
      "2026-07-17T00:00:00.000Z",
      2_410_000,
      82_000,
      4_200
    ),
    endSnapshot: snapshot(
      trackedVideo.videoId,
      "2026-07-24T00:00:00.000Z",
      2_560_000,
      85_000,
      4_500
    ),
    ...overrides,
  };
}

describe("calculateYouTubeVideoPerformance", () => {
  it("calcule les différences sans modifier les snapshots", () => {
    const input = periodInput();
    const startBefore = structuredClone(input.startSnapshot);
    const endBefore = structuredClone(input.endSnapshot);

    expect(calculateYouTubeVideoPerformance(input)).toMatchObject({
      status: "ELIGIBLE",
      weeklyViews: 150_000,
      weeklyLikes: 3_000,
      weeklyComments: 300,
      totalViews: 2_560_000,
      usedZeroStart: false,
    });
    expect(input.startSnapshot).toEqual(startBefore);
    expect(input.endSnapshot).toEqual(endBefore);
  });

  it("utilise zéro pour une nouvelle vidéo publiée pendant la période", () => {
    const trackedVideo = video({
      publishedAt: "2026-07-20T12:00:00.000Z",
    });
    const result = calculateYouTubeVideoPerformance(
      periodInput({
        video: trackedVideo,
        startSnapshot: null,
        endSnapshot: snapshot(
          trackedVideo.videoId,
          "2026-07-24T00:00:00.000Z",
          40_000,
          2_000,
          100
        ),
      })
    );

    expect(result).toMatchObject({
      status: "ELIGIBLE",
      weeklyViews: 40_000,
      usedZeroStart: true,
    });
  });

  it("refuse une ancienne vidéo sans snapshot de départ", () => {
    expect(
      calculateYouTubeVideoPerformance(periodInput({ startSnapshot: null }))
        .status
    ).toBe("START_SNAPSHOT_MISSING");
  });

  it("signale un compteur qui diminue sans produire de delta", () => {
    const input = periodInput({
      endSnapshot: snapshot(
        "video000001",
        "2026-07-24T00:00:00.000Z",
        2_400_000,
        85_000,
        4_500
      ),
    });

    expect(calculateYouTubeVideoPerformance(input)).toMatchObject({
      status: "COUNTER_DECREASED",
      weeklyViews: null,
    });
  });

  it.each([
    [video({ verificationStatus: "UNREVIEWED" }), "VIDEO_NOT_APPROVED"],
    [video({ eligibilityStatus: "INELIGIBLE" }), "VIDEO_NOT_ELIGIBLE"],
    [video({ isAvailable: false }), "VIDEO_UNAVAILABLE"],
  ] as const)("exclut correctement une vidéo non admissible", (item, status) => {
    expect(
      calculateYouTubeVideoPerformance(periodInput({ video: item })).status
    ).toBe(status);
  });

  it.each([
    video({ videoType: "SHORT", trackId: null }),
    video({ videoType: "INTERVIEW", trackId: null }),
  ])("accepte une vidéo approuvée sans chanson, quel que soit son type", (item) => {
    expect(calculateYouTubeVideoPerformance(periodInput({ video: item })).status).toBe("ELIGIBLE");
  });
});

describe("classement automatique par vidéo", () => {
  it("classe chaque vidéo séparément dans le brouillon", () => {
    const first = calculateYouTubeVideoPerformance(periodInput({ video: video({ videoId: "video-a", trackId: null }) }));
    const secondVideo = video({ videoId: "video-b", videoType: "INTERVIEW", trackId: null });
    const second = calculateYouTubeVideoPerformance(periodInput({
      video: secondVideo,
      startSnapshot: snapshot("video-b", "2026-07-17T00:00:00.000Z", 10),
      endSnapshot: snapshot("video-b", "2026-07-24T00:00:00.000Z", 200),
    }));

    expect(rankYouTubeVideos([first, second]).map((item) => item.videoId)).toEqual(["video-a", "video-b"]);
  });
});

describe("agrégation et classement par chanson", () => {
  it("additionne plusieurs vidéos officielles d’une même chanson", () => {
    const first = calculateYouTubeVideoPerformance(periodInput());
    const secondVideo = video({
      videoId: "video000002",
      videoType: "OFFICIAL_AUDIO",
    });
    const second = calculateYouTubeVideoPerformance(
      periodInput({
        video: secondVideo,
        startSnapshot: snapshot(
          secondVideo.videoId,
          "2026-07-17T00:00:00.000Z",
          100_000,
          5_000,
          200
        ),
        endSnapshot: snapshot(
          secondVideo.videoId,
          "2026-07-24T00:00:00.000Z",
          160_000,
          6_000,
          250
        ),
      })
    );

    const aggregate = aggregateYouTubePerformancesByTrack([first, second], [
      {
        trackId: "track-1",
        title: "Chanson",
        artistNames: "Artiste",
        releaseDate: "2026-06-01",
      },
    ]);

    expect(aggregate).toEqual([
      expect.objectContaining({
        weeklyViews: 210_000,
        weeklyLikes: 4_000,
        weeklyComments: 350,
        totalViews: 2_720_000,
        eligibleVideoCount: 2,
        videoIds: ["video000001", "video000002"],
      }),
    ]);
  });

  it("applique tous les critères de départage et limite le Top 20", () => {
    const ranked = rankYouTubeTracks(
      [
        {
          trackId: "track-b",
          title: "B",
          artistNames: "Artiste",
          releaseDate: "2026-06-01",
          weeklyViews: 100,
          weeklyLikes: 10,
          weeklyComments: 2,
          totalViews: 1_000,
          eligibleVideoCount: 1,
          videoIds: ["video-b"],
        },
        {
          trackId: "track-a",
          title: "A",
          artistNames: "Artiste",
          releaseDate: "2026-07-01",
          weeklyViews: 100,
          weeklyLikes: 10,
          weeklyComments: 2,
          totalViews: 1_000,
          eligibleVideoCount: 1,
          videoIds: ["video-a"],
        },
        {
          trackId: "track-c",
          title: "C",
          artistNames: "Artiste",
          releaseDate: "2026-01-01",
          weeklyViews: 100,
          weeklyLikes: 11,
          weeklyComments: 0,
          totalViews: 500,
          eligibleVideoCount: 1,
          videoIds: ["video-c"],
        },
      ],
      2
    );

    expect(ranked.map((item) => item.trackId)).toEqual([
      "track-c",
      "track-a",
    ]);
    expect(ranked.map((item) => item.automaticRank)).toEqual([1, 2]);
  });
});
