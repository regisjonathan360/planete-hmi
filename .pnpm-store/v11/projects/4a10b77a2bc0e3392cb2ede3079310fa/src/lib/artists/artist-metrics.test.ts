import { describe, expect, it } from "vitest";
import {
  buildMetricSummaries,
  databaseRowToMetricSnapshot,
  type ArtistMetricDatabaseRow,
} from "./artist-metrics";

function row(
  overrides: Partial<ArtistMetricDatabaseRow> = {},
): ArtistMetricDatabaseRow {
  return {
    id: "snapshot-id",
    platform: "spotify",
    source_field: "url_spotify",
    collected_at: "2026-07-28T12:00:00.000Z",
    monthly_listeners: 1000,
    followers: 200,
    subscriber_count: null,
    total_views: null,
    popularity: 50,
    album_count: 2,
    track_count: 10,
    ...overrides,
  };
}

describe("historique des indicateurs artiste", () => {
  it("convertit les bigint renvoyés sous forme de texte", () => {
    const snapshot = databaseRowToMetricSnapshot(row({
      monthly_listeners: "1200000",
      followers: "34000",
    }));

    expect(snapshot.values.monthlyListeners).toBe(1_200_000);
    expect(snapshot.values.followers).toBe(34_000);
  });

  it("retient les deux relevés les plus récents par plateforme", () => {
    const summaries = buildMetricSummaries([
      row({ id: "old", collected_at: "2026-07-01T00:00:00.000Z", followers: 100 }),
      row({ id: "latest", collected_at: "2026-07-28T00:00:00.000Z", followers: 140 }),
      row({ id: "previous", collected_at: "2026-07-20T00:00:00.000Z", followers: 125 }),
    ]);

    expect(summaries[0].latest.id).toBe("latest");
    expect(summaries[0].previous?.id).toBe("previous");
    expect(summaries[0].deltas.followers).toBe(15);
  });

  it("ne fabrique pas de variation lorsqu'une valeur précédente manque", () => {
    const summaries = buildMetricSummaries([
      row({ id: "latest", followers: 140, total_views: 5000 }),
      row({
        id: "previous",
        collected_at: "2026-07-20T00:00:00.000Z",
        followers: 125,
        total_views: null,
      }),
    ]);

    expect(summaries[0].deltas.followers).toBe(15);
    expect(summaries[0].deltas.totalViews).toBeNull();
  });

  it("sépare correctement les plateformes", () => {
    const summaries = buildMetricSummaries([
      row({ platform: "spotify" }),
      row({
        id: "youtube",
        platform: "youtube",
        source_field: "url_youtube",
        subscriber_count: 500,
      }),
    ]);

    expect(summaries.map((summary) => summary.platform).sort()).toEqual([
      "spotify",
      "youtube",
    ]);
  });
});
