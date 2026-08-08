"use client";

import { useCallback, useEffect, useState } from "react";
import { NiveauBadge } from "./NiveauBadge";
import { ReactionPicker, type ReactionSummary } from "./ReactionPicker";
import { formatRelativeDate } from "@/lib/arene/date-utils";
import type { Niveau } from "@/lib/arene/levels";
import type { PaginationMeta } from "@/lib/arene/pagination";
import styles from "./CommentList.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportReason = "insulte" | "spam" | "discours_haineux" | "autre";

export interface CommentData {
  id: string;
  member_id: string;
  thread_type: string;
  thread_id: string;
  body: string;
  status: string;
  created_at: string;
  community_profiles: {
    pseudo: string;
    niveau: Niveau;
    avatar_url: string | null;
  };
  reactions?: ReactionSummary[];
  userReactions?: string[];
}

export interface CommentListProps {
  threadType: "song" | "battle" | "challenge" | "free";
  threadId: string;
  currentUserId?: string | null;
  isAuthenticated?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "insulte", label: "Insulte" },
  { value: "spam", label: "Spam" },
  { value: "discours_haineux", label: "Discours haineux" },
  { value: "autre", label: "Autre" },
];

// ---------------------------------------------------------------------------
// CommentList
// ---------------------------------------------------------------------------

export function CommentList({
  threadType,
  threadId,
  currentUserId,
  isAuthenticated = false,
}: CommentListProps) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchComments = useCallback(
    async (pageNum: number, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({
          threadType,
          threadId,
          page: String(pageNum),
        });

        const res = await fetch(`/api/arene/comments?${params}`);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error?.message ?? "Erreur de chargement");
        }

        const data = await res.json();

        if (append) {
          setComments((prev) => [...prev, ...data.comments]);
        } else {
          setComments(data.comments);
        }
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [threadType, threadId]
  );

  useEffect(() => {
    fetchComments(1);
  }, [fetchComments]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchComments(nextPage, true);
  };

  const handleCommentDeleted = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  if (loading) {
    return (
      <div className={styles.loading} role="status" aria-label="Chargement des commentaires">
        <span className={styles.spinner} aria-hidden="true" />
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error} role="alert">
        {error}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className={styles.empty}>
        Aucun commentaire pour le moment. Soyez le premier à commenter !
      </div>
    );
  }

  return (
    <div className={styles.commentList}>
      <ul className={styles.list} aria-label="Commentaires">
        {comments.map((comment) => (
          <li key={comment.id}>
            <CommentItem
              comment={comment}
              isAuthor={currentUserId === comment.member_id}
              isAuthenticated={isAuthenticated}
              onDeleted={() => handleCommentDeleted(comment.id)}
            />
          </li>
        ))}
      </ul>

      {pagination?.hasNextPage && (
        <div className={styles.loadMoreContainer}>
          <button
            type="button"
            className={styles.loadMoreBtn}
            onClick={handleLoadMore}
            disabled={loadingMore}
            aria-label="Charger plus de commentaires"
          >
            {loadingMore ? "Chargement…" : "Voir plus"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommentItem
// ---------------------------------------------------------------------------

interface CommentItemProps {
  comment: CommentData;
  isAuthor: boolean;
  isAuthenticated: boolean;
  onDeleted: () => void;
}

function CommentItem({ comment, isAuthor, isAuthenticated, onDeleted }: CommentItemProps) {
  const [showReportPicker, setShowReportPicker] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { pseudo, niveau } = comment.community_profiles;

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/arene/comments/${comment.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Erreur lors de la suppression");
      }

      onDeleted();
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const handleReport = async (reason: ReportReason) => {
    setReportSubmitting(true);
    setReportError(null);

    try {
      const res = await fetch("/api/arene/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId: comment.id,
          reason,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Erreur lors du signalement");
      }

      setReportSuccess(true);
      setShowReportPicker(false);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <article className={styles.commentItem} aria-label={`Commentaire de ${pseudo}`}>
      {/* Header: pseudo + niveau + date */}
      <div className={styles.commentHeader}>
        <div className={styles.authorInfo}>
          <span className={styles.pseudo}>{pseudo}</span>
          <NiveauBadge niveau={niveau} size="sm" />
        </div>
        <time
          className={styles.date}
          dateTime={comment.created_at}
          title={new Date(comment.created_at).toLocaleString("fr-FR")}
        >
          {formatRelativeDate(comment.created_at)}
        </time>
      </div>

      {/* Body */}
      <p className={styles.commentBody}>{comment.body}</p>

      {/* Footer: reactions + actions */}
      <div className={styles.commentFooter}>
        <ReactionPicker
          contentType="comment"
          contentId={comment.id}
          currentReactions={comment.reactions ?? []}
          userReactions={comment.userReactions ?? []}
          disabled={!isAuthenticated}
        />

        <div className={styles.actions}>
          {/* Delete button — only for own comments */}
          {isAuthor && (
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={handleDelete}
              disabled={deleting}
              aria-label={deleteConfirm ? "Confirmer la suppression" : "Supprimer le commentaire"}
              title={deleteConfirm ? "Cliquez pour confirmer" : "Supprimer"}
            >
              {deleting
                ? "…"
                : deleteConfirm
                  ? "Confirmer ?"
                  : "Supprimer"}
            </button>
          )}

          {/* Report button — for authenticated users (not own comments) */}
          {isAuthenticated && !isAuthor && !reportSuccess && (
            <button
              type="button"
              className={styles.reportBtn}
              onClick={() => setShowReportPicker(!showReportPicker)}
              aria-expanded={showReportPicker}
              aria-label="Signaler le commentaire"
              title="Signaler"
            >
              Signaler
            </button>
          )}

          {reportSuccess && (
            <span className={styles.reportSuccessMsg} aria-live="polite">
              Signalé ✓
            </span>
          )}
        </div>
      </div>

      {/* Report reason picker dropdown */}
      {showReportPicker && (
        <div className={styles.reportPicker} role="dialog" aria-label="Choisir un motif de signalement">
          <p className={styles.reportPickerTitle}>Motif du signalement :</p>
          <div className={styles.reportReasons}>
            {REPORT_REASONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={styles.reasonBtn}
                onClick={() => handleReport(value)}
                disabled={reportSubmitting}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => setShowReportPicker(false)}
            aria-label="Annuler le signalement"
          >
            Annuler
          </button>
        </div>
      )}

      {/* Error message */}
      {reportError && (
        <p className={styles.errorMsg} role="alert">
          {reportError}
        </p>
      )}
    </article>
  );
}
