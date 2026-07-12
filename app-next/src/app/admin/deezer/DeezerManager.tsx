"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import type { AdminChartData, AdminChartEntry } from "@/lib/charts/admin/types";

interface Toast { message: string; error?: boolean }

export function DeezerManager({
  sourceKey,
  initialData,
}: {
  sourceKey: string;
  initialData: AdminChartData;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState<{
    status?: string; message?: string; error?: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  const data = initialData;
  const edition = data?.edition;

  function notify(message: string, error = false) {
    setToast({ message, error });
    setTimeout(() => setToast(null), 4000);
  }

  async function post(url: string, body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { notify(json.error ?? "Erreur.", true); return false; }
      notify(json.message ?? "Fait.");
      startTransition(() => router.refresh());
      return true;
    } catch { notify("Erreur réseau.", true); return false; }
    finally { setBusy(false); }
  }

  const collect = async () => {
    setIsCollecting(true);
    setCollectResult(null);
    try {
      notify("Collecte Deezer en cours…");
      const res = await fetch("/api/admin/deezer/collect", { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.status === "error") {
        setCollectResult({ status: "error", error: json.error ?? "Erreur." });
        notify(json.error ?? "Erreur.", true);
      } else {
        setCollectResult(json);
        notify(json.message ?? "Collecte réussie.");
        startTransition(() => router.refresh());
      }
    } catch {
      setCollectResult({ status: "error", error: "Erreur réseau." });
      notify("Erreur réseau.", true);
    } finally { setIsCollecting(false); }
  };

  const publish = () => post("/api/admin/charts/publish", { sourceKey, mode: "publish" });
  const clearEdition = () => {
    if (confirm("Êtes-vous sûr de vouloir vider tout le classement Deezer ? Cette action est irréversible."))
      post("/api/admin/charts/entry", { editionId: edition?.editionId, entryId: "__all__", action: "delete_all" });
  };

  const entryAction = (entryId: string, action: string, extra: Record<string, unknown> = {}) =>
    post("/api/admin/charts/entry", { editionId: edition?.editionId, entryId, action, ...extra });

  return (
    <>
      {/* Barre de collecte + publication */}
      <div className="admin-card">
        <div className="admin-toolbar" style={{ justifyContent: "space-between" }}>
          <div className="admin-toolbar">
            <button className="btn btn--primary" onClick={collect} disabled={busy || isCollecting}>
              {isCollecting ? "⟳ Collecte en cours…" : "⟳ Collecter depuis Deezer"}
            </button>
            {edition?.collectedAt && (
              <span style={{ color: "var(--admin-muted)", fontSize: "0.82rem" }}>
                Dernière collecte : {new Date(edition.collectedAt).toLocaleString("fr-FR")}
              </span>
            )}
          </div>
          <button className="btn btn--ok" onClick={publish} disabled={busy || !edition}>
            ✓ Publier le classement
          </button>
          <button className="btn btn--danger btn--sm" onClick={clearEdition} disabled={busy || !edition}>
            🗑️ Vider le classement
          </button>
        </div>

        {collectResult && (
          <div
            className={collectResult.status === "error" ? "banner banner--error" : "banner banner--ok"}
            style={{ marginTop: "0.75rem" }}
          >
            {collectResult.status === "error" ? `❌ ${collectResult.error}` : `✅ ${collectResult.message}`}
          </div>
        )}

        {edition && (
          <div style={{ marginTop: "0.75rem" }}>
            {edition.hasUnpublishedChanges ? (
              <div className="banner">
                Modifications non publiées. Cliquez « Publier » pour les rendre visibles sur le site.
              </div>
            ) : (
              <div className="banner banner--ok">Classement à jour.</div>
            )}
          </div>
        )}
      </div>

      {/* Résumé */}
      {data?.summary && (
        <div className="admin-card">
          <h2 className="admin-card__title">Résumé</h2>
          <div className="admin-stats">
            <Stat value={data.summary.totalEntries} label="Musiques" />
            <Stat value={data.summary.distinctArtists} label="Artistes" />
            <Stat value={data.summary.distinctAlbums} label="Albums" />
            <Stat value={data.summary.visibleEntries} label="Visibles" />
            <Stat value={data.summary.eligibleEntries} label="Publiables" accent />
            <Stat value={data.summary.hiddenEntries + data.summary.excludedEntries} label="Masqués / exclus" />
          </div>
        </div>
      )}

      {/* Liste des musiques avec gestion complète */}
      {data?.entries && data.entries.length > 0 && (
        <div className="admin-card">
          <h2 className="admin-card__title">Top Musiques Deezer</h2>
          <div className="entry-list">
            {data.entries.map((e) => (
              <DeezerEntry key={e.entryId} entry={e} busy={busy} onAction={entryAction} />
            ))}
          </div>
        </div>
      )}

      {toast && <div className={toast.error ? "toast toast--error" : "toast"}>{toast.message}</div>}
    </>
  );
}

/** Entrée avec preview audio au hover + boutons de gestion */
function DeezerEntry({
  entry,
  busy,
  onAction,
}: {
  entry: AdminChartEntry;
  busy: boolean;
  onAction: (entryId: string, action: string, extra?: Record<string, unknown>) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Deezer preview URL : on la reconstitue à partir du platformTrackId
  const previewUrl = entry.platformTrackId
    ? `https://cdns-preview-e.dzcdn.net/stream/c-${entry.platformTrackId}.mp3`
    : null;

  function handleMouseEnter() {
    if (!previewUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = 0.3;
    }
    audioRef.current.src = previewUrl;
    audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
  }

  function handleMouseLeave() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    }
  }

  const cls = `entry${entry.isHidden ? " is-hidden" : ""}${entry.isExcluded ? " is-excluded" : ""}`;

  return (
    <div
      className={cls}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: "relative" }}
    >
      <div className="entry__pos">{entry.filteredPosition ?? entry.sourcePosition}</div>
      <div className="entry__cover-wrap">
        <img
          className="entry__cover"
          src={entry.artworkUrl ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
          alt=""
        />
        {playing && (
          <div className="entry__playing-indicator" title="Extrait en cours">
            <span>♫</span>
          </div>
        )}
        {entry.audiomackUrl && (
          <a className="entry__play-btn" href={entry.audiomackUrl} target="_blank" rel="noreferrer" title="Ouvrir sur Deezer">▶</a>
        )}
      </div>
      <div className="entry__meta">
        <div className="entry__title">{entry.title}</div>
        <div className="entry__artist">
          {entry.artist}
          {entry.isEligible && <span className="badge badge--ok" style={{ marginLeft: "0.4rem" }}>Publiable</span>}
          {entry.isHidden && <span className="badge badge--muted" style={{ marginLeft: "0.4rem" }}>Masqué</span>}
          {entry.isExcluded && <span className="badge badge--danger" style={{ marginLeft: "0.4rem" }}>Exclu</span>}
          {entry.genre && <span className="badge badge--muted" style={{ marginLeft: "0.4rem" }}>{entry.genre}</span>}
        </div>
      </div>
      <div className="entry__actions">
        <button className="btn btn--sm" disabled={busy} onClick={() => onAction(entry.entryId, "move_up")} title="Monter">↑</button>
        <button className="btn btn--sm" disabled={busy} onClick={() => onAction(entry.entryId, "move_down")} title="Descendre">↓</button>
        {entry.isHidden ? (
          <button className="btn btn--sm" disabled={busy} onClick={() => onAction(entry.entryId, "unhide")}>Afficher</button>
        ) : (
          <button className="btn btn--sm" disabled={busy} onClick={() => onAction(entry.entryId, "hide")}>Masquer</button>
        )}
        {entry.isExcluded ? (
          <button className="btn btn--sm" disabled={busy} onClick={() => onAction(entry.entryId, "include")}>Réintégrer</button>
        ) : (
          <button className="btn btn--sm btn--danger" disabled={busy} onClick={() => onAction(entry.entryId, "exclude", { reason: "Non haïtien" })}>Exclure</button>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="stat">
      <div className="stat__value" style={{ color: accent ? "var(--admin-ok)" : undefined }}>{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}
