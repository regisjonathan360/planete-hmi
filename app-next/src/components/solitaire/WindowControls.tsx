"use client";

import { useSolitaireFullscreen } from "./SolitaireScaleFrame";
import styles from "./window-controls.module.css";

/**
 * Bouton unique : plein écran / réduire (toggle).
 * Style Win95, cohérent avec la barre de titre.
 */
export function WindowControls() {
  const { enterFullscreen, exitFullscreen, isFullscreen } =
    useSolitaireFullscreen();

  return (
    <button
      type="button"
      className={styles.button}
      onClick={isFullscreen ? exitFullscreen : enterFullscreen}
      title={isFullscreen ? "Réduire (quitter le plein écran)" : "Plein écran"}
      aria-label={isFullscreen ? "Réduire" : "Plein écran"}
    >
      <span aria-hidden="true">{isFullscreen ? "❐" : "□"}</span>
    </button>
  );
}
