"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  isSolitaireModeId,
  SOLITAIRE_MODE_STORAGE_KEY,
  SOLITAIRE_MODE_SWITCH_EVENT,
  SOLITAIRE_START_DIRECT_KEY,
  type SolitaireModeId,
} from "@/lib/solitaire/modes";
import { SolitaireCardsProvider } from "./SolitaireCardsProvider";
import { SolitaireScaleFrame } from "./SolitaireScaleFrame";
import { SolitaireModeShell } from "./modes/SolitaireModeShell";
import { SolitaireGameMenuProvider } from "./SolitaireGameMenuContext";
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

function loadMode(): SolitaireModeId {
  if (typeof window === "undefined") return "klondike";
  try {
    const stored = window.localStorage.getItem(SOLITAIRE_MODE_STORAGE_KEY);
    if (stored && isSolitaireModeId(stored)) return stored;
  } catch {
    /* localStorage indisponible */
  }
  return "klondike";
}

/**
 * Chargeur du Solitaire de l'Arène. Le Klondike (Windows 95 illustré) lit
 * localStorage au chargement du module : il doit être monté uniquement côté
 * client via next/dynamic (ssr: false). Les autres modes (Spider, FreeCell,
 * Pyramid) sont rendus par SolitaireModeShell. Le cadre à l'échelle
 * (SolitaireScaleFrame) est unique et persistant : changer de jeu ne
 * recrée pas le cadre, donc le plein écran est conservé d'un mode à
 * l'autre. Le choix du mode est persisté ; le menu Klondike et la coquille
 * des modes se le renvoient via l'événement solitaire95.switchMode.
 */
export function SolitaireGameLoader() {
  const [mode, setMode] = useState<SolitaireModeId>(() => loadMode());

  const switchMode = useCallback((next: SolitaireModeId) => {
    setMode(next);
    try {
      window.localStorage.setItem(SOLITAIRE_MODE_STORAGE_KEY, next);
      // Changer de jeu vers le Klondike démarre la partie directement :
      // l'écran d'accueil n'est réservé qu'à la première visite.
      if (next === "klondike") {
        window.sessionStorage.setItem(SOLITAIRE_START_DIRECT_KEY, "1");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { mode?: unknown }
        | undefined;
      if (detail?.mode && isSolitaireModeId(detail.mode)) {
        switchMode(detail.mode);
      }
    };
    window.addEventListener(SOLITAIRE_MODE_SWITCH_EVENT, onSwitch);
    return () =>
      window.removeEventListener(SOLITAIRE_MODE_SWITCH_EVENT, onSwitch);
  }, [switchMode]);

  return (
    <SolitaireCardsProvider>
      <SolitaireGameMenuProvider>
        <SolitaireScaleFrame fluid={mode !== "klondike"}>
          {mode !== "klondike" ? (
            <SolitaireModeShell mode={mode} onSwitchMode={switchMode} />
          ) : (
            <SolitaireGame />
          )}
        </SolitaireScaleFrame>
      </SolitaireGameMenuProvider>
    </SolitaireCardsProvider>
  );
}
