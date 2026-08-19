"use client";

import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { toggleWindow } from "@/components/jeux/solitaire95/store/actions/";
import { dealCardsAllSteps } from "@/components/jeux/solitaire95/helpers/dealCardsAllSteps";
import {
  SOLITAIRE_MODES,
  SOLITAIRE_MODE_SWITCH_EVENT,
  SOLITAIRE_START_DIRECT_KEY,
} from "@/lib/solitaire/modes";
import { useSolitaireFullscreen } from "./SolitaireScaleFrame";
import { useSolitaireGameMenu } from "./SolitaireGameMenuContext";
import styles from "./solitaire95-menu.module.css";

/**
 * Menu d'accueil du Solitaire (titre + Jouer / Options / Règles / Retour).
 *
 * Rendus à l'intérieur de l'arbre du jeu (provider redux du jeu) pour
 * pouvoir déclencher les actions du jeu. Recouvre toute la table tant que
 * le joueur n'a pas lancé une action ; « Jouer » lance une nouvelle donne
 * et passe le cadre du jeu en plein écran (toute la table visible, sans
 * barre de défilement sur les rebords). « Modes » ouvre les autres
 * variantes (Spider, FreeCell, Pyramid) : le changement est signalé au
 * loader de la page via un CustomEvent.
 */
export function Solitaire95Menu() {
  /* Arrivée par « Changer de jeu » : le loader pose un signal sessionStorage
     (SOLITAIRE_START_DIRECT_KEY) qui fait démarrer le Klondike directement,
     sans écran d'accueil. L'écran d'accueil reste la porte d'entrée d'une
     visite directe. */
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(SOLITAIRE_START_DIRECT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [modesOpen, setModesOpen] = useState(false);
  const dispatch = useDispatch();
  const { enterFullscreen } = useSolitaireFullscreen();
  const { closeMenu, isMenuOpen } = useSolitaireGameMenu();
  const visible = !dismissed || isMenuOpen;

  /* Consomme le signal et lance une nouvelle donne (l'écran d'accueil est
     déjà masqué par l'état initial ci-dessus). */
  useEffect(() => {
    let startDirect = false;
    try {
      startDirect = sessionStorage.getItem(SOLITAIRE_START_DIRECT_KEY) === "1";
      if (startDirect) sessionStorage.removeItem(SOLITAIRE_START_DIRECT_KEY);
    } catch {
      /* ignore */
    }
    if (startDirect) {
      dealCardsAllSteps(dispatch, false, false);
    }
  }, [dispatch]);

  if (!visible) return null;

  const startGame = () => {
    dealCardsAllSteps(dispatch, false, false);
    enterFullscreen();
    setDismissed(true);
    closeMenu();
  };

  const openOptions = () => {
    dispatch(toggleWindow(true, "optionsWindow"));
    setDismissed(true);
    closeMenu();
  };

  const openHelp = () => {
    dispatch(toggleWindow(true, "helpTopicsWindow"));
    setDismissed(true);
    closeMenu();
  };

  const switchMode = (mode: string) => {
    window.dispatchEvent(
      new CustomEvent(SOLITAIRE_MODE_SWITCH_EVENT, { detail: { mode } })
    );
  };

  return (
    <div className={styles.menu} role="dialog" aria-label="Menu du Solitaire">
      <div className={styles.menu__halo} aria-hidden="true" />
      <div className={styles.menu__card}>
        <p className={styles.menu__eyebrow}>L&apos;Arène — Planète HMI</p>
        <h2 className={styles.menu__title}>Solitaire</h2>
        <p className={styles.menu__subtitle}>
          Le classique de Windows 95, illustré par les artistes de la planète.
          Repose les cartes par couleur sur les fondations, de l&apos;as au roi.
          Retrouvez aussi Spider, FreeCell et Pyramid dans « Modes ».
        </p>

        <div className={styles.menu__actions}>
          <button type="button" className={styles.menu__play} onClick={startGame}>
            <span className={styles.menu__playIcon} aria-hidden="true">
              ▶
            </span>
            Jouer
          </button>
          <div className={styles.menu__modes}>
            <button
              type="button"
              className={styles.menu__button}
              onClick={() => setModesOpen((open) => !open)}
              aria-expanded={modesOpen}
            >
              Modes {modesOpen ? "▴" : "▾"}
            </button>
            {modesOpen && (
              <div className={styles.menu__modesList}>
                {SOLITAIRE_MODES.filter((m) => m.id !== "klondike").map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={styles.menu__modeItem}
                    onClick={() => switchMode(m.id)}
                  >
                    <span className={styles.menu__modeName}>{m.label}</span>
                    <span className={styles.menu__modeShort}>{m.short}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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

        <button
          type="button"
          className={styles.menu__back}
          onClick={() => {
            setDismissed(true);
            closeMenu();
          }}
        >
          <span aria-hidden="true">←</span>
          Fermer
        </button>
      </div>
    </div>
  );
}
