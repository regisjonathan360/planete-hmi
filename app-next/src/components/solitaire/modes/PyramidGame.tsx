"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
  useState,
} from "react";
import { cardBackImages } from "@/components/jeux/solitaire95/static/cardBacks";
import {
  advancePyramidStock,
  isPyramidCovered,
  isPyramidPresent,
  isPyramidWon,
  newPyramidGame,
  pyramidHint,
  pyramidRemaining,
  removePyramidCards,
  removeWastePair,
  pyramidValue,
  type PyramidState,
} from "@/lib/solitaire/pyramidEngine";
import type { ModeGameHandle, ModeSettings, ModeStatus } from "./modeShellTypes";
import { SolitairePlayingCard } from "./SolitairePlayingCard";
import { useTableGeometry } from "./useTableGeometry";
import styles from "./pyramid-game.module.css";

type PickRef = { row: number; col: number } | { waste: true };

type Action =
  | { type: "newGame" }
  | { type: "remove"; picks: { row: number; col: number }[] }
  | { type: "removeWithWaste"; pick: { row: number; col: number } | null }
  | { type: "advanceStock" }
  | { type: "restore"; restored: PyramidState };

function reducer(state: PyramidState, action: Action): PyramidState {
  switch (action.type) {
    case "newGame":
      return newPyramidGame();
    case "remove":
      return removePyramidCards(state, action.picks) ?? state;
    case "removeWithWaste":
      return removeWastePair(state, action.pick) ?? state;
    case "advanceStock":
      return advancePyramidStock(state);
    case "restore":
      return action.restored;
    default:
      return state;
  }
}

interface PyramidGameProps {
  settings: ModeSettings;
  onWin: () => void;
  onStatus: (status: ModeStatus) => void;
  onError?: () => void;
}

export const PyramidGame = forwardRef<ModeGameHandle, PyramidGameProps>(
  function PyramidGame({ settings, onWin, onStatus, onError }, ref) {
    const [state, dispatch] = useReducer(reducer, undefined, newPyramidGame);
    const [picks, setPicks] = useState<PickRef[]>([]);
    const [hintMark, setHintMark] = useState<{
      picks: { row: number; col: number }[];
      useWaste?: boolean;
    } | null>(null);
    const [moves, setMoves] = useState(0);
    const historyRef = useRef<PyramidState[]>([]);
    const wonRef = useRef(false);
    const wasteCard = state.waste[state.waste.length - 1] ?? null;
    const { tableRef, style: geometryStyle } = useTableGeometry({
      columns: 7,
      maxStack: 7,
      topBlockMin: 118,
    });

    useEffect(() => {
      const remaining =
        pyramidRemaining(state) + state.stock.length + state.waste.length;
      onStatus({ moves, left: remaining, done: 52 - remaining, total: 52 });
      if (isPyramidWon(state) && !wonRef.current) {
        wonRef.current = true;
        onWin();
      }
    }, [state, moves, onStatus, onWin]);

    const perform = useCallback(
      (action: Action) => {
        switch (action.type) {
          case "remove":
            if (!removePyramidCards(state, action.picks)) {
              onError?.();
              return;
            }
            break;
          case "removeWithWaste":
            if (!removeWastePair(state, action.pick)) {
              onError?.();
              return;
            }
            break;
          case "advanceStock":
            if (advancePyramidStock(state) === state) {
              onError?.();
              return;
            }
            break;
          default:
            return;
        }
        historyRef.current = [...historyRef.current, state];
        if (action.type !== "advanceStock") setMoves((m) => m + 1);
        setPicks([]);
        setHintMark(null);
        dispatch(action);
      },
      [state, onError]
    );

    const clickStock = useCallback(() => {
      perform({ type: "advanceStock" });
    }, [perform]);

    const clickCard = useCallback(
      (row: number, col: number) => {
        if (!isPyramidPresent(state, row, col)) return;
        if (isPyramidCovered(state, row, col)) {
          onError?.();
          return;
        }
        const card = state.rows[row][col]!;
        if (pyramidValue(card) === 13) {
          perform({ type: "remove", picks: [{ row, col }] });
          return;
        }
        setPicks((prev) => {
          const next = [...prev, { row, col } as PickRef];
          if (next.length === 2) {
            const pyramidOnly = next.filter(
              (p): p is { row: number; col: number } => !("waste" in p)
            );
            if (pyramidOnly.length === 2) {
              const values = pyramidOnly.map(
                (p) => pyramidValue(state.rows[p.row][p.col]!)
              );
              if (values[0] + values[1] === 13) {
                perform({ type: "remove", picks: pyramidOnly });
                return [];
              }
              onError?.();
              return [next[next.length - 1] as PickRef];
            }
          }
          return next;
        });
      },
      [state, perform, onError]
    );

    const clickWaste = useCallback(() => {
      if (!wasteCard) return;
      if (pyramidValue(wasteCard) === 13) {
        perform({ type: "removeWithWaste", pick: null });
        return;
      }
      const pyramidPicks = picks.filter(
        (p): p is { row: number; col: number } => !("waste" in p)
      );
      if (pyramidPicks.length > 0) {
        perform({
          type: "removeWithWaste",
          pick: pyramidPicks[pyramidPicks.length - 1],
        });
      } else {
        setPicks((prev) =>
          prev.some((p) => "waste" in p) ? prev : [...prev, { waste: true } as PickRef]
        );
      }
    }, [wasteCard, picks, perform]);

    useImperativeHandle(ref, () => ({
      newGame: () => {
        historyRef.current = [];
        setMoves(0);
        setPicks([]);
        setHintMark(null);
        wonRef.current = false;
        dispatch({ type: "newGame" });
      },
      undo: () => {
        const previous = historyRef.current.pop();
        if (previous) {
          setPicks([]);
          setHintMark(null);
          setMoves((m) => Math.max(0, m - 1));
          dispatch({ type: "restore", restored: previous });
        }
      },
      hint: () => {
        setHintMark(pyramidHint(state));
      },
    }));

    const isPicked = (row: number, col: number) =>
      picks.some((p) => !("waste" in p) && p.row === row && p.col === col);
    const isHinted = (row: number, col: number) =>
      !!hintMark && hintMark.picks.some((p) => p.row === row && p.col === col);

    return (
      <div
        ref={tableRef}
        className={styles.table}
        style={geometryStyle}
      >
        {/* Rangée du haut : talon + déchet + compteur */}
        <div className={styles.topRow}>
          <div className={styles.stock}>
            {state.stock.length > 0 ? (
              <button
                type="button"
                className={styles.stockButton}
                onClick={clickStock}
                aria-label={`Talon : ${state.stock.length} cartes restantes`}
              >
                <span
                  className={styles.stockBack}
                  style={{
                    backgroundImage: `url(${cardBackImages[settings.backKey]})`,
                  }}
                />
                <span className={styles.stockCount}>{state.stock.length}</span>
              </button>
            ) : (
              <button
                type="button"
                className={styles.stockButton}
                onClick={clickStock}
                aria-label="Recycler le déchet dans le talon"
              >
                <span className={styles.stockRecycle}>↻</span>
                <span className={styles.stockCount}>
                  {state.waste.length > 0 ? "recycler" : "vide"}
                </span>
              </button>
            )}
          </div>

          <div className={styles.waste} aria-label="Déchet">
            {wasteCard ? (
              <div className={styles.wasteCard} onClick={clickWaste}>
                <SolitairePlayingCard
                  card={wasteCard}
                  backKey={settings.backKey}
                  selected={picks.some((p) => "waste" in p)}
                  hinted={!!hintMark?.useWaste}
                  position={0}
                />
              </div>
            ) : (
              <div className={styles.wasteEmpty}>déchet</div>
            )}
          </div>

          <div className={styles.info}>
            <span className={styles.infoValue}>
              {pyramidRemaining(state)} cartes
            </span>
            <span className={styles.infoHint}>
              Paires de 13 — le roi s&apos;en va seul
            </span>
          </div>
        </div>

        {/* La pyramide */}
        <div className={styles.pyramid}>
          {state.rows.map((row, r) => (
            <div key={r} className={styles.pyramidRow}>
              {row.map((card, c) => {
                const present = card !== null;
                const covered = present && isPyramidCovered(state, r, c);
                const playable = present && !covered;
                return (
                  <div
                    key={c}
                    className={
                      playable ? styles.pyramidCard : styles.pyramidCardBlind
                    }
                    onClick={playable ? () => clickCard(r, c) : undefined}
                  >
                    {card && (
                      <SolitairePlayingCard
                        card={card}
                        backKey={settings.backKey}
                        selected={isPicked(r, c)}
                        hinted={isHinted(r, c)}
                        draggable={false}
                        position={c}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {hintMark && (
          <p className={styles.hintLabel} role="status">
            {hintMark.picks.length > 0
              ? "Paire de 13 trouvée !"
              : hintMark.useWaste
                ? "Le roi du déchet peut partir seul."
                : "Retournez une carte du talon."}
          </p>
        )}
      </div>
    );
  }
);