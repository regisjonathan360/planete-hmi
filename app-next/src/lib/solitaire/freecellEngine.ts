/**
 * Moteur pur du FreeCell — mécaniques portées de src_freecell de
 * solitaire-master : distribution en rond (8 colonnes, 52 cartes toutes
 * face visible), 4 cellules libres, 4 fondations (as→roi, même enseigne),
 * longueur maximale d'une suite déplaçable = (cellules libres + 1) × 2^
 * (colonnes vides), suites en ordre décroissant à couleurs alternées,
 * fondations pouvant être rejouées sur le tableau.
 */

import { shuffleCards, singleDeck, rankValue, type GameCard } from "./modes";

export interface FreeCellState {
  /** 8 colonnes, du bas vers le haut (cartes face visible). */
  cols: GameCard[][];
  /** 4 cellules libres (0 ou 1 carte). */
  cells: (GameCard | null)[];
  /** 4 fondations, dans l'ordre SUITS de lib/solitaire/cards (♥♦♣♠). */
  foundations: GameCard[][];
}

const CELLS = 4;
const FOUNDATIONS = 4;
const COLS = 8;

export function newFreeCellGame(): FreeCellState {
  const deck = shuffleCards(singleDeck());
  const cols: GameCard[][] = Array.from({ length: COLS }, () => []);
  deck.forEach((card, i) => cols[i % COLS].push(card));
  return {
    cols,
    cells: Array.from({ length: CELLS }, () => null),
    foundations: Array.from({ length: FOUNDATIONS }, () => []),
  };
}

/** Suite 'start..sommet' en ordre décroissant à couleurs alternées. */
export function isFreeCellRun(col: GameCard[], start: number): boolean {
  if (start < 0 || start >= col.length) return false;
  for (let k = start; k < col.length - 1; k++) {
    if (rankValue(col[k + 1].rank) !== rankValue(col[k].rank) - 1) return false;
    const c1 = col[k].suit === "hearts" || col[k].suit === "diamonds";
    const c2 = col[k + 1].suit === "hearts" || col[k + 1].suit === "diamonds";
    if (c1 === c2) return false;
  }
  return true;
}

function fitsOnFoundation(top: GameCard | null, card: GameCard): boolean {
  if (!top) return card.rank === "ace";
  return (
    top.suit === card.suit &&
    rankValue(card.rank) === rankValue(top.rank) + 1
  );
}

/** Longueur maximale d'une suite en provenance de la colonne 'from'. */
export function freeCellMaxRun(state: FreeCellState, from: number): number {
  const emptyCells = state.cells.filter((c) => c === null).length;
  const emptyCols = state.cols.filter((col, i) => i !== from && col.length === 0).length;
  return (emptyCells + 1) * Math.pow(2, emptyCols);
}

export function isValidFreeCellMove(
  state: FreeCellState,
  from: number,
  start: number,
  to: number
): boolean {
  if (from === to) return false;
  const col = state.cols[from];
  const runLength = col.length - start;
  if (!isFreeCellRun(col, start)) return false;
  if (runLength > freeCellMaxRun(state, from)) return false;
  const target = state.cols[to];
  if (target.length === 0) return true;
  const bottom = col[start];
  const top = target[target.length - 1];
  if (rankValue(bottom.rank) !== rankValue(top.rank) - 1) return false;
  const c1 = bottom.suit === "hearts" || bottom.suit === "diamonds";
  const c2 = top.suit === "hearts" || top.suit === "diamonds";
  return c1 !== c2;
}

export function applyFreeCellMove(
  state: FreeCellState,
  from: number,
  start: number,
  to: number
): FreeCellState {
  const col = [...state.cols[from]];
  const run = col.splice(start);
  const cols = state.cols.map((c, i) => {
    if (i === from) return col;
    if (i === to) return [...c, ...run];
    return c;
  });
  return { ...state, cols };
}

export function applyToCell(
  state: FreeCellState,
  from: number,
  cellIndex: number
): FreeCellState | null {
  const col = state.cols[from];
  if (col.length === 0 || state.cells[cellIndex] !== null) return null;
  const card = col[col.length - 1];
  return {
    ...state,
    cols: state.cols.map((c, i) => (i === from ? c.slice(0, -1) : c)),
    cells: state.cells.map((c, i) => (i === cellIndex ? card : c)),
  };
}

export function applyFromCell(
  state: FreeCellState,
  cellIndex: number,
  to: number
): FreeCellState | null {
  const card = state.cells[cellIndex];
  if (!card) return null;
  const target = state.cols[to];
  if (target.length > 0) {
    const top = target[target.length - 1];
    if (rankValue(card.rank) !== rankValue(top.rank) - 1) return null;
    const c1 = card.suit === "hearts" || card.suit === "diamonds";
    const c2 = top.suit === "hearts" || top.suit === "diamonds";
    if (c1 === c2) return null;
  }
  return {
    ...state,
    cols: state.cols.map((c, i) => (i === to ? [...c, card] : c)),
    cells: state.cells.map((c, i) => (i === cellIndex ? null : c)),
  };
}

export function applyToFoundation(
  state: FreeCellState,
  from: number,
  foundationIndexTarget: number
): FreeCellState | null {
  const col = state.cols[from];
  if (col.length === 0) return null;
  const card = col[col.length - 1];
  const foundation = state.foundations[foundationIndexTarget];
  const top = foundation[foundation.length - 1] ?? null;
  if (!fitsOnFoundation(top, card)) return null;
  return {
    ...state,
    cols: state.cols.map((c, i) => (i === from ? c.slice(0, -1) : c)),
    foundations: state.foundations.map((f, i) =>
      i === foundationIndexTarget ? [...f, card] : f
    ),
  };
}

export function applyCellToFoundation(
  state: FreeCellState,
  cellIndex: number,
  foundationIndexTarget: number
): FreeCellState | null {
  const card = state.cells[cellIndex];
  if (!card) return null;
  const foundation = state.foundations[foundationIndexTarget];
  const top = foundation[foundation.length - 1] ?? null;
  if (!fitsOnFoundation(top, card)) return null;
  return {
    ...state,
    cells: state.cells.map((c, i) => (i === cellIndex ? null : c)),
    foundations: state.foundations.map((f, i) =>
      i === foundationIndexTarget ? [...f, card] : f
    ),
  };
}

/** Une suite complète (as→roi) au sommet de la fondation. */
function topOf(foundation: GameCard[]): GameCard | null {
  return foundation[foundation.length - 1] ?? null;
}

export function freeCellHint(state: FreeCellState): {
  kind: "colToCol" | "colToCell" | "cellToCol" | "colToFoundation" | "cellToFoundation";
  from: number;
  start?: number;
  to: number;
} | null {
  // 1. Sommets de colonnes → fondations (priorité, comme auto-move).
  for (let from = 0; from < state.cols.length; from++) {
    const col = state.cols[from];
    if (col.length === 0) continue;
    const card = col[col.length - 1];
    for (let f = 0; f < FOUNDATIONS; f++) {
      if (fitsOnFoundation(topOf(state.foundations[f]), card)) {
        return { kind: "colToFoundation", from, to: f };
      }
    }
  }
  // 2. Cellules → fondations.
  for (let cell = 0; cell < CELLS; cell++) {
    const card = state.cells[cell];
    if (!card) continue;
    for (let f = 0; f < FOUNDATIONS; f++) {
      if (fitsOnFoundation(topOf(state.foundations[f]), card)) {
        return { kind: "cellToFoundation", from: cell, to: f };
      }
    }
  }
  // 3. Suites de colonnes → colonnes / cellules → colonnes.
  for (let from = 0; from < state.cols.length; from++) {
    const col = state.cols[from];
    if (col.length === 0) continue;
    for (let start = col.length - 1; start >= 0; start--) {
      if (!isFreeCellRun(col, start)) continue;
      for (let to = 0; to < state.cols.length; to++) {
        if (isValidFreeCellMove(state, from, start, to)) {
          return { kind: "colToCol", from, start, to };
        }
      }
      if (col.length - start === 1) {
        for (let cell = 0; cell < CELLS; cell++) {
          if (state.cells[cell] === null) {
            return { kind: "colToCell", from, to: cell };
          }
        }
      }
    }
  }
  for (let cell = 0; cell < CELLS; cell++) {
    const card = state.cells[cell];
    if (!card) continue;
    for (let to = 0; to < state.cols.length; to++) {
      const target = state.cols[to];
      if (target.length === 0) return { kind: "cellToCol", from: cell, to };
      const top = target[target.length - 1];
      if (rankValue(card.rank) === rankValue(top.rank) - 1) {
        const c1 = card.suit === "hearts" || card.suit === "diamonds";
        const c2 = top.suit === "hearts" || top.suit === "diamonds";
        if (c1 !== c2) return { kind: "cellToCol", from: cell, to };
      }
    }
  }
  return null;
}

export function isFreeCellWon(state: FreeCellState): boolean {
  return state.foundations.every((f) => f.length === 13);
}

export function freeCellCardsLeft(state: FreeCellState): number {
  return (
    state.cols.reduce((sum, col) => sum + col.length, 0) +
    state.cells.filter((c) => c !== null).length
  );
}