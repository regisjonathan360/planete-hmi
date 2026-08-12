"use client";

import dynamic from "next/dynamic";
import { SolitaireCardsProvider } from "./SolitaireCardsProvider";
import { SolitaireScaleFrame } from "./SolitaireScaleFrame";
import styles from "./solitaire-game-loader.module.css";

const SolitaireGame = dynamic(
  () => import("@/components/jeux/solitaire95/Solitaire95").then((m) => m.Solitaire95),
  {
    ssr: false,
    loading: () => (
      <div className={styles.loading} role="status">
        Chargement du Solitaire…
      </div>
    ),
  }
);

/**
 * Chargeur du Solitaire 95. Le jeu lit/écrit localStorage au chargement
 * du module (store Redux global) : il doit être monté uniquement côté
 * client via next/dynamic (ssr: false). Le cadre de mise à l'échelle
 * garantit que toute la table est visible, sans barre de défilement.
 */
export function SolitaireGameLoader() {
  return (
    <SolitaireCardsProvider>
      <SolitaireScaleFrame>
        <SolitaireGame />
      </SolitaireScaleFrame>
    </SolitaireCardsProvider>
  );
}