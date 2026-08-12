/* ------------------------------------------------------------
   ParticleManager.ts — Pool de particules réutilisables (3D)
   Gère la traînée de boost, les explosions de nourriture et
   les collisions à la surface de la planète (éjection radiale
   + tangentielle) sans aucune allocation pendant le jeu.
   ------------------------------------------------------------ */

import * as THREE from "three";
import { SNAKE_CONFIG } from "./config";

export class ParticleManager {
  readonly points: THREE.Points;
  private readonly maxParticles: number;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly active: Uint8Array;
  private cursor = 0;

  private readonly n = new THREE.Vector3();
  private readonly t = new THREE.Vector3();

  constructor(scene: THREE.Scene, maxParticles = SNAKE_CONFIG.profiles.HIGH.maxParticles) {
    this.maxParticles = maxParticles;
    this.pos = new Float32Array(maxParticles * 3);
    this.col = new Float32Array(maxParticles * 3);
    this.vel = new Float32Array(maxParticles * 3);
    this.life = new Float32Array(maxParticles);
    this.maxLife = new Float32Array(maxParticles);
    this.active = new Uint8Array(maxParticles);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    geo.setDrawRange(0, 0);

    const mat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geo, mat);
    scene.add(this.points);
  }

  /** Éclat de particules (nourriture / collision) — surface de planète. */
  spawnBurst(x: number, y: number, z: number, color: THREE.Color, count = 24, power = 1.0): void {
    this.n.set(x, y, z).normalize();
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.maxParticles;

      const angle = Math.random() * Math.PI * 2;
      const speed = (1.2 + Math.random() * 2.4) * power;
      /* Direction tangentielle aléatoire */
      this.t.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      this.t.addScaledVector(this.n, -this.t.dot(this.n)).normalize();

      this.pos[idx * 3] = x + this.n.x * (0.6 + Math.random() * 0.8);
      this.pos[idx * 3 + 1] = y + this.n.y * (0.6 + Math.random() * 0.8);
      this.pos[idx * 3 + 2] = z + this.n.z * (0.6 + Math.random() * 0.8);

      const tang = Math.cos(angle) * speed;
      this.vel[idx * 3] = this.t.x * tang + this.n.x * (1.5 + Math.random() * 3.0 * power);
      this.vel[idx * 3 + 1] = this.t.y * tang + this.n.y * (1.5 + Math.random() * 3.0 * power);
      this.vel[idx * 3 + 2] = this.t.z * tang + this.n.z * (1.5 + Math.random() * 3.0 * power);

      const l = 0.4 + Math.random() * 0.5;
      this.life[idx] = l;
      this.maxLife[idx] = l;
      this.active[idx] = 1;

      this.col[idx * 3] = color.r;
      this.col[idx * 3 + 1] = color.g;
      this.col[idx * 3 + 2] = color.b;
    }
  }

  /** Traînée lumineuse derrière le serpent pendant le Boost. */
  spawnTrail(x: number, y: number, z: number): void {
    this.n.set(x, y, z).normalize();
    for (let i = 0; i < 2; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.maxParticles;

      const spread = 0.25;
      this.pos[idx * 3] = x + this.n.x * 0.25 + (Math.random() - 0.5) * spread;
      this.pos[idx * 3 + 1] = y + this.n.y * 0.25 + (Math.random() - 0.5) * spread;
      this.pos[idx * 3 + 2] = z + this.n.z * 0.25 + (Math.random() - 0.5) * spread;

      this.vel[idx * 3] = this.n.x * (0.8 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.5;
      this.vel[idx * 3 + 1] = this.n.y * (0.8 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.5;
      this.vel[idx * 3 + 2] = this.n.z * (0.8 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.5;

      const l = 0.25 + Math.random() * 0.25;
      this.life[idx] = l;
      this.maxLife[idx] = l;
      this.active[idx] = 1;

      this.col[idx * 3] = 0.0;
      this.col[idx * 3 + 1] = 0.88;
      this.col[idx * 3 + 2] = 1.0;
    }
  }

  update(dt: number): void {
    let alive = 0;
    for (let i = 0; i < this.maxParticles; i++) {
      if (!this.active[i]) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.active[i] = 0;
        continue;
      }
      this.vel[i * 3 + 1] -= 8.0 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;

      const ratio = this.life[i] / this.maxLife[i];
      this.col[i * 3] *= ratio;
      this.col[i * 3 + 1] *= ratio;
      this.col[i * 3 + 2] *= ratio;
      alive++;
    }

    const geo = this.points.geometry as THREE.BufferGeometry;
    (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    geo.setDrawRange(0, alive);
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
