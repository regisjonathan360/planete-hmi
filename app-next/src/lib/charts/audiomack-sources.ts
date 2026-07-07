export interface AudiomackHaitiChartSource {
  sourceKey: string;
  genreId: string;
  genreLabel: string;
  displayName: string;
  chartContext: string;
  sourceUrl: string;
}

export const AUDIOMACK_HAITI_SOURCE_URL = "https://audiomack.com/geo-charts/playlist/haiti";
export const AUDIOMACK_CHARTS_URL = "https://audiomack.com/charts";

export const AUDIOMACK_HAITI_CHART_SOURCES: AudiomackHaitiChartSource[] = [
  {
    sourceKey: "audiomack_haiti_weekly100",
    genreId: "all",
    genreLabel: "All",
    displayName: "Audiomack - Weekly 100 Haiti",
    chartContext: "Top Songs Haiti - All",
    sourceUrl: AUDIOMACK_HAITI_SOURCE_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_afrosounds",
    genreId: "afrosounds",
    genreLabel: "Afrosounds",
    displayName: "Audiomack - Haiti Afrosounds",
    chartContext: "Top Songs Haiti - Afrosounds",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_hip_hop_rap",
    genreId: "hip-hop-rap",
    genreLabel: "Hip-Hop/Rap",
    displayName: "Audiomack - Haiti Hip-Hop/Rap",
    chartContext: "Top Songs Haiti - Hip-Hop/Rap",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_latin",
    genreId: "latin",
    genreLabel: "Latin",
    displayName: "Audiomack - Haiti Latin",
    chartContext: "Top Songs Haiti - Latin",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_jazz_blues",
    genreId: "jazz-blues",
    genreLabel: "Jazz/Blues",
    displayName: "Audiomack - Haiti Jazz/Blues",
    chartContext: "Top Songs Haiti - Jazz/Blues",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_caribbean",
    genreId: "caribbean",
    genreLabel: "Caribbean",
    displayName: "Audiomack - Haiti Caribbean",
    chartContext: "Top Songs Haiti - Caribbean",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_pop",
    genreId: "pop",
    genreLabel: "Pop",
    displayName: "Audiomack - Haiti Pop",
    chartContext: "Top Songs Haiti - Pop",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_r_b",
    genreId: "r-b",
    genreLabel: "R&B",
    displayName: "Audiomack - Haiti R&B",
    chartContext: "Top Songs Haiti - R&B",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_gospel",
    genreId: "gospel",
    genreLabel: "Gospel",
    displayName: "Audiomack - Haiti Gospel",
    chartContext: "Top Songs Haiti - Gospel",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_electronic",
    genreId: "electronic",
    genreLabel: "Electronic",
    displayName: "Audiomack - Haiti Electronic",
    chartContext: "Top Songs Haiti - Electronic",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_rock",
    genreId: "rock",
    genreLabel: "Rock",
    displayName: "Audiomack - Haiti Rock",
    chartContext: "Top Songs Haiti - Rock",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_punjabi",
    genreId: "punjabi",
    genreLabel: "Punjabi",
    displayName: "Audiomack - Haiti Punjabi",
    chartContext: "Top Songs Haiti - Punjabi",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_country",
    genreId: "country",
    genreLabel: "Country",
    displayName: "Audiomack - Haiti Country",
    chartContext: "Top Songs Haiti - Country",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_instrumental",
    genreId: "instrumental",
    genreLabel: "Instrumental",
    displayName: "Audiomack - Haiti Instrumental",
    chartContext: "Top Songs Haiti - Instrumental",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
  {
    sourceKey: "audiomack_haiti_top_songs_podcast",
    genreId: "podcast",
    genreLabel: "Podcast",
    displayName: "Audiomack - Haiti Podcast",
    chartContext: "Top Haiti - Podcast",
    sourceUrl: AUDIOMACK_CHARTS_URL,
  },
];

export function getAudiomackHaitiChartSource(genreId: string | null | undefined): AudiomackHaitiChartSource {
  return (
    AUDIOMACK_HAITI_CHART_SOURCES.find((source) => source.genreId === genreId) ??
    AUDIOMACK_HAITI_CHART_SOURCES[0]
  );
}
