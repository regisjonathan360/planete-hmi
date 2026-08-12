/* ------------------------------------------------------------
   SnakeCamera.ts — Caméra isométrique orbitale style Snake Rivals
   Vue du dessus de la surface de la planète : la caméra reste à
   hauteur constante au-dessus de la normale radiale, décalée en
   arrière du cap. "Haut d'écran" = direction du serpent.
   ------------------------------------------------------------ */

import * as THREE from "three";
import { SNAKE_CONFIG } from "./config";

export class SnakeCamera {
  readonly camera = new THREE.PerspectiveCamera(SNAKE_CONFIG.cameraFov, 1, 0.5, 800);

  private readonly smoothPos = new THREE.Vector3();
  private readonly smoothTarget = new THREE.Vector3();
  private readonly wantPos = new THREE.Vector3();
  private readonly wantTarget = new THREE.Vector3();

  private readonly n = new THREE.Vector3();
  private readonly smFwd = new THREE.Vector3(0, 0, 1);
  private readonly tmpFwd = new THREE.Vector3();
  private fov = SNAKE_CONFIG.cameraFov;

  update(
    dt: number,
    head: THREE.Vector3,
    forward: THREE.Vector3,
    speed: number,
    _angularVelocity: number,
    isBoosting: boolean,
    segs: number
  ): void {
    const kFwd = 1 - Math.exp(-4.0 * dt);
    const kPos = 1 - Math.exp(-2.5 * dt);
    const kFov = 1 - Math.exp(-3.0 * dt);

    /* Avant lissé (anticipation direction) */
    this.tmpFwd.copy(forward).normalize();
    this.smFwd.lerp(this.tmpFwd, kFwd).normalize();

    /* Normale radiale + cible de regard devant la tête */
    this.n.copy(head).normalize();
    const lookAhead = SNAKE_CONFIG.lookAheadDistance + (speed / SNAKE_CONFIG.maxSpeed) * 2.0;
    this.wantTarget.copy(head).addScaledVector(this.smFwd, lookAhead);
    this.wantTarget.setLength(SNAKE_CONFIG.planetRadius);

    /* Position caméra : au-dessus de la surface, léger décalage arrière */
    const sizeBonus = Math.min(segs * 0.03, 12.0);
    const height = SNAKE_CONFIG.cameraHeight + sizeBonus;
    const back = SNAKE_CONFIG.cameraDistance + sizeBonus * 0.5;
    this.wantPos
      .copy(this.wantTarget)
      .addScaledVector(this.n, height)
      .addScaledVector(this.smFwd, -back);

    this.smoothPos.lerp(this.wantPos, kPos);
    this.smoothTarget.lerp(this.wantTarget, kPos);
    this.camera.position.copy(this.smoothPos);
    /* Up = normale locale : orientation stable aux pôles (pas de roulis),
       et "droite écran" = forward × normale, quelle que soit la position. */
    this.camera.up.copy(this.n);
    this.camera.lookAt(this.smoothTarget);

    /* FOV dynamique : 48 → 55 */
    const fovTarget = isBoosting
      ? SNAKE_CONFIG.cameraMaxFov
      : SNAKE_CONFIG.cameraNormalFov +
        (speed / SNAKE_CONFIG.maxSpeed) * (SNAKE_CONFIG.cameraFastFov - SNAKE_CONFIG.cameraNormalFov);
    this.fov += (fovTarget - this.fov) * kFov;
    if (Math.abs(this.camera.fov - this.fov) > 0.02) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  reset(head: THREE.Vector3, forward: THREE.Vector3): void {
    this.smFwd.copy(forward).normalize();
    this.n.copy(head).normalize();
    this.smoothTarget.copy(head);
    this.smoothPos
      .copy(head)
      .addScaledVector(this.n, SNAKE_CONFIG.cameraHeight)
      .addScaledVector(this.smFwd, -SNAKE_CONFIG.cameraDistance);
    this.camera.up.copy(this.n);
    this.fov = SNAKE_CONFIG.cameraFov;
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }
}
