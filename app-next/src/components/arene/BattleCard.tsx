"use client";

/**
 * BattleCard — Carte de battle communautaire affichant deux côtés,
 * une barre de progression des votes, un compte à rebours et les boutons de vote.
 *
 * - Disposition côte à côte (desktop ≥768px), empilée (mobile)
 * - Barre de progression animée en temps réel via Supabase Realtime
 * - Compte à rebours avec callback onExpired
 * - Boutons de vote désactivés si : déjà voté, battle terminée, ou non authentifié
 * - Mise à jour optimiste lors du vote
 *
 * Requirements: 5.2, 5.3, 5.4, 5.5, 11.1, 11.3, 13.1, 13.5
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime } from "./RealtimeProvider";
import styles from "./BattleCard.module.css";

// --- Types ---

export interface BattleData {
  id: string;
  title: string;
  description?: string;
  side_a_label: string;
  side_a_image_url?: string;
  side_b_label: string;
  side_b_image_url?: string;
  votes_a: number;
  votes_b: number;
  ends_at: string;
  status: string;
}

export interface BattleCardProps {
  battle: BattleData;
  userVote: "side_a" | "side_b" | null;
  isAuthenticated: boolean;
}

type VoteSide = "side_a" | "side_b";

// --- Sub-components ---

/** Barre de progression animée montrant la répartition des votes */
function VoteProgressBar({
  votesA,
  votesB,
}: {
  votesA: number;
  votesB: number;
}) {
  const total = votesA + votesB;
  const percentA = total === 0 ? 50 : Math.round((votesA / total) * 100);
  const percentB = total === 0 ? 50 : 100 - percentA;

  return (
    <div className={styles.progressContainer} role="meter" aria-label="Progression des votes">
      <div className={styles.progressBar}>
        <div
          className={styles.progressFillA}
          style={{ width: `${percentA}%` }}
          aria-hidden="true"
        />
        <div
          className={styles.progressFillB}
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

/** Compte à rebours affichant le temps restant */
function Countdown({
  endsAt,
  onExpired,
}: {
  endsAt: string;
  onExpired?: () => void;
}) {
  const [remaining, setRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  }>(() => computeRemaining(endsAt));

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

// --- Main Component ---

export function BattleCard({ battle, userVote, isAuthenticated }: BattleCardProps) {
  const [votesA, setVotesA] = useState(battle.votes_a);
  const [votesB, setVotesB] = useState(battle.votes_b);
  const [currentVote, setCurrentVote] = useState<VoteSide | null>(userVote);
  const [isExpired, setIsExpired] = useState(battle.status === "ended");
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { subscribe } = useRealtime();

  // Keep votes in sync with prop changes (e.g. parent re-fetches)
  useEffect(() => {
    setVotesA(battle.votes_a);
    setVotesB(battle.votes_b);
  }, [battle.votes_a, battle.votes_b]);

  useEffect(() => {
    setCurrentVote(userVote);
  }, [userVote]);

  // --- Realtime subscription for live vote count updates ---
  useEffect(() => {
    const unsub = subscribe(
      `battle_votes_${battle.id}`,
      "battle_votes",
      (payload: unknown) => {
        const record = payload as {
          new?: { side?: string; battle_id?: string };
          eventType?: string;
        };

        // Filter to this battle and handle new votes
        if (
          record.eventType === "INSERT" &&
          record.new?.battle_id === battle.id &&
          record.new?.side
        ) {
          if (record.new.side === "side_a") {
            setVotesA((prev) => prev + 1);
          } else if (record.new.side === "side_b") {
            setVotesB((prev) => prev + 1);
          }
        }
      }
    );

    return unsub;
  }, [battle.id, subscribe]);

  // --- Vote handler ---
  const handleVote = useCallback(
    async (side: VoteSide) => {
      if (!isAuthenticated || currentVote || isExpired || isVoting) return;

      setError(null);
      setIsVoting(true);

      // Optimistic update
      setCurrentVote(side);
      if (side === "side_a") {
        setVotesA((prev) => prev + 1);
      } else {
        setVotesB((prev) => prev + 1);
      }

      try {
        const res = await fetch(`/api/arene/battles/${battle.id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ side }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const message =
            data?.error?.message ?? "Une erreur est survenue lors du vote.";

          // Revert optimistic update
          setCurrentVote(null);
          if (side === "side_a") {
            setVotesA((prev) => prev - 1);
          } else {
            setVotesB((prev) => prev - 1);
          }

          setError(message);
        }
      } catch {
        // Revert optimistic update on network error
        setCurrentVote(null);
        if (side === "side_a") {
          setVotesA((prev) => prev - 1);
        } else {
          setVotesB((prev) => prev - 1);
        }
        setError("Erreur réseau. Veuillez réessayer.");
      } finally {
        setIsVoting(false);
      }
    },
    [isAuthenticated, currentVote, isExpired, isVoting, battle.id]
  );

  // --- Countdown expired handler ---
  const handleExpired = useCallback(() => {
    setIsExpired(true);
  }, []);

  // --- Determine button states ---
  const votingDisabled = !isAuthenticated || !!currentVote || isExpired;

  const getVoteButtonLabel = (side: VoteSide): string => {
    if (currentVote === side) return "Votre choix ✓";
    if (currentVote) return "Déjà voté";
    if (isExpired) return "Battle terminée";
    if (!isAuthenticated) return "Connectez-vous pour voter";
    return "Voter";
  };

  return (
    <article className={styles.battleCard} aria-label={`Battle : ${battle.title}`}>
      {/* Header */}
      <header className={styles.header}>
        <h3 className={styles.title}>{battle.title}</h3>
        {battle.description && (
          <p className={styles.description}>{battle.description}</p>
        )}
        <Countdown endsAt={battle.ends_at} onExpired={handleExpired} />
      </header>

      {/* Sides */}
      <div className={styles.sides}>
        {/* Side A */}
        <div
          className={`${styles.side} ${currentVote === "side_a" ? styles.sideSelected : ""}`}
        >
          {battle.side_a_image_url && (
            <div className={styles.sideImageWrap}>
              <img
                src={battle.side_a_image_url}
                alt={battle.side_a_label}
                className={styles.sideImage}
                loading="lazy"
              />
            </div>
          )}
          <span className={styles.sideLabel}>{battle.side_a_label}</span>
          <button
            type="button"
            className={`${styles.voteBtn} ${styles.voteBtnA} ${currentVote === "side_a" ? styles.voteBtnSelected : ""}`}
            onClick={() => handleVote("side_a")}
            disabled={votingDisabled}
            aria-label={`Voter pour ${battle.side_a_label} — ${getVoteButtonLabel("side_a")}`}
            title={getVoteButtonLabel("side_a")}
          >
            {currentVote === "side_a" ? "✓ Voté" : "Voter"}
          </button>
        </div>

        {/* VS separator */}
        <div className={styles.vs} aria-hidden="true">
          VS
        </div>

        {/* Side B */}
        <div
          className={`${styles.side} ${currentVote === "side_b" ? styles.sideSelected : ""}`}
        >
          {battle.side_b_image_url && (
            <div className={styles.sideImageWrap}>
              <img
                src={battle.side_b_image_url}
                alt={battle.side_b_label}
                className={styles.sideImage}
                loading="lazy"
              />
            </div>
          )}
          <span className={styles.sideLabel}>{battle.side_b_label}</span>
          <button
            type="button"
            className={`${styles.voteBtn} ${styles.voteBtnB} ${currentVote === "side_b" ? styles.voteBtnSelected : ""}`}
            onClick={() => handleVote("side_b")}
            disabled={votingDisabled}
            aria-label={`Voter pour ${battle.side_b_label} — ${getVoteButtonLabel("side_b")}`}
            title={getVoteButtonLabel("side_b")}
          >
            {currentVote === "side_b" ? "✓ Voté" : "Voter"}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <VoteProgressBar votesA={votesA} votesB={votesB} />

      {/* Error message */}
      {error && (
        <p className={styles.error} role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      {/* Auth call to action */}
      {!isAuthenticated && (
        <p className={styles.authHint}>
          <a href="/connexion" className={styles.authLink}>
            Connectez-vous
          </a>{" "}
          pour participer à cette battle.
        </p>
      )}
    </article>
  );
}

// --- Utilities ---

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
