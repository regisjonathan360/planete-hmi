/**
 * Géométrie d'une aile d'ange « style anime ».
 *
 * Plutôt qu'un tracé unique dessiné à la main, l'aile est composée de trois
 * rangs de plumes générés par une formule : rémiges primaires (les plus
 * longues, en bas), secondaires (rang médian) et couvertures (courtes, près de
 * l'épaule), plus la masse scapulaire qui coiffe le tout.
 *
 * Repère : l'aile pointe vers la GAUCHE, l'épaule est à droite (voir PIVOT).
 * Le côté droit s'obtient par un simple `scaleX(-1)` en CSS.
 */

export const WING_VIEWBOX = "0 0 210 150";
export const WING_WIDTH = 210;
export const WING_HEIGHT = 150;

/** Épaule : pivot du battement, en unités viewBox. */
export const WING_PIVOT = { x: 196, y: 52 } as const;

/** Pivot exprimé en pourcentage de la boîte (utile pour transform-origin). */
export const WING_PIVOT_PCT = {
  x: (WING_PIVOT.x / WING_WIDTH) * 100, // 93.33
  y: (WING_PIVOT.y / WING_HEIGHT) * 100, // 34.67
} as const;

export interface Feather {
  /** Contour fermé de la plume. */
  d: string;
  /** Rachis (nervure centrale) pour le détail au trait. */
  shaft: string;
}

interface FeatherSpec {
  /** Base de la plume (implantation sur l'os). */
  bx: number;
  by: number;
  /** Direction de pousse, en degrés (0 = vers la droite, 180 = vers la gauche). */
  angle: number;
  /** Longueur de la plume. */
  len: number;
  /** Demi-largeur maximale. */
  width: number;
  /** Courbure : décale progressivement la pointe sur la normale. */
  curve: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Trace une plume : deux cubiques asymétriques (bord d'attaque large,
 * bord de fuite creusé) refermées sur la base, avec une pointe incurvée.
 */
function buildFeather({ bx, by, angle, len, width, curve }: FeatherSpec): Feather {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  // Normale à la direction de pousse.
  const nx = -dy;
  const ny = dx;

  /**
   * Point de la plume : `along` = avancée le long du rachis (0 base, 1 pointe),
   * `side` = écart latéral en fraction de la largeur (positif = bord d'attaque).
   * La courbure croît en `along²` pour un galbe naturel.
   */
  const at = (along: number, side: number): [number, number] => {
    const lateral = side * width + curve * along * along;
    return [bx + dx * len * along + nx * lateral, by + dy * len * along + ny * lateral];
  };

  const fmt = ([x, y]: [number, number]) => `${round(x)},${round(y)}`;

  const base = fmt([bx, by]);
  const tip = at(1, 0);
  const outerNearBase = at(0.34, 0.95);
  const outerNearTip = at(0.82, 0.52);
  const innerNearTip = at(0.86, -0.28);
  const innerNearBase = at(0.3, -0.34);

  return {
    d: `M${base}C${fmt(outerNearBase)} ${fmt(outerNearTip)} ${fmt(tip)}C${fmt(innerNearTip)} ${fmt(innerNearBase)} ${base}Z`,
    shaft: `M${base}Q${fmt(at(0.5, -0.1))} ${fmt(at(0.87, 0.04))}`,
  };
}

/** Génère un rang de plumes en interpolant les paramètres de la base à la pointe. */
function buildRow(count: number, spec: (t: number) => FeatherSpec): Feather[] {
  return Array.from({ length: count }, (_, i) =>
    buildFeather(spec(count === 1 ? 0 : i / (count - 1))),
  );
}

/** Rémiges primaires : longues, elles s'ouvrent en éventail vers l'extérieur. */
export const PRIMARIES: Feather[] = buildRow(7, (t) => ({
  bx: 168 - 74 * t,
  by: 44 + 14 * t + 7 * Math.sin(Math.PI * t),
  angle: 130 + 58 * t,
  len: 48 + 36 * t,
  width: 9.5 + 2.5 * t,
  curve: -9 - 4 * t,
}));

/** Rémiges secondaires : rang médian, recouvre la naissance des primaires. */
export const SECONDARIES: Feather[] = buildRow(7, (t) => ({
  bx: 178 - 66 * t,
  by: 38 + 9 * t + 4 * Math.sin(Math.PI * t),
  angle: 118 + 54 * t,
  len: 33 + 21 * t,
  width: 8.5 + 1.5 * t,
  curve: -7 - 2 * t,
}));

/** Couvertures : plumes courtes serrées le long de l'os, près de l'épaule. */
export const COVERTS: Feather[] = buildRow(6, (t) => ({
  bx: 187 - 56 * t,
  by: 33 + 4 * t,
  angle: 108 + 52 * t,
  len: 19 + 13 * t,
  width: 7 + 0.5 * t,
  curve: -5,
}));

/** Masse scapulaire : croissant qui ferme le bord supérieur de l'aile. */
export const SCAPULAR =
  "M196,56C190,30 172,17 144,17C122,17 104,25 94,37C104,31 124,28 146,30C172,33 189,42 196,56Z";
