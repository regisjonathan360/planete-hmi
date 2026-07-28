// Génère la silhouette d'Haïti (paths SVG) depuis le GeoJSON GADM réel.
// Sortie : app-next/src/components/HaitiMap/haiti-silhouette.ts
// Vérification : rendu ASCII dans la console pour valider la forme.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const geo = JSON.parse(
  readFileSync(join(here, "..", "public", "data", "haiti-departments.geojson"), "utf8"),
);

/** @type {number[][][]} */
const rings = [];
for (const f of geo.features) {
  const polys =
    f.geometry.type === "MultiPolygon"
      ? f.geometry.coordinates.flat()
      : f.geometry.coordinates;
  for (const ring of polys) rings.push(ring);
}

// Aire signée (pour filtrer les micro-îlots invisibles à petite taille)
const area = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
};

let minX = Infinity,
  maxX = -Infinity,
  minY = Infinity,
  maxY = -Infinity;
for (const ring of rings)
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

const VB_W = 200;
const spanX = maxX - minX;
const spanY = maxY - minY;
const scale = VB_W / spanX;
const VB_H = Math.round(spanY * scale * 10) / 10;

const project = ([lng, lat]) => [
  (lng - minX) * scale,
  (maxY - lat) * scale, // flip Y
];

// Simplification Douglas-Peucker
function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / len;
}
function simplify(points, tol) {
  if (points.length < 3) return points;
  let idx = -1;
  let dmax = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpDist(points[i], points[0], points[end]);
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax > tol) {
    const left = simplify(points.slice(0, idx + 1), tol);
    const right = simplify(points.slice(idx), tol);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[end]];
}

const maxArea = Math.max(...rings.map(area));
// On garde tout ring dont l'aire fait > 0.4% du plus grand : Haïti continentale,
// Gonâve, Tortue, Vache… mais pas les cailloux.
const kept = rings.filter((r) => area(r) / maxArea > 0.004);
kept.sort((a, b) => area(b) - area(a));

const paths = kept.map((ring) => {
  const pts = ring.map(project);
  // tolérance en unités de viewBox : 0.35 garde le relief côtier sans bruit
  const simp = simplify(pts, 0.35);
  const round = (n) => Math.round(n * 100) / 100;
  let d = `M${round(simp[0][0])} ${round(simp[0][1])}`;
  for (let i = 1; i < simp.length; i++) {
    d += `L${round(simp[i][0])} ${round(simp[i][1])}`;
  }
  return d + "Z";
});

// ---- Rendu ASCII pour vérifier la forme (node ... --preview) ----
const wantPreview = process.argv.includes("--preview");
const COLS = 76;
const ROWS = Math.round((COLS * VB_H) / VB_W / 2);
const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(" "));
const polysProj = kept.map((r) => r.map(project));
const inside = (px, py, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const px = ((c + 0.5) / COLS) * VB_W;
    const py = ((r + 0.5) / ROWS) * VB_H;
    if (polysProj.some((p) => inside(px, py, p))) grid[r][c] = "#";
  }
}
if (wantPreview) {
  writeFileSync(
    join(here, "haiti-preview.txt"),
    `viewBox 0 0 ${VB_W} ${VB_H} — ${kept.length} anneaux conservés sur ${rings.length}\n` +
      grid.map((r) => r.join("")).join("\n"),
    "utf8",
  );
  console.log("→ scripts/haiti-preview.txt écrit");
}

const out = `// Généré automatiquement par scripts/gen-haiti-silhouette.mjs
// Source : public/data/haiti-departments.geojson (GADM 4.1) — ne pas éditer à la main.
export const HAITI_VIEWBOX = "0 0 ${VB_W} ${VB_H}";

export const HAITI_SILHOUETTE_PATHS: readonly string[] = [
${paths.map((p) => `  "${p}",`).join("\n")}
];

/** Silhouette complète en un seul path (règle de remplissage nonzero). */
export const HAITI_SILHOUETTE = HAITI_SILHOUETTE_PATHS.join(" ");
`;

writeFileSync(join(here, "..", "src", "components", "HaitiMap", "haiti-silhouette.ts"), out, "utf8");
console.log("→ src/components/HaitiMap/haiti-silhouette.ts écrit");
