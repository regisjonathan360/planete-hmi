"use client";

/**
 * DefiCard — Carte de défi communautaire.
 * Affiche : titre, description, barre de progression, type, récompense,
 * nombre de participants et temps restant.
 *
 * Requirements: 6.1, 6.3, 6.5
 */

import styles from "./DefiCard.module.css";

// --- Types ---

export interface ChallengeData {
  id: string;
  title: string;
  description?: string;
  challenge_type: string;
  target_count: number;
  reward_points: number;
  participant_count: number;
  ends_at: string;
  status: string;
}

export interface DefiCardProps {
  challenge: ChallengeData;
  userProgress: number;
  isAuthenticated: boolean;
}

// --- Type labels ---

const TYPE_LABELS: Record<string, string> = {
  vote_battles: "Votes",
  comment_songs: "Commentaires",
  react_contents: "Réactions",
  consecutive_days: "Jours consécutifs",
};

// --- Helpers ---

function formatTimeRemaining(endsAt: string): string {
  const endMs = new Date(endsAt).getTime();
  const nowMs = Date.now();
  const diff = endMs - nowMs;

  if (diff <= 0) return "Expiré";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return `${days}j ${remainingHours}h restant${days > 1 ? "s" : ""}`;
  }
  return `${hours}h restante${hours > 1 ? "s" : ""}`;
}

// --- Component ---

export function DefiCard({ challenge, userProgress, isAuthenticated }: DefiCardProps) {
  const progress = Math.min(userProgress, challenge.target_count);
  const isComplete = progress >= challenge.target_count;
  const progressPercent = challenge.target_count > 0
    ? Math.round((progress / challenge.target_count) * 100)
    : 0;

  const typeLabel = TYPE_LABELS[challenge.challenge_type] ?? challenge.challenge_type;

  return (
    <article className={styles.card} aria-label={`Défi : ${challenge.title}`}>
      {/* Header: title + type badge */}
      <div className={styles.header}>
        <h3 className={styles.title}>{challenge.title}</h3>
        <span className={styles.typeLabel}>{typeLabel}</span>
      </div>

      {/* Description */}
      {challenge.description && (
        <p className={styles.description}>{challenge.description}</p>
      )}

      {/* Progress bar (only shown for authenticated users) */}
      {isAuthenticated && (
        <div className={styles.progressWrapper}>
          <div className={styles.progressBar}>
            <div
              className={`${styles.progressFill}${isComplete ? ` ${styles.progressFillComplete}` : ""}`}
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={challenge.target_count}
              aria-label={`Progression du défi : ${progress} sur ${challenge.target_count}`}
            />
          </div>
          <span className={styles.progressText}>
            {isComplete
              ? `✓ Complété (${progress}/${challenge.target_count})`
              : `${progress} / ${challenge.target_count}`}
          </span>
        </div>
      )}

      {/* Meta information */}
      <div className={styles.meta}>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon} aria-hidden="true">🎯</span>
          <span className={styles.reward}>+{challenge.reward_points} pts</span>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon} aria-hidden="true">👥</span>
          {challenge.participant_count} participant{challenge.participant_count !== 1 ? "s" : ""}
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon} aria-hidden="true">⏰</span>
          {formatTimeRemaining(challenge.ends_at)}
        </span>
      </div>
    </article>
  );
}
