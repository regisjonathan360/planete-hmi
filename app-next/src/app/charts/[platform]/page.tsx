import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlatformChart } from "@/lib/charts/queries/get-platform-chart";
import { SOURCE_KEY_PAR_SLUG, dateHaiti } from "@/lib/charts/format";
import { ChartSourceBadge } from "@/components/charts/ChartSourceBadge";
import { ChartStaleWarning } from "@/components/charts/ChartStaleWarning";
import { ChartEmptyState } from "@/components/charts/ChartEmptyState";
import { ChartFilterableList } from "@/components/charts/ChartFilterableList";

export const dynamic = "force-dynamic";

export default async function PlatformChartPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  const sourceKey = SOURCE_KEY_PAR_SLUG[platform];
  if (!sourceKey) notFound();

  const chart = await getPlatformChart(sourceKey, 100);

  return (
    <>
      <p className="hmi__meta">
        <Link className="row__top20" href="/charts">← Tous les classements</Link>
      </p>

      {!chart ? (
        <>
          <h1 className="hmi__title">Classement indisponible</h1>
          <ChartEmptyState message="Aucune édition publiée pour cette plateforme pour le moment." />
        </>
      ) : (
        <>
          <h1 className="hmi__title">{chart.display_name}</h1>

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
            <ChartFilterableList
              entries={chart.entries}
              platform={platform}
              initialCount={20}
            />
          ) : (
            <ChartEmptyState message="Aucune chanson admissible pour cette édition." />
          )}
        </>
      )}
    </>
  );
}
