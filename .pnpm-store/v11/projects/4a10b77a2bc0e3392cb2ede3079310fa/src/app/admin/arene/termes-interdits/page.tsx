"use client";

import { useEffect, useState, useCallback } from "react";

interface BannedTerm {
  id: string;
  term: string;
  created_at: string;
}

const MAX_TERMS = 500;
const MAX_TERM_LENGTH = 100;

export default function AdminTermesInterditsPage() {
  const [terms, setTerms] = useState<BannedTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [newTerm, setNewTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/arene/banned-terms");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur de chargement");
      }
      const data = await res.json();
      setTerms(data.terms ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTerm.trim();
    if (!trimmed) return;

    if (trimmed.length > MAX_TERM_LENGTH) {
      setFormError(`Le terme ne doit pas dépasser ${MAX_TERM_LENGTH} caractères.`);
      return;
    }

    if (terms.length >= MAX_TERMS) {
      setFormError(`Limite atteinte : ${MAX_TERMS} termes maximum.`);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/admin/arene/banned-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur lors de l'ajout");
      }

      setNewTerm("");
      fetchTerms();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(termId: string) {
    setDeleteLoading(termId);
    try {
      const res = await fetch(`/api/admin/arene/banned-terms/${termId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur lors de la suppression");
      }

      setTerms((prev) => prev.filter((t) => t.id !== termId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setDeleteLoading(null);
    }
  }

  return (
    <div>
      <h1 className="admin__title">Termes interdits</h1>
      <p className="admin__subtitle">
        Gérer la liste des termes filtrés automatiquement dans les commentaires et pseudos
      </p>

      {/* Stats */}
      <div className="admin-stats" style={{ marginBottom: "1.25rem" }}>
        <div className="stat">
          <div className="stat__value">{terms.length}</div>
          <div className="stat__label">Termes actifs</div>
        </div>
        <div className="stat">
          <div className="stat__value">{MAX_TERMS - terms.length}</div>
          <div className="stat__label">Places restantes</div>
        </div>
        <div className="stat">
          <div className="stat__value">{MAX_TERMS}</div>
          <div className="stat__label">Limite max</div>
        </div>
      </div>

      {/* Add form */}
      <div className="admin-card" style={{ marginBottom: "1.25rem" }}>
        <h2 className="admin-card__title">Ajouter un terme</h2>
        <form onSubmit={handleAdd} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="new-term">Terme (max {MAX_TERM_LENGTH} car.)</label>
            <input
              id="new-term"
              type="text"
              maxLength={MAX_TERM_LENGTH}
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="Entrer un terme à bannir..."
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || terms.length >= MAX_TERMS}
            style={{ height: "fit-content" }}
          >
            {submitting ? "Ajout..." : "Ajouter"}
          </button>
        </form>
        {formError && <p className="error-text" style={{ marginTop: "0.5rem" }}>{formError}</p>}
        {terms.length >= MAX_TERMS && (
          <p className="error-text" style={{ marginTop: "0.5rem" }}>
            Limite de {MAX_TERMS} termes atteinte. Supprimez un terme avant d&apos;en ajouter un nouveau.
          </p>
        )}
      </div>

      {/* List */}
      {loading && <p style={{ color: "var(--admin-muted)" }}>Chargement...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && terms.length === 0 && (
        <p style={{ color: "var(--admin-muted)", textAlign: "center", padding: "2rem" }}>
          Aucun terme interdit configuré.
        </p>
      )}

      {!loading && terms.length > 0 && (
        <div className="admin-card">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {terms.map((term) => (
              <div
                key={term.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.45rem 0.6rem",
                  background: "var(--admin-panel-2)",
                  borderRadius: "6px",
                }}
              >
                <span style={{ fontSize: "0.88rem", fontFamily: "monospace" }}>{term.term}</span>
                <button
                  className="btn btn--danger btn--sm"
                  disabled={deleteLoading === term.id}
                  onClick={() => handleDelete(term.id)}
                  aria-label={`Supprimer le terme "${term.term}"`}
                >
                  {deleteLoading === term.id ? "..." : "✕"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
