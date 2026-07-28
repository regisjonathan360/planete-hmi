// Vérifie que la carte peinte dans la texture équirectangulaire apparaît bien,
// une fois plaquée sur la sphère, comme une carte enroulée sur un globe.
// Rendu ASCII du disque visible (projection orthographique de face).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const geo = JSON.parse(
  readFileSync(join(here, "..", "public", "data", "haiti-departments.geojson"), "utf8"),
);

// Doit rester aligné sur LAT_SPAN_DEG dans HaitiGlobe.tsx.
const LAT_SPAN_DEG = 56;

const ringsOf = (f) =>
  f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.flat() : f.geometry.coordinates;
const allRings = geo.features.flatMap(ringsOf);

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const r of allRings) for (const [x, y] of r) {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
const cx = (minX + maxX) / 2;
const cy = (minY + maxY) / 2;
const zoom = LAT_SPAN_DEG / (maxY - minY);

const deg2rad = (d) => (d * Math.PI) / 180;

// Étape 1 : géo → coordonnées texture (fractions [0,1]), comme le composant.
const toTexel = ([lng, lat]) => [
  (((lng - cx) * zoom + 180) / 360),
  ((90 - (lat - cy) * zoom) / 180),
];
const texRings = allRings.map((r) => r.map(toTexel));

const inside = (px, py, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

// Étape 2 : écran → sphère → texture → échantillon.
const COLS = 74;
const ROWS = 37;
const out = [];
for (let r = 0; r < ROWS; r++) {
  let line = "";
  for (let c = 0; c < COLS; c++) {
    const sx = ((c + 0.5) / COLS) * 2 - 1;
    const sy = 1 - ((r + 0.5) / ROWS) * 2;
    if (sx * sx + sy * sy > 1) {
      line += " ";
      continue;
    }
    const lat = Math.asin(sy);
    const cosLat = Math.cos(lat);
    const s = sx / cosLat;
    if (Math.abs(s) > 1) {
      line += ".";
      continue;
    }
    const lon = Math.asin(s);
    const tx = ((lon * 180) / Math.PI + 180) / 360;
    const ty = (90 - (lat * 180) / Math.PI) / 180;
    line += texRings.some((p) => inside(tx, ty, p)) ? "#" : ".";
  }
  out.push(line);
}

// Mesure de l'emprise à l'écran, pour vérifier que la carte reste grande.
const halfLon = deg2rad(((maxX - minX) * zoom) / 2);
const halfLat = deg2rad(LAT_SPAN_DEG / 2);
const header =
  `LAT_SPAN_DEG=${LAT_SPAN_DEG} · zoom=${zoom.toFixed(1)}× · ` +
  `emprise écran : ${(Math.sin(halfLon) * 100).toFixed(0)}% du rayon en largeur, ` +
  `${(Math.sin(halfLat) * 100).toFixed(0)}% en hauteur`;

writeFileSync(join(here, "globe-preview.txt"), `${header}\n${out.join("\n")}`, "utf8");
console.log(header);
console.log("→ scripts/globe-preview.txt");
