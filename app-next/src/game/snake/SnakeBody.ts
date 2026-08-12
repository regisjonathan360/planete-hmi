/* ------------------------------------------------------------
   SnakeBody.ts — Corps tubulaire lisse style Snake Rivals, sur planète
   Un seul InstancedMesh de capsules orientées le long de la
   trajectoire : axe Z = tangente de la trajectoire, axe Y = normale
   radiale de la planète. Tête séparée avec yeux.
   ------------------------------------------------------------ */

import * as THREE from "three";
import { SNAKE_CONFIG } from "./config";
import type { SnakeTrajectory } from "./SnakeTrajectory";

export class SnakeBody {
  readonly mesh: THREE.InstancedMesh;
  readonly headGroup = new THREE.Group();
  count: number = SNAKE_CONFIG.startSegs;
  private growthQueue = 0;
  private growthFrameTimer = 0;

  private isBoosting = false;
  private boostPainted = false;
  private time = 0;

  /* Regard (pupilles) + effet de chauffe du boost */
  private readonly lookDir = new THREE.Vector3(0, 0, 1);
  private readonly lookLocal = new THREE.Vector3();
  private readonly boostColor = new THREE.Color();

  private readonly outX = new Float32Array(SNAKE_CONFIG.maxSegs);
  private readonly outY = new Float32Array(SNAKE_CONFIG.maxSegs);
  private readonly outZ = new Float32Array(SNAKE_CONFIG.maxSegs);

  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly t = new THREE.Vector3();
  private readonly xAxis = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();

  private readonly headMesh: THREE.Mesh;
  private readonly leftEye: THREE.Mesh;
  private readonly rightEye: THREE.Mesh;
  private readonly leftPupil: THREE.Mesh;
  private readonly rightPupil: THREE.Mesh;

  private readonly bodyMat: THREE.MeshStandardMaterial;
  private readonly headMat: THREE.MeshStandardMaterial;

  constructor(color: number = SNAKE_CONFIG.snakeColors[0]) {
    /* ---- Géométrie capsule (cylindre arrondi) le long de Z ---- */
    const r = SNAKE_CONFIG.bodyRadius;
    const geo = new THREE.CapsuleGeometry(r, r * 0.5, 6, 10);
    geo.rotateX(Math.PI / 2);

    this.bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.1,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.bodyMat, SNAKE_CONFIG.maxSegs);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    /* ---- Tête séparée avec yeux ---- */
    this.headMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 });
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(r * 1.15, 12, 10), this.headMat);
    this.headMesh.scale.set(1, 0.85, 1.25);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });

    this.leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), eyeMat);
    this.rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), eyeMat);
    this.leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), pupilMat);
    this.rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), pupilMat);

    this.leftEye.position.set(0.32, 0.18, 0.28);
    this.rightEye.position.set(-0.32, 0.18, 0.28);
    this.leftPupil.position.set(0.36, 0.16, 0.36);
    this.rightPupil.position.set(-0.36, 0.16, 0.36);
    this.headGroup.add(this.headMesh);
    this.headGroup.add(this.leftEye);
    this.headGroup.add(this.rightEye);
    this.headGroup.add(this.leftPupil);
    this.headGroup.add(this.rightPupil);
  }

  /** Ajoute progressivement des segments (growth progressive). */
  growSnake(amount: number): void {
    this.growthQueue += amount;
  }

  /** Retire des segments de la queue (coût du boost style slither.io). */
  shrinkSnake(amount: number): void {
    if (this.count > 1) {
      this.count = Math.max(1, this.count - amount);
    }
  }

  /** Annule toute croissance en attente (respawn propre). */
  resetGrowth(): void {
    this.growthQueue = 0;
    this.growthFrameTimer = 0;
  }

  /** Change la couleur du corps et de la tête (choix de skin). */
  setColor(color: number): void {
    this.bodyMat.color.setHex(color);
    this.headMat.color.setHex(color);
  }

  /** Active/désactive l'effet "chauffe" du boost sur le corps. */
  setBoosting(active: boolean): void {
    this.isBoosting = active;
  }

  /** Direction tangente que regardent les yeux (pilotage). */
  setLookDir(x: number, y: number, z: number): void {
    this.lookDir.set(x, y, z);
  }

  /**
   * Rendu : positionne le corps + la tête le long de la trajectoire.
   * headForward = tangente du cap courant de la tête (pour le 1er segment).
   */
  update(traj: SnakeTrajectory, alphaOffset: number, headForward: THREE.Vector3, dt: number): void {
    if (this.growthQueue > 0) {
      this.growthFrameTimer -= dt;
      if (this.growthFrameTimer <= 0) {
        this.growthFrameTimer = 0.15;
        this.count = Math.min(SNAKE_CONFIG.maxSegs, this.count + 1);
        this.growthQueue -= 1;
      }
    }
    traj.sampleMany(
      this.outX, this.outY, this.outZ, this.count,
      SNAKE_CONFIG.segmentSpacing + alphaOffset,
      SNAKE_CONFIG.segmentSpacing
    );

    const taper = 1 - (SNAKE_CONFIG.tailTaper / SNAKE_CONFIG.maxSegs);
    for (let i = 0; i < this.count; i++) {
      /* Normale radiale = "haut" local du segment */
      this.n.set(this.outX[i], this.outY[i], this.outZ[i]).normalize();

      /* Tangente : vers la tête (ou cap courant pour le premier) */
      if (i === 0) {
        this.t.copy(headForward);
      } else {
        this.t.set(
          this.outX[i - 1] - this.outX[i],
          this.outY[i - 1] - this.outY[i],
          this.outZ[i - 1] - this.outZ[i]
        );
      }
      this.t.addScaledVector(this.n, -this.t.dot(this.n)).normalize();
      if (this.t.lengthSq() < 1e-6) this.t.copy(this.n);

      const scale = i === 0 ? SNAKE_CONFIG.headScale : Math.max(taper, 1 - (i / SNAKE_CONFIG.maxSegs) * (1 - SNAKE_CONFIG.tailTaper));
      this.xAxis.crossVectors(this.n, this.t);
      this.basis.makeBasis(this.xAxis, this.n, this.t);
      this.q.setFromRotationMatrix(this.basis);

      this.v.set(this.outX[i], this.outY[i], this.outZ[i]).addScaledVector(this.n, SNAKE_CONFIG.bodyRadius * scale * 0.9);
      this.s.set(scale, scale, scale);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;

    /* Effet "chauffe" du boost : vague chaude qui défile le long du corps */
    this.time += dt;
    if (this.isBoosting || this.boostPainted) {
      const waveSpeed = 9.0;
      for (let i = 0; i < this.count; i++) {
        const wave = this.isBoosting
          ? Math.max(0, Math.sin(this.time * waveSpeed - i * 0.9))
          : 0;
        const mix = 0.25 + 0.45 * wave;
        this.boostColor.setRGB(1, 1 - mix * 0.5, 1 - mix * 0.85);
        this.mesh.setColorAt(i, this.boostColor);
      }
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      this.boostPainted = this.isBoosting;
    }

    /* ---- Tête avec yeux ---- */
    this.n.set(this.outX[0], this.outY[0], this.outZ[0]).normalize();
    this.t.copy(headForward).addScaledVector(this.n, -headForward.dot(this.n)).normalize();
    if (this.t.lengthSq() < 1e-6) this.t.copy(this.n);
    this.xAxis.crossVectors(this.n, this.t);
    this.basis.makeBasis(this.xAxis, this.n, this.t);
    this.q.setFromRotationMatrix(this.basis);
    this.headGroup.position
      .set(this.outX[0], this.outY[0], this.outZ[0])
      .addScaledVector(this.n, SNAKE_CONFIG.bodyRadius * 1.15 * 0.9);
    this.headGroup.quaternion.copy(this.q);
    this.headGroup.visible = this.count > 0;

    /* Pupilles qui suivent la direction de pilotage (dans le repère tête) */
    this.lookLocal
      .set(this.lookDir.dot(this.xAxis), 0, this.lookDir.dot(this.t))
      .normalize();
    const lookX = this.lookLocal.x * 0.08;
    const lookZ = this.lookLocal.z * 0.08;
    this.leftPupil.position.set(0.36 + lookX, 0.16, 0.36 + lookZ);
    this.rightPupil.position.set(-0.36 + lookX, 0.16, 0.36 + lookZ);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.bodyMat.dispose();
    this.mesh.dispose();
  }
}
