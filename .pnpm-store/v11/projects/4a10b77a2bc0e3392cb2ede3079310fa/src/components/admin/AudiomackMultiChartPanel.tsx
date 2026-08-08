"use client";

import { useState, useCallback } from "react";
import { GenreConfigPanel, type GenreConfig } from "./GenreConfigPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompositePreviewEntry {
  position: number;
  title: string;
  artistName: string;
  compositeScore: number;
  genreCount: number;
  bestPosition: number;
  contributions: Array<{
    sourceKey: string;
    genreId: string;
    genreLabel: string;
    sourcePosition: number;
    weight: number;
    contribution: number;
  }>;
}

interface ReclassificationEntry {
  entryId: string;
  trackTitle: string;
  artistName: string;
  originalPosition: number;
  newPosition: number;
  positionChange: number;
  scoreStats: number;
  hasStats: boolean;
}

interface StatsResult {
  extracted: number;
  failed: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AudiomackMultiChartPanel({
  genres,
}: {
  genres: GenreConfig[];
}) {
  return (
    <>
      {/* 7.1 + 7.5: Genre Configuration Panel with collection triggers */}
      <GenreConfigSection genres={genres} />

      {/* 7.2: Composite Controls */}
      <CompositeSection />

      {/* 7.3: Stats Extraction */}
      <StatsSection />

      {/* 7.4: Reclassification */}
      <ReclassificationSection />
    </>
  );
}

// ---------------------------------------------------------------------------
// 7.5 + 7.1: Genre Config Section with collection triggers
// ---------------------------------------------------------------------------

function GenreConfigSection({ genres }: { genres: GenreConfig[] }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  function notify(message: string, error = false) {
    setToast({ message, error });
    setTimeout(() => setToast(null), 4000);
  }

  const collectGenre = useCallback(async (sourceKey: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/audiomack/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error ?? "Erreur lors de la collecte.", true);
      } else {
        notify(json.message ?? "Collecte lancée !");
      }
    } catch {
      notify("Erreur réseau.", true);
    } finally {
      setBusy(false);
    }
  }, []);

  const collectAll = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/audiomack/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genres: "all" }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error ?? "Erreur lors de la collecte.", true);
      } else {
        notify(json.message ?? "Collecte de tous les genres lancée !");
      }
    } catch {
      notify("Erreur réseau.", true);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      <GenreConfigPanel
        genres={genres}
        onCollectGenre={busy ? undefined : collectGenre}
        onCollectAll={busy ? undefined : collectAll}
      />
      {toast && (
        <div className={toast.error ? "toast toast--error" : "toast"}>
          {toast.message}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// 7.2: Composite Preview & Publish
// ---------------------------------------------------------------------------

function CompositeSection() {
  const [busy, setBusy] = useState(false);
  const [compositeEntries, setCompositeEntries] = useState<CompositePreviewEntry[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  function notify(message: string, error = false) {
    setToast({ message, error });
    setTimeout(() => setToast(null), 4000);
  }

  const computeComposite = async () => {
    setBusy(true);
    setCompositeEntries(null);
    setWarnings([]);
    try {
      const res = await fetch("/api/admin/audiomack/compute-composite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error ?? "Erreur lors du calcul.", true);
        return;
      }
      setCompositeEntries(json.entries ?? []);
      setWarnings(json.warnings ?? []);
      setEditionId(json.editionId ?? null);
      notify(json.message ?? "Composite calculé !");
    } catch {
      notify("Erreur réseau.", true);
    } finally {
      setBusy(false);
    }
  };

  const publishComposite = async () => {
    if (!editionId) return;
    // Check warnings for < 3 sources
    const fewSources = warnings.some((w) => w.includes("source") && w.includes("publiée"));
    if (fewSources) {
      if (!confirm("Moins de 3 sources genre publiées. Publier quand même ?")) return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/charts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey: "audiomack_haiti_composite", mode: "publish" }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error ?? "Erreur lors de la publication.", true);
      } else {
        notify(json.message ?? "Composite publié !");
      }
    } catch {
      notify("Erreur réseau.", true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-card">
      <h2 className="admin-card__title">Classement Composite</h2>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.82rem", marginTop: 0 }}>
        Calculez le classement « Best Of » en fusionnant les genres pondérés.
      </p>

      <div className="admin-toolbar">
        <button className="btn btn--primary" onClick={computeComposite} disabled={busy}>
          {busy ? "⟳ Calcul en cours…" : "Calculer composite"}
        </button>
        {editionId && (
          <button className="btn btn--ok" onClick={publishComposite} disabled={busy}>
            ✓ Publier composite
          </button>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ marginTop: "0.75rem" }}>
          {warnings.map((w, i) => (
            <div key={i} className="banner banner--warn" style={{ marginBottom: "0.3rem", fontSize: "0.82rem" }}>
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      {/* Composite preview table */}
      {compositeEntries && compositeEntries.length > 0 && (
        <div style={{ marginTop: "1rem", overflowX: "auto" }}>
          <table className="t20" style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Titre</th>
                <th>Artiste</th>
                <th>Score</th>
                <th>Genres</th>
                <th>Meilleure pos.</th>
                <th>Contributions</th>
              </tr>
            </thead>
            <tbody>
              {compositeEntries.slice(0, 20).map((entry) => (
                <tr key={entry.position}>
                  <td style={{ fontWeight: 700 }}>{entry.position}</td>
                  <td>{entry.title}</td>
                  <td>{entry.artistName}</td>
                  <td style={{ fontFamily: "monospace" }}>{entry.compositeScore.toFixed(1)}</td>
                  <td>{entry.genreCount}</td>
                  <td>#{entry.bestPosition}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                      {entry.contributions.map((c) => (
                        <span
                          key={c.sourceKey}
                          className="badge badge--muted"
                          style={{ fontSize: "0.7rem" }}
                          title={`${c.genreLabel}: pos #${c.sourcePosition}, poids ${c.weight}, contribution ${c.contribution.toFixed(1)}`}
                        >
                          {c.genreId} #{c.sourcePosition}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {compositeEntries && compositeEntries.length === 0 && (
        <div className="banner" style={{ marginTop: "0.75rem" }}>
          Aucune entrée composite calculée. Vérifiez que des éditions sont publiées avec un poids &gt; 0.
        </div>
      )}

      {toast && (
        <div className={toast.error ? "toast toast--error" : "toast"} style={{ marginTop: "0.5rem" }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7.3: Stats Extraction
// ---------------------------------------------------------------------------

function StatsSection() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StatsResult | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  function notify(message: string, error = false) {
    setToast({ message, error });
    setTimeout(() => setToast(null), 4000);
  }

  const extractStats = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/audiomack/extract-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error ?? "Erreur lors de l'extraction.", true);
        return;
      }
      setResult({ extracted: json.extracted ?? 0, failed: json.failed ?? 0 });
      notify(json.message ?? `Stats extraites : ${json.extracted} réussies, ${json.failed} échouées.`);
    } catch {
      notify("Erreur réseau.", true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-card">
      <h2 className="admin-card__title">Extraction des statistiques</h2>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.82rem", marginTop: 0 }}>
        Récupérez les écoutes, likes et reposts depuis les pages Audiomack des chansons collectées.
      </p>

      <div className="admin-toolbar">
        <button className="btn btn--primary" onClick={extractStats} disabled={busy}>
          {busy ? "⟳ Extraction en cours…" : "Extraire les stats"}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: "0.75rem" }}>
          <div className="admin-stats">
            <div className="stat">
              <div className="stat__value" style={{ color: "var(--admin-ok)" }}>
                {result.extracted}
              </div>
              <div className="stat__label">Extraites</div>
            </div>
            <div className="stat">
              <div className="stat__value" style={{ color: result.failed > 0 ? "var(--admin-warn)" : undefined }}>
                {result.failed}
              </div>
              <div className="stat__label">Échouées</div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={toast.error ? "toast toast--error" : "toast"} style={{ marginTop: "0.5rem" }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7.4: Reclassification
// ---------------------------------------------------------------------------

function ReclassificationSection() {
  const [busy, setBusy] = useState(false);
  const [coefficients, setCoefficients] = useState({ plays: 1.0, likes: 5.0, reposts: 3.0 });
  const [preview, setPreview] = useState<ReclassificationEntry[] | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  function notify(message: string, error = false) {
    setToast({ message, error });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchPreview = async () => {
    setBusy(true);
    setPreview(null);
    try {
      const res = await fetch("/api/admin/audiomack/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", coefficients }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error ?? "Erreur lors du calcul.", true);
        return;
      }
      setPreview(json.entries ?? []);
      notify("Prévisualisation calculée.");
    } catch {
      notify("Erreur réseau.", true);
    } finally {
      setBusy(false);
    }
  };

  const applyReclassification = async () => {
    if (!confirm("Appliquer le reclassement par statistiques ? Les positions seront mises à jour.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/audiomack/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "apply", coefficients }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error ?? "Erreur lors de l'application.", true);
        return;
      }
      notify(json.message ?? "Reclassement appliqué !");
      setPreview(null);
    } catch {
      notify("Erreur réseau.", true);
    } finally {
      setBusy(false);
    }
  };

  const rejectReclassification = () => {
    setPreview(null);
    notify("Reclassement rejeté.");
  };

  return (
    <div className="admin-card">
      <h2 className="admin-card__title">Reclassement par statistiques</h2>
      <p style={{ color: "var(--admin-muted)", fontSize: "0.82rem", marginTop: 0 }}>
        Recalculez les positions basé sur les métriques réelles. Formule : (plays × coeff) + (likes × coeff) + (reposts × coeff).
      </p>

      {/* Coefficient inputs */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
          <span>Plays ×</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={coefficients.plays}
            onChange={(e) => setCoefficients((c) => ({ ...c, plays: parseFloat(e.target.value) || 0 }))}
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
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
          <span>Likes ×</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={coefficients.likes}
            onChange={(e) => setCoefficients((c) => ({ ...c, likes: parseFloat(e.target.value) || 0 }))}
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
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
          <span>Reposts ×</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={coefficients.reposts}
            onChange={(e) => setCoefficients((c) => ({ ...c, reposts: parseFloat(e.target.value) || 0 }))}
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
        </label>
      </div>

      <div className="admin-toolbar">
        <button className="btn btn--primary" onClick={fetchPreview} disabled={busy}>
          {busy ? "⟳ Calcul…" : "Recalculer par stats"}
        </button>
        {preview && preview.length > 0 && (
          <>
            <button className="btn btn--ok" onClick={applyReclassification} disabled={busy}>
              ✓ Appliquer
            </button>
            <button className="btn btn--ghost" onClick={rejectReclassification} disabled={busy}>
              ✕ Rejeter
            </button>
          </>
        )}
      </div>

      {/* Before/after preview table */}
      {preview && preview.length > 0 && (
        <div style={{ marginTop: "1rem", overflowX: "auto" }}>
          <table className="t20" style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th>Pos. originale</th>
                <th>Titre</th>
                <th>Artiste</th>
                <th>Score Stats</th>
                <th>Nouvelle pos.</th>
                <th>Évolution</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((entry) => (
                <tr key={entry.entryId} style={{ opacity: entry.hasStats ? 1 : 0.6 }}>
                  <td style={{ fontFamily: "monospace" }}>#{entry.originalPosition}</td>
                  <td>{entry.trackTitle}</td>
                  <td>{entry.artistName}</td>
                  <td style={{ fontFamily: "monospace" }}>
                    {entry.hasStats ? entry.scoreStats.toLocaleString("fr-FR") : "—"}
                  </td>
                  <td style={{ fontWeight: 700, fontFamily: "monospace" }}>#{entry.newPosition}</td>
                  <td>
                    {entry.positionChange > 0 && (
                      <span style={{ color: "var(--admin-ok)" }}>▲ {entry.positionChange}</span>
                    )}
                    {entry.positionChange < 0 && (
                      <span style={{ color: "var(--admin-warn)" }}>▼ {Math.abs(entry.positionChange)}</span>
                    )}
                    {entry.positionChange === 0 && (
                      <span style={{ color: "var(--admin-muted)" }}>▬ 0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && preview.length === 0 && (
        <div className="banner" style={{ marginTop: "0.75rem" }}>
          Aucune entrée avec statistiques disponible pour le reclassement.
        </div>
      )}

      {toast && (
        <div className={toast.error ? "toast toast--error" : "toast"} style={{ marginTop: "0.5rem" }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
