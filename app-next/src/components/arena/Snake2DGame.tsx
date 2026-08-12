/* ------------------------------------------------------------
   Snake2DGame — composant React qui embarque le jeu de serpent
   Koulèv 2D (moteur Phaser 2.6) dans l'UI de l'Arène.
   Charge les scripts du jeu depuis /koule2d, monte le canvas
   dans le stage et sert de pont entre l'UI React (menu, HUD,
   pause, game over) et le moteur.
   ------------------------------------------------------------ */

"use client";

import { useEffect, useRef, useState } from "react";
import { SNAKE_CONFIG } from "@/game/snake/config";
import "./snake.css";

const IS_TOUCH =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

const NICK_KEY = "snake3d.nick";
const SKIN_KEY = "snake3d.skin";

type Phase = "menu" | "countdown" | "playing" | "paused" | "gameover";

interface LeaderboardEntry {
  name: string;
  color: number;
  score: number;
}

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

/* Scripts du moteur Phaser 2D, dans l'ordre de chargement.
   Chaque entrée = [chemin du script, nom de la globale créée]. */
const GAME_SCRIPTS: Array<[string, string]> = [
  ["src/joystick", "VirtualJoystick"],
  ["src/eye", "Eye"],
  ["src/eyePair", "EyePair"],
  ["src/shadow", "Shadow"],
  ["src/snake", "Snake"],
  ["src/food", "Food"],
  ["src/botSnake", "BotSnake"],
  ["src/playerSnake", "PlayerSnake"],
  ["src/util", "Util"],
  ["src/game", "Game"],
];

declare global {
  interface Window {
    __koule2dGame?: {
      phase: string;
      startGame(): void;
      togglePause(): void;
      quitToMenu(): void;
      setPlayerColor(color: number): void;
      setTouchBoost(active: boolean): void;
      hud: {
        onPhase: ((phase: Phase, score: number, best: number, isRecord: boolean) => void) | null;
        onCountdown: ((n: number) => void) | null;
      };
    };
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

export function Snake2DGame() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(() => {
    try {
      return Number(localStorage.getItem("koule2d.best") ?? "0") || 0;
    } catch {
      return 0;
    }
  });
  const [countdown, setCountdown] = useState(3);
  const [isRecord, setIsRecord] = useState(false);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [nick, setNick] = useState(() => readStored(NICK_KEY, "Joueur"));
  const [skinIdx, setSkinIdx] = useState(() => {
    const n = Number(readStored(SKIN_KEY, "0")) || 0;
    return Math.max(0, Math.min(SNAKE_CONFIG.snakeColors.length - 1, n));
  });
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  /* ref miroir du skin pour le polling de montage */
  const skinIdxRef = useRef(skinIdx);
  skinIdxRef.current = skinIdx;

  /* -------------------------------------------------- montage Phaser */

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const loadScript = (src: string): Promise<void> =>
      new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = `/koule2d/${src}.js`;
        s.async = false;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`script failed: ${src}`));
        document.body.appendChild(s);
      });

    let disposed = false;
    let phaser: any = null;

    const attachHud = (): void => {
      if (disposed) return;
      const g = (window as any).__koule2dGame;
      if (!g) return;
      g.hud.onPhase = (p: Phase, s: number, b: number, rec: boolean) => {
        setPhase(p);
        setScore(s);
        setBest(b);
        setIsRecord(rec);
      };
      g.hud.onCountdown = (n: number) => setCountdown(n);
    };

    async function boot(): Promise<void> {
      try {
        /* 1-2. Phaser + scripts du jeu, chargés une seule fois par page
           (promesse partagée) pour éviter les rechargements multiples
           et les erreurs "already declared" en cas de double montage */
        const shared =
          (window as any).__koule2dScriptsPromise ||
          ((window as any).__koule2dScriptsPromise = (async () => {
            if (!(window as any).Phaser) {
              await loadScript("lib/phaser.min");
            }
            for (const [path, global] of GAME_SCRIPTS) {
              if (!(window as any)[global]) {
                await loadScript(path);
              }
            }
          })());
        await shared;
        if (disposed || !stageRef.current) return;
        setScriptsLoaded(true);

        /* 3. monter le jeu dans le stage */
        const stageEl = stageRef.current;
        const w = stageEl.clientWidth || 800;
        const h = stageEl.clientHeight || 500;
        const P = (window as any).Phaser;
        phaser = new P.Game(w, h, P.AUTO, stageEl);
        phaser.state.add("Game", (window as any).Game);

        /* 4. brancher les callbacks HUD dès que l'état existe.
           L'objet __koule2dGame n'est créé qu'au premier frame de
           l'état, donc on interroge en boucle jusqu'à le trouver. */
        phaser.state.start("Game");
        const poll = window.setInterval(() => {
          if (disposed) {
            window.clearInterval(poll);
            return;
          }
          const g = (window as any).__koule2dGame;
          if (g && g.hud) {
            window.clearInterval(poll);
            attachHud();
            /* applique le skin choisi dès que le jeu est prêt */
            g.setPlayerColor(SNAKE_CONFIG.snakeColors[skinIdxRef.current]);
          }
        }, 100);
      } catch (err) {
        console.error("Koulèv 2D: erreur de chargement", err);
      }
    }

    void boot();

    /* Pause du fond-3D du site pendant le jeu pour garder 60fps.
       On persiste la valeur sur window car les deux composants sont
       chargés par imports dynamiques indépendants : le fond n'est peut-
       être pas encore monté quand cet événement part. */
    const pauseLights = (paused: boolean): void => {
      (window as any).__sphereStageLightsPaused = paused;
      window.dispatchEvent(
        new CustomEvent("stage-lights:pause", { detail: { paused } })
      );
    };
    pauseLights(true);

    /* Resize du stage -> adapter le canvas Phaser */
    const ro = new ResizeObserver(() => {
      if (!phaser || disposed) return;
      phaser.scale.setGameSize(stage.clientWidth || 800, stage.clientHeight || 500);
    });
    ro.observe(stage);

    return () => {
      disposed = true;
      pauseLights(false);
      ro.disconnect();
      if (phaser) {
        try {
          phaser.destroy(true);
        } catch {
          /* canvas déjà retiré */
        }
      }
      (window as any).__koule2dGame = undefined;
    };
  }, []);

  useEffect(() => {
    if (!scriptsLoaded) return;
    const g = (window as any).__koule2dGame;
    if (g) g.setPlayerColor(SNAKE_CONFIG.snakeColors[skinIdx]);
  }, [skinIdx, scriptsLoaded]);

  const applySkin = (idx: number): void => {
    setSkinIdx(idx);
    writeStored(SKIN_KEY, String(idx));
    const g = (window as any).__koule2dGame;
    if (g) g.setPlayerColor(SNAKE_CONFIG.snakeColors[idx]);
  };

  const applyNick = (value: string): void => {
    setNick(value);
    writeStored(NICK_KEY, value);
  };

  const onPlay = (): void => {
    if (stageRef.current) void tryFullscreen(stageRef.current);
    const g = (window as any).__koule2dGame;
    if (!g) return;
    g.setPlayerColor(SNAKE_CONFIG.snakeColors[skinIdx]);
    g.startGame();
  };

  const game = () => (window as any).__koule2dGame;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === "Enter") {
        e.preventDefault();
        if (phase === "menu" || phase === "gameover") onPlay();
        else if (phase === "playing") game()?.togglePause();
      } else if (e.code === "KeyP") {
        e.preventDefault();
        game()?.togglePause();
      } else if (e.code === "Escape") {
        game()?.quitToMenu();
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
                onClick={() => game()?.togglePause()}
              >
                ⏸
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "playing" && IS_TOUCH && (
        <button
          type="button"
          className="snk-boost-btn"
          onPointerDown={() => game()?.setTouchBoost(true)}
          onPointerUp={() => game()?.setTouchBoost(false)}
          onPointerCancel={() => game()?.setTouchBoost(false)}
        >
          ⚡ BOOST
        </button>
      )}

      {phase === "countdown" && (
        <div className="snake-countdown" key={countdown}>
          <span>{countdown}</span>
        </div>
      )}

      {!scriptsLoaded && (
        <div className="snake-overlay snake-overlay--menu">
          <div className="snake-panel">
            <p className="snake-panel__tag">{"// Arène planétaire"}</p>
            <h2 className="snake-panel__title">Chargement du moteur…</h2>
          </div>
        </div>
      )}

      {phase === "menu" && (
        <div className="snake-overlay snake-overlay--menu">
          <div className="snake-panel snake-menu">
            <p className="snake-panel__tag">{"// Arène planétaire"}</p>
            <h2 className="snake-menu__title">
              <span className="snake-menu__title-main">KOULÈV</span>
              <span className="snake-menu__title-3d">2D</span>
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
                    pour accélérer… mais attention aux collisions !
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <span className="snake-rules__ico">🖱️</span> La souris pilote
                    le serpent · <kbd>Espace</kbd> = Boost
                  </li>
                  <li>
                    <span className="snake-rules__ico">⌨️</span> Flèches en
                    secours · <kbd>Entrée</kbd> lancer · <kbd>P</kbd> pause
                  </li>
                </>
              )}
              <li>
                <span className="snake-rules__ico">💀</span> Ne touche ni les
                autres serpents ni le bord du monde
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
                onClick={() => game()?.togglePause()}
              >
                Reprendre
              </button>
              <button
                type="button"
                className="snake-btn"
                onClick={() => game()?.quitToMenu()}
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
                onClick={() => game()?.quitToMenu()}
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