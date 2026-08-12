/* ------------------------------------------------------------
   SnakeController.ts — Physique cinématique sur une planète sphérique
   La tête se déplace à la surface d'une sphère de rayon R :
   position = vecteur 3D de longueur R, cap mesuré dans le plan
   tangent (normal = direction radiale), repère transporté d'une
   frame à l'autre (pas d'aller-retour gauche/droite en dérivant).
   ------------------------------------------------------------ */

import { Vector3 } from "three";
import { SNAKE_CONFIG } from "./config";

const NORTH = new Vector3(0, 0, 1);

const _tmp = new Vector3();
const _tmp2 = new Vector3();

/** Projette un vecteur dans le plan tangent à `n` (normalisé). */
export function projectTangent(v: Vector3, n: Vector3, out: Vector3): Vector3 {
  out.copy(v).addScaledVector(n, -v.dot(n));
  if (out.lengthSq() < 1e-12) {
    out.set(n.z, 0, -n.x);
  }
  return out.normalize();
}

/** Tourne un vecteur tangent `from` autour de la normale `n` d'un angle. */
export function rotateTangent(
  n: Vector3,
  angle: number,
  from: Vector3,
  out: Vector3
): Vector3 {
  _tmp.crossVectors(n, from);
  out
    .copy(from)
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(_tmp, Math.sin(angle));
  return out;
}

/** Angle (signé) d'un vecteur tangent `dir` par rapport à `ref`, autour de `n`. */
export function tangentAngle(
  n: Vector3,
  ref: Vector3,
  dir: Vector3
): number {
  _tmp2.copy(ref);
  return Math.atan2(n.dot(_tmp2.cross(dir)), ref.dot(dir));
}

export class SnakeController {
  readonly pos = new Vector3();
  readonly prevPos = new Vector3();
  /** Tangente unitaire du cap courant (sur la surface). */
  readonly forward = new Vector3(0, 0, 1);
  /** Repère tangent de référence pour l'angle de cap. */
  private readonly refForward = new Vector3(0, 0, 1);
  private readonly normal = new Vector3();

  heading = 0; // cap relatif au repère transporté (0 = refForward)
  speed = 0;
  steerAngle: number | null = null; // cap cible en radians ou null
  isBoosting = false;
  /** Croisière : sans commande, le serpent continue d'avancer droit
      (style slither.io) au lieu de s'arrêter. Désactivé à la mort. */
  cruise = true;
  angularVelocity = 0; // pour le zoom/virage de la caméra
  /** Multiplicateur de virage (1 = nominal) — réduit quand le serpent grossit. */
  turnScale = 1;

  /** Normale radiale à la position courante (instance partagée — à copier). */
  get surfaceNormal(): Vector3 {
    return this.normal.copy(this.pos).normalize();
  }

  get reference(): Vector3 {
    return this.refForward;
  }

  reset(position: Vector3, heading: number): void {
    this.pos.copy(position);
    this.prevPos.copy(position);
    this.heading = heading;
    this.speed = 0;
    this.steerAngle = null;
    this.isBoosting = false;
    this.cruise = true;
    this.angularVelocity = 0;
    const n = this.surfaceNormal;
    projectTangent(NORTH, n, this.refForward);
    rotateTangent(n, heading, this.refForward, this.forward);
  }

  /** Réoriente le serpent face au "nord écran" (spawn sans désorientation). */
  faceNorth(): void {
    const n = this.surfaceNormal;
    this.heading = 0;
    projectTangent(NORTH, n, this.refForward);
    rotateTangent(n, 0, this.refForward, this.forward);
  }

  /** Dirige le cap vers un vecteur du monde projeté dans le plan tangent. */
  steerToward(worldDir: Vector3): void {
    const n = this.surfaceNormal;
    projectTangent(worldDir, n, _tmp);
    this.steerAngle = tangentAngle(n, this.refForward, _tmp);
  }

  /** Direction (tangente) vers laquelle la tête est commandée (ou le cap). */
  getSteerDir(out: Vector3): Vector3 {
    const n = this.surfaceNormal;
    if (this.steerAngle !== null) {
      return rotateTangent(n, this.steerAngle, this.refForward, out);
    }
    return out.copy(this.forward);
  }

  /** Retourne la vélocité angulaire actuelle (pour la caméra). */
  getAngularVelocity(): number {
    return this.angularVelocity;
  }

  step(dt: number, speedMul = 1): void {
    const target = this.steerAngle;

    /* Virage progressif avec meilleure réactivité */
    if (target !== null) {
      const delta = wrapAngle(target - this.heading);
      
      /* Virage plus réactif selon le delta (plus grand virage = plus rapide) */
      let turnSpeed = SNAKE_CONFIG.turnSpeed * this.turnScale;
      const sharpness = Math.abs(delta);
      
      /* Accélération du virage pour les changements aigus (style slither.io) */
      if (sharpness > Math.PI * 0.3) {
        turnSpeed *= 1.3; /* Boost de réactivité sur virage aigus */
      }

      const smoothFactor = 1 - Math.exp(-SNAKE_CONFIG.turnResponsiveness * dt);
      const desiredStep = delta * smoothFactor;
      const maxStep = turnSpeed * dt;
      const actualStep = clamp(desiredStep, -maxStep, maxStep);
      this.heading += actualStep;
      this.angularVelocity = actualStep / dt;
    } else {
      this.angularVelocity *= Math.exp(-8.0 * dt);
    }

    /* Vitesse cible avec accélération plus fluide */
    const baseMax = this.isBoosting ? SNAKE_CONFIG.boostMaxSpeed : SNAKE_CONFIG.maxSpeed;
    const sharp = target !== null ? Math.min(1, Math.abs(wrapAngle(target - this.heading)) / (Math.PI * 0.5)) : 0;
    const targetSpeed = target !== null || this.cruise
      ? baseMax * Math.max(0.6, 1 - 0.3 * sharp) * speedMul
      : 0;

    /* Accélération/décélération plus progressive */
    const accelRate = this.isBoosting 
      ? SNAKE_CONFIG.acceleration * 1.2 
      : SNAKE_CONFIG.acceleration;
    const decelRate = SNAKE_CONFIG.deceleration * 0.9;
    
    if (this.speed < targetSpeed) {
      this.speed = Math.min(targetSpeed, this.speed + accelRate * dt);
    } else {
      this.speed = Math.max(targetSpeed, this.speed - decelRate * dt);
    }

    /* Déplacement à la surface de la planète avec transport parallèle amélioré */
    const n = this.surfaceNormal;
    rotateTangent(n, this.heading, this.refForward, this.forward);
    this.refForward.copy(this.forward);

    this.prevPos.copy(this.pos);
    this.pos.addScaledVector(this.forward, this.speed * dt);
    this.pos.setLength(SNAKE_CONFIG.planetRadius);
  }
}

export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
