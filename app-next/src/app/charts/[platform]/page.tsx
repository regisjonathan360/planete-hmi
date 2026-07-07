import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlatformChart } from "@/lib/charts/queries/get-platform-chart";
import { SOURCE_KEY_PAR_SLUG, dateHaiti } from "@/lib/charts/format";
import { ChartTop20Table } from "@/components/charts/ChartTop20Table";
import { ChartSourceBadge } from "@/components/charts/ChartSourceBadge";
import { ChartStaleWarning } from "@/components/charts/ChartStaleWarning";
import { ChartEmptyState } from "@/components/charts/ChartEmptyState";
import {
  AUDIOMACK_HAITI_CHART_SOURCES,
  getAudiomackHaitiChartSource,
} from "@/lib/charts/audiomack-sources";

export const dynamic = "force-dynamic";

export default async function PlatformChartPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ genre?: string | string[] }>;
}) {
  const { platform } = await params;
  const query = await searchParams;
  const requestedGenre = Array.isArray(query.genre) ? query.genre[0] : query.genre;
  const audiomackSource = platform === "audiomack" ? getAudiomackHaitiChartSource(requestedGenre) : null;
  const sourceKey = audiomackSource?.sourceKey ?? SOURCE_KEY_PAR_SLUG[platform];
  if (!sourceKey) notFound();

  const chart = await getPlatformChart(sourceKey, 20);

  return (
    <>
      <p className="hmi__meta">
        <Link className="hmi__link" href="/charts">← Tous les classements</Link>
      </p>

      {!chart ? (
        <>
          <h1 className="hmi__title">Classement indisponible</h1>
          <ChartEmptyState message="Aucune édition publiée pour cette plateforme pour le moment." />
        </>
      ) : (
        <>
          <h1 className="hmi__title">{chart.display_name}</h1>
          {platform === "audiomack" && (
            <nav className="genre-tabs" aria-label="Genres Audiomack Haiti">
              {AUDIOMACK_HAITI_CHART_SOURCES.map((source) => {
                const active = source.sourceKey === sourceKey;
                const href = source.genreId === "all" ? "/charts/audiomack" : `/charts/audiomack?genre=${source.genreId}`;
                return (
                  <Link key={source.sourceKey} className={active ? "genre-tabs__item is-active" : "genre-tabs__item"} href={href}>
                    {source.genreLabel}
                  </Link>
                );
              })}
            </nav>
          )}
          <div className="hmi__meta">
            {chart.chart_context && <span>{chart.chart_context}</span>}
            <ChartSourceBadge
              ingestionMode={chart.ingestion_mode}
              isStale={chart.edition?.is_stale ?? null}
            />
            {chart.edition && (
              <span>Semaine du {dateHaiti(chart.edition.period_start)} au {dateHaiti(chart.edition.period_end)}</span>
            )}
            <Link className="hmi__link" href="/charts/methodology">Méthodologie</Link>
          </div>

          {chart.edition?.is_stale && (
            <ChartStaleWarning sourceUpdatedAt={chart.edition.source_updated_at} />
          )}

          {chart.entries.length > 0 ? (
            <>
              <ChartTop20Table entries={chart.entries} />
              <p className="row__ctx" style={{ marginTop: "0.75rem" }}>
                {chart.entries.length} chanson(s) admissible(s) cette semaine.
              </p>
            </>
          ) : (
            <ChartEmptyState message="Aucune chanson admissible pour cette édition." />
          )}
        </>
      )}
    </>
  );
}
