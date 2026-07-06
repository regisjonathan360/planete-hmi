"use client";

import { useState } from "react";
import Link from "next/link";
import { previsualiserImport, type ResultatPreview } from "./actions";
import { commitImport } from "../workflow-actions";

const SOURCES = [
  { key: "youtube_haiti_official", label: "YouTube Music — Haïti" },
  { key: "spotify_haiti_popular", label: "Spotify — Populaire en Haïti" },
  { key: "audiomack_haiti_weekly100", label: "Audiomack — Weekly 100 Haiti" },
  { key: "apple_hmi_worldwide", label: "Apple Music — HMI Worldwide" },
  { key: "tiktok_haiti_sounds", label: "TikTok — Sons populaires en Haïti" },
];

const COLONNES: Record<string, string[]> = {
  youtube_haiti_official: ["source_position", "track_title", "artist_names", "youtube_video_id", "youtube_music_url", "haiti_views", "global_views", "source_period_start", "source_period_end", "source_updated_at"],
  spotify_haiti_popular: ["source_position", "track_title", "artist_names", "spotify_track_id", "spotify_url", "album_title", "artwork_url", "source_period_start", "source_period_end", "source_updated_at"],
  audiomack_haiti_weekly100: ["source_position", "track_title", "artist_names", "audiomack_music_id", "audiomack_url", "artwork_url", "source_period_start", "source_period_end", "source_updated_at"],
  apple_hmi_worldwide: ["source_position", "track_title", "artist_names", "source_identifier", "source_url", "source_period_start", "source_period_end", "source_updated_at"],
  tiktok_haiti_sounds: ["source_position", "sound_title", "linked_track_title", "linked_artist_names", "tiktok_music_id", "tiktok_sound_url", "posts_count", "source_period_start", "source_period_end", "source_updated_at"],
};

const EXEMPLE = JSON.stringify(
  [
    { source_position: 3, track_title: "Chanson Test A", artist_names: "Artiste Test HMI Un", source_url: "https://exemple/chart", source_period_start: "2026-07-03", source_period_end: "2026-07-09" },
    { source_position: 5, track_title: "Chanson Test B (Official Video)", artist_names: "Artiste Test HMI Deux", source_url: "https://exemple/chart", source_period_start: "2026-07-03", source_period_end: "2026-07-09" },
  ],
  null,
  2
);

function pill(res: string) {
  if (res === "auto") return "pill pill--ok";
  if (res === "revue_recommandee") return "pill pill--warn";
  return "pill pill--err";
}

export default function ImportPage() {
  const [sourceKey, setSourceKey] = useState(SOURCES[1].key);
  const [texte, setTexte] = useState(EXEMPLE);
  const [res, setRes] = useState<ResultatPreview | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [commit, setCommit] = useState<string | null>(null);
  const [commitOk, setCommitOk] = useState(false);

  async function onCommit() {
    setCommit(null);
    let rows: unknown[];
    try {
      rows = JSON.parse(texte);
    } catch {
      setCommit("JSON invalide.");
      return;
    }
    setChargement(true);
    try {
      const r = await commitImport(sourceKey, rows);
      setCommit(r.message);
      setCommitOk(r.ok);
    } catch (e) {
      setCommit(e instanceof Error ? e.message : "Échec.");
    } finally {
      setChargement(false);
    }
  }

  function telechargerTemplate() {
    const cols = COLONNES[sourceKey] ?? [];
    const csv = cols.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `template-${sourceKey}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onPreview() {
    setErreur(null);
    setRes(null);
    let rows: unknown[];
    try {
      rows = JSON.parse(texte);
      if (!Array.isArray(rows)) throw new Error("Le JSON doit être un tableau de lignes.");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "JSON invalide.");
      return;
    }
    setChargement(true);
    try {
      setRes(await previsualiserImport(sourceKey, rows));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Échec de la prévisualisation.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <>
      <h1>Import de classement</h1>
      <p>
        Import administratif vérifié. Colle les lignes du classement (JSON) puis
        prévisualise avant toute validation. Aucune donnée n’est écrite à ce stade.
      </p>

      <label htmlFor="src">Plateforme / classement</label>
      <select id="src" value={sourceKey} onChange={(e) => setSourceKey(e.target.value)}>
        {SOURCES.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>

      <p style={{ marginTop: "0.75rem" }}>
        <button className="admin__btn admin__btn--ghost" type="button" onClick={telechargerTemplate}>
          Télécharger le template CSV
        </button>
      </p>

      <label htmlFor="rows">Lignes (JSON)</label>
      <textarea id="rows" value={texte} onChange={(e) => setTexte(e.target.value)} />

      {erreur && <p className="admin__err">{erreur}</p>}

      <p style={{ marginTop: "0.75rem" }}>
        <button className="admin__btn" type="button" onClick={onPreview} disabled={chargement}>
          {chargement ? "Analyse…" : "Prévisualiser"}
        </button>
      </p>

      {res && (
        <>
          <h2>
            Prévisualisation — {res.lignesValides} valide(s), {res.lignesInvalides} invalide(s)
          </h2>
          {res.message && <p className="admin__err">{res.message}</p>}
          <table>
            <thead>
              <tr>
                <th>#src</th><th>Titre source</th><th>Artiste source</th>
                <th>Chanson proposée</th><th>Confiance</th><th>Haïtien ?</th><th>Doublon ?</th>
              </tr>
            </thead>
            <tbody>
              {res.preview.map((l, i) => (
                <tr key={i}>
                  <td>{l.sourcePosition}</td>
                  <td>{l.titreSource}</td>
                  <td>{l.artisteSource}</td>
                  <td>{l.titrePropose ?? <span className="admin__err">aucune</span>}</td>
                  <td><span className={pill(l.resolution)}>{(l.confidence * 100).toFixed(0)}%</span></td>
                  <td>{l.admissible ? <span className="pill pill--ok">admissible</span> : <span className="pill pill--warn">non</span>}</td>
                  <td>{l.doublon ? <span className="pill pill--err">doublon</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {res.lignesValides > 0 && (
            <p style={{ marginTop: "1rem" }}>
              <button className="admin__btn" type="button" onClick={onCommit} disabled={chargement}>
                Créer l’édition (brouillon)
              </button>
              {commit && (
                <span className={commitOk ? "admin__ok" : "admin__err"} style={{ marginLeft: "0.75rem" }}>
                  {commit}
                  {commitOk && (
                    <>
                      {" "}
                      <Link className="hmi__link" href="/admin/charts/history">Aller à l’historique →</Link>
                    </>
                  )}
                </span>
              )}
            </p>
          )}

          {res.invalides.length > 0 && (
            <>
              <h2>Lignes invalides</h2>
              <ul>
                {res.invalides.map((iv) => (
                  <li key={iv.index} className="admin__err">Ligne {iv.index + 1} : {iv.erreurs.join(", ")}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
