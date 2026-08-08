import { describe, expect, it } from "vitest";
import { validateYouTubeDraft } from "../validate-draft";
import type { YouTubeDraftValidationEntry } from "../types";

function validEntry(
  overrides: Partial<YouTubeDraftValidationEntry> = {}
): YouTubeDraftValidationEntry {
  return {
    trackId: "track-1",
    publicTitle: "Chanson",
    videoType: "OFFICIAL_MUSIC_VIDEO",
    verificationStatus: "APPROVED",
    eligibilityStatus: "ELIGIBLE",
    hasStartSnapshot: true,
    hasEndSnapshot: true,
    weeklyViews: 100_000,
    hasDuplicate: false,
    artistIsLinked: true,
    manualOverrideApplied: false,
    overrideReason: null,
    likesAvailable: true,
    commentsAvailable: true,
    thumbnailWasChanged: false,
    videoIsAvailable: true,
    ...overrides,
  };
}

function twentyValidEntries(): YouTubeDraftValidationEntry[] {
  return Array.from({ length: 20 }, () => validEntry());
}

describe("validateYouTubeDraft", () => {
  it("autorise un brouillon complet sans erreur bloquante", () => {
    const result = validateYouTubeDraft({
      periodStart: "2026-07-17T00:00:00.000Z",
      periodEnd: "2026-07-24T00:00:00.000Z",
      publicPeriodLabel: "Du 17 au 24 juillet 2026",
      entries: twentyValidEntries(),
    });

    expect(result.valid).toBe(true);
    expect(result.blockingErrors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ["START_SNAPSHOT_MISSING", { hasStartSnapshot: false }],
    ["END_SNAPSHOT_MISSING", { hasEndSnapshot: false }],
    ["VIDEO_NOT_APPROVED", { verificationStatus: "UNREVIEWED" }],
    ["DUPLICATE", { hasDuplicate: true }],
    ["SHORT_INCLUDED", { videoType: "SHORT" }],
    ["INELIGIBLE_VIDEO", { eligibilityStatus: "INELIGIBLE" }],
    ["INVALID_WEEKLY_VIEWS", { weeklyViews: -1 }],
    [
      "OVERRIDE_REASON_MISSING",
      { manualOverrideApplied: true, overrideReason: " " },
    ],
    ["PUBLIC_TITLE_MISSING", { publicTitle: "" }],
  ] as const)("bloque la publication pour %s", (code, overrides) => {
    const entries = twentyValidEntries();
    entries[0] = validEntry(overrides);

    const result = validateYouTubeDraft({
      periodStart: "2026-07-17T00:00:00.000Z",
      periodEnd: "2026-07-24T00:00:00.000Z",
      publicPeriodLabel: "Du 17 au 24 juillet 2026",
      entries,
    });

    expect(result.valid).toBe(false);
    expect(result.blockingErrors.map((item) => item.code)).toContain(code);
  });

  it("autorise une vidéo sans chanson ni artiste associé", () => {
    const entries = twentyValidEntries();
    entries[0] = validEntry({ trackId: null, artistIsLinked: false });

    const result = validateYouTubeDraft({
      periodStart: "2026-07-17T00:00:00.000Z",
      periodEnd: "2026-07-24T00:00:00.000Z",
      publicPeriodLabel: "Du 17 au 24 juillet 2026",
      entries,
    });

    expect(result.valid).toBe(true);
  });

  it("sépare les avertissements des erreurs bloquantes", () => {
    const entries = twentyValidEntries();
    entries[0] = validEntry({
      likesAvailable: false,
      commentsAvailable: false,
      thumbnailWasChanged: true,
      videoIsAvailable: false,
    });

    const result = validateYouTubeDraft({
      periodStart: "2026-07-17T00:00:00.000Z",
      periodEnd: "2026-07-24T00:00:00.000Z",
      publicPeriodLabel: "Du 17 au 24 juillet 2026",
      entries,
    });

    expect(result.valid).toBe(true);
    expect(result.warnings.map((item) => item.code)).toEqual([
      "LIKES_UNAVAILABLE",
      "COMMENTS_UNAVAILABLE",
      "THUMBNAIL_CHANGED",
      "VIDEO_UNAVAILABLE",
    ]);
  });

  it("avertit sans bloquer lorsqu’il y a moins de 20 vidéos", () => {
    const result = validateYouTubeDraft({
      periodStart: "2026-07-17T00:00:00.000Z",
      periodEnd: "2026-07-24T00:00:00.000Z",
      publicPeriodLabel: "Du 17 au 24 juillet 2026",
      entries: [validEntry()],
    });

    expect(result.valid).toBe(true);
    expect(result.warnings.map((item) => item.code)).toContain(
      "LESS_THAN_20_VIDEOS"
    );
  });
});
