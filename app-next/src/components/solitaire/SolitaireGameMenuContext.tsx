"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SolitaireGameMenuContextValue {
  isMenuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
}

const SolitaireGameMenuContext = createContext<SolitaireGameMenuContextValue | null>(null);

export function SolitaireGameMenuProvider({ children }: { children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const openMenu = () => setIsMenuOpen(true);
  const closeMenu = () => setIsMenuOpen(false);
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  return (
    <SolitaireGameMenuContext.Provider value={{ isMenuOpen, openMenu, closeMenu, toggleMenu }}>
      {children}
    </SolitaireGameMenuContext.Provider>
  );
}

export function useSolitaireGameMenu() {
  const ctx = useContext(SolitaireGameMenuContext);
  if (!ctx) {
    throw new Error("useSolitaireGameMenu must be used within SolitaireGameMenuProvider");
  }
  return ctx;
}