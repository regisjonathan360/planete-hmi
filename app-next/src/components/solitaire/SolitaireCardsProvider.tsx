"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  SUITS,
  cardKeyOf,
  CARD_MASK_PRESETS,
  type CardFaceConfig,
} from "@/lib/solitaire/cards";

export interface SolitaireCardsState {
  /** true quand les configurations ont été chargées (au moins une fois). */
  ready: boolean;
  /**
   * Configuration d'une carte par sa clé ("KH"), ou null si la carte n'a
   * pas été personnalisée (rendu classique). Retourne null sur les cartes
   * sans personnalisation ET tant que le fetch n'est pas terminé.
   */
  getConfig: (cardKey: string) => CardFaceConfig | null;
}

export const SolitaireCardsContext = createContext<SolitaireCardsState>({
  ready: false,
  getConfig: () => null,
});

export function useSolitaireCards(): SolitaireCardsState {
  return useContext(SolitaireCardsContext);
}

/** Promesse d'amorçage partagée : un seul fetch toutes sessions confondues. */
let bootstrapPromise: Promise<CardFaceConfig[]> | null = null;

function fetchCards(): Promise<CardFaceConfig[]> {
  if (!bootstrapPromise) {
    bootstrapPromise = fetch("/api/arene/solitaire/cards", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`solitaire cards: HTTP ${response.status}`);
        }
        return response.json().then((data) => data?.cards as CardFaceConfig[] | undefined ?? []);
      })
      .catch((error: unknown) => {
        bootstrapPromise = null;
        throw error;
      });
  }
  return bootstrapPromise;
}

/**
 * Fournit les configurations de cartes (artiste + masque par rang) à tout
 * l'arbre du jeu. Sans config, les cartes gardent un rendu classique.
 */
export function SolitaireCardsProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<CardFaceConfig[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCards()
      .then((cards) => {
        if (!cancelled) setConfigs(cards);
      })
      .catch(() => {
        if (!cancelled) setConfigs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const state = useMemo<SolitaireCardsState>(() => {
    const map = new Map<string, CardFaceConfig>();
    for (const config of configs ?? []) map.set(config.cardKey, config);
    const fallback = CARD_FALLBACK_CONFIGS;
    return {
      ready: configs !== null,
      getConfig: (cardKey: string) => {
        const config = map.get(cardKey);
        if (config) return config;
        return fallback.get(cardKey) ?? null;
      },
    };
  }, [configs]);

  return (
    <SolitaireCardsContext.Provider value={state}>
      {children}
    </SolitaireCardsContext.Provider>
  );
}

/**
 * Configurations de secours : l'as et les figures (J/Q/K) reçoivent une
 * géométrie correcte (masque 0.72 / 0.82) même sans personnalisation,
 * pour que le composant connaisse sa zone sûre. Les cartes à pips (2–10)
 * n'ont pas besoin de config par défaut (rendu classique).
 */
const CARD_FALLBACK_CONFIGS = new Map<string, CardFaceConfig>();
{
  const ranks: Record<string, "ace" | "jack" | "queen" | "king"> = {
    A: "ace",
    J: "jack",
    Q: "queen",
    K: "king",
  };
  for (const suit of SUITS) {
    for (const [label, rank] of Object.entries(ranks)) {
      const key = cardKeyOf(rank, suit);
      CARD_FALLBACK_CONFIGS.set(key, {
        cardKey: key,
        artistId: null,
        artistName: null,
        artistImageUrl: null,
        ...CARD_MASK_PRESETS[rank],
      });
    }
  }
}