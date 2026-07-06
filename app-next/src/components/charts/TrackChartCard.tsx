import { ChartEntryView } from "@/lib/charts/queries/types";
import { libelleMetrique } from "@/lib/charts/format";
import { ChartMovementBadge } from "./ChartMovementBadge";

/** Carte d'une chanson : position HMI à côté de la pochette (jamais dessus). */
export function TrackChartCard({ entry }: { entry: ChartEntryView }) {
  const metric = libelleMetrique(entry.metric_value, entry.metric_unit);
  return (
    <article className="card">
      <div className="card__rank" aria-hidden="true">
        {entry.filtered_position}
      </div>
      <div className="card__body">
        {entry.artwork_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="card__cover" src={entry.artwork_url} alt="" loading="lazy" width={62} height={62} />
        ) : (
          <div className="card__cover" aria-hidden="true" />
        )}
        <div className="card__meta">
          <p className="card__title">
            <span className="sr-only">Position {entry.filtered_position} : </span>
            {entry.track_title}
          </p>
          <p className="card__artist">{entry.artists_text ?? "Artiste inconnu"}</p>
          <div className="card__foot">
            <ChartMovementBadge movement={entry.movement} entryStatus={entry.entry_status} />
            {metric && <span className="card__metric">{metric}</span>}
            <span className="card__src">Source #{entry.source_position}</span>
            {entry.platform_url && (
              <a className="hmi__link" href={entry.platform_url} target="_blank" rel="noopener noreferrer">
                Écouter ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
