"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/* ─── Types ──────────────────────────────────────────────────── */

interface ChartEntry {
  id: string;
  source_position: number;
  admin_position: number | null;
  display_title: string | null;
  display_artist: string | null;
  display_artwork_url: string | null;
  is_hidden: boolean;
  is_excluded: boolean;
  exclusion_reason: string | null;
  metric_value: number | null;
  // Joined from platform_tracks / tiktok_sounds
  title: string;
  artist: string;
  artwork_url: string | null;
}

interface ChartEditorProps {
  sourceKey: string;
  chartLabel: string;
}

interface Toast {
  message: string;
  error?: boolean;
}

/* ─── Component ──────────────────────────────────────────────── */

export function ChartEditor({ sourceKey, chartLabel }: ChartEditorProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<ChartEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [excludeId, setExcludeId] = useState<string | null>(null);
  const [excludeReason, setExcludeReason] = useState("");
  const [, startTransition] = useTransition();

  /* ─ Helpers ─ */

  function notify(message: string, error = false) {
    setToast({ message, error });
    setTimeout(() => setToast(null), 4000);
  }

  async function fetchEntries() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tiktok/entries?sourceKey=${encodeURIComponent(sourceKey)}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      } else {
        notify("Impossible de charger les entrées.", true);
      }
    } catch {
      notify("Erreur réseau.", true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

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
      await fetchEntries();
      return true;
    } catch {
      notify("Erreur réseau.", true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/tiktok/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error ?? "Erreur.", true);
        return false;
      }
      notify(json.message ?? "Modification enregistrée.");
      await fetchEntries();
      return true;
    } catch {
      notify("Erreur réseau.", true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  /* ─ Actions globales ─ */

  function handlePublish() {
    if (!confirm("Publier ce classement ? Il sera visible sur le site public.")) return;
    post("/api/admin/tiktok/publish", { sourceKey });
  }

  function handleRestore() {
    if (!confirm("Restaurer la dernière version publiée ? Les modifications en cours seront perdues.")) return;
    post("/api/admin/tiktok/restore", { sourceKey });
  }

  function handleCancel() {
    if (!confirm("Annuler toutes les modifications et rétablir l'ordre source ?")) return;
    post("/api/admin/tiktok/cancel", { sourceKey });
  }

  /* ─ Actions entrées ─ */

  function moveUp(entry: ChartEntry) {
    const pos = entry.admin_position ?? entry.source_position;
    if (pos <= 1) return;
    patch({ entry_id: entry.id, action: "reorder", new_position: pos - 1 });
  }

  function moveDown(entry: ChartEntry) {
    const pos = entry.admin_position ?? entry.source_position;
    patch({ entry_id: entry.id, action: "reorder", new_position: pos + 1 });
  }

  function toggleHide(entry: ChartEntry) {
    patch({ entry_id: entry.id, action: "hide", is_hidden: !entry.is_hidden });
  }

  function confirmExclude(entryId: string) {
    if (!excludeReason.trim()) {
      notify("Veuillez indiquer une raison pour l'exclusion.", true);
      return;
    }
    patch({ entry_id: entryId, action: "exclude", exclusion_reason: excludeReason.trim() });
    setExcludeId(null);
    setExcludeReason("");
  }

  function reintegrate(entry: ChartEntry) {
    patch({ entry_id: entry.id, action: "exclude" }); // no reason → réintégrer
  }

  /* ─ Position effective pour tri ─ */

  const sortedEntries = [...entries].sort((a, b) => {
    const posA = a.admin_position ?? a.source_position;
    const posB = b.admin_position ?? b.source_position;
    return posA - posB;
  });

  /* ─ Render ─ */

  if (loading) {
    return (
      <div style={{ padding: "2rem", color: "var(--admin-muted)" }}>
        Chargement des entrées…
      </div>
    );
  }

  return (
    <div>
      {/* Barre d'actions globales */}
      <div className="admin-toolbar" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
        <span style={{ fontWeight: 600, color: "var(--admin-text)" }}>{chartLabel}</span>
        <div className="admin-toolbar">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleCancel}
            disabled={busy}
          >
            Annuler les modifications
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleRestore}
            disabled={busy}
          >
            Restaurer dernière publication
          </button>
          <button
            type="button"
            className="btn btn--ok"
            onClick={handlePublish}
            disabled={busy}
          >
            ✓ Publier
          </button>
        </div>
      </div>

      {/* Liste d'entrées */}
      {sortedEntries.length === 0 ? (
        <p style={{ color: "var(--admin-muted)" }}>
          Aucune entrée pour ce classement. Lancez une collecte puis validez des sons.
        </p>
      ) : (
        <div className="entry-list">
          {sortedEntries.map((entry, idx) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              position={idx + 1}
              busy={busy}
              editing={editingId === entry.id}
              excluding={excludeId === entry.id}
              excludeReason={excludeReason}
              onToggleEdit={() => setEditingId(editingId === entry.id ? null : entry.id)}
              onMoveUp={() => moveUp(entry)}
              onMoveDown={() => moveDown(entry)}
              onToggleHide={() => toggleHide(entry)}
              onExclude={() => {
                setExcludeId(entry.id);
                setExcludeReason("");
              }}
              onReintegrate={() => reintegrate(entry)}
              onExcludeReasonChange={setExcludeReason}
              onConfirmExclude={() => confirmExclude(entry.id)}
              onCancelExclude={() => { setExcludeId(null); setExcludeReason(""); }}
              onOverride={(fields) =>
                patch({ entry_id: entry.id, action: "override", ...fields })
              }
            />
          ))}
        </div>
      )}

      {/* Toast local */}
      {toast && (
        <div className={toast.error ? "toast toast--error" : "toast"}>{toast.message}</div>
      )}
    </div>
  );
}

/* ─── Entry Row ──────────────────────────────────────────────── */

function EntryRow({
  entry,
  position,
  busy,
  editing,
  excluding,
  excludeReason,
  onToggleEdit,
  onMoveUp,
  onMoveDown,
  onToggleHide,
  onExclude,
  onReintegrate,
  onExcludeReasonChange,
  onConfirmExclude,
  onCancelExclude,
  onOverride,
}: {
  entry: ChartEntry;
  position: number;
  busy: boolean;
  editing: boolean;
  excluding: boolean;
  excludeReason: string;
  onToggleEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleHide: () => void;
  onExclude: () => void;
  onReintegrate: () => void;
  onExcludeReasonChange: (val: string) => void;
  onConfirmExclude: () => void;
  onCancelExclude: () => void;
  onOverride: (fields: Record<string, string | undefined>) => void;
}) {
  const [title, setTitle] = useState(entry.display_title ?? entry.title);
  const [artist, setArtist] = useState(entry.display_artist ?? entry.artist);
  const [artworkUrl, setArtworkUrl] = useState(entry.display_artwork_url ?? entry.artwork_url ?? "");

  const displayTitle = entry.display_title ?? entry.title;
  const displayArtist = entry.display_artist ?? entry.artist;
  const publications = entry.metric_value ?? 0;

  const cls = `entry${entry.is_hidden ? " is-hidden" : ""}${entry.is_excluded ? " is-excluded" : ""}`;

  return (
    <div className={cls}>
      {/* Position */}
      <div className="entry__pos">{position}</div>

      {/* Infos principales */}
      <div className="entry__meta">
        <div className="entry__title">
          {displayTitle}
          {entry.is_hidden && <span className="badge badge--muted" style={{ marginLeft: "0.4rem" }}>Masqué</span>}
          {entry.is_excluded && <span className="badge badge--danger" style={{ marginLeft: "0.4rem" }}>Exclu</span>}
        </div>
        <div className="entry__artist">
          {displayArtist} · {publications} publication{publications !== 1 ? "s" : ""}
          <span style={{ color: "var(--admin-muted)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
            src #{entry.source_position}
          </span>
        </div>
        {entry.is_excluded && entry.exclusion_reason && (
          <div style={{ fontSize: "0.78rem", color: "var(--admin-muted)", fontStyle: "italic" }}>
            Raison : {entry.exclusion_reason}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="entry__actions">
        <button type="button" className="btn btn--sm" disabled={busy} onClick={onMoveUp} title="Monter">
          ↑
        </button>
        <button type="button" className="btn btn--sm" disabled={busy} onClick={onMoveDown} title="Descendre">
          ↓
        </button>
        <button type="button" className="btn btn--sm" disabled={busy} onClick={onToggleEdit}>
          Modifier
        </button>
        <button type="button" className="btn btn--sm" disabled={busy} onClick={onToggleHide}>
          {entry.is_hidden ? "Afficher" : "Masquer"}
        </button>
        {entry.is_excluded ? (
          <button type="button" className="btn btn--sm" disabled={busy} onClick={onReintegrate}>
            Réintégrer
          </button>
        ) : (
          <button type="button" className="btn btn--sm btn--danger" disabled={busy} onClick={onExclude}>
            Exclure
          </button>
        )}
      </div>

      {/* Panneau d'exclusion avec raison */}
      {excluding && (
        <div className="edit-panel" style={{ marginTop: "0.6rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Raison de l'exclusion…"
              value={excludeReason}
              onChange={(e) => onExcludeReasonChange(e.target.value)}
              style={{
                flex: 1,
                minWidth: "200px",
                background: "var(--admin-bg)",
                border: "1px solid var(--admin-border)",
                color: "var(--admin-text)",
                padding: "0.5rem 0.7rem",
                borderRadius: "6px",
                fontSize: "0.85rem",
              }}
            />
            <button type="button" className="btn btn--sm btn--danger" disabled={busy} onClick={onConfirmExclude}>
              Confirmer l&apos;exclusion
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={onCancelExclude}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Panneau de modification (override) */}
      {editing && (
        <div className="edit-panel" style={{ marginTop: "0.6rem" }}>
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
              <span>URL artwork</span>
              <input value={artworkUrl} onChange={(e) => setArtworkUrl(e.target.value)} />
            </label>
          </div>
          <div className="admin-toolbar" style={{ marginTop: "0.6rem" }}>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy}
              onClick={() => {
                onOverride({
                  override_title: title,
                  override_artist: artist,
                  override_artwork_url: artworkUrl,
                });
                onToggleEdit();
              }}
            >
              Enregistrer
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onToggleEdit}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
