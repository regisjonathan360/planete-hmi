/** Types partagés entre la coquille des modes et les moteurs de jeux. */

import type { SpiderSuits } from "@/lib/solitaire/spiderEngine";

export interface ModeSettings {
  /** Clé du dos de carte choisi (static/cardBacks). */
  backKey: string;
  /** Difficulté Spider (1/2/4 jeux). */
  suits: SpiderSuits;
  /** Sons activés ? */
  sounds: boolean;
}

export interface ModeStatus {
  moves: number;
  left: number;
  done: number;
  total: number;
}

export interface ModeGameHandle {
  newGame: () => void;
  undo: () => void;
  hint: () => void;
}