/* ------------------------------------------------------------
   SnakeGame.ts — Orchestrateur du moteur de jeu Snake 3D
   Style Snake Rivals sur une grosse planète : surface sphérique
   sans murs, nourriture multiple, serpents IA, leaderboard.
   Raccorde : SnakeController / SnakeTrajectory / SnakeBody /
   SnakeCamera / SnakeInput / SnakeWorld / FoodManager / AISnake /
   ParticleManager / CollisionSystem / PerformanceManager / GameLoop.
   ------------------------------------------------------------ */

import * as THREE from "three";
import { SNAKE_CONFIG } from "./config";
import { GameLoop } from "./GameLoop";
import { SnakeInput } from "./SnakeInput";
import { SnakeController } from "./SnakeController";
import { SnakeTrajectory } from "./SnakeTrajectory";
import { SnakeBody } from "./SnakeBody";
import { SnakeCamera } from "./SnakeCamera";
import { SnakeWorld } from "./SnakeWorld";
import { CollisionSystem } from "./CollisionSystem";
import { ParticleManager } from "./ParticleManager";
import { FoodManager } from "./FoodManager";
import { PerformanceManager } from "./PerformanceManager";
import { AISnake } from "./AISnake";
import { Minimap } from "./Minimap";
import { createNameSprite, disposeNameSprite, updateNameSprite } from "./NameSprite";

export type SnakePhase = "menu" | "countdown" | "playing" | "paused" | "gameover";

export interface LeaderboardEntry {
  name: string;
  color: number;
  score: number;
}

export interface SnakeHud {
  onPhase: (phase: SnakePhase, score: number, best: number, isRecord: boolean) => void;
  onCountdown: (n: number) => void;
  onLeaderboard: (entries: LeaderboardEntry[]) => void;
}

const BEST_KEY = "snake3d.best";
const R = SNAKE_CONFIG.planetRadius;
const SPAWN = new THREE.Vector3(0, R, 0);
const GRACE_TIME = 2.5;

export function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function writeBest(v: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* stockage indisponible */
  }
}

export class SnakeGame {
  private readonly stage: HTMLElement;
  private readonly hud: SnakeHud;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly cameraSys = new SnakeCamera();
  private readonly world: SnakeWorld;
  private readonly trajectory = new SnakeTrajectory();
  private readonly controller = new SnakeController();
  private readonly body: SnakeBody;
  private readonly input = new SnakeInput();
  private readonly loop: GameLoop;
  private readonly ro: ResizeObserver;
  private readonly headInterp = new THREE.Vector3();
  private readonly headNormal = new THREE.Vector3();
  private readonly lookTmp = new THREE.Vector3();
  private readonly deathColor = new THREE.Color();

  private readonly collisionSys = new CollisionSystem(2.0);
  private readonly particleMgr: ParticleManager;
  private readonly foodMgr: FoodManager;
  private readonly perfMgr = new PerformanceManager();
  private readonly bots: AISnake[] = [];
  private readonly minimap: Minimap;

  /* Tampons réutilisés (zéro allocation dans la boucle). */
  private readonly sX = new Float32Array(SNAKE_CONFIG.maxSegs);
  private readonly sY = new Float32Array(SNAKE_CONFIG.maxSegs);
  private readonly sZ = new Float32Array(SNAKE_CONFIG.maxSegs);
  /* Tampons séparés pour les festins : ne pas écraser les échantillons
     du corps du joueur utilisés par les tests de collision de la frame. */
  private readonly trailX = new Float32Array(SNAKE_CONFIG.maxSegs);
  private readonly trailY = new Float32Array(SNAKE_CONFIG.maxSegs);
  private readonly trailZ = new Float32Array(SNAKE_CONFIG.maxSegs);

  private phase: SnakePhase = "menu";
  private score = 0;
  private best = readBest();
  /** Couleur du joueur (skin choisi dans le menu). */
  private playerColor: number = SNAKE_CONFIG.snakeColors[0];
  private countdownT = 0;
  private lastCount = -1;
  private driftT = 0;
  private graceT = 0;
  private boostCostT = 0;
  private time = 0;
  private boardTimer = 0;
  private lastBoardKey = "";

  private readonly playerNameSprite: THREE.Sprite;

  constructor(stage: HTMLElement, hud: SnakeHud) {
    this.stage = stage;
    this.hud = hud;

    const profile = this.perfMgr.currentProfile;
    this.renderer = new THREE.WebGLRenderer({
      antialias: profile.antialias,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, profile.maxPixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.className = "snake-canvas";

    /* Le monde gère lui-même le ciel (espace), les lumières et le décor. */
    this.world = new SnakeWorld(this.scene, profile.shadows);
    this.particleMgr = new ParticleManager(this.scene, profile.maxParticles);
    this.foodMgr = new FoodManager(this.scene);
    this.body = new SnakeBody(SNAKE_CONFIG.snakeColors[0]);
    this.scene.add(this.body.mesh);
    this.scene.add(this.body.headGroup);
    this.minimap = new Minimap(stage);

    this.playerNameSprite = createNameSprite("Joueur");
    this.scene.add(this.playerNameSprite);

    /* Serpents IA */
    for (let i = 0; i < SNAKE_CONFIG.aiCount; i++) {
      this.bots.push(
        new AISnake(
          SNAKE_CONFIG.aiNames[i % SNAKE_CONFIG.aiNames.length],
          SNAKE_CONFIG.snakeColors[(i + 1) % SNAKE_CONFIG.snakeColors.length],
          this.scene
        )
      );
    }

    this.loop = new GameLoop(
      SNAKE_CONFIG.fixedHz,
      (dt) => this.fixed(dt),
      (dt, alpha) => this.draw(dt, alpha)
    );
    this.ro = new ResizeObserver(() => this.resize());
  }

  /* -------------------------------------------------- cycle de vie */

  mount(): void {
    this.stage.appendChild(this.renderer.domElement);
    this.ro.observe(this.stage);
    this.input.attach(this.stage);
    document.addEventListener("visibilitychange", this.onVis);
    document.addEventListener("fullscreenchange", this.onFullscreenChange);
    this.resetRun();
    this.resize();
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.ro.disconnect();
    this.input.detach();
    document.removeEventListener("visibilitychange", this.onVis);
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    for (const bot of this.bots) bot.dispose();
    disposeNameSprite(this.playerNameSprite);
    this.minimap.dispose();
    this.world.dispose();
    this.body.dispose();
    this.foodMgr.dispose();
    this.particleMgr.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.stage) {
      this.stage.removeChild(this.renderer.domElement);
    }
  }

  private readonly onVis = (): void => {
    if (document.hidden && this.phase === "playing") {
      this.setPhase("paused");
    }
  };

  private readonly onFullscreenChange = (): void => {
    if (!document.fullscreenElement && this.phase === "playing") {
      this.setPhase("paused");
    }
  };

  /* -------------------------------------------------- API publique */

  startGame(): void {
    if (this.phase === "gameover") {
      this.resetRun();
    } else {
      /* Depuis le menu : réoriente vers le "haut écran" (+Z) pour
         que les commandes (gauche/droite) soient naturelles. */
      this.controller.faceNorth();
    }
    this.setPhase("countdown");
    this.countdownT = 3;
    this.lastCount = 3;
    this.hud.onCountdown(3);
  }

  togglePause(): void {
    if (this.phase === "playing") this.setPhase("paused");
    else if (this.phase === "paused") this.setPhase("playing");
  }

  quitToMenu(): void {
    this.resetRun();
  }

  growSnake(amount: number): void {
    this.body.growSnake(amount);
  }

  setTouchBoost(active: boolean): void {
    this.input.setTouchBoost(active);
  }

  /** Pseudo affiché au-dessus de la tête (menu). */
  setPlayerName(name: string): void {
    updateNameSprite(this.playerNameSprite, name);
  }

  /** Couleur du skin du joueur (menu). */
  setPlayerColor(color: number): void {
    this.playerColor = color;
    this.body.setColor(color);
  }

  /* -------------------------------------------------- état */

  private setPhase(p: SnakePhase): void {
    if (p === this.phase) return;
    this.phase = p;
    this.input.setActive(p === "playing");
    if (p === "playing") this.graceT = GRACE_TIME;
    this.hud.onPhase(p, this.score, this.best, false);
  }

  private resetRun(): void {
    this.controller.reset(SPAWN, 0);
    this.trajectory.reset(
      this.controller.pos,
      this.controller.forward,
      SNAKE_CONFIG.startSegs * SNAKE_CONFIG.segmentSpacing + 2,
      0.06
    );
    this.body.resetGrowth();
    this.body.count = SNAKE_CONFIG.startSegs;
    this.score = SNAKE_CONFIG.startSegs;
    this.driftT = 0;
    this.graceT = 0;
    this.cameraSys.reset(this.controller.pos, this.controller.forward);
    for (const bot of this.bots) bot.spawn(this.controller.pos);
    this.foodMgr.spawn((x, y, z) => this.foodAvoid(x, y, z));
    this.lastBoardKey = "";
    this.setPhase("menu");
  }

  /* -------------------------------------------------- simulation */

  private fixed(dt: number): void {
    this.time += dt;
    this.world.update();
    this.foodMgr.update(dt, this.time);
    this.particleMgr.update(dt);
    this.perfMgr.update(dt);

    switch (this.phase) {
      case "countdown": {
        this.countdownT -= dt;
        const n = Math.ceil(this.countdownT);
        if (n !== this.lastCount && n > 0) {
          this.lastCount = n;
          this.hud.onCountdown(n);
        }
        if (this.countdownT <= 0) this.setPhase("playing");
        break;
      }
      case "playing": {
        if (this.graceT > 0) this.graceT -= dt;

        this.controller.isBoosting = this.input.isBoostActive();
        this.controller.steerAngle = this.input.sample();
        this.controller.turnScale =
          1 / (1 + this.body.count * SNAKE_CONFIG.turnSizePenalty);
        this.controller.step(dt);
        this.trajectory.push(this.controller.pos);

        if (this.controller.isBoosting) {
          this.particleMgr.spawnTrail(this.controller.pos.x, this.controller.pos.y, this.controller.pos.z);
        }

        /* Le boost consomme de la masse (style slither.io) */
        if (this.controller.isBoosting && this.body.count > SNAKE_CONFIG.boostMinSegs) {
          this.boostCostT += dt * SNAKE_CONFIG.boostCostRate;
          if (this.boostCostT >= 1) {
            const n = Math.floor(this.boostCostT);
            this.boostCostT -= n;
            this.body.shrinkSnake(n);
            this.score = this.body.count;
            this.hud.onPhase("playing", this.score, this.best, false);
          }
        } else {
          this.boostCostT = 0;
        }

        if (this.graceT <= 0 && this.hitSelf()) {
          this.die();
          break;
        }
        this.eat();

        /* Tête du joueur vs corps des IA (pas pendant la grâce) */
        if (this.graceT <= 0) {
          let killedByBot = false;
          for (const bot of this.bots) {
            if (!bot.canBeHit()) continue;
            if (bot.hitTest(this.controller.pos.x, this.controller.pos.y, this.controller.pos.z, SNAKE_CONFIG.selfHitRadius + 0.2)) {
              killedByBot = true;
              break;
            }
          }
          if (killedByBot) {
            this.die();
            break;
          }
        }

        /* Têtes des IA vs corps du joueur + collisions IA vs IA.
           Pas d'auto-collision des IA (elles s'entretueraient en boucle,
           cf. slither-master où elle est désactivée). */
        const bodyCount = this.sampleBody(
          SNAKE_CONFIG.maxSegs,
          SNAKE_CONFIG.segmentSpacing,
          SNAKE_CONFIG.segmentSpacing
        );
        for (const bot of this.bots) {
          if (!bot.canBeHit()) continue;
          if (this.pointHitsSamples(bot.headX, bot.headY, bot.headZ, bodyCount, SNAKE_CONFIG.selfHitRadius + 0.15)) {
            this.killBot(bot);
            continue;
          }
          for (const other of this.bots) {
            if (other === bot || !other.alive || !other.canBeHit()) continue;
            if (
              other.maxReach +
                SNAKE_CONFIG.selfHitRadius <
              Math.hypot(
                bot.headX - other.headX,
                bot.headY - other.headY,
                bot.headZ - other.headZ
              )
            ) {
              continue;
            }
            if (other.hitTest(bot.headX, bot.headY, bot.headZ, SNAKE_CONFIG.selfHitRadius + 0.15, 4)) {
              this.killBot(bot);
              break;
            }
          }
        }
        break;
      }
      case "menu": {
        this.demoSteer();
        this.controller.step(dt, 0.6);
        this.trajectory.push(this.controller.pos);
        break;
      }
      case "gameover": {
        /* Le serpent glisse encore un instant avant de s'arrêter. */
        if (this.driftT > 0) {
          this.driftT -= dt;
          this.controller.steerAngle = null;
          this.controller.step(dt);
          this.trajectory.push(this.controller.pos);
        }
        break;
      }
      case "paused":
        break;
    }

    /* Les IA évoluent dans tous les états sauf la pause. */
    if (this.phase !== "paused") {
      for (const bot of this.bots) {
        bot.fixedUpdate(dt, this.foodMgr, this.controller.pos, this.world.obstacles, this.bots);
      }
    }

    this.emitLeaderboard(dt);
  }

  private draw(dt: number, alpha: number): void {
    const interp = alpha * this.controller.speed * (1 / SNAKE_CONFIG.fixedHz);

    this.controller.getSteerDir(this.lookTmp);
    this.body.setLookDir(this.lookTmp.x, this.lookTmp.y, this.lookTmp.z);
    this.body.setBoosting(this.controller.isBoosting);
    this.body.update(this.trajectory, interp, this.controller.forward, dt);
    this.headInterp.lerpVectors(this.controller.prevPos, this.controller.pos, alpha);
    this.headNormal.copy(this.headInterp).normalize();
    this.playerNameSprite.position.copy(this.headInterp).addScaledVector(this.headNormal, 2.4);

    for (const bot of this.bots) {
      bot.renderUpdate(dt, alpha);
    }

    this.cameraSys.update(
      dt,
      this.headInterp,
      this.controller.forward,
      this.controller.speed,
      this.controller.angularVelocity,
      this.controller.isBoosting,
      this.body.count
    );

    this.minimap.draw(
      this.headInterp,
      this.controller.forward,
      this.playerColor,
      this.foodMgr,
      this.bots
    );

    this.renderer.render(this.scene, this.cameraSys.camera);
  }

  /* -------------------------------------------------- IA démo (menu) */

  private demoSteer(): void {
    this.controller.steerAngle = this.controller.heading + Math.sin(this.time * 0.9) * 0.7;
  }

  /* -------------------------------------------------- collisions */

  private sampleBody(n: number, start: number, step: number): number {
    const span = Math.min((n - 1) * step, this.trajectory.maxBehind - start);
    const count = span >= 0 ? Math.min(n, Math.floor(span / step) + 1) : 0;
    if (count <= 0) return 0;
    this.trajectory.sampleMany(this.sX, this.sY, this.sZ, count, start, step);
    return count;
  }

  private pointHitsSamples(x: number, y: number, z: number, count: number, radius: number): boolean {
    const r2 = radius * radius;
    for (let i = 0; i < count; i++) {
      const dx = x - this.sX[i];
      const dy = y - this.sY[i];
      const dz = z - this.sZ[i];
      if (dx * dx + dy * dy + dz * dz < r2) return true;
    }
    return false;
  }

  private hitSelf(): boolean {
    if (this.body.count < 8) return false;
    const start = SNAKE_CONFIG.segmentSpacing * 1.8;
    const step = 0.65;
    const n = Math.min(SNAKE_CONFIG.maxSegs, Math.ceil((this.body.count * SNAKE_CONFIG.segmentSpacing - start) / step) + 1);
    const count = this.sampleBody(n, start, step);

    this.collisionSys.clear();
    for (let i = 0; i < count; i++) {
      this.collisionSys.insert({
        id: i,
        x: this.sX[i],
        y: this.sY[i],
        z: this.sZ[i],
        radius: SNAKE_CONFIG.selfHitRadius,
      });
    }

    const hx = this.controller.pos.x;
    const hy = this.controller.pos.y;
    const hz = this.controller.pos.z;
    const hits = this.collisionSys.querySphere(hx, hy, hz, SNAKE_CONFIG.selfHitRadius);
    return hits.length > 0;
  }

  private foodAvoid(x: number, y: number, z: number): boolean {
    const n = Math.min(SNAKE_CONFIG.maxSegs, Math.ceil((this.body.count * SNAKE_CONFIG.segmentSpacing) / 0.6) + 1);
    const count = this.sampleBody(n, 0.5, 0.6);
    return this.pointHitsSamples(x, y, z, count, 1.2);
  }

  /* -------------------------------------------------- événements */

  private eat(): void {
    const eaten = this.foodMgr.checkEat(this.controller.pos, 0.9);
    if (eaten.length === 0) return;
    for (const i of eaten) {
      const p = this.foodMgr.getPos(i);
      this.particleMgr.spawnBurst(p.x, p.y, p.z, p.color, 12, 0.9);
    }
    this.body.growSnake(SNAKE_CONFIG.foodGrow * eaten.length);
    this.score = this.body.count;
    this.foodMgr.respawn(eaten, (x, y, z) => this.foodAvoid(x, y, z));
    this.hud.onPhase("playing", this.score, this.best, false);
  }

  private killBot(bot: AISnake): void {
    /* Le corps mort se transforme en festin de nourriture (slither.io) */
    const n = Math.min(bot.body.count, SNAKE_CONFIG.maxSegs);
    bot.sampleBodyInto(this.trailX, this.trailY, this.trailZ, n);
    this.deathColor.set(bot.color);
    this.foodMgr.addFoodTrail(
      this.trailX, this.trailY, this.trailZ, n,
      SNAKE_CONFIG.foodTrailPer,
      SNAKE_CONFIG.foodTrailJitter,
      this.deathColor
    );
    this.particleMgr.spawnBurst(bot.headX, bot.headY, bot.headZ, this.deathColor, 30, 1.4);
    bot.die();
  }

  private die(): void {
    this.setPhase("gameover");
    this.driftT = 1.0;
    this.controller.cruise = false;
    this.deathColor.set(this.playerColor);
    this.particleMgr.spawnBurst(
      this.controller.pos.x, this.controller.pos.y, this.controller.pos.z,
      this.deathColor, 45, 1.8
    );
    /* Le joueur laisse aussi un festin derrière lui */
    const n = Math.min(this.body.count, SNAKE_CONFIG.maxSegs);
    this.sampleBody(n, 0, SNAKE_CONFIG.segmentSpacing);
    this.foodMgr.addFoodTrail(
      this.sX, this.sY, this.sZ, n,
      SNAKE_CONFIG.foodTrailPer,
      SNAKE_CONFIG.foodTrailJitter,
      this.deathColor
    );
    const isRecord = this.score > this.best && this.score > 0;
    if (isRecord) {
      this.best = this.score;
      writeBest(this.best);
    }
    this.hud.onPhase("gameover", this.score, this.best, isRecord);
  }

  /* -------------------------------------------------- leaderboard */

  private emitLeaderboard(dt: number): void {
    this.boardTimer -= dt;
    if (this.boardTimer > 0) return;
    this.boardTimer = 0.25;

    const entries: LeaderboardEntry[] = [
      { name: "Joueur", color: this.playerColor, score: this.body.count },
      ...this.bots.map((b) => b.getState()).map((s) => ({ name: s.name, color: s.color, score: s.score })),
    ];
    entries.sort((a, b) => b.score - a.score);

    const key = entries.map((e) => `${e.name}:${e.score}`).join("|");
    if (key !== this.lastBoardKey) {
      this.lastBoardKey = key;
      this.hud.onLeaderboard(entries.slice(0, 8));
    }
  }

  private resize(): void {
    const w = this.stage.clientWidth || 1;
    const h = this.stage.clientHeight || 1;
    this.cameraSys.setAspect(w / h);
    this.renderer.setSize(w, h, false);
  }
}
