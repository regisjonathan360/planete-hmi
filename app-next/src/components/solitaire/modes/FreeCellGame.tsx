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
import {
  applyCellToFoundation,
  applyFreeCellMove,
  applyFromCell,
  applyToCell,
  applyToFoundation,
  freeCellCardsLeft,
  freeCellHint,
  isFreeCellRun,
  isFreeCellWon,
  isValidFreeCellMove,
  newFreeCellGame,
  type FreeCellState,
} from "@/lib/solitaire/freecellEngine";
import type { GameCard } from "@/lib/solitaire/modes";
import type {
  ModeGameHandle,
  ModeSettings,
  ModeStatus,
} from "./modeShellTypes";
import { SolitairePlayingCard } from "./SolitairePlayingCard";
import { useTableDrag } from "./useTableDrag";
import { useTableGeometry } from "./useTableGeometry";
import { useSolitaireFullscreen } from "@/components/solitaire/SolitaireScaleFrame";
import styles from "./freecell-game.module.css";

type DragPayload =
  | { kind: "col"; col: number; start: number }
  | { kind: "cell"; cell: number };

type Action =
  | { type: "newGame" }
  | { type: "colToCol"; from: number; start: number; to: number }
  | { type: "colToCell"; from: number; cell: number }
  | { type: "cellToCol"; cell: number; to: number }
  | { type: "colToFoundation"; from: number; foundation: number }
  | { type: "cellToFoundation"; cell: number; foundation: number }
  | { type: "restore"; restored: FreeCellState };

function reducer(state: FreeCellState, action: Action): FreeCellState {
  switch (action.type) {
    case "newGame":
      return newFreeCellGame();
    case "colToCol":
      if (!isValidFreeCellMove(state, action.from, action.start, action.to)) {
        return state;
      }
      return applyFreeCellMove(state, action.from, action.start, action.to);
    case "colToCell":
      return applyToCell(state, action.from, action.cell) ?? state;
    case "cellToCol":
      return applyFromCell(state, action.cell, action.to) ?? state;
    case "colToFoundation":
      return applyToFoundation(state, action.from, action.foundation) ?? state;
    case "cellToFoundation":
      return applyCellToFoundation(state, action.cell, action.foundation) ?? state;
    case "restore":
      return action.restored;
    default:
      return state;
  }
}

interface FreeCellGameProps {
  settings: ModeSettings;
  onWin: () => void;
  onStatus: (status: ModeStatus) => void;
  onError?: () => void;
}

interface HintMark {
  from: number;
  start?: number;
  to: number;
}

export const FreeCellGame = forwardRef<ModeGameHandle, FreeCellGameProps>(
  function FreeCellGame({ settings, onWin, onStatus, onError }, ref) {
    const [state, dispatch] = useReducer(reducer, undefined, newFreeCellGame);
    const [selected, setSelected] = useState<{
      kind: "col" | "cell";
      index: number;
      start?: number;
    } | null>(null);
    const [hint, setHint] = useState<HintMark | null>(null);
    const [moves, setMoves] = useState(0);
    const historyRef = useRef<FreeCellState[]>([]);
    const wonRef = useRef(false);

    const tableRef = useRef<HTMLDivElement>(null);
    const { isFullscreen } = useSolitaireFullscreen();
    const { ghost, ghostStyle, beginDrag } = useTableDrag({
      onDrop: handleDrop,
      frameRef: tableRef,
    });
    const {
      style: geometryStyle,
      overlap,
    } = useTableGeometry({ columns: 8, maxStack: 24, isFullscreen });

    useEffect(() => {
      onStatus({
        moves,
        left: freeCellCardsLeft(state),
        done: state.foundations.reduce((sum, f) => sum + f.length, 0),
        total: 52,
      });
      if (isFreeCellWon(state) && !wonRef.current) {
        wonRef.current = true;
        onWin();
      }
    }, [state, moves, onStatus, onWin]);

    const perform = useCallback(
      (action: Action) => {
        let valid = true;
        switch (action.type) {
          case "colToCol":
            valid = isValidFreeCellMove(state, action.from, action.start, action.to);
            break;
          case "colToCell":
            valid = state.cols[action.from].length > 0 && state.cells[action.cell] === null;
            break;
          case "cellToCol":
            valid = state.cells[action.cell] !== null;
            break;
          case "colToFoundation":
            valid = state.cols[action.from].length > 0;
            break;
          case "cellToFoundation":
            valid = state.cells[action.cell] !== null;
            break;
          default:
            return;
        }
        if (!valid) {
          onError?.();
          return;
        }
        historyRef.current = [...historyRef.current, state];
        setMoves((m) => m + 1);
        setSelected(null);
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
      const positionAttr = element
        ?.closest?.("[data-position]")
        ?.getAttribute("data-position");
      const clickedIndex =
        positionAttr !== null && positionAttr !== undefined
          ? Number(positionAttr)
          : null;

      /* Clic = sélection (ou déplacement de la sélection). */
      if (moved <= 6) {
        if (selected) {
          const targetCol = zone && zone.startsWith("col-") ? Number(zone.slice(4)) : NaN;
          const targetCell = zone && zone.startsWith("cell-") ? Number(zone.slice(5)) : NaN;
          const targetFond = zone && zone.startsWith("fond-") ? Number(zone.slice(5)) : NaN;

          if (Number.isFinite(targetCol) && selected.kind === "col") {
            perform({ type: "colToCol", from: selected.index, start: selected.start ?? 0, to: targetCol });
            return;
          }
          if (Number.isFinite(targetCol) && selected.kind === "cell") {
            perform({ type: "cellToCol", cell: selected.index, to: targetCol });
            return;
          }
          if (Number.isFinite(targetCell) && selected.kind === "col") {
            perform({ type: "colToCell", from: selected.index, cell: targetCell });
            return;
          }
          if (Number.isFinite(targetFond) && selected.kind === "col") {
            perform({ type: "colToFoundation", from: selected.index, foundation: targetFond });
            return;
          }
          if (Number.isFinite(targetFond) && selected.kind === "cell") {
            perform({ type: "cellToFoundation", cell: selected.index, foundation: targetFond });
            return;
          }
          setSelected(null);
          return;
        }

        if (p.kind === "col" && clickedIndex !== null) {
          if (isFreeCellRun(state.cols[p.col], Number(clickedIndex))) {
            const start =
              Number(clickedIndex) === state.cols[p.col].length - 1
                ? state.cols[p.col].length - 1
                : Number(clickedIndex);
            setSelected({ kind: "col", index: p.col, start });
          }
          return;
        }
        if (p.kind === "cell") {
          setSelected({ kind: "cell", index: p.cell });
          return;
        }
        return;
      }

      /* Drag. */
      if (p.kind === "col") {
        if (zone?.startsWith("col-")) {
          const to = Number(zone.slice(4));
          if (Number.isFinite(to)) perform({ type: "colToCol", from: p.col, start: p.start, to });
        } else if (zone?.startsWith("cell-")) {
          const cell = Number(zone.slice(5));
          if (Number.isFinite(cell) && p.start === state.cols[p.col].length - 1) {
            perform({ type: "colToCell", from: p.col, cell });
          }
        } else if (zone?.startsWith("fond-")) {
          const foundation = Number(zone.slice(5));
          if (Number.isFinite(foundation) && p.start === state.cols[p.col].length - 1) {
            perform({ type: "colToFoundation", from: p.col, foundation });
          }
        }
      } else if (p.kind === "cell") {
        if (zone?.startsWith("col-")) {
          perform({ type: "cellToCol", cell: p.cell, to: Number(zone.slice(4)) });
        } else if (zone?.startsWith("fond-")) {
          perform({ type: "cellToFoundation", cell: p.cell, foundation: Number(zone.slice(5)) });
        }
      }
    }

    useImperativeHandle(ref, () => ({
      newGame: () => {
        historyRef.current = [];
        setMoves(0);
        setSelected(null);
        setHint(null);
        wonRef.current = false;
        dispatch({ type: "newGame" });
      },
      undo: () => {
        const previous = historyRef.current.pop();
        if (previous) {
          setSelected(null);
          setHint(null);
          setMoves((m) => Math.max(0, m - 1));
          dispatch({ type: "restore", restored: previous });
        }
      },
      hint: () => {
        const h = freeCellHint(state);
        if (h) {
          setHint({ from: h.from, start: h.start, to: h.to });
          if (h.kind === "colToCol" || h.kind === "colToCell") {
            setSelected({ kind: "col", index: h.from, start: h.start ?? state.cols[h.from].length - 1 });
          } else if (h.kind === "cellToCol" || h.kind === "cellToFoundation") {
            setSelected({ kind: "cell", index: h.from });
          } else {
            setSelected({ kind: "col", index: h.from, start: state.cols[h.from].length - 1 });
          }
        }
      },
    }));

    const ghostRun: GameCard[] = ghost
      ? (() => {
          const p = ghost.payload as DragPayload;
          if (p.kind === "col") {
            return state.cols[p.col]?.slice(p.start) ?? [];
          }
          const cell = state.cells[p.cell];
          return cell ? [cell] : [];
        })()
      : [];

    const gs = ghostStyle;

    const ghostNode = gs && ghost ? (
      <div
        className={styles.ghostStack}
        style={{
          left: gs.x,
          top: gs.y,
          width: gs.w,
          height: gs.h,
        }}
        aria-hidden="true"
      >
        {ghostRun.slice(0, 3).map((card, i) => (
          <div
            key={i}
            className={styles.ghostCard}
            style={{ transform: `translateY(${i * 4}px)` }}
          >
            <SolitairePlayingCard card={card} backKey={settings.backKey} />
          </div>
        ))}
      </div>
    ) : null;

    return (
      <div
        ref={tableRef}
        className={styles.table}
        style={{ ...geometryStyle, touchAction: "none" }}
      >
        {/* Rangée du haut : 4 cellules, 4 fondations */}
        <div className={styles.topRow}>
          <div className={styles.cells}>
            {state.cells.map((card, i) => (
              <div
                key={i}
                className={styles.cellSlot}
                data-drop={`cell-${i}`}
                onPointerDown={beginDrag({ kind: "cell", cell: i })}
              >
                {card ? (
                  <SolitairePlayingCard
                    card={card}
                    backKey={settings.backKey}
                    selected={!!selected && selected.kind === "cell" && selected.index === i}
                    position={0}
                    dropZone={`cell-${i}`}
                  />
                ) : (
                  <div className={styles.cellEmpty} />
                )}
              </div>
            ))}
          </div>

          <div className={styles.foundations}>
            {state.foundations.map((foundation, i) => (
              <div key={i} className={styles.foundationSlot} data-drop={`fond-${i}`}>
                {foundation.length > 0 ? (
                  <SolitairePlayingCard
                    card={foundation[foundation.length - 1]}
                    backKey={settings.backKey}
                    position={0}
                    dropZone={`fond-${i}`}
                    draggable={false}
                  />
                ) : (
                  <div className={styles.foundationEmpty} />
                )}
                <span className={styles.foundationCount}>{foundation.length}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Les 8 colonnes */}
        <div className={styles.columns}>
          {state.cols.map((col, i) => (
            <div key={i} className={styles.column} data-drop={`col-${i}`}>
              {col.length === 0 && <div className={styles.emptySlot} />}
              {col.map((card, index) => {
                const inSelected =
                  !!selected &&
                  selected.kind === "col" &&
                  selected.index === i &&
                  index >= (selected.start ?? col.length - 1);
                const inHint =
                  hint &&
                  (hint.from === i || hint.to === i) &&
                  index >= (hint.start ?? index);
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
                      selected={!!inSelected}
                      hinted={!!inHint}
                      position={index}
                      dropZone={`col-${i}`}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {ghostNode}
      </div>
    );
  }
);
