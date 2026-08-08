"use client";

import { useCallback, useOptimistic, useTransition } from "react";
import styles from "./ReactionPicker.module.css";

// --- Types ---

export type ReactionType = "star" | "fire" | "rocket" | "planet" | "magic" | "heart";

export interface ReactionSummary {
  type: string;
  count: number;
}

export interface ReactionPickerProps {
  contentType: "song" | "comment" | "battle";
  contentId: string;
  currentReactions: ReactionSummary[];
  userReactions: string[]; // reaction types already used by the user
  onReact?: (type: string, action: "added" | "removed") => void;
  disabled?: boolean; // true when not authenticated
}

// --- Constants ---

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "star", emoji: "🌟", label: "Brillant" },
  { type: "fire", emoji: "🔥", label: "Feu" },
  { type: "rocket", emoji: "🚀", label: "Décollage" },
  { type: "planet", emoji: "🪐", label: "Planétaire" },
  { type: "magic", emoji: "💫", label: "Magique" },
  { type: "heart", emoji: "❤️", label: "Cœur" },
];

// --- Optimistic state helpers ---

interface OptimisticState {
  reactions: ReactionSummary[];
  userReactions: string[];
}

type OptimisticAction = { type: ReactionType; action: "added" | "removed" };

function optimisticReducer(
  state: OptimisticState,
  { type, action }: OptimisticAction
): OptimisticState {
  if (action === "added") {
    return {
      reactions: state.reactions.map((r) =>
        r.type === type ? { ...r, count: r.count + 1 } : r
      ),
      userReactions: [...state.userReactions, type],
    };
  }
  // removed
  return {
    reactions: state.reactions.map((r) =>
      r.type === type ? { ...r, count: Math.max(0, r.count - 1) } : r
    ),
    userReactions: state.userReactions.filter((t) => t !== type),
  };
}

// --- Component ---

export function ReactionPicker({
  contentType,
  contentId,
  currentReactions,
  userReactions,
  onReact,
  disabled = false,
}: ReactionPickerProps) {
  const [, startTransition] = useTransition();

  // Ensure all 6 reaction types are represented
  const normalizedReactions: ReactionSummary[] = REACTIONS.map(({ type }) => {
    const found = currentReactions.find((r) => r.type === type);
    return found ?? { type, count: 0 };
  });

  const [optimistic, addOptimistic] = useOptimistic<OptimisticState, OptimisticAction>(
    { reactions: normalizedReactions, userReactions },
    optimisticReducer
  );

  const handleClick = useCallback(
    (reactionType: ReactionType) => {
      if (disabled) return;

      const isActive = optimistic.userReactions.includes(reactionType);
      const action: "added" | "removed" = isActive ? "removed" : "added";

      startTransition(async () => {
        // Apply optimistic update
        addOptimistic({ type: reactionType, action });

        try {
          const res = await fetch("/api/arene/reactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contentType,
              contentId,
              reactionType,
            }),
          });

          if (!res.ok) {
            // On error, the optimistic state will revert on next render
            // since the server state won't reflect the change
            return;
          }

          const data = await res.json();
          onReact?.(reactionType, data.action);
        } catch {
          // Network error — optimistic state reverts on next prop update
        }
      });
    },
    [disabled, optimistic.userReactions, contentType, contentId, onReact, addOptimistic]
  );

  return (
    <div className={styles.picker} role="group" aria-label="Réactions">
      {REACTIONS.map(({ type, emoji, label }) => {
        const isActive = optimistic.userReactions.includes(type);
        const count =
          optimistic.reactions.find((r) => r.type === type)?.count ?? 0;

        const classNames = [
          styles.reactionBtn,
          isActive ? styles.active : "",
          disabled ? styles.disabled : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={type}
            type="button"
            className={classNames}
            onClick={() => handleClick(type)}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={`${label}${count > 0 ? ` (${count})` : ""}${disabled ? " — connexion requise" : ""}`}
            title={disabled ? "Connectez-vous pour réagir" : label}
          >
            <span className={styles.emoji} aria-hidden="true">
              {emoji}
            </span>
            {count > 0 && (
              <span className={styles.count}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
