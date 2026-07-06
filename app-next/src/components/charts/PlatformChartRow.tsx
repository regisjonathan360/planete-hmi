import Link from "next/link";
import { ChartOverviewRow } from "@/lib/charts/queries/types";
import { SLUG_PAR_PLATEFORME } from "@/lib/charts/format";
import { TrackChartCard } from "./TrackChartCard";
import { ChartSourceBadge } from "./ChartSourceBadge";
import { ChartUpdatedAt } from "./ChartUpdatedAt";
import { ChartEmptyState } from "./ChartEmptyState";
import { ChartStaleWarning } from "./ChartStaleWarning";

/** Une rangée = un classement (Top 10 + lien Top 20). */
export function PlatformChartRow({ row }: { row: ChartOverviewRow }) {
  const slug = SLUG_PAR_PLATEFORME[row.platform] ?? row.platform;
  const aDesEntrees = row.entries && row.entries.length > 0;

  return (
    <section className="row" aria-label={row.display_name}>
      <div className="row__head">
        <h2 className="row__name">{row.display_name}</h2>
        {row.chart_context && <span className="row__ctx">{row.chart_context}</span>}
        <ChartSourceBadge ingestionMode={row.ingestion_mode} isStale={row.is_stale} />
        {row.period_end && <ChartUpdatedAt iso={row.published_at ?? row.source_updated_at} />}
        <span className="row__spacer" />
        <Link className="row__top20" href={`/charts/${slug}`}>
          Voir le Top 20 →
        </Link>
      </div>

      {row.is_stale && <ChartStaleWarning sourceUpdatedAt={row.source_updated_at} />}

      {aDesEntrees ? (
        <div className="track-scroll" role="list">
          {row.entries.map((e) => (
            <div role="listitem" key={e.track_id + "-" + e.filtered_position}>
              <TrackChartCard entry={e} />
            </div>
          ))}
        </div>
      ) : (
        <ChartEmptyState message="Aucune édition publiée pour le moment. Les données arriveront après le prochain import vérifié ou une source officielle." />
      )}
    </section>
  );
}
