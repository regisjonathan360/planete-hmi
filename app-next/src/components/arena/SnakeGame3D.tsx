/* ------------------------------------------------------------
   SnakeGame3D — composant React (wrapper mince)
   Instancie le moteur SnakeGame, gère le menu (pseudo, skin,
   record), le HUD, le leaderboard et les raccourcis clavier.
   ------------------------------------------------------------ */

"use client";

import { useEffect, useRef, useState } from "react";
import {
  SnakeGame,
  readBest,
  type SnakePhase,
  type LeaderboardEntry,
} from "@/game/snake/SnakeGame";
import { SNAKE_CONFIG } from "@/game/snake/config";
import "./snake.css";

const IS_TOUCH =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

const NICK_KEY = "snake3d.nick";
const SKIN_KEY = "snake3d.skin";

function readStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible */
  }
}

async function tryFullscreen(el: HTMLElement): Promise<void> {
  try {
    if (!document.fullscreenElement) await el.requestFullscreen();
  } catch {
    /* encart */
  }
  try {
    const ori = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    await ori.lock?.("landscape");
  } catch {
    /* lock */
  }
}

const SKIN_HEX = SNAKE_CONFIG.snakeColors.map((c) =>
  `#${c.toString(16).padStart(6, "0")}`
);

export function SnakeGame3D() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<SnakeGame | null>(null);
  const [phase, setPhase] = useState<SnakePhase>("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(readBest);
  const [countdown, setCountdown] = useState(3);
  const [isRecord, setIsRecord] = useState(false);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [nick, setNick] = useState(() => readStored(NICK_KEY, "Joueur"));
  const [skinIdx, setSkinIdx] = useState(() => {
    const n = Number(readStored(SKIN_KEY, "0")) || 0;
    return Math.max(0, Math.min(SNAKE_CONFIG.snakeColors.length - 1, n));
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const game = new SnakeGame(stage, {
      onPhase: (p, s, b, rec) => {
        setPhase(p);
        setScore(s);
        setBest(b);
        setIsRecord(rec);
      },
      onCountdown: setCountdown,
      onLeaderboard: setBoard,
    });
    gameRef.current = game;
    game.mount();
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    gameRef.current?.setPlayerName(nick);
  }, [nick]);

  useEffect(() => {
    gameRef.current?.setPlayerColor(SNAKE_CONFIG.snakeColors[skinIdx]);
  }, [skinIdx]);

  const applySkin = (idx: number): void => {
    setSkinIdx(idx);
    writeStored(SKIN_KEY, String(idx));
    gameRef.current?.setPlayerColor(SNAKE_CONFIG.snakeColors[idx]);
  };

  const applyNick = (value: string): void => {
    setNick(value);
    writeStored(NICK_KEY, value);
    gameRef.current?.setPlayerName(value);
  };

  const onPlay = (): void => {
    if (stageRef.current) void tryFullscreen(stageRef.current);
    gameRef.current?.setPlayerName(nick);
    gameRef.current?.setPlayerColor(SNAKE_CONFIG.snakeColors[skinIdx]);
    gameRef.current?.startGame();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === "Enter") {
        e.preventDefault();
        if (phase === "menu" || phase === "gameover") onPlay();
        else if (phase === "playing") gameRef.current?.togglePause();
      } else if (e.code === "KeyP") {
        e.preventDefault();
        gameRef.current?.togglePause();
      } else if (e.code === "Escape") {
        gameRef.current?.quitToMenu();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const inGame = phase === "playing" || phase === "countdown" || phase === "paused";

  return (
    <div ref={stageRef} className="snake-stage" data-phase={phase}>
      {inGame && (
        <div className="snake-hud">
          <div className="snake-hud__left">
            <span className="snake-hud__label">Longueur</span>
            <span className="snake-hud__value">{score}</span>
          </div>
          <div className="snake-hud__right">
            <div className="snake-hud__best">
              <span className="snake-hud__label">Record</span>
              <span className="snake-hud__value snake-hud__value--best">
                {best}
              </span>
            </div>
            {phase === "playing" && (
              <button
                type="button"
                className="snake-icon-btn"
                aria-label="Pause"
                onClick={() => gameRef.current?.togglePause()}
              >
                ⏸
              </button>
            )}
          </div>
        </div>
      )}

      {(inGame || phase === "menu") && board.length > 0 && (
        <div className="snk-board">
          <p className="snk-board__title">Classement</p>
          <ol className="snk-board__list">
            {board.map((e, i) => (
              <li
                key={e.name}
                className={i === 0 ? "snk-board__row snk-board__row--first" : "snk-board__row"}
              >
                <span
                  className="snk-board__dot"
                  style={{ backgroundColor: `#${e.color.toString(16).padStart(6, "0")}` }}
                />
                <span className="snk-board__name">{e.name}</span>
                <span className="snk-board__pts">{e.score}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {phase === "playing" && IS_TOUCH && (
        <button
          type="button"
          className="snk-boost-btn"
          onPointerDown={() => gameRef.current?.setTouchBoost(true)}
          onPointerUp={() => gameRef.current?.setTouchBoost(false)}
          onPointerCancel={() => gameRef.current?.setTouchBoost(false)}
        >
          ⚡ BOOST
        </button>
      )}

      {phase === "countdown" && (
        <div className="snake-countdown" key={countdown}>
          <span>{countdown}</span>
        </div>
      )}

      {phase === "menu" && (
        <div className="snake-overlay snake-overlay--menu">
          <div className="snake-panel snake-menu">
            <p className="snake-panel__tag">{"// Arène planétaire"}</p>
            <h2 className="snake-menu__title">
              <span className="snake-menu__title-main">KOULÈV</span>
              <span className="snake-menu__title-3d">3D</span>
            </h2>

            <label className="snake-menu__field">
              <span className="snake-menu__field-label">Ton pseudo</span>
              <input
                className="snake-menu__input"
                value={nick}
                maxLength={12}
                placeholder="Joueur"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => applyNick(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onPlay();
                  }
                }}
              />
            </label>

            <div className="snake-menu__skins">
              <span className="snake-menu__field-label">Ton skin</span>
              <div className="snake-menu__swatches">
                {SKIN_HEX.map((hex, i) => (
                  <button
                    key={hex}
                    type="button"
                    className={
                      i === skinIdx
                        ? "snake-menu__swatch snake-menu__swatch--on"
                        : "snake-menu__swatch"
                    }
                    style={{ backgroundColor: hex }}
                    aria-label={`Skin ${i + 1}`}
                    aria-pressed={i === skinIdx}
                    onClick={() => applySkin(i)}
                  />
                ))}
              </div>
            </div>

            {best > 0 && (
              <p className="snake-menu__best">
                🏆 Record : <strong>{best}</strong>
              </p>
            )}

            <div className="snake-panel__actions">
              <button type="button" className="snake-btn snake-btn--play snake-menu__play" onClick={onPlay}>
                ▶ Jouer
              </button>
            </div>

            <ul className="snake-rules">
              {IS_TOUCH ? (
                <>
                  <li>
                    <span className="snake-rules__ico">👆</span> Touche l&apos;écran :
                    le joystick apparaît sous ton doigt
                  </li>
                  <li>
                    <span className="snake-rules__ico">⚡</span> Maintiens BOOST
                    pour accélérer… mais ça raccourcit !
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <span className="snake-rules__ico">🖱️</span> La souris pilote
                    le serpent · clic gauche maintenu = Boost
                  </li>
                  <li>
                    <span className="snake-rules__ico">⌨️</span> Flèches / WASD en
                    secours · <kbd>Espace</kbd> Boost · <kbd>Entrée</kbd> lancer ·{" "}
                    <kbd>P</kbd> pause
                  </li>
                </>
              )}
              <li>
                <span className="snake-rules__ico">📡</span> Minimap en bas à
                droite
              </li>
            </ul>
          </div>
        </div>
      )}

      {phase === "paused" && (
        <div className="snake-overlay">
          <div className="snake-panel">
            <p className="snake-panel__tag">{"// Pause"}</p>
            <h2 className="snake-panel__title">Pause</h2>
            <div className="snake-panel__actions">
              <button
                type="button"
                className="snake-btn snake-btn--play"
                onClick={() => gameRef.current?.togglePause()}
              >
                Reprendre
              </button>
              <button
                type="button"
                className="snake-btn"
                onClick={() => gameRef.current?.quitToMenu()}
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "gameover" && (
        <div className="snake-overlay">
          <div className="snake-panel">
            <p className="snake-panel__tag">{"// Fin de course"}</p>
            <h2 className="snake-panel__title">Game over</h2>
            {isRecord && (
              <p className="snake-panel__record">🏆 Nouveau record !</p>
            )}
            <p className="snake-panel__score">
              Longueur : <strong>{score}</strong>
            </p>
            {best > 0 && (
              <p className="snake-panel__best">
                Meilleur : <strong>{best}</strong>
              </p>
            )}
            <div className="snake-panel__actions">
              <button type="button" className="snake-btn snake-btn--play" onClick={onPlay}>
                Rejouer
              </button>
              <button
                type="button"
                className="snake-btn"
                onClick={() => gameRef.current?.quitToMenu()}
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
