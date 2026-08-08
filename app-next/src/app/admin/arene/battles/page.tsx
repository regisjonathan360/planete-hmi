"use client";

import { useEffect, useState, useCallback } from "react";

interface Battle {
  id: string;
  title: string;
  description: string | null;
  side_a_label: string;
  side_a_type: string;
  side_b_label: string;
  side_b_type: string;
  votes_a: number;
  votes_b: number;
  status: "active" | "ended" | "cancelled";
  duration_hours: number;
  starts_at: string;
  ends_at: string;
  winner: string | null;
  created_at: string;
}

export default function AdminBattlesPage() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSideALabel, setFormSideALabel] = useState("");
  const [formSideAType, setFormSideAType] = useState<"artist" | "song">("artist");
  const [formSideBLabel, setFormSideBLabel] = useState("");
  const [formSideBType, setFormSideBType] = useState<"artist" | "song">("artist");
  const [formDuration, setFormDuration] = useState<24 | 48 | 72>(24);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBattles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/arene/battles?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur de chargement");
      }
      const data = await res.json();
      setBattles(data.battles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBattles();
  }, [fetchBattles]);

  // Search state for sides
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [resultsA, setResultsA] = useState<Array<{ id: string; name?: string; title?: string; artistName?: string; imageUrl?: string; artworkUrl?: string; type: string }>>([]);
  const [resultsB, setResultsB] = useState<Array<{ id: string; name?: string; title?: string; artistName?: string; imageUrl?: string; artworkUrl?: string; type: string }>>([]);
  const [selectedA, setSelectedA] = useState<{ id: string; label: string; type: "artist" | "song"; imageUrl: string | null } | null>(null);
  const [selectedB, setSelectedB] = useState<{ id: string; label: string; type: "artist" | "song"; imageUrl: string | null } | null>(null);

  // Search handler
  async function searchSide(query: string, side: "a" | "b") {
    if (query.length < 2) {
      if (side === "a") setResultsA([]);
      else setResultsB([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/arene/battles/search?q=${encodeURIComponent(query)}&type=all`);
      if (!res.ok) return;
      const data = await res.json();
      const combined = [...(data.artists ?? []), ...(data.tracks ?? [])];
      if (side === "a") setResultsA(combined);
      else setResultsB(combined);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const timer = setTimeout(() => searchSide(searchA, "a"), 300);
    return () => clearTimeout(timer);
  }, [searchA]);

  useEffect(() => {
    const timer = setTimeout(() => searchSide(searchB, "b"), 300);
    return () => clearTimeout(timer);
  }, [searchB]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedA || !selectedB) {
      setFormError("Sélectionnez un artiste ou une chanson pour chaque côté.");
      return;
    }
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/admin/arene/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle || `${selectedA.label} vs ${selectedB.label}`,
          description: formDescription || undefined,
          side_a_type: selectedA.type,
          side_a_id: selectedA.id,
          side_a_label: selectedA.label,
          side_b_type: selectedB.type,
          side_b_id: selectedB.id,
          side_b_label: selectedB.label,
          duration_hours: formDuration,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur lors de la création");
      }

      setFormTitle("");
      setFormDescription("");
      setSelectedA(null);
      setSelectedB(null);
      setSearchA("");
      setSearchB("");
      setShowForm(false);
      fetchBattles();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case "active": return "badge badge--ok";
      case "ended": return "badge badge--muted";
      case "cancelled": return "badge badge--danger";
      default: return "badge";
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "active": return "Active";
      case "ended": return "Terminée";
      case "cancelled": return "Annulée";
      default: return status;
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 className="admin__title">Battles</h1>
          <p className="admin__subtitle">Gérer les battles communautaires de l&apos;arène</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Annuler" : "+ Nouvelle battle"}
        </button>
      </div>

      {showForm && (
        <div className="admin-card" style={{ marginBottom: "1.25rem" }}>
          <h2 className="admin-card__title">Créer une battle</h2>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="battle-title">Titre (optionnel — généré auto si vide)</label>
              <input
                id="battle-title"
                type="text"
                maxLength={100}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Rutshelle vs Kai — laissez vide pour auto-générer"
              />
            </div>
            <div className="field">
              <label htmlFor="battle-desc">Description (optionnel)</label>
              <input
                id="battle-desc"
                type="text"
                maxLength={500}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            {/* Sélecteur côté A et B */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              {/* Côté A */}
              <div>
                <label style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.4rem", display: "block" }}>Côté A — Rechercher</label>
                {selectedA ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem", border: "1px solid var(--admin-accent)", borderRadius: "8px", background: "rgba(101,166,255,0.08)" }}>
                    {selectedA.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedA.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: "6px", objectFit: "cover" }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{selectedA.label}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--admin-muted)" }}>{selectedA.type === "artist" ? "Artiste" : "Chanson"}</div>
                    </div>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => { setSelectedA(null); setSearchA(""); }}>✕</button>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={searchA}
                      onChange={(e) => setSearchA(e.target.value)}
                      placeholder="Tapez un nom d'artiste ou titre..."
                      style={{ width: "100%" }}
                    />
                    {resultsA.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "var(--admin-panel-2, #1a1a2e)", border: "1px solid var(--admin-border)", borderRadius: "8px", maxHeight: "200px", overflowY: "auto", marginTop: "4px" }}>
                        {resultsA.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setSelectedA({
                                id: r.id,
                                label: r.name ?? r.title ?? "Sans nom",
                                type: r.type as "artist" | "song",
                                imageUrl: r.imageUrl ?? r.artworkUrl ?? null,
                              });
                              setResultsA([]);
                              setSearchA("");
                            }}
                            style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.5rem 0.7rem", border: "none", borderBottom: "1px solid var(--admin-border)", background: "transparent", color: "inherit", cursor: "pointer", textAlign: "left" }}
                          >
                            {(r.imageUrl || r.artworkUrl) && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.imageUrl ?? r.artworkUrl ?? ""} alt="" style={{ width: 32, height: 32, borderRadius: "4px", objectFit: "cover" }} />
                            )}
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{r.name ?? r.title}</div>
                              <div style={{ fontSize: "0.7rem", color: "var(--admin-muted)" }}>
                                {r.type === "artist" ? "Artiste" : `${r.artistName ?? ""} — Chanson`}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Côté B */}
              <div>
                <label style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.4rem", display: "block" }}>Côté B — Rechercher</label>
                {selectedB ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem", border: "1px solid var(--admin-accent)", borderRadius: "8px", background: "rgba(101,166,255,0.08)" }}>
                    {selectedB.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedB.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: "6px", objectFit: "cover" }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{selectedB.label}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--admin-muted)" }}>{selectedB.type === "artist" ? "Artiste" : "Chanson"}</div>
                    </div>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => { setSelectedB(null); setSearchB(""); }}>✕</button>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={searchB}
                      onChange={(e) => setSearchB(e.target.value)}
                      placeholder="Tapez un nom d'artiste ou titre..."
                      style={{ width: "100%" }}
                    />
                    {resultsB.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "var(--admin-panel-2, #1a1a2e)", border: "1px solid var(--admin-border)", borderRadius: "8px", maxHeight: "200px", overflowY: "auto", marginTop: "4px" }}>
                        {resultsB.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setSelectedB({
                                id: r.id,
                                label: r.name ?? r.title ?? "Sans nom",
                                type: r.type as "artist" | "song",
                                imageUrl: r.imageUrl ?? r.artworkUrl ?? null,
                              });
                              setResultsB([]);
                              setSearchB("");
                            }}
                            style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.5rem 0.7rem", border: "none", borderBottom: "1px solid var(--admin-border)", background: "transparent", color: "inherit", cursor: "pointer", textAlign: "left" }}
                          >
                            {(r.imageUrl || r.artworkUrl) && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.imageUrl ?? r.artworkUrl ?? ""} alt="" style={{ width: 32, height: 32, borderRadius: "4px", objectFit: "cover" }} />
                            )}
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{r.name ?? r.title}</div>
                              <div style={{ fontSize: "0.7rem", color: "var(--admin-muted)" }}>
                                {r.type === "artist" ? "Artiste" : `${r.artistName ?? ""} — Chanson`}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="field">
              <label htmlFor="battle-duration">Durée</label>
              <select
                id="battle-duration"
                value={formDuration}
                onChange={(e) => setFormDuration(Number(e.target.value) as 24 | 48 | 72)}
                style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "var(--admin-text)", padding: "0.55rem 0.7rem", borderRadius: "8px" }}
              >
                <option value={24}>24 heures</option>
                <option value={48}>48 heures</option>
                <option value={72}>72 heures</option>
              </select>
            </div>
            {formError && <p className="error-text">{formError}</p>}
            <button type="submit" className="btn btn--primary" disabled={submitting || !selectedA || !selectedB}>
              {submitting ? "Création..." : "Créer la battle"}
            </button>
          </form>
        </div>
      )}

      <div className="admin-toolbar" style={{ marginBottom: "1rem" }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "var(--admin-text)", padding: "0.45rem 0.6rem", borderRadius: "8px", fontSize: "0.85rem" }}
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actives</option>
          <option value="ended">Terminées</option>
          <option value="cancelled">Annulées</option>
        </select>
      </div>

      {loading && <p style={{ color: "var(--admin-muted)" }}>Chargement...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && battles.length === 0 && (
        <p style={{ color: "var(--admin-muted)", textAlign: "center", padding: "2rem" }}>
          Aucune battle trouvée.
        </p>
      )}

      {!loading && battles.length > 0 && (
        <div className="entry-list">
          {battles.map((battle) => (
            <div key={battle.id} className="admin-card" style={{ padding: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                <div>
                  <strong>{battle.title}</strong>
                  {battle.description && (
                    <p style={{ color: "var(--admin-muted)", fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
                      {battle.description}
                    </p>
                  )}
                </div>
                <span className={getStatusBadgeClass(battle.status)}>
                  {getStatusLabel(battle.status)}
                </span>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.6rem", fontSize: "0.82rem", color: "var(--admin-muted)" }}>
                <span>{battle.side_a_label} vs {battle.side_b_label}</span>
                <span>Votes : {battle.votes_a} / {battle.votes_b}</span>
                <span>Durée : {battle.duration_hours}h</span>
                {battle.winner && <span>Gagnant : {battle.winner === "tie" ? "Égalité" : battle.winner === "side_a" ? battle.side_a_label : battle.side_b_label}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
