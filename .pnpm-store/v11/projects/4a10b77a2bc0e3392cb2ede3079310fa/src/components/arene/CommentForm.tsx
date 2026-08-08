"use client";

import { useCallback, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import styles from "./CommentForm.module.css";

// --- Types ---

export interface CommentFormProps {
  threadType: "song" | "battle" | "challenge" | "free";
  threadId: string;
  onSubmit?: (comment: { id: string; body: string }) => void;
  disabled?: boolean;
}

// --- Constants ---

const MAX_LENGTH = 500;
const WARNING_THRESHOLD = 450;

// --- Component ---

export function CommentForm({
  threadType,
  threadId,
  onSubmit,
  disabled = false,
}: CommentFormProps) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmedLength = body.trim().length;
  const charCount = body.length;
  const isEmpty = trimmedLength === 0;
  const isOverLimit = charCount > MAX_LENGTH;
  const isDisabled = disabled || isEmpty || isOverLimit || submitting;

  // Counter styling
  const counterClass = [
    styles.counter,
    charCount >= MAX_LENGTH ? styles.over : charCount >= WARNING_THRESHOLD ? styles.warning : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();

      if (isDisabled) return;

      // Client-side validation
      const trimmed = body.trim();
      if (trimmed.length === 0) {
        setError("Le commentaire ne peut pas être vide.");
        return;
      }
      if (trimmed.length > MAX_LENGTH) {
        setError(`Le commentaire ne doit pas dépasser ${MAX_LENGTH} caractères.`);
        return;
      }

      setError(null);
      setSubmitting(true);

      try {
        const res = await fetch("/api/arene/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadType,
            threadId,
            body: trimmed,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const errorData = data?.error;

          if (errorData?.code === "moderated") {
            setError(errorData.message ?? "Votre commentaire enfreint les règles de la communauté. Veuillez reformuler.");
          } else if (errorData?.code === "rate_limited") {
            setError(errorData.message ?? "Veuillez patienter avant de poster un nouveau commentaire.");
          } else if (errorData?.code === "validation_error") {
            setError(errorData.message ?? "Commentaire invalide. Vérifiez la longueur (1-500 caractères).");
          } else {
            setError("Une erreur est survenue. Veuillez réessayer.");
          }
          return;
        }

        const data = await res.json();
        const comment = data.comment;

        // Clear form
        setBody("");
        setError(null);

        // Notify parent
        onSubmit?.({ id: comment.id, body: comment.body });
      } catch {
        setError("Erreur de connexion. Veuillez réessayer.");
      } finally {
        setSubmitting(false);
      }
    },
    [body, isDisabled, threadType, threadId, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit with Ctrl+Enter or Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      aria-label="Formulaire de commentaire"
    >
      <div className={styles.textareaWrapper}>
        <textarea
          ref={textareaRef}
          className={`${styles.textarea}${error ? ` ${styles.error}` : ""}`}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Partagez votre avis avec la communauté…"
          disabled={disabled || submitting}
          aria-label="Contenu du commentaire"
          aria-describedby="comment-counter comment-error"
          aria-invalid={!!error || isOverLimit}
          maxLength={MAX_LENGTH + 50} // Allow slight over-type for UX, validation handles the rest
          rows={3}
        />
      </div>

      {error && (
        <p
          id="comment-error"
          className={styles.errorMessage}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}

      <div className={styles.footer}>
        <span
          id="comment-counter"
          className={counterClass}
          aria-live="polite"
          aria-atomic="true"
        >
          {charCount}/{MAX_LENGTH}
        </span>

        <button
          type="submit"
          className={`${styles.submitBtn}${submitting ? ` ${styles.submitting}` : ""}`}
          disabled={isDisabled}
          aria-label={
            submitting
              ? "Envoi en cours…"
              : isEmpty
                ? "Écrivez un commentaire pour pouvoir l'envoyer"
                : isOverLimit
                  ? "Le commentaire dépasse la limite de caractères"
                  : "Envoyer le commentaire"
          }
        >
          {submitting ? "Envoi…" : "Commenter"}
        </button>
      </div>
    </form>
  );
}
