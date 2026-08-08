"use client";

import { useEffect, useState, useCallback } from "react";

interface ModerationComment {
  id: string;
  member_id: string;
  thread_type: string;
  thread_id: string;
  body: string;
  status: string;
  report_count: number;
  created_at: string;
  community_profiles: {
    pseudo: string;
    niveau: string;
    avatar_url: string | null;
  };
  reports: { reason: string; created_at: string }[];
}

const REASON_LABELS: Record<string, string> = {
  insulte: "Insulte",
  spam: "Spam",
  discours_haineux: "Discours haineux",
  autre: "Autre",
};

export default function AdminModerationPage() {
  const [comments, setComments] = useState<ModerationComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ commentId: string; reason: string } | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/arene/moderation");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur de chargement");
      }
      const data = await res.json();
      setComments(data.comments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  async function handleAction(commentId: string, action: "validate" | "delete" | "restore", reason?: string) {
    setActionLoading(commentId);
    try {
      const res = await fetch(`/api/admin/arene/moderation/${commentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur lors de l'action");
      }

      // Remove the comment from the list
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setDeleteModal(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setActionLoading(null);
    }
  }

  function handleDeleteClick(commentId: string) {
    setDeleteModal({ commentId, reason: "" });
  }

  function handleDeleteConfirm() {
    if (!deleteModal) return;
    handleAction(deleteModal.commentId, "delete", deleteModal.reason || undefined);
  }

  return (
    <div>
      <h1 className="admin__title">Modération</h1>
      <p className="admin__subtitle">
        File de modération — commentaires masqués en attente d&apos;action
      </p>

      {loading && <p style={{ color: "var(--admin-muted)" }}>Chargement...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && comments.length === 0 && (
        <div className="admin-card" style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ color: "var(--admin-muted)" }}>✓ Aucun commentaire en attente de modération</p>
        </div>
      )}

      {!loading && comments.length > 0 && (
        <div className="entry-list">
          {comments.map((comment) => (
            <div key={comment.id} className="admin-card" style={{ padding: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{comment.community_profiles.pseudo}</strong>
                    <span className="badge badge--muted">{comment.community_profiles.niveau}</span>
                  </div>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.88rem", lineHeight: 1.4, wordBreak: "break-word" }}>
                    {comment.body}
                  </p>
                  <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", color: "var(--admin-muted)" }}>
                    <span>📅 {new Date(comment.created_at).toLocaleString("fr-FR")}</span>
                    <span>🚨 {comment.report_count} signalement{comment.report_count > 1 ? "s" : ""}</span>
                    <span>📍 {comment.thread_type}</span>
                  </div>
                  {comment.reports.length > 0 && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.78rem" }}>
                      <span style={{ color: "var(--admin-muted)" }}>Motifs : </span>
                      {comment.reports.map((r, i) => (
                        <span key={i} className="badge badge--warn" style={{ marginRight: "0.3rem" }}>
                          {REASON_LABELS[r.reason] ?? r.reason}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flexShrink: 0 }}>
                  <button
                    className="btn btn--ok btn--sm"
                    disabled={actionLoading === comment.id}
                    onClick={() => handleAction(comment.id, "validate")}
                  >
                    Valider
                  </button>
                  <button
                    className="btn btn--sm"
                    disabled={actionLoading === comment.id}
                    onClick={() => handleAction(comment.id, "restore")}
                  >
                    Restaurer
                  </button>
                  <button
                    className="btn btn--danger btn--sm"
                    disabled={actionLoading === comment.id}
                    onClick={() => handleDeleteClick(comment.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete reason modal */}
      {deleteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "grid",
            placeItems: "center",
            zIndex: 200,
          }}
          onClick={() => setDeleteModal(null)}
        >
          <div
            className="admin-card"
            style={{ maxWidth: "400px", width: "90%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.75rem" }}>Motif de suppression</h3>
            <div className="field">
              <label htmlFor="delete-reason">Raison (sera envoyée à l&apos;auteur)</label>
              <input
                id="delete-reason"
                type="text"
                value={deleteModal.reason}
                onChange={(e) => setDeleteModal({ ...deleteModal, reason: e.target.value })}
                placeholder="Ex: Contenu inapproprié"
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="btn btn--ghost" onClick={() => setDeleteModal(null)}>
                Annuler
              </button>
              <button className="btn btn--danger" onClick={handleDeleteConfirm}>
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
