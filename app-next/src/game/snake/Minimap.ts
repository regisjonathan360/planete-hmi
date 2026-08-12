/* ------------------------------------------------------------
   Minimap.ts — Radar 2D de la planète (coin de l'écran)
   Projection orthographique locale au joueur : la tête du serpent
   est au centre, "haut" = cap du joueur, "droite" = droite écran.
   Affiche la nourriture proche, les serpents IA et le joueur,
   pour se repérer sur la planète (pas de murs = besoin de boussole).
   ------------------------------------------------------------ */

import * as THREE from "three";
import type { FoodManager } from "./FoodManager";
import type { AISnake } from "./AISnake";

const RANGE = 90; // unités de monde visibles autour de la tête
const SIZE = 128; // taille du canvas en px

export class Minimap {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly right = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly d = new THREE.Vector3();

  constructor(stage: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.className = "snk-minimap";
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas 2d");
    this.ctx = ctx;
    stage.appendChild(this.canvas);
  }

  /** Dessine le radar à la position de la tête du joueur. */
  draw(
    head: THREE.Vector3,
    forward: THREE.Vector3,
    playerColor: number,
    foodMgr: FoodManager,
    bots: AISnake[]
  ): void {
    const ctx = this.ctx;
    const c = SIZE / 2;
    const pxPerUnit = (c - 4) / RANGE;

    ctx.clearRect(0, 0, SIZE, SIZE);

    /* Fond + anneau */
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(8, 7, 13, 0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 178, 0, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* Base : droite écran = forward × normale, haut = forward */
    this.fwd.copy(forward).normalize();
    this.right.crossVectors(this.fwd, head).normalize();

    /* Nourriture (points discrets, uniquement dans le rayon) */
    const food = foodMgr.findNear(head, this.right, this.fwd, RANGE);
    for (let i = 0; i < food.length; i++) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = food[i].color;
      ctx.beginPath();
      ctx.arc(c + food[i].x * pxPerUnit, c - food[i].y * pxPerUnit, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* Serpents IA : point coloré + anneau */
    for (const bot of bots) {
      if (!bot.alive) continue;
      const p = bot.controller.pos;
      this.d.copy(p).sub(head);
      const sx = this.d.dot(this.right);
      const sy = this.d.dot(this.fwd);
      if (sx * sx + sy * sy > RANGE * RANGE) continue;
      ctx.fillStyle = `#${bot.color.toString(16).padStart(6, "0")}`;
      ctx.beginPath();
      ctx.arc(c + sx * pxPerUnit, c - sy * pxPerUnit, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }

    /* Joueur : flèche au centre (cap = haut du radar) */
    ctx.fillStyle = `#${playerColor.toString(16).padStart(6, "0")}`;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(c, c - 9);
    ctx.lineTo(c + 7, c + 7);
    ctx.lineTo(c - 7, c + 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    /* Croix centrale discrète */
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c, c - 2);
    ctx.lineTo(c, c + 2);
    ctx.moveTo(c - 2, c);
    ctx.lineTo(c + 2, c);
    ctx.stroke();
  }

  dispose(): void {
    this.canvas.remove();
  }
}
