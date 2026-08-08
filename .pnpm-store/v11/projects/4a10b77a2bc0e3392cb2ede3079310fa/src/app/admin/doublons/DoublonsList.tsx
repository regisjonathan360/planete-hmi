"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DuplicateSensitivity } from "@/lib/artists/duplicate-similarity";

interface ArtistPreview {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  haitian_status: string;
  tags: string[] | null;
}

interface CandidateRow {
  id: string;
  confidence: number;
  reason: string;
  status: string;
  created_at: string;
  artist_a: ArtistPreview | ArtistPreview[];
  artist_b: ArtistPreview | ArtistPreview[];
}

interface ScanResult {
  artistsScanned: number;
  pairsCompared: number;
  matchesFound: number;
  created: number;
  updated: number;
  alreadyReviewed: number;
}

export function DoublonsList({
  candidates,
  totalCount,
}: {
  candidates: unknown[];
  totalCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [sensitivity, setSensitivity] = useState<DuplicateSensitivity>("broad");
  const [message, setMessage] = useState<string | null>(null);

  const items = (candidates ?? []).map((candidate) => {
    const row = candidate as CandidateRow;
    return {
      ...row,
      artist_a: Array.isArray(row.artist_a) ? row.artist_a[0] : row.artist_a,
      artist_b: Array.isArray(row.artist_b) ? row.artist_b[0] : row.artist_b,
    };
  });

  async function resolve(candidateId: string, action: "merge" | "dismiss", keepId?: string) {
    setBusy(candidateId);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/doublons/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, action, keepId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Action impossible.");
      setMessage(payload.message ?? "Action enregistrée.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function scanSimilarNames() {
    setScanning(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/doublons/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensitivity }),
      });
      const payload = await response.json() as ScanResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Recherche impossible.");
      setMessage(
        `${payload.artistsScanned} artistes et ${payload.pairsCompared.toLocaleString("fr")} paires analysés : ` +
        `${payload.created} nouveau(x) rapprochement(s), ${payload.updated} score(s) amélioré(s), ` +
        `${payload.alreadyReviewed} paire(s) déjà examinée(s).`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recherche impossible.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      <section className="admin-card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: "0.35rem", minWidth: 250 }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>Sensibilité de la recherche</span>
            <select
              className="admin-input"
              value={sensitivity}
              onChange={(event) => setSensitivity(event.target.value as DuplicateSensitivity)}
              disabled={scanning}
            >
              <option value="broad">Très large — dès 40 % de ressemblance</option>
              <option value="balanced">Équilibrée — dès 52 %</option>
              <option value="strict">Stricte — dès 66 %</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn--primary"
            onClick={scanSimilarNames}
            disabled={scanning || busy !== null}
          >
            {scanning ? "Analyse approfondie en cours…" : "Rechercher les noms ressemblants"}
          </button>
        </div>
        <p style={{ color: "var(--admin-muted)", fontSize: "0.76rem", margin: "0.7rem 0 0" }}>
          L’analyse compare les fautes de frappe, accents, ponctuation, ordre des mots,
          abréviations, termes comme « DJ » ou « Official », prononciation et noms affichés
          sur les plateformes. Aucun profil n’est fusionné automatiquement.
        </p>
        {message ? (
          <p aria-live="polite" style={{ margin: "0.65rem 0 0", fontSize: "0.8rem" }}>
            {message}
          </p>
        ) : null}
      </section>

      {!items.length ? (
        <div className="admin-card">
          <p style={{ color: "var(--admin-muted)" }}>
            Aucun doublon en attente. Lancez une recherche pour analyser tous les artistes.
          </p>
        </div>
      ) : (
        <div className="entry-list">
          <p style={{ color: "var(--admin-muted)", fontSize: "0.78rem" }}>
            {totalCount} rapprochement(s) en attente
            {totalCount > items.length ? ` · ${items.length} plus probables affichés` : ""}
          </p>
          {items.map((candidate) => {
            const artistA = candidate.artist_a;
            const artistB = candidate.artist_b;
            if (!artistA || !artistB) return null;

            return (
              <div key={candidate.id} className="admin-card" style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, textAlign: "center", minWidth: 140 }}>
                    <img
                      src={artistA.image_url ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
                      alt=""
                      width={60}
                      height={60}
                      style={{ borderRadius: "50%", objectFit: "cover" }}
                    />
                    <p style={{ fontWeight: 700, margin: "0.4rem 0 0" }}>{artistA.name}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--admin-muted)" }}>/{artistA.slug}</p>
                    {artistA.tags?.length ? <p style={{ fontSize: "0.72rem" }}>{artistA.tags.join(", ")}</p> : null}
                  </div>

                  <div style={{ textAlign: "center", maxWidth: 300 }}>
                    <div className="badge badge--warn" style={{ fontSize: "0.8rem" }}>
                      {Math.round(candidate.confidence * 100)} % de ressemblance
                    </div>
                    <p style={{ fontSize: "0.72rem", color: "var(--admin-muted)", marginTop: "0.3rem" }}>
                      {candidate.reason}
                    </p>
                  </div>

                  <div style={{ flex: 1, textAlign: "center", minWidth: 140 }}>
                    <img
                      src={artistB.image_url ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
                      alt=""
                      width={60}
                      height={60}
                      style={{ borderRadius: "50%", objectFit: "cover" }}
                    />
                    <p style={{ fontWeight: 700, margin: "0.4rem 0 0" }}>{artistB.name}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--admin-muted)" }}>/{artistB.slug}</p>
                    {artistB.tags?.length ? <p style={{ fontSize: "0.72rem" }}>{artistB.tags.join(", ")}</p> : null}
                  </div>
                </div>

                <div className="admin-toolbar" style={{ marginTop: "1rem", justifyContent: "center" }}>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={busy !== null || scanning}
                    onClick={() => resolve(candidate.id, "merge", artistA.id)}
                  >
                    Fusionner (garder {artistA.name})
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={busy !== null || scanning}
                    onClick={() => resolve(candidate.id, "merge", artistB.id)}
                  >
                    Fusionner (garder {artistB.name})
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={busy !== null || scanning}
                    onClick={() => resolve(candidate.id, "dismiss")}
                  >
                    Garder séparés
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
