"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminChartData,
  AdminChartEntry,
  AdminArtistToValidate,
  AdminValidationStatus,
} from "@/lib/charts/admin/types";
import { ARTIST_TAGS, getTagMeta } from "@/lib/artists/tags";

type Tab = "musiques" | "albums" | "artistes";

interface Toast {
  message: string;
  error?: boolean;
}

export function AudiomackManager({
  sourceKey,
  initialData,
}: {
  sourceKey: string;
  initialData: AdminChartData;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("musiques");
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState<{
    status?: string;
    message?: string;
    error?: string;
    summary?: { musiques?: number; albums?: number; artistes?: number; aValider?: number; photosArtistes?: number };
  } | null>(null);
  const [, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  const data = initialData;
  const edition = data.edition;

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

  const collect = async () => {
    setIsCollecting(true);
    setCollectResult(null);
    try {
      notify("Lancement de la collecte…");
      const res = await fetch("/api/admin/charts/collect-via-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey }),
      });
      const json = await res.json();

      if (!res.ok || json.status === "error") {
        setCollectResult({ status: "error", error: json.error ?? "Erreur lors de la collecte." });
        notify(json.error ?? "Erreur lors de la collecte.", true);
      } else {
        setCollectResult(json);
        notify(json.message ?? "Collecte lancée !");
        // Rafraîchir automatiquement après 60s
        setTimeout(() => startTransition(() => router.refresh()), 60000);
      }
    } catch {
      setCollectResult({ status: "error", error: "Erreur de connexion au serveur." });
      notify("Erreur de connexion au serveur.", true);
    } finally {
      setIsCollecting(false);
    }
  };
  const publish = () => post("/api/admin/charts/publish", { sourceKey, mode: "publish" });
  const restore = () => {
    if (confirm("Restaurer la dernière version publiée ? Les modifications non publiées seront perdues."))
      post("/api/admin/charts/publish", { sourceKey, mode: "restore" });
  };
  const cancel = () => {
    if (confirm("Annuler toutes les modifications et revenir à l'ordre source Audiomack ?"))
      post("/api/admin/charts/publish", { sourceKey, mode: "cancel" });
  };

  const entryAction = (entryId: string, action: string, extra: Record<string, unknown> = {}) =>
    post("/api/admin/charts/entry", { editionId: edition?.editionId, entryId, action, ...extra });

  const validateArtist = (artistId: string, status: AdminValidationStatus) =>
    post("/api/admin/charts/artist", { artistId, status, editionId: edition?.editionId });

  const updateArtistTags = (artistId: string, tags: string[]) =>
    post("/api/admin/charts/artist-tags", { artistId, tags });

  return (
    <>
      {/* Barre de collecte + publication */}
      <div className="admin-card">
        <div className="admin-toolbar" style={{ justifyContent: "space-between" }}>
          <div className="admin-toolbar">
            <button className="btn btn--primary" onClick={collect} disabled={busy || isCollecting}>
              {isCollecting ? "⟳ Collecte en cours…" : "⟳ Collecter depuis Audiomack"}
            </button>
            {edition?.collectedAt && (
              <span style={{ color: "var(--admin-muted)", fontSize: "0.82rem" }}>
                Dernière collecte : {new Date(edition.collectedAt).toLocaleString("fr-FR")}
              </span>
            )}
          </div>
          <div className="admin-toolbar">
            <button className="btn btn--ghost btn--sm" onClick={cancel} disabled={busy || !edition}>
              Annuler les changements
            </button>
            <button className="btn btn--ghost btn--sm" onClick={restore} disabled={busy || !edition}>
              Restaurer la version publiée
            </button>
            <button className="btn btn--ok" onClick={publish} disabled={busy || !edition}>
              ✓ Publier le classement
            </button>
          </div>
        </div>

        {/* Résultat de collecte — banner persistant */}
        {collectResult && (
          <div
            className={collectResult.status === "error" ? "banner banner--error" : "banner banner--ok"}
            style={{ marginTop: "0.75rem" }}
          >
            {collectResult.status === "error" ? (
              <span>❌ {collectResult.error}</span>
            ) : (
              <span>
                ✅ {collectResult.message}
                {collectResult.summary && (
                  <> — {collectResult.summary.musiques} musiques, {collectResult.summary.albums} albums, {collectResult.summary.artistes} artistes</>
                )}
              </span>
            )}
            <button
              type="button"
              onClick={() => setCollectResult(null)}
              style={{ marginLeft: "0.75rem", background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1rem" }}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        )}

        {edition && (
          <div style={{ marginTop: "0.9rem" }}>
            {edition.hasUnpublishedChanges ? (
              <div className="banner">
                Modifications en brouillon non publiées. Le site public affiche encore la dernière
                version publiée. Cliquez « Publier » pour les rendre visibles.
              </div>
            ) : (
              <div className="banner banner--ok">
                Classement à jour : la version publiée correspond au brouillon.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Résumé de collecte */}
      <div className="admin-card">
        <h2 className="admin-card__title">Résumé</h2>
        <div className="admin-stats">
          <Stat value={data.summary.totalEntries} label="Musiques" />
          <Stat value={data.summary.distinctAlbums} label="Albums" />
          <Stat value={data.summary.distinctArtists} label="Artistes" />
          <Stat value={data.summary.eligibleEntries} label="Éligibles (publiables)" accent />
          <Stat value={data.summary.pendingArtists} label="Artistes à valider" warn />
          <Stat value={data.summary.hiddenEntries + data.summary.excludedEntries} label="Masqués / exclus" />
        </div>
      </div>

      {!edition ? (
        <div className="admin-card">
          <p style={{ color: "var(--admin-muted)" }}>
            Aucune édition. Cliquez « Collecter depuis Audiomack » pour importer le Weekly 100 Haiti.
          </p>
        </div>
      ) : (
        <>
          {/* Zone À valider */}
          {data.artistsToValidate.length > 0 && (
            <CollapsibleCard
              title={
                <>
                  À valider · artistes haïtiens{" "}
                  <span className="badge badge--warn">{data.summary.pendingArtists} en attente</span>
                </>
              }
            >
              {data.artistsToValidate.map((a) => (
                <ArtistRow key={a.artistId} artist={a} busy={busy} onValidate={validateArtist} onTagsChange={updateArtistTags} />
              ))}
            </CollapsibleCard>
          )}

          {/* Classements */}
          <div className="admin-card">
            <div className="tabs">
              <button className={tabCls(tab, "musiques")} onClick={() => setTab("musiques")}>
                Top musiques
              </button>
              <button className={tabCls(tab, "albums")} onClick={() => setTab("albums")}>
                Top albums
              </button>
              <button className={tabCls(tab, "artistes")} onClick={() => setTab("artistes")}>
                Top artistes
              </button>
            </div>

            {tab === "musiques" && (
              <div className="entry-list">
                {data.entries.length === 0 && (
                  <p style={{ color: "var(--admin-muted)" }}>Aucune entrée.</p>
                )}
                {data.entries.map((e) => (
                  <EntryCard
                    key={e.entryId}
                    entry={e}
                    busy={busy}
                    editing={editingId === e.entryId}
                    onToggleEdit={() => setEditingId(editingId === e.entryId ? null : e.entryId)}
                    onAction={entryAction}
                  />
                ))}
              </div>
            )}

            {tab === "albums" && (
              <div className="entry-list">
                <p style={{ color: "var(--admin-muted)", fontSize: "0.82rem" }}>
                  Agrégation dérivée des musiques visibles (album issu des métadonnées Audiomack).
                </p>
                {data.derivedAlbums.length === 0 && (
                  <p style={{ color: "var(--admin-muted)" }}>Aucun album détecté.</p>
                )}
                {data.derivedAlbums.map((al, i) => (
                  <div className="entry" key={`${al.name}-${i}`}>
                    <div className="entry__pos">{al.bestPosition}</div>
                    <img className="entry__cover" src={al.artworkUrl ?? placeholder} alt="" />
                    <div className="entry__meta">
                      <div className="entry__title">{al.name}</div>
                      <div className="entry__artist">
                        {al.artist} · {al.trackCount} titre(s)
                      </div>
                    </div>
                    <div />
                  </div>
                ))}
              </div>
            )}

            {tab === "artistes" && (
              <div className="entry-list">
                <p style={{ color: "var(--admin-muted)", fontSize: "0.82rem" }}>
                  Agrégation dérivée des musiques visibles.
                </p>
                {data.derivedArtists.map((ar, i) => (
                  <div className="entry" key={`${ar.name}-${i}`}>
                    <div className="entry__pos">{ar.bestPosition}</div>
                    <div />
                    <div className="entry__meta">
                      <div className="entry__title">{ar.name}</div>
                      <div className="entry__artist">{ar.trackCount} titre(s) au classement</div>
                    </div>
                    <div className="entry__actions">
                      {ar.eligible ? (
                        <span className="badge badge--ok">Publiable</span>
                      ) : (
                        <span className="badge badge--muted">Non validé</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {toast && <div className={toast.error ? "toast toast--error" : "toast"}>{toast.message}</div>}
    </>
  );
}

const placeholder = "/image/artists/planet-hmi-artist-placeholder-square.webp.webp";

function tabCls(active: Tab, self: Tab) {
  return active === self ? "tabs__btn is-active" : "tabs__btn";
}

function Stat({ value, label, accent, warn }: { value: number; label: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="stat">
      <div
        className="stat__value"
        style={{ color: accent ? "var(--admin-ok)" : warn ? "var(--admin-warn)" : undefined }}
      >
        {value}
      </div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

function statusBadge(entry: AdminChartEntry) {
  if (entry.isExcluded) return <span className="badge badge--danger">Exclu</span>;
  if (entry.isHidden) return <span className="badge badge--muted">Masqué</span>;
  if (entry.isEligible) return <span className="badge badge--ok">Publiable</span>;
  return <span className="badge badge--warn">Artiste à valider</span>;
}

function EntryCard({
  entry,
  busy,
  editing,
  onToggleEdit,
  onAction,
}: {
  entry: AdminChartEntry;
  busy: boolean;
  editing: boolean;
  onToggleEdit: () => void;
  onAction: (entryId: string, action: string, extra?: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState(entry.title);
  const [artist, setArtist] = useState(entry.artist);
  const [artworkUrl, setArtworkUrl] = useState(entry.artworkUrl ?? "");
  const [url, setUrl] = useState(entry.audiomackUrl ?? "");
  const [genre, setGenre] = useState(entry.genre ?? "");

  const cls = `entry${entry.isHidden ? " is-hidden" : ""}${entry.isExcluded ? " is-excluded" : ""}`;

  return (
    <div className={cls}>
      <div className="entry__pos">{entry.filteredPosition ?? "—"}</div>
      <div className="entry__cover-wrap">
        <img className="entry__cover" src={entry.artworkUrl ?? placeholder} alt="" />
        {entry.audiomackUrl && (
          <a className="entry__play-btn" href={entry.audiomackUrl} target="_blank" rel="noreferrer" title="Écouter sur Audiomack">▶</a>
        )}
      </div>
      <div className="entry__meta">
        <div className="entry__title">{entry.title}</div>
        <div className="entry__artist" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          {entry.primaryArtistImageUrl && (
            <img
              src={entry.primaryArtistImageUrl}
              alt=""
              style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }}
            />
          )}
          {entry.artist} {statusBadge(entry)}{" "}
          {entry.genre && <span className="badge badge--muted">{entry.genre}</span>}
          <span style={{ color: "var(--admin-muted)", fontSize: "0.75rem" }}>
            src #{entry.sourcePosition}
          </span>
        </div>
      </div>
      <div className="entry__actions">
        <button className="btn btn--sm" disabled={busy} onClick={() => onAction(entry.entryId, "move_up")} title="Monter">
          ↑
        </button>
        <button className="btn btn--sm" disabled={busy} onClick={() => onAction(entry.entryId, "move_down")} title="Descendre">
          ↓
        </button>
        <button className="btn btn--sm" disabled={busy} onClick={onToggleEdit}>
          Éditer
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
            onClick={() => onAction(entry.entryId, "exclude", { reason: "Artiste non haïtien" })}
            title="Retirer (non haïtien)"
          >
            Exclure
          </button>
        )}
        <button
          className="btn btn--sm btn--danger"
          disabled={busy}
          onClick={() => {
            if (confirm("Supprimer définitivement cette entrée ?")) onAction(entry.entryId, "delete");
          }}
        >
          Suppr.
        </button>
        {entry.audiomackUrl && (
          <a className="btn btn--sm btn--ghost" href={entry.audiomackUrl} target="_blank" rel="noreferrer">
            ▶ Audiomack
          </a>
        )}
      </div>

      {editing && (
        <div className="edit-panel">
          <div className="edit-panel__grid">
            <label className="field">
              <span>Titre</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field">
              <span>Artiste</span>
              <input value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
            <label className="field">
              <span>Genre</span>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "var(--admin-text)", padding: "0.55rem 0.7rem", borderRadius: "8px", fontSize: "0.9rem" }}>
                <option value="">— Aucun —</option>
                <option value="afrosounds">Afrosounds</option>
                <option value="hip-hop-rap">Hip-Hop/Rap</option>
                <option value="latin">Latin</option>
                <option value="caribbean">Caribbean</option>
                <option value="pop">Pop</option>
                <option value="r-b">R&B</option>
                <option value="gospel">Gospel</option>
                <option value="electronic">Electronic</option>
                <option value="rock">Rock</option>
                <option value="jazz-blues">Jazz/Blues</option>
                <option value="country">Country</option>
                <option value="instrumental">Instrumental</option>
                <option value="konpa">Konpa</option>
                <option value="raboday">Raboday</option>
                <option value="dancehall">Dancehall</option>
              </select>
            </label>
            <label className="field">
              <span>URL cover</span>
              <input value={artworkUrl} onChange={(e) => setArtworkUrl(e.target.value)} />
            </label>
            <label className="field">
              <span>Lien Audiomack</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} />
            </label>
          </div>
          <div className="admin-toolbar">
            <button
              className="btn btn--primary btn--sm"
              disabled={busy}
              onClick={() => {
                onAction(entry.entryId, "edit", { fields: { title, artist, artworkUrl, url, genre } });
                onToggleEdit();
              }}
            >
              Enregistrer
            </button>
            <button className="btn btn--ghost btn--sm" onClick={onToggleEdit}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArtistRow({
  artist,
  busy,
  onValidate,
  onTagsChange,
}: {
  artist: AdminArtistToValidate;
  busy: boolean;
  onValidate: (artistId: string, status: AdminValidationStatus) => void;
  onTagsChange: (artistId: string, tags: string[]) => void;
}) {
  const current: AdminValidationStatus = !artist.isActive
    ? "masque"
    : artist.haitianStatus === "rejected"
      ? "refuse"
      : artist.haitianStatus.startsWith("verified")
        ? "valide"
        : "a_verifier";

  const badge =
    current === "valide" ? (
      <span className="badge badge--ok">Validé</span>
    ) : current === "refuse" ? (
      <span className="badge badge--danger">Refusé</span>
    ) : current === "masque" ? (
      <span className="badge badge--muted">Masqué</span>
    ) : (
      <span className="badge badge--warn">À vérifier</span>
    );

  function toggleTag(tagId: string) {
    const newTags = artist.tags.includes(tagId)
      ? artist.tags.filter((t) => t !== tagId)
      : [...artist.tags, tagId];
    onTagsChange(artist.artistId, newTags);
  }

  return (
    <div className="artist-row" style={{ flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <img
          src={artist.imageUrl ?? placeholder}
          alt={artist.name}
          style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", background: "#05050c" }}
        />
        <div>
          <div style={{ fontWeight: 600 }}>
            {artist.name} {badge}
          </div>
          <div style={{ color: "var(--admin-muted)", fontSize: "0.8rem" }}>
            {artist.trackCount} titre(s)
            {artist.confidenceScore != null && ` · confiance ${artist.confidenceScore}%`}
          </div>
          <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem", flexWrap: "wrap" }}>
            {ARTIST_TAGS.map((tag) => {
              const active = artist.tags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className="btn btn--sm"
                  disabled={busy}
                  onClick={() => toggleTag(tag.id)}
                  style={{
                    background: active ? tag.bgColor : "transparent",
                    borderColor: active ? tag.color : "var(--admin-border)",
                    color: active ? tag.color : "var(--admin-muted)",
                    fontSize: "0.72rem",
                    padding: "0.2rem 0.45rem",
                  }}
                >
                  {tag.icon} {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="artist-row__actions">
        <button
          type="button"
          className="btn btn--sm btn--ok"
          disabled={busy || current === "valide"}
          onClick={() => onValidate(artist.artistId, "valide")}
        >
          Valider
        </button>
        <button
          type="button"
          className="btn btn--sm btn--danger"
          disabled={busy || current === "refuse"}
          onClick={() => onValidate(artist.artistId, "refuse")}
        >
          Refuser
        </button>
        <button
          type="button"
          className="btn btn--sm"
          disabled={busy || current === "masque"}
          onClick={() => onValidate(artist.artistId, "masque")}
        >
          Masquer
        </button>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          disabled={busy || current === "a_verifier"}
          onClick={() => onValidate(artist.artistId, "a_verifier")}
        >
          À vérifier
        </button>
      </div>
    </div>
  );
}

function CollapsibleCard({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="admin-card">
      <h2 className="admin-card__title" style={{ cursor: "pointer", userSelect: "none" }} onClick={() => setCollapsed(!collapsed)}>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
          aria-label={collapsed ? "Développer" : "Réduire"}
          style={{ padding: "0.2rem 0.5rem", fontSize: "0.9rem" }}
        >
          {collapsed ? "▸" : "▾"}
        </button>
        {title}
      </h2>
      {!collapsed && children}
    </div>
  );
}
