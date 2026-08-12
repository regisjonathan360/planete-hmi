"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { dealCards, toggleWindow } from "@/components/jeux/solitaire95/store/actions/";
import { useSolitaireFullscreen } from "./SolitaireScaleFrame";
import styles from "./solitaire95-menu.module.css";

/**
 * Menu d'accueil du Solitaire (titre + Jouer / Options / Règles / Retour).
 *
 * Rendus à l'intérieur de l'arbre du jeu (provider redux du jeu) pour
 * pouvoir déclencher les actions du jeu. Recouvre toute la table tant que
 * le joueur n'a pas lancé une action ; « Jouer » lance une nouvelle donne
 * et passe le cadre du jeu en plein écran (toute la table visible, sans
 * barre de défilement sur les rebords).
 */
export function Solitaire95Menu() {
  const [visible, setVisible] = useState(true);
  const dispatch = useDispatch();
  const router = useRouter();
  const { enterFullscreen } = useSolitaireFullscreen();

  if (!visible) return null;

  const startGame = () => {
    dispatch(dealCards());
    enterFullscreen();
    setVisible(false);
  };

  const openOptions = () => {
    dispatch(toggleWindow(true, "optionsWindow"));
    setVisible(false);
  };

  const openHelp = () => {
    dispatch(toggleWindow(true, "helpTopicsWindow"));
    setVisible(false);
  };

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/arene");
    }
  };

  return (
    <div className={styles.menu} role="dialog" aria-label="Menu du Solitaire 95">
      <div className={styles.menu__halo} aria-hidden="true" />
      <div className={styles.menu__card}>
        <p className={styles.menu__eyebrow}>L&apos;Arène — Planète HMI</p>
        <h2 className={styles.menu__title}>Solitaire 95</h2>
        <p className={styles.menu__subtitle}>
          Le classique de Windows 95, illustré par les artistes de la planète.
          Repose les cartes par couleur sur les fondations, de l&apos;as au roi.
        </p>

        <div className={styles.menu__actions}>
          <button type="button" className={styles.menu__play} onClick={startGame}>
            <span className={styles.menu__playIcon} aria-hidden="true">
              ▶
            </span>
            Jouer
          </button>
          <button type="button" className={styles.menu__button} onClick={openOptions}>
            Options
          </button>
          <button type="button" className={styles.menu__button} onClick={openHelp}>
            Règles du jeu
          </button>
        </div>

        <p className={styles.menu__hint}>
          Les options du jeu (répartition, score, fond de table) sont aussi
          dans le menu « Game » de la fenêtre.
        </p>

        <button type="button" className={styles.menu__back} onClick={goBack}>
          <span aria-hidden="true">←</span>
          Retour
        </button>
      </div>
    </div>
  );
}