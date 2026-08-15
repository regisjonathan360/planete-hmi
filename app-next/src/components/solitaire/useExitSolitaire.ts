"use client";

import { useCallback } from "react";
import { SOLITAIRE_MODE_SWITCH_EVENT } from "@/lib/solitaire/modes";
import { useSolitaireGameMenu } from "./SolitaireGameMenuContext";

/**
 * Bascule vers le mode Klondike (affiche le menu d'accueil).
 * Utilisé par « Quitter » dans les modes Spider/FreeCell/Pyramid.
 */
export function useExitSolitaire() {
  const { openMenu } = useSolitaireGameMenu();
  return useCallback(() => {
    // Bascule vers Klondike via l'événement global
    window.dispatchEvent(
      new CustomEvent(SOLITAIRE_MODE_SWITCH_EVENT, { detail: { mode: "klondike" } })
    );
    // Ouvre aussi le menu d'accueil Klondike
    openMenu();
  }, [openMenu]);
}

export function useCloseGameMenu() {
  const { closeMenu } = useSolitaireGameMenu();
  return useCallback(() => closeMenu(), [closeMenu]);
}
