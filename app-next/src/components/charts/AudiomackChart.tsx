"use client";

import { useEffect, useState } from "react";
import type { AudiomackChartResponse, AudiomackSnapshotEntry } from "@/lib/audiomack/types";

function MovementBadge({ entry }: { entry: AudiomackSnapshotEntry }) {
  if (entry.isNew) return <span className="mv mv--new" aria-label="Nouvelle entrée">★ NEW</span>;
  if (entry.rankChange == null || entry.rankChange === 0) return <span className="mv mv--stable" aria-label="Stable">▬ 0</span>;
  if (entry.rankChange > 0) return <span className="mv mv--up" aria-label={`Hausse de ${entry.rankChange}`}>▲ {entry.rankChange}</span>;
  return <span className="mv mv--down" aria-label={`Baisse de ${Math.abs(entry.rankChange)}`}>▼ {Math.abs(entry.rankChange)}</span>;
}

export function AudiomackChartSection() {
  const [data, setData] = useState<AudiomackChartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch("/api/charts/audiomack?limit=100")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  // Skeleton loader
  if (loading) {
    return (
      <section className="row" aria-label="Audiomack Weekly 100 Haiti">
        <div className="row__head">
          <h2 className="row__name">Audiomack Weekly 100 — Haiti</h2>
          <span className="mbadge mbadge--import">Classement officiel Audiomack</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card" style={{ opacity: 0.4, minWidth: 220 }}>
              <div className="card__rank">—</div>
              <div className="card__body"><div className="card__cover" /><div className="card__meta"><p className="card__title">Chargement...</p></div></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Error state with stale data message
  if (error || !data || !data.entries?.length) {
    return (
      <section className="row" aria-label="Audiomack Weekly 100 Haiti">
        <div className="row__head">
          <h2 className="row__name">Audiomack Weekly 100 — Haiti</h2>
        </div>
        {data?.isStale ? (
          <p className="stale">⏳ Dernière mise à jour disponible — les données pourraient ne pas être à jour.</p>
        ) : (
          <p className="empty">Aucun classement Audiomack disponible pour le moment.</p>
        )}
      </section>
    );
  }

  const entries = showAll ? data.entries : data.entries.slice(0, 20);

  return (
    <section className="row" aria-label="Audiomack Weekly 100 Haiti">
      <div className="row__head">
        <h2 className="row__name">Audiomack Weekly 100 — Haiti</h2>
        <span className="row__ctx">Les titres les plus écoutés sur Audiomack en Haïti</span>
        <span className="mbadge mbadge--import">Classement officiel Audiomack</span>
        {data.collectedAt && (
          <span className="row__ctx">Mis à jour le {new Date(data.collectedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
        )}
        <span className="row__spacer" />
        <a className="row__top20" href="https://audiomack.com/geo-charts/playlist/haiti" target="_blank" rel="noopener noreferrer">
          Source officielle ↗
        </a>
      </div>

      {data.isStale && (
        <p className="stale" role="status">⏳ Dernière mise à jour disponible — données possiblement anciennes.</p>
      )}

      <table className="t20">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Évol.</th>
            <th scope="col"></th>
            <th scope="col">Titre / Artiste</th>
            <th scope="col" className="hide-sm">Sem.</th>
            <th scope="col" className="hide-sm">Pic</th>
            <th scope="col">Écouter</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={`${e.rank}-${e.platformTrackId ?? e.title}`}>
              <td className="num">{e.rank}</td>
              <td><MovementBadge entry={e} /></td>
              <td>
                {e.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="cover" src={e.artworkUrl} alt="" loading="lazy" width={40} height={40} style={{ borderRadius: 8 }} />
                ) : (
                  <div className="cover" style={{ width: 40, height: 40, borderRadius: 8, background: "#201d2c" }} aria-hidden="true" />
                )}
              </td>
              <td>
                <strong>{e.title}</strong><br />
                <span className="row__ctx">{e.artistName}</span>
              </td>
              <td className="num hide-sm">{e.weeksOnChart}</td>
              <td className="num hide-sm">{e.peakRank}</td>
              <td>
                <a
                  className="hmi__link"
                  href={e.sourceTrackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Écouter ${e.title} par ${e.artistName} sur Audiomack`}
                >
                  Audiomack ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!showAll && data.entries.length > 20 && (
        <p style={{ marginTop: "1rem" }}>
          <button className="row__top20" onClick={() => setShowAll(true)} style={{ cursor: "pointer", border: "1px solid rgba(244,239,228,0.18)" }}>
            Voir le Top 100
          </button>
        </p>
      )}
    </section>
  );
}
