"use client";

import type { Niveau } from "@/lib/arene/levels";
import styles from "./NiveauBadge.module.css";

export interface NiveauBadgeProps {
  niveau: Niveau;
  size?: "sm" | "md" | "lg";
}

/** Emoji et label localisé pour chaque niveau cosmique. */
const NIVEAU_META: Record<Niveau, { emoji: string; label: string }> = {
  etoile: { emoji: "⭐", label: "Étoile" },
  constellation: { emoji: "✨", label: "Constellation" },
  nebuleuse: { emoji: "🌀", label: "Nébuleuse" },
  galaxie: { emoji: "🌌", label: "Galaxie" },
  univers: { emoji: "🌠", label: "Univers" },
};

/**
 * Badge visuel du niveau cosmique d'un membre.
 * Utilisé dans le classement, les commentaires et le mur d'activité.
 *
 * Tailles :
 * - sm : texte seul (label du niveau)
 * - md : emoji + texte
 * - lg : emoji + texte + bordure lumineuse (glow)
 */
export function NiveauBadge({ niveau, size = "md" }: NiveauBadgeProps) {
  const { emoji, label } = NIVEAU_META[niveau];

  const className = [
    styles.badge,
    styles[size],
    styles[niveau],
  ].join(" ");

  return (
    <span className={className} aria-label={`Niveau ${label}`}>
      {size !== "sm" && (
        <span className={styles.emoji} aria-hidden="true">
          {emoji}
        </span>
      )}
      <span className={styles.label}>{label}</span>
    </span>
  );
}
