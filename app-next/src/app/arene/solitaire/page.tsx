import type { Metadata } from "next";
import { SolitaireGameLoader } from "@/components/solitaire/SolitaireGameLoader";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Solitaire — Arène Planète HMI",
};

/**
 * SolitairePage — Le Solitaire de l'Arène.
 * Les cartes sont personnalisées par artiste (visages en pleine carte avec
 * masque par rang) et un fond peut être choisi dans les options du jeu.
 * Le jeu nécessite le client (localStorage au chargement du module) :
 * il est monté via le loader next/dynamic ssr:false.
 */
export default function SolitairePage() {
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.pageTitle}>Solitaire</h1>
          <p className={styles.pageLead}>
            Le classique de Windows 95 dans l&apos;Arène : repose les cartes
            sur les fondations par couleur, de l&apos;as au roi. Ici, les
            artistes de la planète illustrent le jeu — changez de fond et de
            look dans les options.
          </p>
        </div>
      </div>

      {/* Fenêtre du jeu : occupe toute la largeur du contenu (au-dessus de
          la barre latérale de l'Arène sur desktop). */}
      <div className={styles.gameWindow}>
        <SolitaireGameLoader />
      </div>
    </div>
  );
}