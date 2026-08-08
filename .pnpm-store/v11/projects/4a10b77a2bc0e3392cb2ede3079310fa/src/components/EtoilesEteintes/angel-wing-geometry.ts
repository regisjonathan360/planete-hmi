/**
 * Géométrie d'une aile d'ange « style anime ».
 *
 * Structure d'une vraie aile déployée, dans cet ordre de lecture :
 *   1. un BORD D'ATTAQUE massif qui part de l'épaule, monte en arc vers
 *      l'extérieur et se termine au poignet ;
 *   2. sous cet arc, trois rangs de plumes qui RETOMBENT en cascade :
 *      couvertures (courtes, près du corps), rémiges secondaires (moyennes),
 *      rémiges primaires (longues, elles forment la pointe de l'aile).
 *
 * L'arc qui monte et la cascade qui descend sont ce qui distingue une aile
 * d'un simple éventail : les plumes ne rayonnent pas d'un point, elles sont
 * implantées le long de l'os et pendent vers le bas.
 *
 * Repère : l'aile pointe vers la GAUCHE, l'épaule est à droite (voir PIVOT).
 * Le côté droit s'obtient par un simple `scaleX(-1)` en CSS.
 */

export const WING_VIEWBOX = "0 0 235 118";
export const WING_WIDTH = 235;
export const WING_HEIGHT = 118;

/** Épaule : pivot du battement et de l'attache, en unités viewBox. */
export const WING_PIVOT = { x: 217, y: 65 } as const;

/** Pivot en % de la boîte — pour `transform-origin` sur l'élément <svg>. */
export const WING_PIVOT_PCT = {
  x: (WING_PIVOT.x / WING_WIDTH) * 100, // 92.34
  y: (WING_PIVOT.y / WING_HEIGHT) * 100, // 55.08
} as const;

/**
 * Rapport hauteur/largeur, et hauteur de l'épaule exprimée en fraction de la
 * LARGEUR : sert au CSS pour aligner l'épaule sur le texte sans calcul magique.
 */
export const WING_RATIO = WING_HEIGHT / WING_WIDTH; // 0.502
export const WING_PIVOT_Y_OVER_WIDTH = WING_PIVOT.y / WING_WIDTH; // 0.2766

type Pt = [number, number];

const round = (n: number) => Math.round(n * 10) / 10;
const fmt = (p: Pt) => `${round(p[0])},${round(p[1])}`;

/* =========================================================
   BORD D'ATTAQUE (l'« os » de l'aile)
   ========================================================= */

/**
 * Ligne de l'os, paramétrée de l'épaule (t=0) au poignet (t=1).
 * Elle monte (y décroît) en s'éloignant vers la gauche : c'est l'arc
 * caractéristique d'une aile déployée.
 */
function arm(t: number): Pt {
  return [217 - 120 * t, 65 - 62 * t + 20 * t * t];
}

/** Épaisseur du bord d'attaque : épais à l'épaule, fin au poignet. */
function armThickness(t: number): number {
  return 13 - 7 * t;
}

/** Chaîne de courbes lissées passant par une polyligne (sans le « M » initial). */
function smoothChain(pts: Pt[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `L${fmt(pts[1])}`;
  let d = "";
  for (let i = 1; i < pts.length - 1; i++) {
    const mid: Pt = [
      (pts[i][0] + pts[i + 1][0]) / 2,
      (pts[i][1] + pts[i + 1][1]) / 2,
    ];
    d += `Q${fmt(pts[i])} ${fmt(mid)}`;
  }
  return d + `L${fmt(pts[pts.length - 1])}`;
}

const ARM_SAMPLES = 14;

/** Contour fermé du bord d'attaque : dessous de l'os, puis retour par le dessus. */
export const LEADING_EDGE: string = (() => {
  const dessous: Pt[] = [];
  const dessus: Pt[] = [];
  for (let i = 0; i < ARM_SAMPLES; i++) {
    const t = i / (ARM_SAMPLES - 1);
    const [x, y] = arm(t);
    dessous.push([x, y]);
    dessus.push([x, y - armThickness(t)]);
  }
  dessus.reverse();
  return `M${fmt(dessous[0])}${smoothChain(dessous)}${smoothChain([dessous[dessous.length - 1], ...dessus])}Z`;
})();

/* =========================================================
   PLUMES
   ========================================================= */

export interface Feather {
  /** Contour fermé de la plume. */
  d: string;
  /** Rachis (nervure centrale), pour le détail au trait. */
  shaft: string;
}

interface FeatherSpec {
  /** Position d'implantation sur l'os, de 0 (épaule) à 1 (poignet). */
  t: number;
  /** Direction de pousse en degrés : 90 = vers le bas, 180 = vers la gauche. */
  angle: number;
  len: number;
  /** Demi-largeur maximale. */
  width: number;
  /** Courbure : décale progressivement la pointe sur la normale. */
  curve: number;
}

/**
 * Trace une plume : deux cubiques asymétriques (bord d'attaque bombé, bord de
 * fuite creusé) refermées sur la base, avec une pointe incurvée.
 */
function buildFeather({ t, angle, len, width, curve }: FeatherSpec): Feather {
  const [bx, by] = arm(t);
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const nx = -dy;
  const ny = dx;

  const at = (along: number, side: number): Pt => {
    const lateral = side * width + curve * along * along;
    return [
      bx + dx * len * along + nx * lateral,
      by + dy * len * along + ny * lateral,
    ];
  };

  const base = fmt([bx, by]);
  return {
    d:
      `M${base}` +
      `C${fmt(at(0.32, 0.95))} ${fmt(at(0.8, 0.5))} ${fmt(at(1, 0))}` +
      `C${fmt(at(0.84, -0.3))} ${fmt(at(0.3, -0.32))} ${base}Z`,
    shaft: `M${base}Q${fmt(at(0.5, -0.08))} ${fmt(at(0.88, 0.04))}`,
  };
}

function buildRow(count: number, spec: (u: number) => FeatherSpec): Feather[] {
  return Array.from({ length: count }, (_, i) =>
    buildFeather(spec(count === 1 ? 0 : i / (count - 1))),
  );
}

/**
 * Rémiges primaires : implantées sur la moitié externe de l'os, ce sont les
 * plus longues. Elles s'ouvrent en éventail du bas (près du corps) vers
 * l'extérieur, où la plus longue forme la pointe de l'aile.
 */
export const PRIMARIES: Feather[] = buildRow(10, (u) => ({
  t: 0.38 + 0.62 * u,
  angle: 122 + 46 * u,
  len: 60 + 28 * u,
  width: 10.5 + 3.5 * u,
  curve: -7 - 3 * u,
}));

/**
 * Rémiges secondaires : rang médian. Elles balaient vers le bas ET vers
 * l'extérieur — jamais à la verticale, sinon elles pendent comme des rubans
 * au lieu de former le bord de fuite continu de l'aile.
 */
export const SECONDARIES: Feather[] = buildRow(9, (u) => ({
  t: 0.08 + 0.47 * u,
  angle: 104 + 30 * u,
  len: 42 + 20 * u,
  width: 9 + 2 * u,
  curve: -5 - 2 * u,
}));

/** Couvertures : plumes courtes qui habillent la naissance des secondaires. */
export const COVERTS: Feather[] = buildRow(8, (u) => ({
  t: 0.02 + 0.46 * u,
  angle: 100 + 28 * u,
  len: 21 + 13 * u,
  width: 7.5 + 1 * u,
  curve: -4,
}));
