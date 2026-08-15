/**
 * Modes de solitaire (portage des mécaniques de « solitaire-master » :
 * Klondike, Spider, FreeCell, Pyramid).
 *
 * Types partagés par les moteurs React des nouveaux modes : modèle de
 * carte (mêmes valeurs sémantiques que lib/solitaire/cards.ts pour que la
 * personnalisation des artistes fonctionne telle quelle), construction de
 * jeux de cartes multiples (Spider 1/2/4 jeux, FreeCell double) et
 * utilitaires de rang/enseigne.
 */

import { RANKS, SUITS, type Rank, type Suit } from "./cards";

export type SolitaireModeId = "klondike" | "spider" | "freecell" | "pyramid";

/** Modèle de carte des moteurs (clonable, sérialisable). */
export interface GameCard {
  /** Rang sémantique ("ace"…"king") — clé de la personnalisation. */
  rank: Rank;
  /** Enseigne sémantique — clé de la personnalisation. */
  suit: Suit;
  faceDown: boolean;
}

/** Rang numérique : ace = 1 … king = 13 (règles de Spider/FreeCell/Pyramid). */
export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 1;
}

/** Index de carte dans un jeu de 52 (0..51) — tri/déterminisme. */
export function cardIndex(card: GameCard): number {
  return (rankValue(card.rank) - 1) * 4 + SUITS.indexOf(card.suit);
}

export function isRed(card: GameCard): boolean {
  return card.suit === "hearts" || card.suit === "diamonds";
}

/** Un jeu de 52 cartes, faces cachées. */
export function singleDeck(): GameCard[] {
  const deck: GameCard[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit, faceDown: false });
    }
  }
  return deck;
}

/** n jeux de cartes entrelacés (comme MultiDeck de solitaire-master). */
export function multiDeck(count: number): GameCard[] {
  const deck: GameCard[] = [];
  for (let i = 0; i < count; i++) {
    deck.push(...singleDeck());
  }
  return deck;
}

/** Mélange de Fisher-Yates (graine optionnelle, comme Deck::shuffle). */
export function shuffleCards(deck: GameCard[]): GameCard[] {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cards[i];
    cards[i] = cards[j];
    cards[j] = tmp;
  }
  return cards;
}

/** Mode choisi par le joueur (persisté dans localStorage). */
export const SOLITAIRE_MODE_STORAGE_KEY = "solitaire95.mode";
/** Signal de changement de mode entre le menu classique et le loader. */
export const SOLITAIRE_MODE_SWITCH_EVENT = "solitaire95.switchMode";
/**
 * Signal : démarrer le Klondike sans son écran d'accueil. Posé quand le
 * joueur change de jeu vers le Klondike depuis un autre mode — cliquer sur
 * « Klondike » dans la liste des jeux doit lancer la partie, pas afficher
 * le menu d'accueil (qui reste la porte d'entrée d'une visite directe).
 */
export const SOLITAIRE_START_DIRECT_KEY = "solitaire95.startDirect";

export function isSolitaireModeId(value: unknown): value is SolitaireModeId {
  return SOLITAIRE_MODES.some((m) => m.id === value);
}

export const SOLITAIRE_MODES: {
  id: SolitaireModeId;
  label: string;
  short: string;
  subtitle: string;
}[] = [
  {
    id: "klondike",
    label: "Klondike",
    short: "Le classique",
    subtitle:
      "Reposez les cartes par couleur sur les fondations, de l'as au roi.",
  },
  {
    id: "spider",
    label: "Spider",
    short: "8 pattes, 4 jeux",
    subtitle:
      "Rangez des suites du roi à l'as pour les retirer du tableau.",
  },
  {
    id: "freecell",
    label: "FreeCell",
    short: "Tout est face visible",
    subtitle:
      "Utilisez les cellules libres pour organiser les colonnes, du roi à l'as.",
  },
  {
    id: "pyramid",
    label: "Pyramid",
    short: "Les paires de 13",
    subtitle:
      "Retirez les cartes par paires dont la somme vaut 13 pour démolir la pyramide.",
  },
];
