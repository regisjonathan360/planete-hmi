/* ------------------------------------------------------------
   NameSprite.ts — Étiquette de nom au-dessus d'un serpent
   Sprite billboard avec texte dessiné sur canvas (aucun asset).
   ------------------------------------------------------------ */

import * as THREE from "three";

export function createNameSprite(name: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unavailable");

  ctx.font = "bold 32px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.65)";
  ctx.strokeText(name, 128, 32);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(name, 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.4, 0.85, 1);
  return sprite;
}

/** Redessine le texte d'une étiquette existante (changement de pseudo). */
export function updateNameSprite(sprite: THREE.Sprite, name: string): void {
  const mat = sprite.material as THREE.SpriteMaterial;
  const tex = mat.map;
  if (!tex) return;
  const image = tex.image as HTMLCanvasElement | null;
  if (!image) return;
  const ctx = image.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, image.width, image.height);
  ctx.font = "bold 32px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.65)";
  ctx.strokeText(name, 128, 32);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(name, 128, 32);
  tex.needsUpdate = true;
}

export function disposeNameSprite(sprite: THREE.Sprite): void {
  const mat = sprite.material as THREE.SpriteMaterial;
  mat.map?.dispose();
  mat.dispose();
}
