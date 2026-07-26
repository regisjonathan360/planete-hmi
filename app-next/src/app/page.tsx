import { StaticPage } from "@/components/StaticPage";
import { SOURCE_KEY_PAR_SLUG } from "@/lib/charts/format";
import { getPlatformChart } from "@/lib/charts/queries/get-platform-chart";
import { buildAudiomackTickerHtml } from "@/lib/home/audiomack-ticker";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let tickerHtml = buildAudiomackTickerHtml([]);

  try {
    const chart = await getPlatformChart(
      SOURCE_KEY_PAR_SLUG.audiomack,
      10
    );
    tickerHtml = buildAudiomackTickerHtml(
      (chart?.entries ?? []).map((entry) => ({
        rank: entry.filtered_position,
        title: entry.track_title,
        artistName: entry.artists_text ?? "Artiste HMI",
        rankChange: entry.movement,
        isNew: entry.entry_status?.toUpperCase() === "NEW",
      }))
    );
  } catch {
    // La page reste disponible si le classement est momentanément inaccessible.
  }

  return (
    <StaticPage
      filename="index.html"
      replacements={[
        { marker: "<!-- AUDIOMACK_TICKER -->", html: tickerHtml },
      ]}
    />
  );
}
