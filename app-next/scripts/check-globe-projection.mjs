// Vérifie que la carte, une fois peinte dans la texture équirectangulaire puis
// plaquée sur la sphère, apparaît bien à la forme d'Haïti vue de face.
// Rendu ASCII du disque visible de la planète.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const geo = JSON.parse(
  readFileSync(join(here, "..", "public", "data", "haiti-departments.geojson"), "utf8"),
);
const FILL = 0.84;

const ringsOf = (f) =>
  f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.flat() : f.geometry.coordinates;
const allRings = geo.features.flatMap(ringsOf);

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const r of allRings) for (const [x, y] of r) {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
const spanX = maxX - minX, spanY = maxY - minY;
const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
const ratio = spanX / spanY;
const halfV = FILL / Math.sqrt(ratio * ratio + 1);
const halfU = halfV * ratio;

const rad2deg = (r) => (r * 180) / Math.PI;

// Étape 1 : géo -> texture (exactement la fonction du composant)
const toTexel = (lng, lat) => {
  const u = ((lng - cx) / spanX) * 2 * halfU;
  const v = ((lat - cy) / spanY) * 2 * halfV;
  const latOut = Math.asin(Math.max(-1, Math.min(1, v)));
  const cosLat = Math.cos(latOut);
  const ratioU = cosLat < 1e-6 ? 0 : u / cosLat;
  const lonOut = Math.asin(Math.max(-1, Math.min(1, ratioU)));
  return [(rad2deg(lonOut) + 180) / 360, (90 - rad2deg(latOut)) / 180]; // en fractions [0,1]
};

const texRings = allRings.map((r) => r.map(([lng, lat]) => toTexel(lng, lat)));

const inside = (px, py, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

// Étape 2 : écran (orthographique, face à lon 0) -> sphère -> texture -> échantillon
const COLS = 74;
const ROWS = 37;
const out = [];
for (let r = 0; r < ROWS; r++) {
  let line = "";
  for (let c = 0; c < COLS; c++) {
    const sx = ((c + 0.5) / COLS) * 2 - 1; // -1..1
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
    const tx = (rad2deg(lon) + 180) / 360;
    const ty = (90 - rad2deg(lat)) / 180;
    line += texRings.some((p) => inside(tx, ty, p)) ? "#" : ".";
  }
  out.push(line);
}

writeFileSync(join(here, "globe-preview.txt"), out.join("\n"), "utf8");
console.log("→ scripts/globe-preview.txt");
