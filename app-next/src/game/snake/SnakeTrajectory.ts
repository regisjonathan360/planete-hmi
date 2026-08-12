/* ------------------------------------------------------------
   SnakeTrajectory — historique 3D de la trajectoire de la tête
   La tête pousse ses positions (sur la sphère) dans un anneau
   pré-alloué (Float32Array, zéro allocation en jeu). Chaque segment
   du corps se positionne à une distance EXACTE derrière la tête en
   interpolant entre deux échantillons : l'espacement reste constant
   et le corps suit parfaitement le chemin (grands cercles par
   projection : lerp de cordes puis normalisation sur le rayon R).
   ------------------------------------------------------------ */

import { Vector3 } from "three";
import { SNAKE_CONFIG } from "./config";

const R = SNAKE_CONFIG.planetRadius;

const _p = new Vector3();
const _f = new Vector3();
const _q = new Vector3();

export class SnakeTrajectory {
  private readonly cap: number;
  private readonly xs: Float32Array;
  private readonly ys: Float32Array;
  private readonly zs: Float32Array;
  private readonly ds: Float32Array; // distance cumulative depuis le début enregistré
  private head = 0; // index de l'échantillon le plus récent
  private count = 0;
  private total = 0; // distance cumulée de l'échantillon le plus récent

  constructor(cap = 16384) {
    this.cap = cap;
    this.xs = new Float32Array(cap);
    this.ys = new Float32Array(cap);
    this.zs = new Float32Array(cap);
    this.ds = new Float32Array(cap);
  }

  /** Réinitialise en pré-remplissant un historique droit derrière la tête. */
  reset(pos: Vector3, fwd: Vector3, fillLen: number, spacing: number): void {
    const n = Math.min(this.cap, Math.ceil(fillLen / spacing) + 1);
    for (let i = 0; i < n; i++) {
      _p.copy(pos).addScaledVector(fwd, -i * spacing);
      _p.setLength(R);
      this.xs[i] = _p.x;
      this.ys[i] = _p.y;
      this.zs[i] = _p.z;
      this.ds[i] = i * spacing;
    }
    this.head = n - 1;
    this.count = n;
    this.total = (n - 1) * spacing;
  }

  /** Pousse la position courante de la tête (fusionne les points trop proches). */
  push(pos: Vector3): void {
    _q.set(this.xs[this.head], this.ys[this.head], this.zs[this.head]);
    const d = pos.distanceTo(_q);
    /* Seuil anti-jitter réduit pour meilleur suivi : 0.02 → 0.015 */
    if (d < 0.015) return;
    const next = (this.head + 1) % this.cap;
    this.xs[next] = pos.x;
    this.ys[next] = pos.y;
    this.zs[next] = pos.z;
    this.ds[next] = this.total + d;
    this.total += d;
    this.head = next;
    if (this.count < this.cap) this.count++;
  }

  get newestX(): number {
    return this.xs[this.head];
  }

  get newestY(): number {
    return this.ys[this.head];
  }

  get newestZ(): number {
    return this.zs[this.head];
  }

  /** Longueur de chemin disponible derrière la tête. */
  get maxBehind(): number {
    return this.total - this.ds[this.oldest()];
  }

  private oldest(): number {
    return this.count >= this.cap ? (this.head + 1) % this.cap : 0;
  }

  /**
   * Échantillonne `count` positions à startDist, startDist+step, … derrière
   * la tête, interpolation entre échantillons puis projection sur la sphère.
   */
  sampleMany(
    outX: Float32Array,
    outY: Float32Array,
    outZ: Float32Array,
    count: number,
    startDist: number,
    step: number
  ): void {
    let p = this.head;
    let behind = 0; // distance derrière la tête de l'échantillon courant
    for (let i = 0; i < count; i++) {
      const need = startDist + i * step;
      while (behind < need && p !== this.oldest()) {
        const prev = (p - 1 + this.cap) % this.cap;
        behind += this.ds[p] - this.ds[prev];
        p = prev;
      }
      if (behind >= need) {
        const newer = (p + 1) % this.cap;
        const segLen = this.ds[p] - this.ds[newer];
        const t = segLen > 1e-9 ? (need - (behind - segLen)) / segLen : 0;
        const x0 = this.xs[newer];
        const y0 = this.ys[newer];
        const z0 = this.zs[newer];
        _f.set(
          x0 + (this.xs[p] - x0) * t,
          y0 + (this.ys[p] - y0) * t,
          z0 + (this.zs[p] - z0) * t
        );
        _f.setLength(R);
        outX[i] = _f.x;
        outY[i] = _f.y;
        outZ[i] = _f.z;
      } else {
        outX[i] = this.xs[p];
        outY[i] = this.ys[p];
        outZ[i] = this.zs[p];
      }
    }
  }
}
