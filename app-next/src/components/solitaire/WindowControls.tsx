"use client";

import { useSolitaireFullscreen } from "./SolitaireScaleFrame";
import styles from "./window-controls.module.css";

/**
 * Boutons de fenêtre Windows 95 — Réduire / Agrandir–Restaurer / Fermer —
 * partagés par la coquille des modes et le Solitaire 95 classique.
 *
 * Réduire et Agrandir agissent sur le plein écran du cadre du jeu
 * (SolitaireScaleFrame) ; Fermer quitte le solitaire (callback fourni par
 * l'hôte, généralement retour vers l'Arène).
 */
export function WindowControls({ onClose }: { onClose: () => void }) {
  const { enterFullscreen, exitFullscreen, isFullscreen } =
    useSolitaireFullscreen();

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.button}
        onClick={exitFullscreen}
        title="Réduire (quitter le plein écran)"
        aria-label="Réduire"
      >
        <span aria-hidden="true">_</span>
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={isFullscreen ? exitFullscreen : enterFullscreen}
        title={isFullscreen ? "Restaurer (quitter le plein écran)" : "Agrandir (plein écran)"}
        aria-label={isFullscreen ? "Restaurer" : "Agrandir"}
      >
        <span aria-hidden="true">{isFullscreen ? "❐" : "□"}</span>
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonClose}`}
        onClick={onClose}
        title="Fermer et quitter le solitaire"
        aria-label="Fermer"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
