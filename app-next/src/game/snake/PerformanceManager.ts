/* ------------------------------------------------------------
   PerformanceManager.ts — Ajustement dynamique des profils graphiques
   Détecte automatiquement mobile/desktop, surveille le FPS et sélectionne
   le profil optimal (LOW, MEDIUM, HIGH) pour garantir 60 FPS constants.
   ------------------------------------------------------------ */

import { SNAKE_CONFIG, type QualityProfile } from "./config";

export class PerformanceManager {
  currentProfile: QualityProfile;
  private frameCount = 0;
  private timeAcc = 0;
  private fps = 60;

  constructor() {
    const isTouch =
      typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;

    if (isTouch || memory <= 3 || cores <= 4) {
      this.currentProfile = SNAKE_CONFIG.profiles.MEDIUM;
    } else {
      this.currentProfile = SNAKE_CONFIG.profiles.HIGH;
    }
  }

  update(dt: number): void {
    this.frameCount++;
    this.timeAcc += dt;
    if (this.timeAcc >= 1.0) {
      this.fps = this.frameCount / this.timeAcc;
      this.frameCount = 0;
      this.timeAcc = 0;

      /* Si le FPS tombe en dessous de 42 sur 1 seconde, rétrograder le profil */
      if (this.fps < 42 && this.currentProfile.name === "HIGH") {
        this.currentProfile = SNAKE_CONFIG.profiles.MEDIUM;
      } else if (this.fps < 30 && this.currentProfile.name === "MEDIUM") {
        this.currentProfile = SNAKE_CONFIG.profiles.LOW;
      }
    }
  }

  get currentFps(): number {
    return Math.round(this.fps);
  }
}
