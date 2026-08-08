import { describe, expect, it } from "vitest";
import {
  youtubeChannelIdSchema,
  youtubeChannelInputSchema,
  youtubeCollectionParamsSchema,
  youtubeUrlSchema,
  youtubeVideoIdSchema,
  youtubeVideoListResponseSchema,
} from "../schemas";

describe("identifiants et URL YouTube", () => {
  it("accepte les identifiants YouTube valides", () => {
    expect(youtubeVideoIdSchema.parse("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(
      youtubeChannelIdSchema.parse("UC_x5XG1OV2P6uZZ5FSM9Ttw")
    ).toBe("UC_x5XG1OV2P6uZZ5FSM9Ttw");
  });

  it.each(["court", "dQw4w9WgXc!", "https://youtu.be/dQw4w9WgXcQ"])(
    "rejette l’identifiant vidéo %s",
    (value) => {
      expect(youtubeVideoIdSchema.safeParse(value).success).toBe(false);
    }
  );

  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://music.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
  ])("accepte l’URL officielle %s", (value) => {
    expect(youtubeUrlSchema.safeParse(value).success).toBe(true);
  });

  it("rejette une URL qui imite YouTube", () => {
    expect(
      youtubeUrlSchema.safeParse("https://youtube.com.example.org/video")
        .success
    ).toBe(false);
  });
});

describe("youtubeChannelInputSchema", () => {
  it("valide une source YouTube complète", () => {
    expect(
      youtubeChannelInputSchema.safeParse({
        artistId: null,
        channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
        channelTitle: "Chaîne officielle",
        channelType: "OFFICIAL_ARTIST_CHANNEL",
        uploadsPlaylistId: "UU_x5XG1OV2P6uZZ5FSM9Ttw",
        channelUrl:
          "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
        isVerified: true,
        isActive: true,
        notes: null,
      }).success
    ).toBe(true);
  });

  it("rejette un type de chaîne inconnu", () => {
    expect(
      youtubeChannelInputSchema.safeParse({
        artistId: null,
        channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
        channelTitle: "Chaîne",
        channelType: "FAN_CHANNEL",
        uploadsPlaylistId: null,
        channelUrl: "https://youtube.com/@artiste",
        isVerified: false,
        isActive: true,
        notes: null,
      }).success
    ).toBe(false);
  });
});

describe("youtubeCollectionParamsSchema", () => {
  const base = {
    periodStart: "2026-07-17",
    periodEnd: "2026-07-24",
    mode: "FULL_WEEKLY" as const,
  };

  it("applique les options par défaut d’une collecte complète", () => {
    const result = youtubeCollectionParamsSchema.parse(base);

    expect(result.discoverNewVideos).toBe(true);
    expect(result.refreshStatistics).toBe(true);
    expect(result.createDraft).toBe(true);
    expect(result.artistIds).toEqual([]);
  });

  it.each([
    { ...base, periodStart: "2026-02-30" },
    { ...base, periodEnd: "2026-07-17" },
    { ...base, mode: "INCONNU" },
  ])("rejette des paramètres invalides", (value) => {
    expect(youtubeCollectionParamsSchema.safeParse(value).success).toBe(false);
  });

  it("exige une cible pour une collecte personnalisée", () => {
    expect(
      youtubeCollectionParamsSchema.safeParse({ ...base, mode: "CUSTOM" })
        .success
    ).toBe(false);

    expect(
      youtubeCollectionParamsSchema.safeParse({
        ...base,
        mode: "CUSTOM",
        channelIds: ["f090bf7c-9e91-4f6b-bf70-92b18b3360cd"],
      }).success
    ).toBe(true);
  });
});

describe("youtubeVideoListResponseSchema", () => {
  it("valide les métadonnées et statistiques publiques utiles", () => {
    const result = youtubeVideoListResponseSchema.parse({
      items: [
        {
          id: "dQw4w9WgXcQ",
          snippet: {
            channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
            channelTitle: "Chaîne officielle",
            title: "Titre officiel",
            description: "Description",
            publishedAt: "2026-07-20T12:00:00Z",
            categoryId: "10",
            thumbnails: {
              high: {
                url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
                width: 480,
                height: 360,
              },
            },
          },
          contentDetails: { duration: "PT3M42S" },
          status: { privacyStatus: "public", embeddable: true },
          statistics: {
            viewCount: "2500000",
            likeCount: "85000",
            commentCount: "4500",
          },
        },
      ],
      pageInfo: { totalResults: 1, resultsPerPage: 1 },
    });

    expect(result.items[0].statistics.viewCount).toBe("2500000");
  });

  it("rejette un compteur négatif ou non numérique", () => {
    expect(
      youtubeVideoListResponseSchema.safeParse({
        items: [
          {
            id: "dQw4w9WgXcQ",
            snippet: {
              channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
              channelTitle: "Chaîne",
              title: "Titre",
              description: "",
              publishedAt: "2026-07-20T12:00:00Z",
              categoryId: "10",
              thumbnails: {},
            },
            contentDetails: { duration: "PT3M" },
            status: { privacyStatus: "public", embeddable: true },
            statistics: { viewCount: "-1" },
          },
        ],
      }).success
    ).toBe(false);
  });
});
