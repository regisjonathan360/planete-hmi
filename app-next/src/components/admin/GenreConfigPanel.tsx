"use client";

import { useState, useCallback, useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenreConfig {
  sourceKey: string;
  genreId: string;
  genreLabel: string;
  isEnabled: boolean;
  isAutomatic: boolean;
  weight: number;
  displayOrder: number;
  lastCollectedAt: string | null;
  currentEditionStatus: "draft" | "validated" | "published" | null;
  entryCount: number;
}

interface GenreConfigPanelProps {
  genres: GenreConfig[];
  onCollectGenre?: (sourceKey: string) => void;
  onCollectAll?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeWeights(genres: GenreConfig[]): Map<string, number> {
  const enabled = genres.filter((g) => g.isEnabled && g.weight > 0);
  const total = enabled.reduce((sum, g) => sum + g.weight, 0);
  const map = new Map<string, number>();
  for (const g of enabled) {
    map.set(g.sourceKey, total > 0 ? (g.weight / total) * 100 : 0);
  }
  return map;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: GenreConfig["currentEditionStatus"]) {
  switch (status) {
    case "published":
      return <span className="badge badge--ok">Publié</span>;
    case "validated":
      return <span className="badge badge--warn">Validé</span>;
    case "draft":
      return <span className="badge badge--muted">Brouillon</span>;
    default:
      return <span className="badge badge--muted">Aucune édition</span>;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenreConfigPanel({ genres: initialGenres, onCollectGenre, onCollectAll }: GenreConfigPanelProps) {
  const [genres, setGenres] = useState<GenreConfig[]>(initialGenres);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const normalizedPcts = useMemo(() => normalizeWeights(genres), [genres]);

  function notify(message: string, error = false) {
    setToast({ message, error });
    setTimeout(() => setToast(null), 4000);
  }

  const patchGenre = useCallback(
    async (sourceKey: string, updates: Partial<{ is_enabled: boolean; weight: number; display_order: number }>) => {
      setSaving(sourceKey);
      try {
        const res = await fetch("/api/admin/audiomack/genres", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_key: sourceKey, ...updates }),
        });
        const json = await res.json();
        if (!res.ok) {
          notify(json.error ?? "Erreur lors de la sauvegarde.", true);
          return;
        }
        notify("Configuration mise à jour.");
      } catch {
        notify("Erreur réseau.", true);
      } finally {
        setSaving(null);
      }
    },
    []
  );

  const handleToggle = useCallback(
    (sourceKey: string) => {
      setGenres((prev) =>
        prev.map((g) =>
          g.sourceKey === sourceKey ? { ...g, isEnabled: !g.isEnabled } : g
        )
      );
      const genre = genres.find((g) => g.sourceKey === sourceKey);
      if (genre) patchGenre(sourceKey, { is_enabled: !genre.isEnabled });
    },
    [genres, patchGenre]
  );

  const handleWeightChange = useCallback(
    (sourceKey: string, weight: number) => {
      const clamped = Math.min(5.0, Math.max(0.0, Math.round(weight * 100) / 100));
      setGenres((prev) =>
        prev.map((g) => (g.sourceKey === sourceKey ? { ...g, weight: clamped } : g))
      );
    },
    []
  );

  const handleWeightBlur = useCallback(
    (sourceKey: string) => {
      const genre = genres.find((g) => g.sourceKey === sourceKey);
      if (genre) patchGenre(sourceKey, { weight: genre.weight });
    },
    [genres, patchGenre]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      setGenres((prev) => {
        const next = [...prev];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        // Update display_order
        next.forEach((g, i) => (g.displayOrder = i));
        // Persist both changed items
        patchGenre(next[index - 1].sourceKey, { display_order: index - 1 });
        patchGenre(next[index].sourceKey, { display_order: index });
        return next;
      });
    },
    [patchGenre]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      setGenres((prev) => {
        if (index >= prev.length - 1) return prev;
        const next = [...prev];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        next.forEach((g, i) => (g.displayOrder = i));
        patchGenre(next[index].sourceKey, { display_order: index });
        patchGenre(next[index + 1].sourceKey, { display_order: index + 1 });
        return next;
      });
    },
    [patchGenre]
  );

  return (
    <div className="admin-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="admin-card__title">Configuration des genres</h2>
        {onCollectAll && (
          <button
            className="btn btn--primary btn--sm"
            onClick={onCollectAll}
            disabled={saving !== null}
          >
            ⟳ Collecter tous les genres
          </button>
        )}
      </div>

      <p style={{ color: "var(--admin-muted)", fontSize: "0.82rem", marginTop: 0 }}>
        Activez les genres à collecter, ajustez les poids pour le classement composite.
        Les pourcentages indiquent la contribution normalisée de chaque genre.
      </p>

      <div className="genre-config-list" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
        {genres.map((genre, index) => {
          const pct = normalizedPcts.get(genre.sourceKey);
          const isSaving = saving === genre.sourceKey;

          return (
            <div
              key={genre.sourceKey}
              className="genre-config-row"
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto auto auto",
                gap: "0.75rem",
                alignItems: "center",
                padding: "0.6rem 0.8rem",
                borderRadius: "8px",
                background: genre.isEnabled ? "var(--admin-panel-2, rgba(255,255,255,0.03))" : "transparent",
                border: "1px solid var(--admin-border)",
                opacity: genre.isEnabled ? 1 : 0.6,
              }}
            >
              {/* Toggle */}
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={genre.isEnabled}
                  onChange={() => handleToggle(genre.sourceKey)}
                  disabled={isSaving}
                  style={{ width: 18, height: 18 }}
                />
              </label>

              {/* Genre label + dashboard info */}
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {genre.genreLabel}
                  <span style={{ color: "var(--admin-muted)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                    {genre.genreId}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.6rem", fontSize: "0.75rem", color: "var(--admin-muted)", marginTop: "0.2rem" }}>
                  <span>Collecte : {formatDate(genre.lastCollectedAt)}</span>
                  <span>·</span>
                  <span>{genre.entryCount} entrées</span>
                  <span>·</span>
                  {statusBadge(genre.currentEditionStatus)}
                </div>
              </div>

              {/* Weight input */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--admin-muted)" }}>Poids :</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={genre.weight}
                  onChange={(e) => handleWeightChange(genre.sourceKey, parseFloat(e.target.value) || 0)}
                  onBlur={() => handleWeightBlur(genre.sourceKey)}
                  disabled={isSaving}
                  style={{
                    width: "60px",
                    padding: "0.3rem 0.4rem",
                    borderRadius: "6px",
                    border: "1px solid var(--admin-border)",
                    background: "var(--admin-bg)",
                    color: "var(--admin-text)",
                    fontSize: "0.85rem",
                    textAlign: "center",
                  }}
                />
                {pct !== undefined && genre.isEnabled && genre.weight > 0 && (
                  <span style={{ fontSize: "0.75rem", color: "var(--admin-accent-2, #7c9cff)", minWidth: "40px" }}>
                    {pct.toFixed(1)}%
                  </span>
                )}
              </div>

              {/* Order controls */}
              <div style={{ display: "flex", gap: "0.2rem" }}>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0 || isSaving}
                  title="Monter"
                  style={{ padding: "0.2rem 0.4rem" }}
                >
                  ↑
                </button>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === genres.length - 1 || isSaving}
                  title="Descendre"
                  style={{ padding: "0.2rem 0.4rem" }}
                >
                  ↓
                </button>
              </div>

              {/* Collect button per genre */}
              {onCollectGenre && (
                <button
                  className="btn btn--sm"
                  onClick={() => onCollectGenre(genre.sourceKey)}
                  disabled={!genre.isEnabled || isSaving}
                  title="Collecter ce genre"
                >
                  ⟳ Collecter
                </button>
              )}

              {/* Saving indicator */}
              {isSaving && (
                <span style={{ fontSize: "0.75rem", color: "var(--admin-accent-2)" }}>⟳</span>
              )}
            </div>
          );
        })}
      </div>

      {toast && (
        <div
          className={toast.error ? "toast toast--error" : "toast"}
          style={{ marginTop: "0.75rem" }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
