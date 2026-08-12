/* ------------------------------------------------------------
   AISnake.ts — Serpent IA style Snake Rivals sur la planète
   Chaque bot a son propre controller, trajectoire et corps.
   Comportement : chercher la nourriture, éviter les obstacles,
   éviter le joueur, boost aléatoire. Respawn après mort
   (jamais trop près du joueur).
   ------------------------------------------------------------ */

import * as THREE from "three";
import { SNAKE_CONFIG } from "./config";
import { SnakeController } from "./SnakeController";
import { SnakeTrajectory } from "./SnakeTrajectory";
import { SnakeBody } from "./SnakeBody";
import { createNameSprite, disposeNameSprite } from "./NameSprite";
import type { FoodManager } from "./FoodManager";
import type { Obstacle3D } from "./SnakeWorld";

const R = SNAKE_CONFIG.planetRadius;

export interface AISnakeState {
  name: string;
  color: number;
  alive: boolean;
  score: number;
}

export class AISnake {
  readonly name: string;
  readonly color: number;
  readonly controller = new SnakeController();
  readonly trajectory = new SnakeTrajectory(8192);
  readonly body: SnakeBody;
  readonly nameSprite: THREE.Sprite;

  alive = true;
  respawnTimer = 0;
  score = 0;
  private spawnGrace = 0;
  private thinkTimer = 0;
  private targetAngle: number | null = null;
  private wantsBoost = false;
  private wanderAngle = 0;
  private boostCostT = 0;

  /* Tampons pré-alloués pour les tests de collision (0 alloc/frame). */
  private readonly hitX = new Float32Array(SNAKE_CONFIG.maxSegs);
  private readonly hitY = new Float32Array(SNAKE_CONFIG.maxSegs);
  private readonly hitZ = new Float32Array(SNAKE_CONFIG.maxSegs);

  private readonly tmp = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly lookTmp = new THREE.Vector3();

  constructor(name: string, color: number, scene: THREE.Scene) {
    this.name = name;
    this.color = color;
    this.body = new SnakeBody(color);
    scene.add(this.body.mesh);
    scene.add(this.body.headGroup);
    this.nameSprite = createNameSprite(name);
    scene.add(this.nameSprite);
    this.spawn();
  }

  /** Respawn sur un point aléatoire de la planète, loin du joueur. */
  spawn(avoidPlayer?: THREE.Vector3): void {
    const tmp = this.tmp;
    for (let attempt = 0; attempt < 16; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      tmp.setFromSphericalCoords(R, b, a);
      if (!avoidPlayer || tmp.distanceTo(avoidPlayer) > 14) break;
    }
    const heading = Math.random() * Math.PI * 2;
    const pos = this.controller.pos;

    this.controller.reset(pos.copy(tmp), heading);
    this.trajectory.reset(
      this.controller.pos,
      this.controller.forward,
      SNAKE_CONFIG.aiStartSegs * SNAKE_CONFIG.segmentSpacing + 2,
      0.06
    );
    this.body.resetGrowth();
    this.body.count = SNAKE_CONFIG.aiStartSegs;
    this.alive = true;
    this.respawnTimer = 0;
    this.spawnGrace = SNAKE_CONFIG.aiSpawnGrace;
    this.score = SNAKE_CONFIG.aiStartSegs;
    this.thinkTimer = 0;
    this.wanderAngle = heading;
    this.targetAngle = heading;
    this.wantsBoost = false;
    this.nameSprite.visible = true;
  }

  die(): void {
    this.alive = false;
    this.respawnTimer = SNAKE_CONFIG.aiRespawnDelay;
    this.body.mesh.count = 0;
    this.body.headGroup.visible = false;
    this.nameSprite.visible = false;
  }

  /** Invulnérable (grâce de spawn) ? */
  canBeHit(): boolean {
    return this.alive && this.spawnGrace <= 0;
  }

  /** Portée maximale du corps derrière la tête (pré-filtre de collision). */
  get maxReach(): number {
    return this.body.count * SNAKE_CONFIG.segmentSpacing + 2;
  }

  /** Échantillonne le corps du serpent dans les tampons (mort → nourriture). */
  sampleBodyInto(x: Float32Array, y: Float32Array, z: Float32Array, count: number): void {
    this.trajectory.sampleMany(
      x, y, z, count,
      SNAKE_CONFIG.segmentSpacing,
      SNAKE_CONFIG.segmentSpacing
    );
  }

  /** Collision de la tête avec son propre corps. */
  selfHit(hitRadius: number): boolean {
    return this.hitTest(
      this.controller.pos.x, this.controller.pos.y, this.controller.pos.z,
      hitRadius, 5
    );
  }

  /** Update IA : cerveau + physique. */
  fixedUpdate(
    dt: number,
    foodMgr: FoodManager,
    playerPos: THREE.Vector3,
    obstacles: Obstacle3D[],
    bots: AISnake[]
  ): void {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.spawn(playerPos);
        this.body.headGroup.visible = true;
      }
      return;
    }

    if (this.spawnGrace > 0) this.spawnGrace -= dt;
    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.think(foodMgr, playerPos, obstacles, bots);
      this.thinkTimer = 0.25 + Math.random() * 0.2;
    }

    /* Les grosses IA virent aussi moins vite (parité avec le joueur) */
    this.controller.turnScale =
      1 / (1 + this.body.count * SNAKE_CONFIG.turnSizePenalty);
    this.controller.steerAngle = this.targetAngle;
    this.controller.isBoosting = this.wantsBoost;
    this.controller.step(dt);
    this.trajectory.push(this.controller.pos);

    /* Le boost des IA coûte aussi de la masse (fair-play slither.io) */
    if (this.controller.isBoosting && this.body.count > SNAKE_CONFIG.boostMinSegs) {
      this.boostCostT += dt * SNAKE_CONFIG.boostCostRate;
      if (this.boostCostT >= 1) {
        const n = Math.floor(this.boostCostT);
        this.boostCostT -= n;
        this.body.shrinkSnake(n);
        this.score = this.body.count;
      }
    } else {
      this.boostCostT = 0;
    }
  }

  /** Décisions de l'IA. */
  private think(
    foodMgr: FoodManager,
    playerPos: THREE.Vector3,
    obstacles: Obstacle3D[],
    bots: AISnake[]
  ): void {
    const pos = this.controller.pos;

    /* 1. Éviter les obstacles proches (arbres, rochers) */
    for (const obs of obstacles) {
      const dx = pos.x - obs.x;
      const dy = pos.y - obs.y;
      const dz = pos.z - obs.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < obs.radius + 2.0) {
        this.tmp.set(dx, dy, dz);
        this.controller.steerToward(this.tmp);
        this.targetAngle = this.controller.steerAngle ?? this.targetAngle;
        this.wantsBoost = false;
        return;
      }
    }

    /* 2. Éviter les autres serpents (joueur + têtes des IA) */
    let threat: THREE.Vector3 | null = null;
    let threatDist: number = SNAKE_CONFIG.aiThreatRadius;
    const pd = pos.distanceTo(playerPos);
    if (pd < threatDist) {
      threat = playerPos;
      threatDist = pd;
    }
    for (const other of bots) {
      if (other === this || !other.alive) continue;
      const d = pos.distanceTo(other.controller.pos);
      if (d < threatDist) {
        threat = other.controller.pos;
        threatDist = d;
      }
    }
    if (threat) {
      this.tmp.copy(pos).sub(threat);
      this.controller.steerToward(this.tmp);
      this.targetAngle = this.controller.steerAngle ?? this.targetAngle;
      this.wantsBoost = threatDist < SNAKE_CONFIG.aiThreatBoostRadius;
      return;
    }

    /* 3. Nourriture : préfère un tas dans le cône devant (moins de zigzag) */
    const cone = foodMgr.findClosestInCone(pos, this.controller.forward, 0.5, 18);
    const closest = cone ?? foodMgr.findClosest(pos);
    if (closest && closest.dist < 22) {
      this.tmp.set(closest.x - pos.x, closest.y - pos.y, closest.z - pos.z);
      this.controller.steerToward(this.tmp);
      this.targetAngle = this.controller.steerAngle ?? this.targetAngle;
      this.wantsBoost = closest.dist < 5 && Math.random() > 0.7;
      return;
    }

    /* 4. Errance aléatoire douce (courbes longues, pas de zigzag serré) */
    this.wanderAngle += (Math.random() - 0.5) * 0.5;
    this.targetAngle = this.wanderAngle;
    this.wantsBoost = false;
  }

  /** Rendu du corps + étiquette de nom. */
  renderUpdate(dt: number, alpha: number): void {
    if (!this.alive) return;
    const interp = alpha * this.controller.speed * (1 / SNAKE_CONFIG.fixedHz);
    this.controller.getSteerDir(this.lookTmp);
    this.body.setLookDir(this.lookTmp.x, this.lookTmp.y, this.lookTmp.z);
    this.body.setBoosting(this.controller.isBoosting);
    this.body.update(this.trajectory, interp, this.controller.forward, dt);
    this.score = this.body.count;
    this.n.copy(this.controller.pos).normalize();
    this.nameSprite.position
      .copy(this.controller.pos)
      .addScaledVector(this.n, 2.4);
  }

  /** Teste si un point 3D touche le corps de ce serpent. */
  hitTest(testX: number, testY: number, testZ: number, hitRadius: number, skipHead = 3): boolean {
    if (!this.alive) return false;
    const count = this.body.count;
    if (count < skipHead + 1) return false;

    this.trajectory.sampleMany(
      this.hitX, this.hitY, this.hitZ, count,
      SNAKE_CONFIG.segmentSpacing,
      SNAKE_CONFIG.segmentSpacing
    );

    const r2 = hitRadius * hitRadius;
    for (let i = skipHead; i < count; i++) {
      const dx = testX - this.hitX[i];
      const dy = testY - this.hitY[i];
      const dz = testZ - this.hitZ[i];
      if (dx * dx + dy * dy + dz * dz < r2) return true;
    }
    return false;
  }

  get headX(): number { return this.controller.pos.x; }
  get headY(): number { return this.controller.pos.y; }
  get headZ(): number { return this.controller.pos.z; }

  getState(): AISnakeState {
    return {
      name: this.name,
      color: this.color,
      alive: this.alive,
      score: this.score,
    };
  }

  dispose(): void {
    this.body.dispose();
    disposeNameSprite(this.nameSprite);
  }
}
