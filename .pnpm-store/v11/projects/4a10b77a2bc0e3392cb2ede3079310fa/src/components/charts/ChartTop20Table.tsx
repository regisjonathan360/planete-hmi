"use client";

import { Fragment, useState } from "react";
import { ChartEntryView } from "@/lib/charts/queries/types";
import { libelleMetrique } from "@/lib/charts/format";
import { ChartMovementBadge } from "./ChartMovementBadge";

/** Tableau Top complet d'une plateforme. */
export function ChartTop20Table({ entries, platform }: { entries: ChartEntryView[]; platform?: string }) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  return (
    <table className="t20">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Évol.</th>
          <th scope="col"></th>
          <th scope="col">Titre / Artiste</th>
          <th scope="col" className="hide-sm">Source</th>
          <th scope="col" className="hide-sm">Pic</th>
          <th scope="col" className="hide-sm">Sem.</th>
          <th scope="col">Métrique</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => {
          const pos = e.filtered_position;
          const rankClass =
            pos === 1 ? "num card__rank--1" :
            pos === 2 ? "num card__rank--2" :
            pos === 3 ? "num card__rank--3" :
            pos === 4 ? "num card__rank--4" :
            "num card__rank--rest";
          const canPlay = platform === "youtube" && Boolean(e.video_id && e.embed_url);
          const key = e.video_id ?? e.track_id ?? String(e.filtered_position);
          return (
            <Fragment key={key + "-" + e.filtered_position}>
            <tr>
              <td className={rankClass}>{e.filtered_position}</td>
              <td><ChartMovementBadge movement={e.movement} entryStatus={e.entry_status} /></td>
              <td>
                <button
                  type="button"
                  className={canPlay ? "youtube-chart__cover-button" : "youtube-chart__cover-button is-static"}
                  onClick={() => canPlay && setPlayingVideoId(playingVideoId === e.video_id ? null : e.video_id ?? null)}
                  disabled={!canPlay}
                  aria-label={canPlay ? `Lire ${e.track_title}` : undefined}
                >
                {e.artwork_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="cover" src={e.artwork_url} alt="" loading="lazy" width={40} height={40} />
                ) : (
                  <div className="cover" aria-hidden="true" />
                )}
                {canPlay ? <span className="youtube-chart__play" aria-hidden="true">▶</span> : null}
                </button>
              </td>
              <td>
                <strong>{e.track_title}</strong>
                <br />
                <span className="row__ctx">{e.artists_text ?? "Artiste inconnu"}</span>
                {e.platform_url && (
                  <>
                    {" "}
                    <a className="hmi__link" href={e.platform_url} target="_blank" rel="noopener noreferrer">↗</a>
                  </>
                )}
              </td>
              <td className="num hide-sm">#{e.source_position}</td>
              <td className="num hide-sm">{e.peak_filtered_position ?? "—"}</td>
              <td className="num hide-sm">{e.weeks_on_chart ?? "—"}</td>
              <td>{libelleMetrique(e.metric_value, e.metric_unit) ?? "—"}</td>
            </tr>
            {canPlay && playingVideoId === e.video_id ? (
              <tr className="youtube-chart__player-row">
                <td colSpan={8}>
                  <div className="youtube-chart__player">
                    <iframe
                      src={e.embed_url ?? undefined}
                      title={`${e.track_title} — lecteur YouTube`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </td>
              </tr>
            ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
