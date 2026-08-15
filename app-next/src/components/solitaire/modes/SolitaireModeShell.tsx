"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cardBackImages } from "@/components/jeux/solitaire95/static/cardBacks";
import {
  getStoredSolitaireBackground,
  setStoredSolitaireBackground,
  SOLITAIRE_BACKGROUNDS,
  SOLITAIRE_CLASSIC_BACKGROUND_ID,
} from "@/lib/solitaire/backgrounds";
import { SOLITAIRE_MODES, type SolitaireModeId } from "@/lib/solitaire/modes";
import type { ModeGameHandle, ModeStatus } from "./modeShellTypes";
import { FreeCellGame } from "./FreeCellGame";
import { PyramidGame } from "./PyramidGame";
import { SpiderGame } from "./SpiderGame";
import type { SpiderSuits } from "@/lib/solitaire/spiderEngine";
import { useExitSolitaire } from "@/components/solitaire/useExitSolitaire";
import { useSolitaireGameMenu } from "@/components/solitaire/SolitaireGameMenuContext";
import { WindowControls } from "@/components/solitaire/WindowControls";
import styles from "./solitaire-mode-shell.module.css";

const BACK_KEYS = [
  "acorns",
  "acorns2",
  "mosaic1",
  "mosaic2",
  "beach",
  "magic",
  "fish1",
  "fish2",
  "robo",
  "shell",
  "castle",
  "roses",
];

const MODE_RULES: Record<SolitaireModeId, string> = {
  klondike:
    "Reposez les cartes par couleur sur les fondations, de l'as au roi. Les colonnes se font du roi à l'as, couleurs alternées.",
  spider:
    "Rangez des suites du roi à l'as d'une même enseigne pour les écarter. Une colonne vide reçoit n'importe quelle carte ; le talon rejoue 10 cartes.",
  freecell:
    "Toutes les cartes sont face visible. Utilisez les 4 cellules et les colonnes vides : une suite d'au plus (cellules libres + 1) × 2^(colonnes vides) cartes peut se déplacer.",
  pyramid:
    "Retirez deux cartes dont les valeurs s'additionnent à 13 (as = 1 … roi = 13). Le roi se retire seul. Recyclez le déchet quand le talon est vide.",
};

interface SolitaireModeShellProps {
  mode: SolitaireModeId;
  onSwitchMode: (mode: SolitaireModeId) => void;
}

interface SettingsState {
  backKey: string;
  suits: SpiderSuits;
  sounds: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  backKey: "robo",
  suits: 1,
  sounds: true,
};

function loadSettings(): SettingsState {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem("solitaire95.modeSettings");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        backKey: BACK_KEYS.includes(parsed.backKey) ? parsed.backKey : DEFAULT_SETTINGS.backKey,
        suits: parsed.suits === 1 || parsed.suits === 2 || parsed.suits === 4 ? parsed.suits : 1,
        sounds: parsed.sounds !== false,
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SolitaireModeShell({
  mode,
  onSwitchMode,
}: SolitaireModeShellProps) {
  const gameRef = useRef<ModeGameHandle>(null);
  const { openMenu, closeMenu } = useSolitaireGameMenu();
  const switchToKlondike = useExitSolitaire(); // réutilise le hook pour switcher vers klondike
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings());
  const [status, setStatus] = useState<ModeStatus>({ moves: 0, left: 52, done: 0, total: 52 });
  const [seconds, setSeconds] = useState(0);
  const [won, setWon] = useState(false);
  const [menu, setMenu] = useState<"game" | "options" | "help" | null>(null);
  const [background, setBackground] = useState<string>(() => {
    if (typeof window === "undefined") return SOLITAIRE_CLASSIC_BACKGROUND_ID;
    return getStoredSolitaireBackground()?.id ?? SOLITAIRE_CLASSIC_BACKGROUND_ID;
  });
  const shellRef = useRef<HTMLDivElement>(null);

  /* Minuteur : court pendant la partie, s'arrête à la victoire. */
  useEffect(() => {
    if (won) return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [won]);

  /* Fermeture des menus au clic ailleurs. */
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  const modeLabel = SOLITAIRE_MODES.find((m) => m.id === mode)?.label ?? mode;
  const isSpider = mode === "spider";

  const newGame = useCallback(() => {
    gameRef.current?.newGame();
    setWon(false);
    setSeconds(0);
  }, []);

  const playError = useCallback(() => {
    if (!settings.sounds) return;
    const audio = new Audio("/games/solitaire/ding.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }, [settings.sounds]);

  const chooseBack = useCallback(
    (backKey: string) => {
      const next = { ...settings, backKey };
      setSettings(next);
      try {
        localStorage.setItem("solitaire95.modeSettings", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      setMenu(null);
    },
    [settings]
  );

  const chooseSuits = useCallback(
    (suits: SpiderSuits) => {
      const next = { ...settings, suits };
      setSettings(next);
      try {
        localStorage.setItem("solitaire95.modeSettings", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      newGame();
      setMenu(null);
    },
    [settings, newGame]
  );

  const toggleSounds = useCallback(() => {
    const next = { ...settings, sounds: !settings.sounds };
    setSettings(next);
    try {
      localStorage.setItem("solitaire95.modeSettings", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const chooseBackground = useCallback(
    (id: string) => {
      const backgroundObject =
        id === SOLITAIRE_CLASSIC_BACKGROUND_ID
          ? null
          : SOLITAIRE_BACKGROUNDS.find((b) => b.id === id) ?? null;
      setStoredSolitaireBackground(backgroundObject);
      setBackground(id);
    },
    []
  );

  useEffect(() => {
    if (!won) return;
    if (settings.sounds) {
      const audio = new Audio("/games/solitaire/ding.mp3");
      audio.volume = 0.6;
      audio.play().catch(() => {});
    }
  }, [won, settings.sounds]);

  const gameComponent = useMemo(() => {
    const shared = {
      settings: { backKey: settings.backKey, suits: settings.suits, sounds: settings.sounds },
      onWin: () => setWon(true),
      onStatus: setStatus,
      onError: playError,
      ref: gameRef as React.Ref<ModeGameHandle>,
    };
    if (mode === "freecell") return <FreeCellGame {...shared} />;
    if (mode === "pyramid") return <PyramidGame {...shared} />;
    return <SpiderGame key={settings.suits} {...shared} />;
  }, [mode, settings, playError]);

  const backgroundImage =
    background === SOLITAIRE_CLASSIC_BACKGROUND_ID
      ? undefined
      : SOLITAIRE_BACKGROUNDS.find((b) => b.id === background)?.src;

  const menuButton = (id: "game" | "options" | "help", label: string): ReactNode => (
    <button
      type="button"
      className={`${styles.menuButton}${menu === id ? " " + styles.menuButtonActive : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        setMenu(menu === id ? null : id);
      }}
    >
      {label}
    </button>
  );

  return (
    <div ref={shellRef} className={styles.shell} style={{ "--card-w": "96px" } as React.CSSProperties}>
      <div className={styles.frame}>
        <div className={styles.backgroundLayer}>
          {backgroundImage && (
            <div
              className={styles.backgroundImage}
              style={{ backgroundImage: `url(${backgroundImage})` }}
            />
          )}
        </div>

        {/* Barre de titre (même chrome que le Solitaire 95 classique) */}
        <div className={styles.captionBar}>
          <span className={styles.captionTitle}>Solitaire — {modeLabel}</span>
          <WindowControls />
        </div>

        {/* Menu principal */}
        <div className={styles.toolbar}>
          {menuButton("game", "Jeu")}
          {menuButton("options", "Options")}
          {menuButton("help", "Aide")}

          {menu === "game" && (
            <div className={styles.dropdown} onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" className={styles.dropdownItem} onClick={() => { newGame(); setMenu(null); }}>
                Nouvelle donne
              </button>
              <button type="button" className={styles.dropdownItem} onClick={() => { gameRef.current?.undo(); setMenu(null); }}>
                Annuler
              </button>
              <button type="button" className={styles.dropdownItem} onClick={() => { gameRef.current?.hint(); setMenu(null); }}>
                Indice
              </button>
              <div className={styles.dropdownSeparator} />
              <div className={styles.dropdownLabel}>Changer de jeu</div>
              {SOLITAIRE_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => { onSwitchMode(m.id); setMenu(null); }}
                >
                  {m.label}
                  {m.id === mode ? " ✓" : ""}
                </button>
              ))}
              <div className={styles.dropdownSeparator} />
              <button type="button" className={styles.dropdownItem} onClick={() => { switchToKlondike(); setMenu(null); }}>
                Quitter
              </button>
            </div>
          )}

          {menu === "options" && (
            <div className={styles.dropdown} onPointerDown={(e) => e.stopPropagation()}>
              <div className={styles.dropdownLabel}>Dos des cartes</div>
              <div className={styles.backGrid}>
                {BACK_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.backOption}${key === settings.backKey ? " " + styles.backOptionActive : ""}`}
                    onClick={() => chooseBack(key)}
                    title={key}
                  >
                    <span
                      className={styles.backThumb}
                      style={{ backgroundImage: `url(${cardBackImages[key]})` }}
                    />
                  </button>
                ))}
              </div>
              {isSpider && (
                <>
                  <div className={styles.dropdownSeparator} />
                  <div className={styles.dropdownLabel}>Difficulté Spider</div>
                  <div className={styles.suitRow}>
                    {([1, 2, 4] as SpiderSuits[]).map((suits) => (
                      <button
                        key={suits}
                        type="button"
                        className={`${styles.dropdownItem}${settings.suits === suits ? " " + styles.dropdownItemActive : ""}`}
                        onClick={() => chooseSuits(suits)}
                      >
                        {suits === 1 ? "Facile (1 couleur)" : suits === 2 ? "Moyen (2 couleurs)" : "Difficile (4 couleurs)"}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className={styles.dropdownSeparator} />
              <div className={styles.dropdownLabel}>Fond de table</div>
              <div className={styles.backGrid}>
                <button
                  type="button"
                  className={`${styles.backOption}${background === SOLITAIRE_CLASSIC_BACKGROUND_ID ? " " + styles.backOptionActive : ""}`}
                  onClick={() => chooseBackground(SOLITAIRE_CLASSIC_BACKGROUND_ID)}
                  title="Classique"
                >
                  <span className={styles.backThumbClassic} />
                </button>
                {SOLITAIRE_BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    className={`${styles.backOption}${background === bg.id ? " " + styles.backOptionActive : ""}`}
                    onClick={() => chooseBackground(bg.id)}
                    title={bg.label}
                  >
                    <span
                      className={styles.backThumb}
                      style={{ backgroundImage: `url(${bg.src})` }}
                    />
                  </button>
                ))}
              </div>
              <div className={styles.dropdownSeparator} />
              <button type="button" className={styles.dropdownItem} onClick={() => { toggleSounds(); setMenu(null); }}>
                Sons {settings.sounds ? "✓" : ""}
              </button>
            </div>
          )}

          {menu === "help" && (
            <div className={`${styles.dropdown} ${styles.helpDropdown}`} onPointerDown={(e) => e.stopPropagation()}>
              <div className={styles.dropdownLabel}>Règles du {modeLabel}</div>
              <p className={styles.helpText}>{MODE_RULES[mode]}</p>
              <div className={styles.dropdownSeparator} />
              <p className={styles.helpText}>
                Astuce : double-cliquez pour ranger une carte, cliquez pour sélectionner
                puis cliquez la destination. Les modes gardent vos cartes personnalisées.
              </p>
            </div>
          )}
        </div>

        {/* L'aire de jeu */}
        <div className={styles.gameArea}>{gameComponent}</div>

        {/* Barre d'état */}
        <div className={styles.statusBar}>
          <span className={styles.statusCell}>Mouvements : {status.moves}</span>
          <span className={styles.statusCell}>
            Cartes : {status.left} restantes
          </span>
          <span className={styles.statusCell}>
            {status.done}/{status.total} rangées
          </span>
          <span className={styles.statusCellRight}>Temps : {formatTime(seconds)}</span>
        </div>

        {/* Écran de victoire */}
        {won && (
          <div className={styles.winOverlay} role="dialog" aria-label="Vous avez gagné">
            <div className={styles.winCard}>
              <p className={styles.winEyebrow}>Victoire</p>
              <h2 className={styles.winTitle}>
                Solitaire <span className={styles.winAccent}>{modeLabel}</span> terminé !
              </h2>
              <p className={styles.winTime}>
                Temps : {formatTime(seconds)} · {status.moves} mouvements
              </p>
              <div className={styles.winActions}>
                <button type="button" className={styles.winPrimary} onClick={newGame}>
                  Rejouer
                </button>
                <button
                  type="button"
                  className={styles.winSecondary}
                  onClick={() => onSwitchMode(mode)}
                >
                  Changer de jeu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}