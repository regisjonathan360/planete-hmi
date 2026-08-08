"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ComputedEntry, HomepageChartEntry } from "@/lib/home/homepage-chart";

interface Toast { message: string; error?: boolean }

export function HomepageChartManager({
  initialComputed,
  initialPublished,
}: {
  initialComputed: ComputedEntry[];
  initialPublished: HomepageChartEntry[];
}) {
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const [computed, setComputed] = useState(initialComputed);
  const [published, setPublished] = useState(initialPublished);
  const [limit, setLimit] = useState("5");
  const [, startTransition] = useTransition();

  function notify(message: string, error = false) {
    setToast({ message, error });
    setTimeout(() => setToast(null), 5000);
  }

  async function recalculate() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/homepage-chart");
      const json = await res.json();
      if (!res.ok) { notify(json.error ?? "Erreur.", true); return; }
      setComputed(json.computed);
      setPublished(json.published);
      notify("Calcul actualisé.");
    } catch { notify("Erreur réseau.", true); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!confirm(`Publier le top ${limit} sur la page d'accueil ? Le podium actuel sera remplacé.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/homepage-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: Number(limit) || 5 }),
      });
      const json = await res.json();
      if (!res.ok) { notify(json.error ?? "Erreur.", true); return; }
      notify(json.message ?? "Publié.");
      startTransition(() => router.refresh());
    } catch { notify("Erreur réseau.", true); }
    finally { setBusy(false); }
  }

  return (
    <>
      {/* Actions */}
      <div className="admin-card">
        <div className="admin-toolbar">
          <button className="btn btn--primary" onClick={recalculate} disabled={busy}>
            ⟳ Recalculer la moyenne
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem" }}>
            Publier le top
            <input
              type="number"
              min={1}
              max={10}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              style={{ width: 50, textAlign: "center" }}
              className="field"
            />
          </label>
          <button className="btn btn--ok" onClick={publish} disabled={busy || computed.length === 0}>
            ✓ Publier sur la page d&apos;accueil
          </button>
          <a className="btn btn--ghost btn--sm" href="/" target="_blank" rel="noreferrer">
            Voir la page d&apos;accueil ↗
          </a>
        </div>

        {computed.length === 0 && (
          <p style={{ marginTop: "0.8rem", color: "var(--admin-warn)" }}>
            Aucun titre trouvé. Publiez au moins un classement (Audiomack, Deezer, Spotify ou
            TikTok) avant de calculer la moyenne.
          </p>
        )}
      </div>

      {/* Prévisualisation du calcul */}
      {computed.length > 0 && (
        <div className="admin-card">
          <h2 className="admin-card__title">
            Calcul automatique — {computed.length} titre(s) éligibles
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--admin-muted)", margin: 0 }}>
            Triés par position moyenne croissante. Les {limit} premiers seront publiés.
          </p>

          <div className="entry-list" style={{ marginTop: "0.8rem" }}>
            {computed.map((entry, index) => (
              <div
                key={entry.trackId}
                className="entry"
                style={{
                  opacity: index < Number(limit) ? 1 : 0.45,
                  borderColor: index < Number(limit) ? "var(--admin-accent)" : undefined,
                }}
              >
                <div className="entry__pos" style={{ color: index < 3 ? "var(--admin-accent-2)" : undefined }}>
                  {index + 1}
                </div>
                <img
                  className="entry__cover"
                  src={entry.artworkUrl ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
                  alt=""
                  width={52}
                  height={52}
                  style={{ borderRadius: 6, objectFit: "cover" }}
                />
                <div className="entry__meta">
                  <div className="entry__title">{entry.title}</div>
                  <div className="entry__artist">
                    {entry.artistName}
                    <span className="badge badge--ok" style={{ marginLeft: "0.5rem" }}>
                      moy. {entry.avgPosition.toFixed(1)} / {entry.platformsCount} plateforme
                      {entry.platformsCount > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--admin-muted)", marginTop: "0.15rem" }}>
                    {entry.platformsDetail.map((p) => `${p.display_name}: #${p.position}`).join(" · ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Publication en cours */}
      {published.length > 0 && (
        <div className="admin-card">
          <h2 className="admin-card__title">
            Actuellement publié sur la page d&apos;accueil ({published.length} titres)
          </h2>
          <div className="entry-list" style={{ marginTop: "0.6rem" }}>
            {published.map((entry) => (
              <div key={entry.id} className="entry">
                <div className="entry__pos">{entry.displayPosition}</div>
                <img
                  className="entry__cover"
                  src={entry.artworkUrl ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
                  alt=""
                  width={52}
                  height={52}
                  style={{ borderRadius: 6, objectFit: "cover" }}
                />
                <div className="entry__meta">
                  <div className="entry__title">{entry.title}</div>
                  <div className="entry__artist">
                    {entry.artistName}
                    {entry.movement !== null && entry.movement !== 0 && (
                      <span
                        className={`badge ${entry.movement > 0 ? "badge--ok" : "badge--danger"}`}
                        style={{ marginLeft: "0.4rem" }}
                      >
                        {entry.movement > 0 ? `▲ ${entry.movement}` : `▼ ${Math.abs(entry.movement)}`}
                      </span>
                    )}
                    {entry.movement === null && (
                      <span className="badge badge--muted" style={{ marginLeft: "0.4rem" }}>Nouveau</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div className={toast.error ? "toast toast--error" : "toast"}>{toast.message}</div>}
    </>
  );
}
