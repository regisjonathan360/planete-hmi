import { ChartEntryView } from "@/lib/charts/queries/types";
import { libelleMetrique } from "@/lib/charts/format";
import { ChartMovementBadge } from "./ChartMovementBadge";
import { TrackHoverPreview } from "./TrackHoverPreview";

/** Carte d'une chanson : position HMI à côté de la pochette (jamais dessus). */
export function TrackChartCard({ entry }: { entry: ChartEntryView }) {
  const metric = libelleMetrique(entry.metric_value, entry.metric_unit);
  const pos = entry.filtered_position;
  const rankClass =
    pos === 1 ? "card__rank card__rank--1" :
    pos === 2 ? "card__rank card__rank--2" :
    pos === 3 ? "card__rank card__rank--3" :
    pos === 4 ? "card__rank card__rank--4" :
    "card__rank card__rank--rest";

  // Extraire artistSlug et trackSlug depuis platform_url.
  const slugs = extractSlugs(entry.platform_url);

  return (
    <TrackHoverPreview
      platformUrl={entry.platform_url}
      artistSlug={slugs.artistSlug}
      trackSlug={slugs.trackSlug}
    >
      <article className="card">
        <div className={rankClass} aria-hidden="true">
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
    </TrackHoverPreview>
  );
}

function extractSlugs(url: string | null): { artistSlug: string | null; trackSlug: string | null } {
  if (!url) return { artistSlug: null, trackSlug: null };
  const match = url.match(/audiomack\.com\/([^/]+)\/song\/([^/?#]+)/i);
  return { artistSlug: match?.[1] ?? null, trackSlug: match?.[2] ?? null };
}
