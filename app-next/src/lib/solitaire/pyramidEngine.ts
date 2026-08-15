/**
 * Moteur pur de la Pyramide — mécaniques portées de src_pyramid de
 * solitaire-master : 28 cartes en pyramide de 7 rangées (une seule carte
 * exposée = les deux en dessous retirées), talon de 24 cartes qui
 * retourne une carte à la fois sur le déchet, paires dont la somme des
 * valeurs vaut 13 (roi seul), victoire quand la pyramide est vide.
 */

import { shuffleCards, singleDeck, rankValue, type GameCard } from "./modes";

export interface PyramidState {
  /** Pyramide : rows[r] = r+1 cartes (row 0 = sommet), null si retirée. */
  rows: (GameCard | null)[][];
  /** Talon (faces cachées). */
  stock: GameCard[];
  /** Déchet (face visible, seule dernière carte jouable). */
  waste: GameCard[];
}

const ROWS = 7;

export function newPyramidGame(): PyramidState {
  const deck = shuffleCards(singleDeck());
  const rows: (GameCard | null)[][] = [];
  let index = 0;
  for (let r = 0; r < ROWS; r++) {
    rows.push(deck.slice(index, index + r + 1));
    index += r + 1;
  }
  return {
    rows,
    stock: deck.slice(index, 52).map((card) => ({ ...card, faceDown: true })),
    waste: [],
  };
}

export function pyramidValue(card: GameCard): number {
  return rankValue(card.rank); // A=1 … K=13
}

/** La carte (r,c) est-elle encore sur le tableau ? */
export function isPyramidCovered(
  state: PyramidState,
  row: number,
  col: number
): boolean {
  if (row === ROWS - 1) return false; // dernière rangée : jamais couverte
  const leftRemoved = !isPyramidPresent(state, row + 1, col);
  const rightRemoved = !isPyramidPresent(state, row + 1, col + 1);
  return !(leftRemoved && rightRemoved);
}

/** Une carte est présente si elle n'a pas été retirée (comparaison d'identité). */
export function isPyramidPresent(
  state: PyramidState,
  row: number,
  col: number
): boolean {
  return state.rows[row][col] !== null;
}

/** Cartes restantes de la pyramide (affiché). */
export function pyramidRemaining(state: PyramidState): number {
  return state.rows.flat().filter((c) => c !== null).length;
}

/** Retire deux cartes de la pyramide (ou une seule, roi seul). */
export function removePyramidCards(
  state: PyramidState,
  picks: { row: number; col: number }[]
): PyramidState | null {
  const picksFiltered = picks.filter((p) => isPyramidPresent(state, p.row, p.col));
  const values = picksFiltered.map((p) => pyramidValue(state.rows[p.row][p.col]!));
  const sum = values.reduce((a, b) => a + b, 0);
  if (picksFiltered.length === 0) return null;
  if (picksFiltered.length === 1 && values[0] !== 13) return null;
  if (picksFiltered.length === 2 && sum !== 13) return null;
  if (picksFiltered.length > 2) return null;
  const rows = state.rows.map((row, r) =>
    row.map((card, c) =>
      picksFiltered.some((p) => p.row === r && p.col === c) ? null : card
    )
  );
  return { ...state, rows };
}

/** Retire la carte du déchet (seule carte jouable) + paire dans la pyramide. */
export function removeWastePair(
  state: PyramidState,
  pick: { row: number; col: number } | null
): PyramidState | null {
  if (state.waste.length === 0) return null;
  const wasteCard = state.waste[state.waste.length - 1];
  if (!pick) {
    if (pyramidValue(wasteCard) !== 13) return null;
    return { ...state, waste: state.waste.slice(0, -1) };
  }
  if (!isPyramidPresent(state, pick.row, pick.col)) return null;
  const card = state.rows[pick.row][pick.col]!;
  if (pyramidValue(wasteCard) + pyramidValue(card) !== 13) return null;
  const rows = state.rows.map((row, r) =>
    row.map((c, col) => (r === pick.row && col === pick.col ? null : c))
  );
  return { ...state, rows, waste: state.waste.slice(0, -1) };
}

/** Retourne la carte suivante du talon (recycle le déchet si talon vide). */
export function advancePyramidStock(state: PyramidState): PyramidState {
  let stock = [...state.stock];
  let waste = [...state.waste];
  if (stock.length === 0) {
    if (waste.length === 0) return state;
    // Recyclage du déchet (répété jusqu'à ce que le talon redevienne non vide).
    stock = waste.reverse().map((card) => ({ ...card, faceDown: true }));
    waste = [];
  }
  const card = stock.pop()!;
  return {
    ...state,
    stock,
    waste: [...waste, { ...card, faceDown: false }],
  };
}

/** Indice : paire de 13 jouable (2 cartes de la pyramide, ou déchet+pyramide). */
export function pyramidHint(state: PyramidState): {
  picks: { row: number; col: number }[];
  useWaste?: boolean;
} | null {
  // Déchet + carte de la pyramide.
  if (state.waste.length > 0) {
    const wasteValue = pyramidValue(state.waste[state.waste.length - 1]);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= r; c++) {
        if (!isPyramidPresent(state, r, c)) continue;
        if (isPyramidCovered(state, r, c)) continue;
        const card = state.rows[r][c]!;
        if (pyramidValue(card) + wasteValue === 13) {
          return { picks: [{ row: r, col: c }], useWaste: true };
        }
      }
    }
    // Roi seul sur le déchet.
    if (wasteValue === 13) {
      return { picks: [], useWaste: true };
    }
  }
  // Deux cartes de la pyramide.
  for (let r1 = 0; r1 < ROWS; r1++) {
    for (let c1 = 0; c1 <= r1; c1++) {
      if (!isPyramidPresent(state, r1, c1)) continue;
      if (isPyramidCovered(state, r1, c1)) continue;
      const v1 = pyramidValue(state.rows[r1][c1]!);
      for (let r2 = 0; r2 < ROWS; r2++) {
        for (let c2 = 0; c2 <= r2; c2++) {
          if (r1 === r2 && c1 === c2) continue;
          if (!isPyramidPresent(state, r2, c2)) continue;
          if (isPyramidCovered(state, r2, c2)) continue;
          const v2 = pyramidValue(state.rows[r2][c2]!);
          if (v1 + v2 === 13) {
            return { picks: [{ row: r1, col: c1 }, { row: r2, col: c2 }] };
          }
        }
      }
    }
  }
  return null;
}

export function isPyramidWon(state: PyramidState): boolean {
  return pyramidRemaining(state) === 0;
}

/** Action recommandée : avancer le talon s'il reste des cartes. */
export function pyramidStockLeft(state: PyramidState): number {
  return state.stock.length + state.waste.length;
}