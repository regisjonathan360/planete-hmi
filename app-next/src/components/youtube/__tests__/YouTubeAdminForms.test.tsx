import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  splitUuidList,
  YouTubeCollectionForm,
  YouTubeVideoEditorialForm,
  youtubeVideoEditorialInputSchema,
} from "..";

const TRACK_ID = "00000000-0000-4000-8000-000000000001";

describe("YouTubeCollectionForm", () => {
  it("affiche les paramètres stabilisés sans appeler une route K6", () => {
    const markup = renderToStaticMarkup(
      <YouTubeCollectionForm
        initialValues={{
          periodStart: "2026-07-13",
          periodEnd: "2026-07-20",
          mode: "FULL_WEEKLY",
          artistIds: [],
          channelIds: [],
          videoIds: [],
          trackIds: [],
          discoverNewVideos: true,
          refreshStatistics: true,
          refreshMetadata: false,
          createDraft: true,
          recalculateChart: true,
        }}
        onSubmit={() => undefined}
      />
    );

    expect(markup).toContain("Période et mode");
    expect(markup).toContain("Collecte hebdomadaire complète");
    expect(markup).toContain("Le mode applique un réglage conseillé.");
    expect(markup).toContain("La période filtre les nouvelles vidéos découvertes.");
    expect(markup).toContain(
      "Bientôt disponible. Cette opération ne peut pas encore être sélectionnée."
    );
    expect(markup).toContain('type="date"');
    expect(markup).toContain("Lancer la collecte");
  });

  it("affiche les cibles uniquement en mode personnalisé", () => {
    const markup = renderToStaticMarkup(
      <YouTubeCollectionForm
        initialValues={{
          periodStart: "2026-07-13",
          periodEnd: "2026-07-20",
          mode: "CUSTOM",
          artistIds: [TRACK_ID],
          channelIds: [],
          videoIds: [],
          trackIds: [],
          discoverNewVideos: true,
          refreshStatistics: true,
          refreshMetadata: false,
          createDraft: true,
          recalculateChart: true,
        }}
        onSubmit={() => undefined}
      />
    );

    expect(markup).toContain("Cibles personnalisées");
    expect(markup).toContain(TRACK_ID);
  });
});

describe("YouTubeVideoEditorialForm", () => {
  it("sépare visuellement les données sources des champs modifiables", () => {
    const markup = renderToStaticMarkup(
      <YouTubeVideoEditorialForm
        source={{
          videoId: "dQw4w9WgXcQ",
          sourceTitle: "Titre officiel YouTube",
          channelTitle: "Chaîne officielle",
          publishedAt: "2026-07-18T12:00:00.000Z",
          viewCount: 125000,
        }}
        initialValues={{
          displayTitle: "Titre public",
          displayThumbnailUrl: null,
          reviewStatus: "APPROVED",
          videoType: "OFFICIAL_MUSIC_VIDEO",
          isEligible: true,
          trackId: TRACK_ID,
          exclusionReason: "",
          reviewReason: "Association vérifiée par l’administration.",
        }}
        onSubmit={() => undefined}
      />
    );

    expect(markup).toContain("Données YouTube originales");
    expect(markup).toContain("lecture seule");
    expect(markup).toContain("Titre officiel YouTube");
    expect(markup).toContain("Décision éditoriale");
    expect(markup).toContain("Justification de la modification");
  });
});

describe("youtubeVideoEditorialInputSchema", () => {
  it("refuse une vidéo approuvée et éligible sans chanson", () => {
    const result = youtubeVideoEditorialInputSchema.safeParse({
      displayTitle: "Titre public",
      displayThumbnailUrl: "",
      reviewStatus: "APPROVED",
      videoType: "OFFICIAL_MUSIC_VIDEO",
      isEligible: true,
      trackId: "",
      exclusionReason: "",
      reviewReason: "Validation éditoriale complète.",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["trackId"] }),
        ])
      );
    }
  });

  it("interdit les Shorts dans le classement principal", () => {
    const result = youtubeVideoEditorialInputSchema.safeParse({
      displayTitle: "Short officiel",
      displayThumbnailUrl: "",
      reviewStatus: "APPROVED",
      videoType: "SHORT",
      isEligible: true,
      trackId: TRACK_ID,
      exclusionReason: "",
      reviewReason: "Vérification manuelle complète.",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["isEligible"] }),
        ])
      );
    }
  });

  it("normalise les listes d’identifiants sans doublons", () => {
    expect(splitUuidList(`${TRACK_ID}, ${TRACK_ID}\nother-id`)).toEqual([
      TRACK_ID,
      "other-id",
    ]);
  });
});
