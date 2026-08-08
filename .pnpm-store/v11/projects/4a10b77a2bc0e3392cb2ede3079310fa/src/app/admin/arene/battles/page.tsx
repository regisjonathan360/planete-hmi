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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/admin/arene/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription || undefined,
          side_a_type: formSideAType,
          side_a_id: crypto.randomUUID(), // placeholder — will be real IDs in production
          side_a_label: formSideALabel,
          side_b_type: formSideBType,
          side_b_id: crypto.randomUUID(),
          side_b_label: formSideBLabel,
          duration_hours: formDuration,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur lors de la création");
      }

      // Reset form and refresh list
      setFormTitle("");
      setFormDescription("");
      setFormSideALabel("");
      setFormSideBLabel("");
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
              <label htmlFor="battle-title">Titre (max 100 car.)</label>
              <input
                id="battle-title"
                type="text"
                maxLength={100}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="battle-desc">Description (optionnel, max 500 car.)</label>
              <input
                id="battle-desc"
                type="text"
                maxLength={500}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <div className="field">
                  <label htmlFor="side-a-label">Côté A — Nom</label>
                  <input
                    id="side-a-label"
                    type="text"
                    value={formSideALabel}
                    onChange={(e) => setFormSideALabel(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="side-a-type">Côté A — Type</label>
                  <select
                    id="side-a-type"
                    value={formSideAType}
                    onChange={(e) => setFormSideAType(e.target.value as "artist" | "song")}
                    style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "var(--admin-text)", padding: "0.55rem 0.7rem", borderRadius: "8px" }}
                  >
                    <option value="artist">Artiste</option>
                    <option value="song">Chanson</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="field">
                  <label htmlFor="side-b-label">Côté B — Nom</label>
                  <input
                    id="side-b-label"
                    type="text"
                    value={formSideBLabel}
                    onChange={(e) => setFormSideBLabel(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="side-b-type">Côté B — Type</label>
                  <select
                    id="side-b-type"
                    value={formSideBType}
                    onChange={(e) => setFormSideBType(e.target.value as "artist" | "song")}
                    style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "var(--admin-text)", padding: "0.55rem 0.7rem", borderRadius: "8px" }}
                  >
                    <option value="artist">Artiste</option>
                    <option value="song">Chanson</option>
                  </select>
                </div>
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
            <button type="submit" className="btn btn--primary" disabled={submitting}>
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
