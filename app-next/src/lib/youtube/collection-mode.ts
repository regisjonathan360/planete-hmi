import type { YouTubeCollectionParams } from "./schemas";

export type CollectionOperationValues = Pick<
  YouTubeCollectionParams,
  | "discoverNewVideos"
  | "refreshStatistics"
  | "refreshMetadata"
  | "createDraft"
  | "recalculateChart"
>;

const MODE_PRESETS: Record<
  Exclude<YouTubeCollectionParams["mode"], "CUSTOM">,
  CollectionOperationValues
> = {
  FULL_WEEKLY: {
    discoverNewVideos: true,
    refreshStatistics: true,
    refreshMetadata: false,
    createDraft: true,
    recalculateChart: true,
  },
  REFRESH_STATISTICS: {
    discoverNewVideos: false,
    refreshStatistics: true,
    refreshMetadata: false,
    createDraft: false,
    recalculateChart: false,
  },
  DISCOVER_NEW_RELEASES: {
    discoverNewVideos: true,
    refreshStatistics: false,
    refreshMetadata: false,
    createDraft: false,
    recalculateChart: false,
  },
};

export function getCollectionModePreset(
  mode: YouTubeCollectionParams["mode"]
): CollectionOperationValues | null {
  return mode === "CUSTOM" ? null : MODE_PRESETS[mode];
}
