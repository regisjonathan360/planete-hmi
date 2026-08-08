"use client";

/**
 * VoteProgressBar — Barre de progression animée montrant la répartition des votes.
 * Export standalone réutilisable (composant défini à l'origine dans BattleCard).
 *
 * - Affiche le pourcentage de chaque côté avec une barre bi-colorée
 * - Labels avec nombre de votes et pourcentages
 * - Ratios de contraste WCAG AA
 *
 * Requirements: 5.2, 11.4
 */

import styles from "./VoteProgressBar.module.css";

export interface VoteProgressBarProps {
  votesA: number;
  votesB: number;
  animated?: boolean;
}

export function VoteProgressBar({ votesA, votesB, animated = true }: VoteProgressBarProps) {
  const total = votesA + votesB;
  const percentA = total === 0 ? 50 : Math.round((votesA / total) * 100);
  const percentB = total === 0 ? 50 : 100 - percentA;

  return (
    <div className={styles.progressContainer} role="meter" aria-label="Progression des votes">
      <div className={styles.progressBar}>
        <div
          className={`${styles.progressFillA}${animated ? ` ${styles.animated}` : ""}`}
          style={{ width: `${percentA}%` }}
          aria-hidden="true"
        />
        <div
          className={`${styles.progressFillB}${animated ? ` ${styles.animated}` : ""}`}
          style={{ width: `${percentB}%` }}
          aria-hidden="true"
        />
      </div>
      <div className={styles.progressLabels}>
        <span className={styles.progressLabelA}>
          {votesA} vote{votesA !== 1 ? "s" : ""} ({percentA}%)
        </span>
        <span className={styles.progressLabelB}>
          {votesB} vote{votesB !== 1 ? "s" : ""} ({percentB}%)
        </span>
      </div>
    </div>
  );
}
