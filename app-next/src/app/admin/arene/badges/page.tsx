"use client";

import { useEffect, useState, useCallback } from "react";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  badge_type: string;
  is_special: boolean;
  created_at: string;
}

const BADGE_TYPE_LABELS: Record<string, string> = {
  first_comment: "Premier commentaire",
  first_vote: "Premier vote",
  "10_battles": "10 battles",
  "50_reactions": "50 réactions",
  "7_days_streak": "7 jours consécutifs",
  challenge_complete: "Défi complété",
  level_up: "Niveau supérieur",
  special: "Spécial",
};

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIconUrl, setFormIconUrl] = useState("");
  const [formCondition, setFormCondition] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBadges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/arene/badges");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur de chargement");
      }
      const data = await res.json();
      setBadges(data.badges ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/admin/arene/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formCondition || formDescription,
          icon_url: formIconUrl,
          badge_type: "special",
          is_special: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur lors de la création");
      }

      // Reset form and refresh list
      setFormName("");
      setFormDescription("");
      setFormIconUrl("");
      setFormCondition("");
      setShowForm(false);
      fetchBadges();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  const standardBadges = badges.filter((b) => !b.is_special);
  const specialBadges = badges.filter((b) => b.is_special);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 className="admin__title">Badges</h1>
          <p className="admin__subtitle">
            {badges.length} badge{badges.length > 1 ? "s" : ""} — {standardBadges.length} standard{standardBadges.length > 1 ? "s" : ""}, {specialBadges.length} spéci{specialBadges.length > 1 ? "aux" : "al"}
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Annuler" : "+ Badge spécial"}
        </button>
      </div>

      {showForm && (
        <div className="admin-card" style={{ marginBottom: "1.25rem" }}>
          <h2 className="admin-card__title">Créer un badge spécial</h2>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="badge-name">Nom (3–50 car.)</label>
              <input
                id="badge-name"
                type="text"
                minLength={3}
                maxLength={50}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="badge-icon">URL de l&apos;icône</label>
              <input
                id="badge-icon"
                type="url"
                value={formIconUrl}
                onChange={(e) => setFormIconUrl(e.target.value)}
                placeholder="https://..."
                required
              />
            </div>
            <div className="field">
              <label htmlFor="badge-condition">Condition d&apos;attribution (10–200 car.)</label>
              <input
                id="badge-condition"
                type="text"
                minLength={10}
                maxLength={200}
                value={formCondition}
                onChange={(e) => setFormCondition(e.target.value)}
                placeholder="Ex: Avoir participé à l'événement spécial du 14 juillet"
                required
              />
            </div>
            {formError && <p className="error-text">{formError}</p>}
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? "Création..." : "Créer le badge"}
            </button>
          </form>
        </div>
      )}

      {loading && <p style={{ color: "var(--admin-muted)" }}>Chargement...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && badges.length === 0 && (
        <p style={{ color: "var(--admin-muted)", textAlign: "center", padding: "2rem" }}>
          Aucun badge trouvé.
        </p>
      )}

      {!loading && standardBadges.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Badges standard</h2>
          <div className="entry-list">
            {standardBadges.map((badge) => (
              <div key={badge.id} className="admin-card" style={{ padding: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.5rem" }}>
                    {badge.icon_url.startsWith("http") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={badge.icon_url} alt={badge.name} style={{ width: 32, height: 32, borderRadius: "6px" }} />
                    ) : (
                      badge.icon_url || "🏅"
                    )}
                  </span>
                  <div style={{ flex: 1 }}>
                    <strong>{badge.name}</strong>
                    <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", margin: "0.15rem 0 0" }}>
                      {badge.description}
                    </p>
                  </div>
                  <span className="badge badge--muted">
                    {BADGE_TYPE_LABELS[badge.badge_type] ?? badge.badge_type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && specialBadges.length > 0 && (
        <div>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Badges spéciaux</h2>
          <div className="entry-list">
            {specialBadges.map((badge) => (
              <div key={badge.id} className="admin-card" style={{ padding: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.5rem" }}>
                    {badge.icon_url.startsWith("http") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={badge.icon_url} alt={badge.name} style={{ width: 32, height: 32, borderRadius: "6px" }} />
                    ) : (
                      badge.icon_url || "⭐"
                    )}
                  </span>
                  <div style={{ flex: 1 }}>
                    <strong>{badge.name}</strong>
                    <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", margin: "0.15rem 0 0" }}>
                      {badge.description}
                    </p>
                  </div>
                  <span className="badge badge--warn">Spécial</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
