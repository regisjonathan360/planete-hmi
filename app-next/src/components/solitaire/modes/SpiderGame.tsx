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
  applySpiderMove,
  applySpiderStockDeal,
  isSpiderRun,
  isSpiderWon,
  isValidSpiderMove,
  newSpiderGame,
  spiderCardsLeft,
  spiderHint,
  type SpiderState,
  type SpiderSuits,
} from "@/lib/solitaire/spiderEngine";
import type { GameCard } from "@/lib/solitaire/modes";
import type {
  ModeGameHandle,
  ModeSettings,
  ModeStatus,
} from "./modeShellTypes";
import { SolitairePlayingCard } from "./SolitairePlayingCard";
import { useTableDrag } from "./useTableDrag";
import { useTableGeometry } from "./useTableGeometry";
import styles from "./spider-game.module.css";

interface SpiderGameProps {
  settings: ModeSettings;
  onWin: () => void;
  onStatus: (status: ModeStatus) => void;
  onError?: () => void;
}

interface UiSelection {
  col: number;
  start: number;
}

interface HintMark {
  from: number;
  start: number;
  to: number;
}

type DragPayload =
  | { kind: "col"; col: number; start: number }
  | { kind: "stock" };

type Action =
  | { type: "newGame"; suits: SpiderSuits }
  | { type: "move"; from: number; start: number; to: number }
  | { type: "stockDeal" }
  | { type: "restore"; restored: SpiderState };

function reducer(state: SpiderState, action: Action): SpiderState {
  switch (action.type) {
    case "newGame":
      return newSpiderGame(action.suits);
    case "move":
      if (!isValidSpiderMove(state, action.from, action.start, action.to)) {
        return state;
      }
      return applySpiderMove(state, action.from, action.start, action.to);
    case "stockDeal": {
      return applySpiderStockDeal(state) ?? state;
    }
    case "restore":
      return action.restored;
    default:
      return state;
  }
}

/** Cartes d'une colonne après la suite à déplacer (rendu du fantôme). */
function GhostStack({
  ghost,
  run,
  backKey,
}: {
  ghost: { x: number; y: number; w: number; h: number } | null;
  run: GameCard[];
  backKey: string;
}) {
  if (!ghost) return null;
  return (
    <div
      className={styles.ghostStack}
      style={{ left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h }}
      aria-hidden="true"
    >
      {run.slice(0, 3).map((card, i) => (
        <div
          key={i}
          className={styles.ghostCard}
          style={{ transform: `translateY(${i * 4}px)` }}
        >
          <SolitairePlayingCard card={card} backKey={backKey} />
        </div>
      ))}
      {run.length > 3 && (
        <span className={styles.ghostBadge}>+{run.length - 3}</span>
      )}
    </div>
  );
}

export const SpiderGame = forwardRef<ModeGameHandle, SpiderGameProps>(
  function SpiderGame({ settings, onWin, onStatus, onError }, ref) {
    const [state, dispatch] = useReducer(reducer, settings.suits, (suits) =>
      newSpiderGame(suits)
    );
    const [selection, setSelection] = useState<UiSelection | null>(null);
    const [hint, setHint] = useState<HintMark | null>(null);
    const [moves, setMoves] = useState(0);
    const historyRef = useRef<SpiderState[]>([]);
    const wonRef = useRef(false);

    const tableRef = useRef<HTMLDivElement>(null);
    const { ghost, ghostStyle, beginDrag } = useTableDrag({
      onDrop: handleDrop,
      frameRef: tableRef,
    });
    const {
      style: geometryStyle,
      overlap,
    } = useTableGeometry({ columns: 10, maxStack: 22 });

    useEffect(() => {
      onStatus({
        moves,
        left: spiderCardsLeft(state),
        done: state.done,
        total: 8,
      });
      if (isSpiderWon(state) && !wonRef.current) {
        wonRef.current = true;
        onWin();
      }
    }, [state, moves, onStatus, onWin]);

    const perform = useCallback(
      (action: Action) => {
        if (action.type === "move") {
          if (!isValidSpiderMove(state, action.from, action.start, action.to)) {
            onError?.();
            return;
          }
        } else if (action.type === "stockDeal") {
          if (!applySpiderStockDeal(state)) {
            onError?.();
            return;
          }
        } else {
          return;
        }
        historyRef.current = [...historyRef.current, state];
        setMoves((m) => m + 1);
        setSelection(null);
        setHint(null);
        dispatch(action);
      },
      [state, onError]
    );

    function handleDrop(
      payload: unknown,
      zone: string | null,
      moved: number,
      element: HTMLElement | null
    ) {
      const p = payload as DragPayload;
      if (p.kind === "stock") {
        if (moved <= 6) perform({ type: "stockDeal" });
        return;
      }
      const positionAttr = element
        ?.closest?.("[data-position]")
        ?.getAttribute("data-position");
      const clickedIndex =
        positionAttr !== null && positionAttr !== undefined
          ? Number(positionAttr)
          : null;

      if (moved <= 6) {
        if (selection) {
          const targetCol =
            zone && zone.startsWith("col-") ? Number(zone.slice(4)) : NaN;
          if (Number.isFinite(targetCol)) {
            perform({
              type: "move",
              from: selection.col,
              start: selection.start,
              to: targetCol,
            });
            return;
          }
          if (
            clickedIndex !== null &&
            p.col === selection.col &&
            clickedIndex === selection.start
          ) {
            setSelection(null);
          }
          return;
        }
        if (
          clickedIndex !== null &&
          isSpiderRun(state.cols[p.col], Number(clickedIndex))
        ) {
          setSelection({ col: p.col, start: Number(clickedIndex) });
        }
        return;
      }

      if (zone?.startsWith("col-")) {
        const targetCol = Number(zone.slice(4));
        if (Number.isFinite(targetCol)) {
          perform({ type: "move", from: p.col, start: p.start, to: targetCol });
        }
      }
    }

    useImperativeHandle(ref, () => ({
      newGame: () => {
        historyRef.current = [];
        setMoves(0);
        setSelection(null);
        setHint(null);
        wonRef.current = false;
        dispatch({ type: "newGame", suits: settings.suits });
      },
      undo: () => {
        const previous = historyRef.current.pop();
        if (previous) {
          setSelection(null);
          setHint(null);
          setMoves((m) => Math.max(0, m - 1));
          dispatch({ type: "restore", restored: previous });
        }
      },
      hint: () => {
        const h = spiderHint(state);
        setHint(h);
        if (h) {
          setSelection({ col: h.from, start: h.start });
        }
      },
    }));

    const ghostRun: GameCard[] = ghost
      ? (() => {
          const p = ghost.payload as DragPayload;
          if (p.kind === "stock") return [];
          return state.cols[p.col]?.slice(p.start) ?? [];
        })()
      : [];

    const gs = ghostStyle;

    return (
      <div
        ref={tableRef}
        className={styles.table}
        style={{ ...geometryStyle, touchAction: "none" }}
      >
        <div className={styles.topRow}>
          <div className={styles.stock}>
            {state.stock.length > 0 ? (
              <button
                type="button"
                className={styles.stockButton}
                onPointerDown={beginDrag({ kind: "stock" })}
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
              <div className={styles.stockEmpty} />
            )}
          </div>

          <div className={styles.foundations}>
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className={
                  i < state.done
                    ? styles.foundationDone
                    : styles.foundationSlot
                }
                aria-label={`Suite ${i + 1} : ${i < state.done ? "complète" : "vide"}`}
              >
                {i < state.done && (
                  <span className={styles.foundationMark}>✦</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.columns}>
          {state.cols.map((col, i) => (
            <div key={i} className={styles.column} data-drop={`col-${i}`}>
              {col.length === 0 && <div className={styles.emptySlot} />}
              {col.map((card, index) => {
                const inSelection =
                  !!selection && selection.col === i && index >= selection.start;
                const inHint = !!hint && hint.from === i && index >= hint.start;
                return (
                  <div
                    key={`${card.rank}-${card.suit}-${index}`}
                    className={styles.cardSlot}
                    data-drop={`col-${i}`}
                    onPointerDown={beginDrag({ kind: "col", col: i, start: index })}
                    style={{ top: index * overlap }}
                  >
                    <SolitairePlayingCard
                      card={card}
                      backKey={settings.backKey}
                      selected={inSelection}
                      hinted={inHint}
                      position={index}
                      dropZone={`col-${i}`}
                    />
                  </div>
                );
              })}
              {hint && hint.to === i && (
                <div
                  className={styles.hintTarget}
                  style={{ top: col.length * overlap }}
                />
              )}
            </div>
          ))}
        </div>

{gs && ghost && (
              <GhostStack ghost={gs} run={ghostRun} backKey={settings.backKey} />
            )}
      </div>
    );
  }
);
