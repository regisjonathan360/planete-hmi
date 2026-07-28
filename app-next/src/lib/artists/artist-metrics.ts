export const ARTIST_METRIC_KEYS = [
  "monthlyListeners",
  "followers",
  "subscriberCount",
  "totalViews",
  "popularity",
  "albumCount",
  "trackCount",
] as const;

export type ArtistMetricKey = (typeof ARTIST_METRIC_KEYS)[number];
export type ArtistMetricValues = Record<ArtistMetricKey, number | null>;

export interface ArtistMetricDatabaseRow {
  id: string;
  platform: string;
  source_field: string;
  collected_at: string;
  monthly_listeners: number | string | null;
  followers: number | string | null;
  subscriber_count: number | string | null;
  total_views: number | string | null;
  popularity: number | string | null;
  album_count: number | string | null;
  track_count: number | string | null;
}

export interface ArtistMetricSnapshot {
  id: string;
  platform: string;
  sourceField: string;
  collectedAt: string;
  values: ArtistMetricValues;
}

export interface ArtistMetricSummary {
  platform: string;
  sourceField: string;
  latest: ArtistMetricSnapshot;
  previous: ArtistMetricSnapshot | null;
  deltas: ArtistMetricValues;
}

function numberOrNull(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function databaseRowToMetricSnapshot(
  row: ArtistMetricDatabaseRow,
): ArtistMetricSnapshot {
  return {
    id: row.id,
    platform: row.platform,
    sourceField: row.source_field,
    collectedAt: row.collected_at,
    values: {
      monthlyListeners: numberOrNull(row.monthly_listeners),
      followers: numberOrNull(row.followers),
      subscriberCount: numberOrNull(row.subscriber_count),
      totalViews: numberOrNull(row.total_views),
      popularity: numberOrNull(row.popularity),
      albumCount: numberOrNull(row.album_count),
      trackCount: numberOrNull(row.track_count),
    },
  };
}

function emptyMetricValues(): ArtistMetricValues {
  return {
    monthlyListeners: null,
    followers: null,
    subscriberCount: null,
    totalViews: null,
    popularity: null,
    albumCount: null,
    trackCount: null,
  };
}

export function buildMetricSummaries(
  rows: ArtistMetricDatabaseRow[],
): ArtistMetricSummary[] {
  const snapshots = rows
    .map(databaseRowToMetricSnapshot)
    .sort((left, right) => Date.parse(right.collectedAt) - Date.parse(left.collectedAt));
  const byPlatform = new Map<string, ArtistMetricSnapshot[]>();
  for (const snapshot of snapshots) {
    const list = byPlatform.get(snapshot.platform) ?? [];
    if (list.length < 2) list.push(snapshot);
    byPlatform.set(snapshot.platform, list);
  }

  return [...byPlatform.values()]
    .filter((items) => items[0])
    .map((items) => {
      const latest = items[0];
      const previous = items[1] ?? null;
      const deltas = emptyMetricValues();
      if (previous) {
        for (const key of ARTIST_METRIC_KEYS) {
          const currentValue = latest.values[key];
          const previousValue = previous.values[key];
          deltas[key] = currentValue === null || previousValue === null
            ? null
            : currentValue - previousValue;
        }
      }
      return {
        platform: latest.platform,
        sourceField: latest.sourceField,
        latest,
        previous,
        deltas,
      };
    })
    .sort((left, right) => {
      return Date.parse(right.latest.collectedAt) - Date.parse(left.latest.collectedAt);
    });
}
