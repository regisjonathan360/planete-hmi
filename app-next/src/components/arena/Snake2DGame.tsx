/* ------------------------------------------------------------
   Snake2DGame — composant React qui embarque le jeu de serpent
   HMI Snake 2D (moteur Phaser) dans l'UI de l'Arène.
   Charge les scripts du jeu depuis /koule2d, monte le canvas
   dans le stage et sert de pont entre l'UI React (menu, HUD,
   pause, game over) et le moteur.
   ------------------------------------------------------------ */

"use client";

import { useEffect, useRef, useState } from "react";
import "./snake.css";

const NICK_KEY = "koule2d.nick";
const LEGACY_NICK_KEY = "snake3d.nick";
const SKIN_KEY = "koule2d.skin";

type Phase = "menu" | "countdown" | "playing" | "paused" | "gameover";

interface LeaderboardEntry {
  name: string;
  color: number;
  score: number;
}

interface MinimapPoint {
  x: number;
  y: number;
}

interface MinimapSnake {
  name: string;
  x: number;
  y: number;
  color: number;
  isPlayer: boolean;
  points: MinimapPoint[];
}

interface MinimapSnapshot {
  left: number;
  right: number;
  top: number;
  bottom: number;
  snakes: MinimapSnake[];
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
      restartGame?(): void;
      togglePause(): void;
      quitToMenu(): void;
      setPlayerColor(color: number): void;
      setPlayerSkin(skin: SnakeSkin): void;
      setPlayerName(name: string): void;
      setTouchBoost(active: boolean): void;
      releaseBoost(): void;
      setTouchEject(active: boolean): void;
      getMinimapSnapshot?(): MinimapSnapshot;
      toggleSound(): boolean;
      soundEnabled: boolean;
      hud: {
        onPhase: ((phase: Phase, score: number, best: number, isRecord: boolean) => void) | null;
        onCountdown: ((n: number) => void) | null;
        onLeaderboard: ((entries: LeaderboardEntry[]) => void) | null;
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

export function Snake2DGame() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const autoPausedRef = useRef(false);
  const nickRef = useRef("");
  const [phase, setPhase] = useState<Phase>("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(readBest);
  const [countdown, setCountdown] = useState(3);
  const [isRecord, setIsRecord] = useState(false);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [minimap, setMinimap] = useState<MinimapSnapshot | null>(null);
  const [nick, setNick] = useState(readNick);
  const [skinIdx, setSkinIdx] = useState(() => {
    const n = Number(readStored(SKIN_KEY, "0")) || 0;
    return Math.max(0, Math.min(HMI_SKINS.length - 1, n));
  });
  const [skins, setSkins] = useState<SnakeSkin[]>(HMI_SKINS);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pauseMinimized, setPauseMinimized] = useState(false);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const submittedScoreRef = useRef(false);
  const submitScoreRef = useRef<((value: number) => void) | null>(null);

  /* ref miroir du skin pour le polling de montage */
  const skinIdxRef = useRef(skinIdx);
  skinIdxRef.current = skinIdx;
  nickRef.current = nick;

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
        if (p === "gameover") submitScoreRef.current?.(s);
      };
      g.hud.onCountdown = (n: number) => setCountdown(n);
      g.hud.onLeaderboard = (entries: LeaderboardEntry[]) => setBoard(entries);
      setSoundEnabled(g.soundEnabled !== false);
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
            setEngineReady(true);
    g.setPlayerName(nickRef.current);
            /* applique le skin choisi dès que le jeu est prêt */
            g.setPlayerSkin(HMI_SKINS[skinIdxRef.current]);
          }
        }, 100);
      } catch (err) {
        delete (window as any).__koule2dScriptsPromise;
        setEngineError(err instanceof Error ? err.message : "chargement impossible");
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
      setEngineReady(false);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const g = (window as any).__koule2dGame;
      if (document.hidden && g?.phase === "playing") {
        g.togglePause();
        autoPausedRef.current = true;
      } else if (!document.hidden && autoPausedRef.current && g?.phase === "paused") {
        g.togglePause();
        autoPausedRef.current = false;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* Pointer-up can happen outside the button on mobile. Always release the
     gameplay actions globally so a lost pointer event can never leave boost
     or ejection stuck on. */
  useEffect(() => {
    const releaseTouchActions = () => {
      const g = (window as any).__koule2dGame;
      g?.releaseBoost?.();
      g?.setTouchBoost(false);
      g?.setTouchEject(false);
    };
    window.addEventListener("pointerup", releaseTouchActions, true);
    window.addEventListener("pointercancel", releaseTouchActions, true);
    window.addEventListener("blur", releaseTouchActions);
    document.addEventListener("visibilitychange", releaseTouchActions);
    return () => {
      window.removeEventListener("pointerup", releaseTouchActions, true);
      window.removeEventListener("pointercancel", releaseTouchActions, true);
      window.removeEventListener("blur", releaseTouchActions);
      document.removeEventListener("visibilitychange", releaseTouchActions);
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing") {
      const g = (window as any).__koule2dGame;
      g?.releaseBoost?.();
      g?.setTouchBoost(false);
      g?.setTouchEject(false);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "paused") setPauseMinimized(false);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/koule2d/skins/skin-catalog.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("catalogue indisponible"))))
      .then((catalog: Array<{ id: string; name: string; frame: string; palette?: string[]; rarity?: string }>) => {
        if (cancelled || !Array.isArray(catalog) || catalog.length === 0) return;
        setSkins(catalog.map((skin) => ({
          id: skin.id,
          frame: skin.frame || skin.id,
          name: skin.name,
          base: hexToNumber(skin.palette?.[0], 0x2de2ff),
          accent: hexToNumber(skin.palette?.[1], 0x8b2fff),
          style: "pulse" as const,
          rarity: skin.rarity || "standard",
        })));
        const stored = Number(readStored(SKIN_KEY, "0")) || 0;
        setSkinIdx(Math.max(0, Math.min(catalog.length - 1, stored)));
      })
      .catch(() => {
        /* Le fallback intégré garde le menu utilisable hors ligne. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scriptsLoaded) return;
    const g = (window as any).__koule2dGame;
    if (g) g.setPlayerSkin(skins[skinIdx] || HMI_SKINS[0]);
  }, [skinIdx, scriptsLoaded, skins]);

  const applySkin = (idx: number): void => {
    setSkinIdx(idx);
    writeStored(SKIN_KEY, String(idx));
    const g = (window as any).__koule2dGame;
    if (g) g.setPlayerSkin(skins[idx] || HMI_SKINS[0]);
  };

  const applyNick = (value: string): void => {
    setNick(value);
    writeStored(NICK_KEY, value);
    (window as any).__koule2dGame?.setPlayerName(value);
  };

  const onPlay = (): void => {
    if (stageRef.current) void tryFullscreen(stageRef.current);
    const g = (window as any).__koule2dGame;
    if (!g || !engineReady) return;
    g.setPlayerName(nick);
    g.setPlayerSkin(skins[skinIdx] || HMI_SKINS[0]);
    submittedScoreRef.current = false;
    if (typeof g.restartGame === "function") g.restartGame();
    else g.startGame();
  };

  const toggleSound = (): void => {
    const g = (window as any).__koule2dGame;
    if (!g) return;
    setSoundEnabled(Boolean(g.toggleSound()));
  };

  const submitScore = (value: number): void => {
    if (submittedScoreRef.current || value <= 0) return;
    submittedScoreRef.current = true;
    void fetch("/api/arene/snake-scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ score: value, pseudo: nickRef.current, skin: skinIdxRef.current }),
      keepalive: true,
    }).catch(() => {
      /* Le meilleur score local reste disponible si l'utilisateur est anonyme. */
    });
  };
  submitScoreRef.current = submitScore;

  const game = () => (window as any).__koule2dGame;

  useEffect(() => {
    const visible = phase === "playing" || phase === "countdown" || phase === "paused";
    if (!engineReady || !visible) {
      setMinimap(null);
      return;
    }

    const readSnapshot = (): void => {
      const snapshot = game()?.getMinimapSnapshot?.();
      if (snapshot) setMinimap(snapshot);
    };
    readSnapshot();
    const timer = window.setInterval(readSnapshot, 120);
    return () => window.clearInterval(timer);
  }, [phase, engineReady]);

  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas || !minimap) return;
    const size = 260;
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const project = (point: MinimapPoint): MinimapPoint => ({
      x: 8 + ((point.x - minimap.left) / Math.max(1, minimap.right - minimap.left)) * (size - 16),
      y: 8 + ((point.y - minimap.top) / Math.max(1, minimap.bottom - minimap.top)) * (size - 16),
    });
    const color = (value: number): string => `#${Math.max(0, value || 0).toString(16).padStart(6, "0").slice(-6)}`;

    ctx.strokeStyle = "rgba(45, 226, 255, 0.18)";
    ctx.lineWidth = 1;
    [size * 0.25, size * 0.5, size * 0.75].forEach((offset) => {
      ctx.beginPath();
      ctx.moveTo(offset, 8);
      ctx.lineTo(offset, size - 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, offset);
      ctx.lineTo(size - 8, offset);
      ctx.stroke();
    });

    ctx.strokeStyle = "rgba(255, 43, 214, 0.82)";
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, size - 16, size - 16);

    minimap.snakes.forEach((snake) => {
      const points = snake.points.map(project);
      if (points.length > 1) {
        ctx.beginPath();
        points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.strokeStyle = snake.isPlayer ? "#ffffff" : color(snake.color);
        ctx.globalAlpha = snake.isPlayer ? 0.9 : 0.56;
        ctx.lineWidth = snake.isPlayer ? 5 : 3;
        ctx.stroke();
      }
      const head = project(snake);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(head.x, head.y, snake.isPlayer ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = snake.isPlayer ? "#ffffff" : color(snake.color);
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = snake.isPlayer ? 14 : 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }, [minimap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === "Enter") {
        e.preventDefault();
        if (phase === "menu" || phase === "gameover") onPlay();
        else if (phase === "playing") game()?.togglePause();
      } else if (e.code === "KeyP") {
        e.preventDefault();
        game()?.togglePause();
      } else if (e.code === "KeyE") {
        e.preventDefault();
        game()?.ejectWaste?.();
      } else if (e.code === "Space") {
        e.preventDefault();
        game()?.setTouchBoost(true);
      } else if (e.code === "Escape") {
        game()?.quitToMenu();
      }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === "Space") {
        e.preventDefault();
        game()?.releaseBoost?.();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
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
            <button
              type="button"
              className="snake-icon-btn"
              aria-label={soundEnabled ? "Couper le son" : "Activer le son"}
              aria-pressed={soundEnabled}
              onClick={toggleSound}
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>
          </div>
        </div>
      )}

      {inGame && board.length > 0 && (
        <aside className="snk-board" aria-label="Classement de la partie">
          <h3 className="snk-board__title">Classement</h3>
          <ol className="snk-board__list">
            {board.slice(0, 5).map((entry, index) => (
              <li
                key={`${entry.name}-${index}`}
                className={index === 0 ? "snk-board__row snk-board__row--first" : "snk-board__row"}
              >
                <span className="snk-board__dot" style={{ backgroundColor: `#${entry.color.toString(16).padStart(6, "0")}` }} />
                <span className="snk-board__name">{entry.name}</span>
                <span className="snk-board__pts">{entry.score}</span>
              </li>
            ))}
          </ol>
        </aside>
      )}

      {inGame && (
        <canvas
          ref={minimapRef}
          className="snk-minimap"
          width={260}
          height={260}
          role="img"
          aria-label="Minimap de l’arène : joueur, bots et limites"
        />
      )}

      {phase === "playing" && isTouch && (
        <div className="snk-mobile-actions">
          <button
            type="button"
            className="snk-boost-btn"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              game()?.setTouchBoost(true);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              game()?.releaseBoost?.();
              game()?.setTouchBoost(false);
            }}
            onPointerCancel={() => game()?.releaseBoost?.()}
            onLostPointerCapture={() => game()?.releaseBoost?.()}
          >
            BOOST
          </button>
          <button
            type="button"
            className="snk-eject-btn"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              game()?.setTouchEject(true);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              game()?.setTouchEject(false);
            }}
            onPointerCancel={() => game()?.setTouchEject(false)}
            onLostPointerCapture={() => game()?.setTouchEject(false)}
          >
            ÉJECTER
          </button>
        </div>
      )}

      {phase === "countdown" && (
        <div className="snake-countdown" key={countdown}>
          <span>{countdown}</span>
        </div>
      )}

      {engineError && (
        <div className="snake-overlay snake-overlay--menu">
          <div className="snake-panel" role="alert">
            <p className="snake-panel__tag">{"// Erreur moteur"}</p>
            <h2 className="snake-panel__title">Le jeu n&apos;a pas pu démarrer</h2>
            <p className="snake-panel__desc">Recharge la page pour réessayer.</p>
          </div>
        </div>
      )}

      {!engineReady && !engineError && (
        <div className="snake-overlay snake-overlay--menu">
          <div className="snake-panel">
            <p className="snake-panel__tag">{"// Arène planétaire"}</p>
            <h2 className="snake-panel__title">Chargement du moteur…</h2>
          </div>
        </div>
      )}

      {phase === "menu" && !engineError && (
        <div className="snake-overlay snake-overlay--menu">
          <div className="snake-panel snake-menu">
            <p className="snake-panel__tag">{"// Arène planétaire"}</p>
            <h2 className="snake-menu__title">
              <span className="snake-menu__title-main">HMI SNAKE</span>
              <span className="snake-menu__title-3d">PHASER 2D</span>
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
                {skins.map((skin, i) => (
                  <button
                    key={skin.id || skin.name}
                    type="button"
                    className={
                      i === skinIdx
                        ? "snake-menu__swatch snake-menu__swatch--on"
                        : "snake-menu__swatch"
                    }
                    style={{
                      backgroundColor: `#${skin.base.toString(16).padStart(6, "0")}`,
                      backgroundImage: skin.id
                        ? `url(/koule2d/skins/${skin.id}-head.webp), linear-gradient(135deg, #${skin.base.toString(16).padStart(6, "0")} 0 58%, #${skin.accent.toString(16).padStart(6, "0")} 58% 100%)`
                        : `linear-gradient(135deg, #${skin.base.toString(16).padStart(6, "0")} 0 58%, #${skin.accent.toString(16).padStart(6, "0")} 58% 100%)`,
                    }}
                    aria-label={skin.name}
                    title={skin.name}
                    aria-pressed={i === skinIdx}
                    onClick={() => applySkin(i)}
                  />
                ))}
              </div>
              <span className="snake-menu__skin-name">{skins[skinIdx]?.name || "Chargement des skins"}</span>
            </div>

            {best > 0 && (
              <p className="snake-menu__best">
                🏆 Record : <strong>{best}</strong>
              </p>
            )}

            <div className="snake-panel__actions">
              <button type="button" className="snake-btn snake-btn--play snake-menu__play" onClick={onPlay} disabled={!engineReady}>
                {engineReady ? "▶ Jouer" : "Chargement…"}
              </button>
            </div>

            <ul className="snake-rules">
              {isTouch ? (
                <>
                  <li>
                    <span className="snake-rules__ico">👆</span> Touche l&apos;écran :
                    le joystick apparaît sous ton doigt
                  </li>
                  <li>
                    <span className="snake-rules__ico">⚡</span> Maintiens BOOST
                    pour accélérer : la vitesse consomme de la longueur
                  </li>
                  <li>
                    <span className="snake-rules__ico">●</span> Espace / Ejecter :
                    dépose une déjection toxique qui fait rétrécir les autres
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <span className="snake-rules__ico">🖱️</span> La souris pilote
                    le serpent · <kbd>Espace</kbd> = Boost · <kbd>E</kbd> = Éjecter
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
        <div className={pauseMinimized ? "snake-overlay snake-overlay--pause-mini" : "snake-overlay"}>
          {pauseMinimized ? (
            <div className="snake-pause-mini" role="status" aria-label="Pause réduite">
              <span>PAUSE</span>
              <button
                type="button"
                className="snake-pause-mini__restore"
                aria-label="Agrandir la pause"
                onClick={() => setPauseMinimized(false)}
              >
                ↗
              </button>
              <button
                type="button"
                className="snake-pause-mini__resume"
                aria-label="Reprendre la partie"
                onClick={() => game()?.togglePause()}
              >
                ▶
              </button>
              <button
                type="button"
                className="snake-pause-mini__fullscreen"
                aria-label="Quitter le plein écran"
                onClick={() => void exitFullscreen()}
              >
                ⤢
              </button>
            </div>
          ) : (
            <div className="snake-panel">
              <div className="snake-pause-panel__topline">
                <p className="snake-panel__tag">{"// Pause"}</p>
                <button
                  type="button"
                  className="snake-pause-minimize"
                  aria-label="Réduire la pause"
                  onClick={() => setPauseMinimized(true)}
                >
                  Réduire
                </button>
                <button
                  type="button"
                  className="snake-pause-fullscreen"
                  aria-label="Quitter le plein écran"
                  onClick={() => void exitFullscreen()}
                >
                  Sortir du plein écran
                </button>
              </div>
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
          )}
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

async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* Le navigateur peut refuser la sortie si le document a changé d’état. */
  }
}

function hexToNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value.replace("#", ""), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

interface SnakeSkin {
  id?: string;
  frame?: string;
  name: string;
  base: number;
  accent: number;
  style: "pulse" | "stripe";
  rarity?: string;
}

const HMI_SKINS: SnakeSkin[] = [
  { name: "Kompa Pulse", base: 0xe23030, accent: 0xffb020, style: "pulse" },
  { name: "Rara Cyan", base: 0x2de2ff, accent: 0xffffff, style: "stripe" },
  { name: "Neon Kreyòl", base: 0xff2bd6, accent: 0x8b2fff, style: "pulse" },
  { name: "Flanm Ble", base: 0x1677ff, accent: 0x2de2ff, style: "stripe" },
  { name: "Flanm Wouj", base: 0xff3b30, accent: 0xffb020, style: "pulse" },
  { name: "Audiomack Night", base: 0x111111, accent: 0xff4d22, style: "stripe" },
  { name: "Spotify Lime", base: 0x1ed760, accent: 0x071b12, style: "pulse" },
  { name: "Apple Sunset", base: 0xfa2d48, accent: 0xffc857, style: "stripe" },
  { name: "Deezer Violet", base: 0x7c3aed, accent: 0xb76cff, style: "pulse" },
  { name: "Instagram Heat", base: 0xe1306c, accent: 0xffdc80, style: "stripe" },
  { name: "YouTube Red", base: 0xff0033, accent: 0xffffff, style: "pulse" },
  { name: "Planète Or", base: 0x7a4b12, accent: 0xffd166, style: "stripe" },
];

function readNick(): string {
  return readStored(NICK_KEY, readStored(LEGACY_NICK_KEY, "Joueur"));
}

function readBest(): number {
  return Number(readStored("koule2d.best", readStored("snake3d.best", "0"))) || 0;
}
