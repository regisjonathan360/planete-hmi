/* ------------------------------------------------------------
   FoodManager.ts — Multiples items de nourriture sur la planète
   Style Snake Rivals : 40-60 petites sphères colorées réparties
   sur la surface, InstancedMesh unique pour performance.
   ------------------------------------------------------------ */

import * as THREE from "three";
import { SNAKE_CONFIG, COLORS } from "./config";

const R = SNAKE_CONFIG.planetRadius;

interface FoodItem {
  x: number;
  y: number;
  z: number;
  color: THREE.Color;
  active: boolean;
}

export class FoodManager {
  private readonly items: FoodItem[] = [];
  private readonly mesh: THREE.InstancedMesh;
  private readonly colors: THREE.Color[];
  private readonly maxItems: number;

  private readonly m = new THREE.Matrix4();
  private readonly c = new THREE.Color();
  private readonly v = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly t = new THREE.Vector3();

  private time = 0;

  constructor(scene: THREE.Scene) {
    this.maxItems = SNAKE_CONFIG.foodCount;
    this.colors = COLORS.foodColors.map((c) => new THREE.Color(c));

    const geo = new THREE.SphereGeometry(0.18, 8, 6);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.4,
      metalness: 0.2,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, this.maxItems);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.count = 0;
    scene.add(this.mesh);

    for (let i = 0; i < this.maxItems; i++) {
      this.items.push({
        x: 0,
        y: R,
        z: 0,
        color: new THREE.Color(),
        active: false,
      });
    }
  }

  /** Point uniforme à la surface de la planète. */
  private randomSurfacePoint(out: THREE.Vector3): void {
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(2 * Math.random() - 1);
    out.setFromSphericalCoords(R, b, a);
  }

  /** Spawn tous les items. */
  spawn(avoid?: (x: number, y: number, z: number) => boolean): void {
    for (let i = 0; i < this.maxItems; i++) {
      this.spawnOne(i, avoid);
    }
    this.rebuildMesh();
  }

  private spawnOne(index: number, avoid?: (x: number, y: number, z: number) => boolean): void {
    for (let attempt = 0; attempt < 20; attempt++) {
      this.randomSurfacePoint(this.t);
      if (!avoid || !avoid(this.t.x, this.t.y, this.t.z)) {
        this.items[index].x = this.t.x;
        this.items[index].y = this.t.y;
        this.items[index].z = this.t.z;
        this.items[index].color.copy(
          this.colors[Math.floor(Math.random() * this.colors.length)]
        );
        this.items[index].active = true;
        return;
      }
    }
    // Fallback : n'importe où
    this.randomSurfacePoint(this.t);
    this.items[index].x = this.t.x;
    this.items[index].y = this.t.y;
    this.items[index].z = this.t.z;
    this.items[index].color.copy(
      this.colors[Math.floor(Math.random() * this.colors.length)]
    );
    this.items[index].active = true;
  }

  /** Vérifie si la tête mange un item (distance 3D). */
  checkEat(head: THREE.Vector3, eatRadius = 0.9): number[] {
    const eaten: number[] = [];
    const r2 = eatRadius * eatRadius;
    for (let i = 0; i < this.maxItems; i++) {
      const it = this.items[i];
      if (!it.active) continue;
      const dx = head.x - it.x;
      const dy = head.y - it.y;
      const dz = head.z - it.z;
      if (dx * dx + dy * dy + dz * dz < r2) {
        eaten.push(i);
      }
    }
    return eaten;
  }

  /** Respawn des items mangés. */
  respawn(indices: number[], avoid?: (x: number, y: number, z: number) => boolean): void {
    for (const i of indices) {
      this.spawnOne(i, avoid);
    }
    this.rebuildMesh();
  }

  /** Ajoute de la nourriture à une position (mort d'une IA) — plan tangent. */
  addFoodAt(x: number, y: number, z: number, count: number): void {
    for (let c = 0; c < count; c++) {
      this.spawnFoodNear(
        x, y, z, 2.0,
        this.colors[Math.floor(Math.random() * this.colors.length)]
      );
    }
    this.rebuildMesh();
  }

  /** Sème un festin de nourriture le long d'un corps mort (style slither.io). */
  addFoodTrail(
    xs: Float32Array,
    ys: Float32Array,
    zs: Float32Array,
    count: number,
    per: number,
    jitter: number,
    color: THREE.Color
  ): void {
    for (let i = 0; i < count; i += per) {
      this.spawnFoodNear(xs[i], ys[i], zs[i], jitter, color);
    }
    this.rebuildMesh();
  }

  /** Pose un item libre près d'un point (dispersion tangentielle). */
  private spawnFoodNear(x: number, y: number, z: number, spread: number, color: THREE.Color): void {
    let slot = -1;
    for (let i = 0; i < this.maxItems; i++) {
      if (!this.items[i].active) {
        slot = i;
        break;
      }
    }
    if (slot < 0) {
      /* Pool plein : évince la pastille la plus éloignée du nouveau point
         (le festin reste dense sur le cadavre). */
      let worst = -1;
      let worstD = -1;
      for (let i = 0; i < this.maxItems; i++) {
        const it = this.items[i];
        const dx = it.x - x;
        const dy = it.y - y;
        const dz = it.z - z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d > worstD) {
          worstD = d;
          worst = i;
        }
      }
      slot = worst;
    }

    this.n.set(x, y, z).normalize();
    this.t.set(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread
    );
    this.t.addScaledVector(this.n, -this.t.dot(this.n)); // plan tangent
    this.t.add(this.n.multiplyScalar(R));
    this.items[slot].x = this.t.x;
    this.items[slot].y = this.t.y;
    this.items[slot].z = this.t.z;
    this.items[slot].color.copy(color);
    this.items[slot].active = true;
  }

  /** Reconstruit les transformations InstancedMesh. */
  private rebuildMesh(): void {
    let visibleCount = 0;
    for (let i = 0; i < this.maxItems; i++) {
      if (!this.items[i].active) continue;
      const it = this.items[i];
      this.n.set(it.x, it.y, it.z).normalize();
      this.v.copy(this.n).multiplyScalar(R + 0.18);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(visibleCount, this.m);
      this.c.copy(it.color);
      this.mesh.setColorAt(visibleCount, this.c);
      visibleCount++;
    }
    this.mesh.count = visibleCount;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  update(dt: number, time: number): void {
    this.time = time;
    let visibleCount = 0;
    const bobSpeed = 2.5;
    for (let i = 0; i < this.maxItems; i++) {
      const it = this.items[i];
      if (!it.active) continue;
      const bob = 0.18 + Math.sin(time * bobSpeed + i * 0.7) * 0.04;
      this.n.set(it.x, it.y, it.z).normalize();
      this.v.copy(this.n).multiplyScalar(R + bob);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(visibleCount, this.m);
      visibleCount++;
    }
    if (visibleCount > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Items visibles depuis un point, projetés dans un repère local
   * (pour le minimap) : right = axe X, fwd = axe Y, limités au rayon.
   */
  findNear(
    head: THREE.Vector3,
    right: THREE.Vector3,
    fwd: THREE.Vector3,
    range: number
  ): { x: number; y: number; color: string }[] {
    const out: { x: number; y: number; color: string }[] = [];
    const r2 = range * range;
    for (let i = 0; i < this.maxItems; i++) {
      const it = this.items[i];
      if (!it.active) continue;
      const dx = it.x - head.x;
      const dy = it.y - head.y;
      const dz = it.z - head.z;
      const sx = dx * right.x + dy * right.y + dz * right.z;
      const sy = dx * fwd.x + dy * fwd.y + dz * fwd.z;
      if (sx * sx + sy * sy > r2) continue;
      out.push({
        x: sx,
        y: sy,
        color: `#${it.color.getHexString()}`,
      });
    }
    return out;
  }

  /** Nourriture la plus proche d'un point 3D. */
  findClosest(p: THREE.Vector3): { x: number; y: number; z: number; dist: number } | null {
    let best: { x: number; y: number; z: number; dist: number } | null = null;
    for (let i = 0; i < this.maxItems; i++) {
      const it = this.items[i];
      if (!it.active) continue;
      const dist = Math.hypot(p.x - it.x, p.y - it.y, p.z - it.z);
      if (!best || dist < best.dist) {
        best = { x: it.x, y: it.y, z: it.z, dist };
      }
    }
    return best;
  }

  /** Nourriture la plus proche dans un cône devant `fwd` (IA moins en zigzag). */
  findClosestInCone(
    p: THREE.Vector3,
    fwd: THREE.Vector3,
    cosHalf: number,
    maxDist: number
  ): { x: number; y: number; z: number; dist: number } | null {
    let best: { x: number; y: number; z: number; dist: number } | null = null;
    for (let i = 0; i < this.maxItems; i++) {
      const it = this.items[i];
      if (!it.active) continue;
      const dx = it.x - p.x;
      const dy = it.y - p.y;
      const dz = it.z - p.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > maxDist || dist < 1e-6) continue;
      if ((dx * fwd.x + dy * fwd.y + dz * fwd.z) / dist < cosHalf) continue;
      if (!best || dist < best.dist) {
        best = { x: it.x, y: it.y, z: it.z, dist };
      }
    }
    return best;
  }

  /** Position + couleur d'un item (pour éclats de particules). */
  getPos(index: number): { x: number; y: number; z: number; color: THREE.Color } {
    return {
      x: this.items[index].x,
      y: this.items[index].y,
      z: this.items[index].z,
      color: this.items[index].color,
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
