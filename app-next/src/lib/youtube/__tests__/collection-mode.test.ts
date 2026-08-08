import { describe, expect, it } from "vitest";
import { getCollectionModePreset } from "../collection-mode";

describe("préréglages des modes de collecte YouTube", () => {
  it("configure une collecte hebdomadaire complète", () => {
    expect(getCollectionModePreset("FULL_WEEKLY")).toEqual({
      discoverNewVideos: true,
      refreshStatistics: true,
      refreshMetadata: false,
      createDraft: true,
      recalculateChart: true,
    });
  });

  it("n’active que les statistiques en mode actualisation", () => {
    expect(getCollectionModePreset("REFRESH_STATISTICS")).toEqual({
      discoverNewVideos: false,
      refreshStatistics: true,
      refreshMetadata: false,
      createDraft: false,
      recalculateChart: false,
    });
  });

  it("n’active que la découverte pour les nouvelles sorties", () => {
    expect(getCollectionModePreset("DISCOVER_NEW_RELEASES")).toEqual({
      discoverNewVideos: true,
      refreshStatistics: false,
      refreshMetadata: false,
      createDraft: false,
      recalculateChart: false,
    });
  });

  it("laisse les cases libres en mode personnalisé", () => {
    expect(getCollectionModePreset("CUSTOM")).toBeNull();
  });
});
