"use client";

import { useState } from "react";
import Link from "next/link";
import { previsualiserImport, type ResultatPreview } from "./actions";
import { commitImport } from "../workflow-actions";
import { AUDIOMACK_HAITI_CHART_SOURCES } from "@/lib/charts/audiomack-sources";

const SOURCES = [
  { key: "youtube_haiti_official", label: "YouTube Music — Haïti" },
  { key: "spotify_haiti_popular", label: "Spotify — Populaire en Haïti" },
  ...AUDIOMACK_HAITI_CHART_SOURCES.map((source) => ({
    key: source.sourceKey,
    label: source.genreId === "all" ? "Audiomack — Weekly 100 Haiti" : `Audiomack — Haiti ${source.genreLabel}`,
  })),
  { key: "apple_hmi_worldwide", label: "Apple Music — HMI Worldwide" },
  { key: "tiktok_haiti_sounds", label: "TikTok — Sons populaires en Haïti" },
];

const COLONNES: Record<string, string[]> = {
  youtube_haiti_official: ["source_position", "track_title", "artist_names", "youtube_video_id", "youtube_music_url", "haiti_views", "global_views", "source_period_start", "source_period_end", "source_updated_at"],
  spotify_haiti_popular: ["source_position", "track_title", "artist_names", "spotify_track_id", "spotify_url", "album_title", "artwork_url", "source_period_start", "source_period_end", "source_updated_at"],
  apple_hmi_worldwide: ["source_position", "track_title", "artist_names", "source_identifier", "source_url", "source_period_start", "source_period_end", "source_updated_at"],
  tiktok_haiti_sounds: ["source_position", "sound_title", "linked_track_title", "linked_artist_names", "tiktok_music_id", "tiktok_sound_url", "posts_count", "source_period_start", "source_period_end", "source_updated_at"],
};

for (const source of AUDIOMACK_HAITI_CHART_SOURCES) {
  COLONNES[source.sourceKey] = [
    "source_position",
    "track_title",
    "artist_names",
    "source_identifier",
    "source_url",
    "artwork_url",
    "metric_value",
    "metric_unit",
    "source_period_start",
    "source_period_end",
    "source_updated_at",
  ];
}

const EXEMPLE = `1. Joé Dwèt Filé - 4 Kampé
2. Rutshelle Guillaume - Tolere w
3. Roody Roodboy - Dous Pou Dous
4. Mikaben - Ayo Girl
5. Baky - Bon Pou Mwen`;

/** Parse du texte ligne par ligne : "N. Artiste - Titre" ou "N. Titre - Artiste" */
function parseTexteSimple(texte: string, periodStart: string, periodEnd: string): unknown[] {
  const lignes = texte
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const lignesAvecTiret = lignes
    .map((l) => {
      // Format : "3. Artiste - Titre" ou "3) Artiste - Titre" ou "3 Artiste - Titre"
      const match = l.match(/^(\d+)[.):\s-]+\s*(.+?)\s*[-–—]\s*(.+)$/);
      if (!match) return null;
      const [, pos, part1, part2] = match;
      return {
        source_position: parseInt(pos, 10),
        artist_names: part1.trim(),
        track_title: part2.trim(),
        source_identifier: `manual-${periodStart}-${pos}`,
        source_url: "https://import-manuel-verifie",
        source_period_start: periodStart,
        source_period_end: periodEnd,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (lignesAvecTiret.length > 0) return lignesAvecTiret;

  const lignesAudiomack: unknown[] = [];
  for (let i = 0; i < lignes.length; i += 1) {
    const rang = lignes[i].match(/^(\d+)[.)]?$/);
    if (!rang) continue;
    const titre = lignes[i + 1];
    const artiste = lignes[i + 2];
    if (!titre || !artiste) continue;
    lignesAudiomack.push({
      source_position: parseInt(rang[1], 10),
      track_title: titre,
      artist_names: artiste,
      source_identifier: `manual-${periodStart}-${rang[1]}`,
      source_url: "https://audiomack.com/geo-charts/playlist/haiti",
      source_period_start: periodStart,
      source_period_end: periodEnd,
    });
    i += 2;
  }

  return lignesAudiomack;
}

function pill(res: string) {
  if (res === "auto") return "pill pill--ok";
  if (res === "revue_recommandee") return "pill pill--warn";
  return "pill pill--err";
}

export default function ImportPage() {
  const [sourceKey, setSourceKey] = useState(SOURCES[1].key);
  const [texte, setTexte] = useState(EXEMPLE);
  const [mode, setMode] = useState<"simple" | "json">("simple");
  const [periodStart, setPeriodStart] = useState("2026-07-04");
  const [periodEnd, setPeriodEnd] = useState("2026-07-10");
  const [res, setRes] = useState<ResultatPreview | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [commit, setCommit] = useState<string | null>(null);
  const [commitOk, setCommitOk] = useState(false);

  function getRows(): unknown[] | null {
    if (mode === "simple") {
      const rows = parseTexteSimple(texte, periodStart, periodEnd);
      if (!rows.length) { setErreur("Aucune ligne reconnue. Format attendu : « 1. Artiste - Titre »"); return null; }
      return rows;
    }
    try {
      const rows = JSON.parse(texte);
      if (!Array.isArray(rows)) { setErreur("Le JSON doit être un tableau."); return null; }
      return rows;
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "JSON invalide.");
      return null;
    }
  }

  async function onCommit() {
    setCommit(null);
    const rows = getRows();
    if (!rows) return;
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
    const rows = getRows();
    if (!rows) return;
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

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
        <div>
          <label htmlFor="ps">Début de semaine</label>
          <input id="ps" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="pe">Fin de semaine</label>
          <input id="pe" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
        <div>
          <label>Format</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as "simple" | "json")}>
            <option value="simple">Texte simple (1. Artiste - Titre)</option>
            <option value="json">JSON avancé</option>
          </select>
        </div>
      </div>

      <label htmlFor="rows">{mode === "simple" ? "Classement (une ligne par chanson)" : "Lignes (JSON)"}</label>
      <textarea id="rows" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={mode === "simple" ? "1. Artiste - Titre\n2. Artiste - Titre" : '[{"source_position":1,...}]'} />

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
