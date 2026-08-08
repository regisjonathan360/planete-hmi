"use client";

import { useEffect, useState, useCallback } from "react";

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  challenge_type: string;
  target_count: number;
  reward_points: number;
  status: "draft" | "active" | "ended";
  starts_at: string;
  ends_at: string;
  participant_count: number;
  created_at: string;
}

const CHALLENGE_TYPES = [
  { value: "vote_battles", label: "Voter dans N battles" },
  { value: "comment_songs", label: "Commenter N chansons" },
  { value: "react_contents", label: "Réagir à N contenus" },
  { value: "consecutive_days", label: "Participer N jours consécutifs" },
];

export default function AdminDefisPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState("vote_battles");
  const [formTargetCount, setFormTargetCount] = useState(5);
  const [formRewardPoints, setFormRewardPoints] = useState(50);
  const [formDurationDays, setFormDurationDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/arene/challenges?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur de chargement");
      }
      const data = await res.json();
      setChallenges(data.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + formDurationDays);

      const res = await fetch("/api/admin/arene/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription || undefined,
          challenge_type: formType,
          target_count: formTargetCount,
          reward_points: formRewardPoints,
          ends_at: endsAt.toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur lors de la création");
      }

      // Reset form and refresh list
      setFormTitle("");
      setFormDescription("");
      setFormTargetCount(5);
      setFormRewardPoints(50);
      setFormDurationDays(7);
      setShowForm(false);
      fetchChallenges();
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
      case "draft": return "badge badge--warn";
      default: return "badge";
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "active": return "Actif";
      case "ended": return "Terminé";
      case "draft": return "Brouillon";
      default: return status;
    }
  }

  function getTypeLabel(type: string) {
    return CHALLENGE_TYPES.find((t) => t.value === type)?.label ?? type;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 className="admin__title">Défis communautaires</h1>
          <p className="admin__subtitle">Gérer les défis temporaires de l&apos;arène</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Annuler" : "+ Nouveau défi"}
        </button>
      </div>

      {showForm && (
        <div className="admin-card" style={{ marginBottom: "1.25rem" }}>
          <h2 className="admin-card__title">Créer un défi</h2>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="defi-title">Titre (max 100 car.)</label>
              <input
                id="defi-title"
                type="text"
                maxLength={100}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="defi-desc">Description (optionnel, max 500 car.)</label>
              <input
                id="defi-desc"
                type="text"
                maxLength={500}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="field">
                <label htmlFor="defi-type">Type de défi</label>
                <select
                  id="defi-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", color: "var(--admin-text)", padding: "0.55rem 0.7rem", borderRadius: "8px" }}
                >
                  {CHALLENGE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="defi-target">Objectif (1–100)</label>
                <input
                  id="defi-target"
                  type="number"
                  min={1}
                  max={100}
                  value={formTargetCount}
                  onChange={(e) => setFormTargetCount(Number(e.target.value))}
                  required
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="field">
                <label htmlFor="defi-reward">Récompense (1–10 000 pts)</label>
                <input
                  id="defi-reward"
                  type="number"
                  min={1}
                  max={10000}
                  value={formRewardPoints}
                  onChange={(e) => setFormRewardPoints(Number(e.target.value))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="defi-duration">Durée (jours)</label>
                <input
                  id="defi-duration"
                  type="number"
                  min={1}
                  max={30}
                  value={formDurationDays}
                  onChange={(e) => setFormDurationDays(Number(e.target.value))}
                  required
                />
              </div>
            </div>
            {formError && <p className="error-text">{formError}</p>}
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? "Création..." : "Créer le défi"}
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
          <option value="active">Actifs</option>
          <option value="ended">Terminés</option>
          <option value="draft">Brouillons</option>
        </select>
      </div>

      {loading && <p style={{ color: "var(--admin-muted)" }}>Chargement...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && challenges.length === 0 && (
        <p style={{ color: "var(--admin-muted)", textAlign: "center", padding: "2rem" }}>
          Aucun défi trouvé.
        </p>
      )}

      {!loading && challenges.length > 0 && (
        <div className="entry-list">
          {challenges.map((challenge) => (
            <div key={challenge.id} className="admin-card" style={{ padding: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                <div>
                  <strong>{challenge.title}</strong>
                  {challenge.description && (
                    <p style={{ color: "var(--admin-muted)", fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
                      {challenge.description}
                    </p>
                  )}
                </div>
                <span className={getStatusBadgeClass(challenge.status)}>
                  {getStatusLabel(challenge.status)}
                </span>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.6rem", fontSize: "0.82rem", color: "var(--admin-muted)" }}>
                <span>{getTypeLabel(challenge.challenge_type)}</span>
                <span>Objectif : {challenge.target_count}</span>
                <span>Récompense : {challenge.reward_points} pts</span>
                <span>Participants : {challenge.participant_count}</span>
                <span>Fin : {new Date(challenge.ends_at).toLocaleDateString("fr-FR")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
