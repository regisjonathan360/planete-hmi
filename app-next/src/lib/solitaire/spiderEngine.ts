/**
 * Moteur pur du Spider — mécaniques portées de src_spider de
 * solitaire-master : 10 colonnes (6 cartes sur 0-3, 5 sur 4-9, une seule
 * face visible… ici toutes les cartes sont retournées à l'arrivée), 50
 * cartes au talon, suites K→A d'une même enseigne retirées du tableau,
 * talon rejoué d'une carte par colonne (exige une colonne vide).
 */

import { RANKS } from "./cards";
import { shuffleCards, rankValue, type GameCard } from "./modes";

export type SpiderSuits = 1 | 2 | 4;

export interface SpiderState {
  /** 10 colonnes, du bas vers le haut. */
  cols: GameCard[][];
  /** Talon (faces cachées). */
  stock: GameCard[];
  /** Suites complètes retirées (victoire à 8). */
  done: number;
  suits: SpiderSuits;
}

const SUIT_SETS: Record<SpiderSuits, ("spades" | "hearts" | "clubs" | "diamonds")[]> = {
  1: ["spades"],
  2: ["spades", "hearts"],
  4: ["spades", "hearts", "clubs", "diamonds"],
};

/** Jeu de 104 cartes : 8 jeux d'enseignes choisies (comme SpiderDeck). */
function spiderDeck(suits: SpiderSuits): GameCard[] {
  const suitSet = SUIT_SETS[suits];
  const cards: GameCard[] = [];
  for (const suit of suitSet) {
    for (let i = 0; i < 8 / suits; i++) {
      for (const rank of RANKS) {
        cards.push({ rank, suit, faceDown: false });
      }
    }
  }
  return shuffleCards(cards);
}

export function newSpiderGame(suits: SpiderSuits): SpiderState {
  const cards = spiderDeck(suits);
  const cols: GameCard[][] = Array.from({ length: 10 }, () => []);
  let index = 0;
  for (let col = 0; col < 10; col++) {
    const count = col < 4 ? 6 : 5;
    for (let i = 0; i < count; i++) {
      cols[col].push(cards[index++]);
    }
  }
  const stock = cards.slice(index).map((card) => ({ ...card, faceDown: true }));
  return { cols, stock, done: 0, suits };
}

/** Une suite « start..sommet » est-elle déplaçable (même enseigne, rangs -1) ? */
export function isSpiderRun(col: GameCard[], start: number): boolean {
  if (start < 0 || start >= col.length) return false;
  for (let k = start; k < col.length - 1; k++) {
    if (col[k].suit !== col[k + 1].suit) return false;
    if (rankValue(col[k + 1].rank) !== rankValue(col[k].rank) - 1) return false;
  }
  return true;
}

/** Coup valide ? Suite du bas à poser sur le sommet de la colonne cible. */
export function isValidSpiderMove(
  state: SpiderState,
  from: number,
  start: number,
  to: number
): boolean {
  if (from === to) return false;
  const col = state.cols[from];
  if (!isSpiderRun(col, start)) return false;
  const target = state.cols[to];
  if (target.length === 0) return true;
  const bottom = col[start];
  const top = target[target.length - 1];
  return (
    top.suit === bottom.suit &&
    rankValue(bottom.rank) === rankValue(top.rank) - 1
  );
}

/** Une suite complète K→A d'une même enseigne au sommet ? (13 cartes). */
function completedSequenceAtTop(col: GameCard[]): boolean {
  if (col.length < 13) return false;
  if (rankValue(col[col.length - 1].rank) !== 1) return false; // sommet = A
  return isSpiderRun(col, col.length - 13) && rankValue(col[col.length - 13].rank) === 13;
}

export function applySpiderMove(
  state: SpiderState,
  from: number,
  start: number,
  to: number
): SpiderState {
  const col = [...state.cols[from]];
  const run = col.splice(start);
  const target = [...state.cols[to], ...run];
  const removed = completedSequenceAtTop(target) ? 13 : 0;
  const targetClean = removed > 0 ? target.slice(0, target.length - removed) : target;
  const cols = state.cols.map((c, i) => {
    if (i === from) return col;
    if (i === to) return targetClean;
    return c;
  });
  return { ...state, cols, done: state.done + (removed > 0 ? 1 : 0) };
}

/** Rejoue une carte de chaque colonne depuis le talon (exige une colonne vide). */
export function applySpiderStockDeal(state: SpiderState): SpiderState | null {
  if (state.stock.length === 0) return null;
  if (state.cols.every((col) => col.length > 0)) return null;
  const stock = [...state.stock];
  const cols = state.cols.map((col) => {
    const card = stock.pop();
    if (!card) return col;
    return [...col, { ...card, faceDown: false }];
  });
  return { ...state, cols, stock };
}

/** Un indice : suite déplaçable + colonne de dépôt valide. */
export function spiderHint(state: SpiderState): {
  from: number;
  start: number;
  to: number;
} | null {
  for (let from = 0; from < state.cols.length; from++) {
    const col = state.cols[from];
    for (let start = col.length - 1; start >= 0; start--) {
      if (!isSpiderRun(col, start)) continue;
      for (let to = 0; to < state.cols.length; to++) {
        if (isValidSpiderMove(state, from, start, to)) {
          return { from, start, to };
        }
      }
    }
  }
  return null;
}

export function isSpiderWon(state: SpiderState): boolean {
  return state.done === 8;
}

/** Nombre de cartes restant à ranger (affiché dans la barre d'état). */
export function spiderCardsLeft(state: SpiderState): number {
  return state.cols.reduce((sum, col) => sum + col.length, 0) + state.stock.length;
}
