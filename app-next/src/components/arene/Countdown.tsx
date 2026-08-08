"use client";

/**
 * Countdown — Compte à rebours affichant le temps restant.
 * Export standalone réutilisable (composant défini à l'origine dans BattleCard).
 *
 * - Affiche jours/heures/minutes/secondes
 * - Déclenche onExpired quand le temps est écoulé
 * - Met à jour chaque seconde via setInterval
 *
 * Requirements: 5.2, 5.5, 5.6
 */

import { useEffect, useRef, useState } from "react";
import styles from "./Countdown.module.css";

export interface CountdownProps {
  endsAt: string;
  onExpired?: () => void;
}

function computeRemaining(endsAt: string) {
  const endMs = new Date(endsAt).getTime();
  const nowMs = Date.now();
  const diff = endMs - nowMs;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds, expired: false };
}

export function Countdown({ endsAt, onExpired }: CountdownProps) {
  const [remaining, setRemaining] = useState(() => computeRemaining(endsAt));

  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  const hasExpiredRef = useRef(false);

  useEffect(() => {
    function tick() {
      const r = computeRemaining(endsAt);
      setRemaining(r);

      if (r.expired && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpiredRef.current?.();
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (remaining.expired) {
    return (
      <div className={styles.countdown} role="timer" aria-label="Temps restant">
        <span className={styles.countdownExpired}>Terminée</span>
      </div>
    );
  }

  return (
    <div className={styles.countdown} role="timer" aria-label="Temps restant">
      {remaining.days > 0 && (
        <span className={styles.countdownSegment}>
          <span className={styles.countdownValue}>{remaining.days}</span>
          <span className={styles.countdownUnit}>j</span>
        </span>
      )}
      <span className={styles.countdownSegment}>
        <span className={styles.countdownValue}>
          {String(remaining.hours).padStart(2, "0")}
        </span>
        <span className={styles.countdownUnit}>h</span>
      </span>
      <span className={styles.countdownSegment}>
        <span className={styles.countdownValue}>
          {String(remaining.minutes).padStart(2, "0")}
        </span>
        <span className={styles.countdownUnit}>min</span>
      </span>
      <span className={styles.countdownSegment}>
        <span className={styles.countdownValue}>
          {String(remaining.seconds).padStart(2, "0")}
        </span>
        <span className={styles.countdownUnit}>s</span>
      </span>
    </div>
  );
}
