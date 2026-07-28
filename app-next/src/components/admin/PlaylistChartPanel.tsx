"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CollectProgressBar,
  readCollectStream,
  type CollectProgress,
} from "@/components/CollectProgressBar";
import type { AdminChartData, AdminChartEntry } from "@/lib/charts/admin/types";
import type { PlaylistSourceState } from "@/lib/charts/playlist-sources";

function formatListeners(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

interface Toast {
  message: string;
  error?: boolean;
}

/**
 * Administration complète d'un classement alimenté par une playlist Spotify :
 * réglage de la playlist, collecte avec progression, édition des entrées,
 * publication / restauration / annulation.
 */
export function PlaylistChartPanel({
  sourceKey,
  title,
  description,
  data,
  source,
  defaultPlaylistUrl,
  publicUrl,
}: {
  sourceKey: string;
  title: string;
  description: string;
  data: AdminChartData | null;
  source: PlaylistSourceState | null;
  defaultPlaylistUrl: string;
  /** Page publique correspondante, ouverte dans un nouvel onglet. */
  publicUrl?: string;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<CollectProgress | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState(source?.playlistUrl ?? defaultPlaylistUrl);
  const [showSettings, setShowSettings] = useState(false);
  const [, startTransition] = useTransition();

  const edition = data?.edition ?? null;

  function notify(message: string, error = false) {
    setToast({ message, error });
    setTimeout(() => setToast(null), 5000);
  }

  async function post(url: string, body: Record<string, unknown>, method = "POST") {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error ?? "Erreur.", true);
        return false;
      }
      notify(json.message ?? "Fait.");
      startTransition(() => router.refresh());
      return true;
    } catch {
      notify("Erreur réseau.", true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function collect() {
    setBusy(true);
    setProgress({ phase: "init", percent: 0, message: "Démarrage de la collecte..." });
    try {
      const res = await fetch("/api/admin/charts/playlist-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey }),
      });

      if (!res.ok && res.headers.get("Content-Type")?.includes("json")) {
        const json = await res.json();
        setProgress({ phase: "error", percent: 0, message: json.error ?? "Collecte refusée." });
        return;
      }

      const last = await readCollectStream(res, setProgress);
      if (last?.phase === "done") startTransition(() => router.refresh());
    } catch {
      setProgress({ phase: "error", percent: 0, message: "Erreur réseau pendant la collecte." });
    } finally {
      setBusy(false);
    }
  }

  const saveSettings = () =>
    post("/api/admin/charts/playlist-source", { sourceKey, playlistUrl }, "PATCH");

  const toggleEnabled = () =>
    post(
      "/api/admin/charts/playlist-source",
      { sourceKey, isEnabled: !(source?.isEnabled ?? true) },
      "PATCH",
    );

  const publish = () => post("/api/admin/charts/publish", { sourceKey, mode: "publish" });
  const restore = () => {
    if (confirm("Restaurer l'état de la dernière publication ? Les modifications en cours seront perdues."))
      post("/api/admin/charts/publish", { sourceKey, mode: "restore" });
  };
  const cancelChanges = () => {
    if (confirm("Annuler toutes les retouches manuelles (ordre, masquages, corrections) ?"))
      post("/api/admin/charts/publish", { sourceKey, mode: "cancel" });
  };
  const clearEdition = () => {
    if (edition && confirm("Vider entièrement ce classement ? Action irréversible."))
      post("/api/admin/charts/entry", {
        editionId: edition.editionId,
        entryId: "__all__",
        action: "delete_all",
      });
  };

  const reorderByListeners = async () => {
    if (!edition) return;
    if (!confirm("Récupérer les auditeurs mensuels de chaque artiste et reclasser ? Cela peut prendre 30 secondes.")) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/admin/charts/spotify-listeners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey, editionId: edition.editionId }),
      });
      const json = await res.json();
      if (!res.ok) { notify(json.error ?? "Erreur.", true); return; }
      notify(json.message ?? "Reclassement terminé.");
      startTransition(() => router.refresh());
    } catch { notify("Erreur réseau.", true); }
    finally { setBusy(false); }
  };

  const fetchListeners = async (entryId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/charts/spotify-listeners?entryId=${encodeURIComponent(entryId)}`);
      const json = await res.json();
      if (!res.ok) { notify(json.error ?? "Erreur.", true); return; }
      const ml = json.monthlyListeners;
      const followers = json.followers;
      const value = ml ?? followers;
      const label = ml ? `${(ml / 1000).toFixed(0)}k auditeurs/mois` : followers ? `${(followers / 1000).toFixed(0)}k followers` : "indisponible";
      notify(`${json.artistName} : ${label} (${json.method})`);
      if (value !== null) {
        // Mettre à jour la valeur dans la base
        await fetch("/api/admin/charts/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            editionId: edition?.editionId,
            entryId,
            action: "edit",
            metricValue: value,
            metricUnit: "monthly_listeners",
          }),
        });
        startTransition(() => router.refresh());
      }
    } catch { notify("Erreur réseau.", true); }
    finally { setBusy(false); }
  };

  const entryAction = (entryId: string, action: string, extra: Record<string, unknown> = {}) =>
    edition
      ? post("/api/admin/charts/entry", {
          editionId: edition.editionId,
          entryId,
          action,
          ...extra,
        })
      : Promise.resolve(false);

  return (
    <>
      <div className="admin-card">
        <h2 className="admin-card__title">{title}</h2>
        <p style={{ color: "var(--admin-muted)", fontSize: "0.82rem", marginTop: 0 }}>
          {description}
        </p>

        <div className="admin-toolbar">
          <button className="btn btn--primary" onClick={collect} disabled={busy}>
            ⟳ Collecter depuis la playlist
          </button>
          <button className="btn btn--ok" onClick={publish} disabled={busy || !edition}>
            ✓ Publier
          </button>
          <button className="btn btn--sm" onClick={restore} disabled={busy || !data?.isPublished}>
            ↩ Restaurer la publication
          </button>
          <button className="btn btn--sm" onClick={cancelChanges} disabled={busy || !edition}>
            ✕ Annuler les retouches
          </button>
          <button
            className="btn btn--sm"
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
          >
            ⚙ Réglages
          </button>
          {publicUrl && (
            <a className="btn btn--sm btn--ghost" href={publicUrl} target="_blank" rel="noreferrer">
              Voir la page publique ↗
            </a>
          )}
          <button className="btn btn--danger btn--sm" onClick={clearEdition} disabled={busy || !edition}>
            🗑 Vider
          </button>
          <button className="btn btn--sm btn--primary" onClick={reorderByListeners} disabled={busy || !edition}>
            🎧 Reclasser par auditeurs mensuels
          </button>
        </div>

        {/* État de la source */}
        <p style={{ marginTop: "0.7rem", marginBottom: 0, fontSize: "0.8rem", color: "var(--admin-muted)" }}>
          Playlist :{" "}
          <a
            href={source?.playlistUrl ?? defaultPlaylistUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--admin-accent-2)" }}
          >
            {source?.playlistUrl ?? defaultPlaylistUrl}
          </a>
          {source?.lastSuccessAt &&
            ` · dernière collecte réussie : ${new Date(source.lastSuccessAt).toLocaleString("fr-FR")}`}
          {!source && " · source pas encore créée en base : lancez une première collecte"}
        </p>

        {source && !source.isEnabled && (
          <p style={{ marginTop: "0.4rem", marginBottom: 0, fontSize: "0.8rem", color: "var(--admin-warn)" }}>
            ⚠ Source désactivée : elle n&apos;apparaît plus dans les classements publics.
          </p>
        )}

        {source?.lastError && (
          <p style={{ marginTop: "0.4rem", marginBottom: 0, fontSize: "0.8rem", color: "var(--admin-warn)" }}>
            ⚠ Dernière erreur : {source.lastError}
          </p>
        )}

        {showSettings && (
          <div
            style={{
              marginTop: "0.9rem",
              padding: "0.8rem",
              borderRadius: 8,
              background: "var(--admin-panel-2)",
              border: "1px solid var(--admin-border)",
            }}
          >
            <div className="field">
              <label htmlFor={`${sourceKey}-playlist`}>Lien de la playlist Spotify</label>
              <input
                id={`${sourceKey}-playlist`}
                type="url"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder={defaultPlaylistUrl}
              />
            </div>
            <div className="admin-toolbar">
              <button className="btn btn--sm btn--primary" onClick={saveSettings} disabled={busy || !source}>
                Enregistrer
              </button>
              <button
                className="btn btn--sm"
                onClick={() => setPlaylistUrl(defaultPlaylistUrl)}
                disabled={busy}
              >
                Playlist par défaut
              </button>
              <button className="btn btn--sm" onClick={toggleEnabled} disabled={busy || !source}>
                {source?.isEnabled ? "Désactiver la source" : "Réactiver la source"}
              </button>
            </div>
            <p style={{ fontSize: "0.76rem", color: "var(--admin-muted)", margin: 0 }}>
              Le mode d&apos;ingestion affiché au public est «&nbsp;
              {source?.ingestionMode ?? "VERIFIED_ADMIN_IMPORT"}&nbsp;» : chaque édition est
              vérifiée puis publiée à la main.
            </p>
          </div>
        )}

        <CollectProgressBar progress={progress} />

        {edition && (
          <div style={{ marginTop: "0.75rem" }}>
            {edition.hasUnpublishedChanges ? (
              <div className="banner">
                Modifications non publiées. Cliquez «&nbsp;Publier&nbsp;» pour les rendre visibles.
              </div>
            ) : (
              <div className="banner banner--ok">Classement publié et à jour.</div>
            )}
          </div>
        )}
      </div>

      {data?.summary && edition && (
        <div className="admin-card">
          <h2 className="admin-card__title">Résumé</h2>
          <div className="admin-stats">
            <Stat value={data.summary.totalEntries} label="Titres" />
            <Stat value={data.summary.distinctArtists} label="Artistes" />
            <Stat value={data.summary.visibleEntries} label="Visibles" />
            <Stat value={data.summary.eligibleEntries} label="Publiables" accent />
            <Stat
              value={data.summary.hiddenEntries + data.summary.excludedEntries}
              label="Masqués / exclus"
            />
            <Stat value={data.summary.pendingArtists} label="Artistes à valider" />
          </div>
        </div>
      )}

      {data?.entries && data.entries.length > 0 && (
        <div className="admin-card">
          <h2 className="admin-card__title">Titres du classement</h2>
          <div className="entry-list">
            {data.entries.map((entry) => (
              <PlaylistEntry
                key={entry.entryId}
                entry={entry}
                busy={busy}
                onAction={entryAction}
                onFetchListeners={fetchListeners}
              />
            ))}
          </div>
        </div>
      )}

      {toast && <div className={toast.error ? "toast toast--error" : "toast"}>{toast.message}</div>}
    </>
  );
}

function PlaylistEntry({
  entry,
  busy,
  onAction,
  onFetchListeners,
}: {
  entry: AdminChartEntry;
  busy: boolean;
  onAction: (entryId: string, action: string, extra?: Record<string, unknown>) => void;
  onFetchListeners?: (entryId: string) => void;
}) {
  const cls = `entry${entry.isHidden ? " is-hidden" : ""}${entry.isExcluded ? " is-excluded" : ""}`;
  const spotifyUrl = entry.platformTrackId
    ? `https://open.spotify.com/track/${entry.platformTrackId}`
    : entry.audiomackUrl;

  // Afficher la métrique si elle est renseignée
  const hasListeners = entry.metricValue != null && entry.metricUnit === "monthly_listeners";

  return (
    <div className={cls}>
      <div className="entry__pos">{entry.filteredPosition ?? entry.sourcePosition}</div>
      <Image
        unoptimized
        className="entry__cover"
        src={entry.artworkUrl ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
        alt=""
        width={52}
        height={52}
      />
      <div className="entry__meta">
        <div className="entry__title">{entry.title}</div>
        <div className="entry__artist">
          {entry.artist}
          {hasListeners && (
            <span className="badge badge--ok" style={{ marginLeft: "0.4rem" }}>
              🎧 {formatListeners(entry.metricValue!)}
            </span>
          )}
          {entry.isEligible && (
            <span className="badge badge--ok" style={{ marginLeft: "0.4rem" }}>
              Publiable
            </span>
          )}
          {!entry.isEligible && !entry.isExcluded && (
            <span className="badge badge--warn" style={{ marginLeft: "0.4rem" }}>
              Artiste à valider
            </span>
          )}
          {entry.isHidden && (
            <span className="badge badge--muted" style={{ marginLeft: "0.4rem" }}>
              Masqué
            </span>
          )}
          {entry.isExcluded && (
            <span className="badge badge--danger" style={{ marginLeft: "0.4rem" }}>
              Exclu
            </span>
          )}
        </div>
      </div>
      <div className="entry__actions">
        {onFetchListeners && (
          <button
            className="btn btn--sm"
            disabled={busy}
            onClick={() => onFetchListeners(entry.entryId)}
            title="Récupérer les auditeurs mensuels Spotify"
          >
            🎧
          </button>
        )}
        {spotifyUrl && (
          <a className="btn btn--sm btn--ghost" href={spotifyUrl} target="_blank" rel="noreferrer">
            ▶
          </a>
        )}
        <button className="btn btn--sm" disabled={busy} onClick={() => onAction(entry.entryId, "move_up")} title="Monter">
          ↑
        </button>
        <button className="btn btn--sm" disabled={busy} onClick={() => onAction(entry.entryId, "move_down")} title="Descendre">
          ↓
        </button>
        {entry.isHidden ? (
          <button className="btn btn--sm" disabled={busy} onClick={() => onAction(entry.entryId, "unhide")}>
            Afficher
          </button>
        ) : (
          <button className="btn btn--sm" disabled={busy} onClick={() => onAction(entry.entryId, "hide")}>
            Masquer
          </button>
        )}
        {entry.isExcluded ? (
          <button className="btn btn--sm" disabled={busy} onClick={() => onAction(entry.entryId, "include")}>
            Réintégrer
          </button>
        ) : (
          <button
            className="btn btn--sm btn--danger"
            disabled={busy}
            onClick={() => onAction(entry.entryId, "exclude", { reason: "Non haïtien" })}
          >
            Exclure
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="stat">
      <div className="stat__value" style={{ color: accent ? "var(--admin-ok)" : undefined }}>
        {value}
      </div>
      <div className="stat__label">{label}</div>
    </div>
  );
}
