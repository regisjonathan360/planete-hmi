/* ------------------------------------------------------------
   config.ts — Re-export + palette de couleurs naturelle
   Style Snake Rivals : herbe verte, ciel bleu, couleurs vives.
   ------------------------------------------------------------ */

export { SNAKE_CONFIG, CFG } from "./GameConfig";
export type { QualityProfile } from "./GameConfig";

export const COLORS = {
  /* Terrain */
  grassA: "#4a8c2a",
  grassB: "#5da832",
  grassDark: "#3d7522",
  dirt: "#8b7355",
  dirtDark: "#6b5540",

  /* Ciel & ambiance */
  sky: "#87CEEB",
  skyBottom: "#b8e4f0",
  fog: "#c8e8d8",
  sunLight: "#fff5e0",
  ambientSky: "#9fc4e8",
  ambientGround: "#223344",
  spaceBg: "#05070f",
  starWarm: "#ffe9b0",
  atmosphere: "#88ccff",

  /* Décor */
  treeTrunk: "#6b4226",
  treeLeaves: "#2d8c3e",
  treeLeavesAlt: "#3aaa4e",
  rock: "#8a8a7a",
  rockDark: "#6a6a5a",
  flowerRed: "#e84040",
  flowerBlue: "#4488dd",
  flowerYellow: "#eecc22",
  flowerPink: "#ee66aa",
  flowerWhite: "#f0f0e8",

  /* Nourriture */
  foodColors: ["#ff4444", "#44aaff", "#44dd44", "#ffcc22", "#ff66aa", "#ff8833", "#aa66ff"],

  /* UI */
  boostBlue: "#2288ff",
  boostGlow: "#44aaff",
  hudBg: "rgba(0,0,0,0.45)",
  hudText: "#ffffff",

  /* Particules */
  burst: "#ffcc00",
  boostTrail: "#44aaff",
} as const;
