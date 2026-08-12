/* ------------------------------------------------------------
   SnakeInput.ts — Contrôles façon slither.io :
   • Desktop : la souris pilote le serpent (il se dirige vers le
     curseur), clic gauche maintenu = Boost, flèches/WASD en secours.
   • Tactile : joystick analogique (apparaît au point de contact),
     bouton ⚡ = Boost.
   Produit une direction cible en radians, alignée sur l'écran :
   0 = droit devant, +π/2 = droite écran, −π/2 = gauche écran
   (la caméra orbitale projette +X à gauche de l'écran → angle inversé).
   ------------------------------------------------------------ */

const JOY_RADIUS = 56; // px
const JOY_DEADZONE = 0.16;
const MOUSE_DEADZONE = 16; // px autour du centre de l'écran

const UI_SELECTOR = "button, input, select, textarea, a, [data-ui]";

export class SnakeInput {
  private readonly keys = new Set<string>();
  private joyActive = false;
  private joyX = 0;
  private joyZ = 0;
  private joyPointer = -1;
  private joyBaseX = 0;
  private joyBaseY = 0;
  private stage: HTMLElement | null = null;
  private baseEl: HTMLDivElement | null = null;
  private knobEl: HTMLDivElement | null = null;
  private active = false;
  private touchBoost = false;

  private isTouch = false;
  private mouseActive = false;
  private mouseBoost = false;
  private mouseX = 0;
  private mouseY = 0;

  /* Lissage du curseur pour une meilleure réactivité */
  private smoothAngle: number | null = null;
  private lastAngle: number | null = null;

  setActive(v: boolean): void {
    this.active = v;
    if (!v) {
      this.joyActive = false;
      this.joyPointer = -1;
      this.touchBoost = false;
      this.mouseBoost = false;
      this.mouseActive = false;
      if (this.baseEl) this.baseEl.style.opacity = "0";
    }
  }

  setTouchBoost(active: boolean): void {
    this.touchBoost = active;
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "Space" || e.code === "ShiftLeft") {
      e.preventDefault();
    }
    this.keys.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.(UI_SELECTOR)) return;

    /* Desktop : clic gauche maintenu = boost (style slither.io) */
    if (this.isTouch) {
      if (!this.active || this.joyPointer !== -1 || !this.baseEl || !this.knobEl) return;
      this.joyPointer = e.pointerId;
      const rect = this.stage?.getBoundingClientRect();
      if (!rect) return;
      this.joyBaseX = e.clientX - rect.left;
      this.joyBaseY = e.clientY - rect.top;
      this.baseEl.style.left = `${this.joyBaseX}px`;
      this.baseEl.style.top = `${this.joyBaseY}px`;
      this.baseEl.style.opacity = "1";
      this.knobEl.style.translate = "0px 0px";
      this.joyActive = true;
      this.joyX = 0;
      this.joyZ = 0;
      this.stage?.setPointerCapture?.(e.pointerId);
    } else if (e.button === 0 && this.active) {
      this.mouseBoost = true;
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.(UI_SELECTOR)) {
      this.mouseActive = false;
      return;
    }
    if (this.isTouch) {
      if (!this.joyActive || e.pointerId !== this.joyPointer || !this.knobEl) return;
      const rect = this.stage?.getBoundingClientRect();
      if (!rect) return;
      let dx = e.clientX - rect.left - this.joyBaseX;
      let dy = e.clientY - rect.top - this.joyBaseY;
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) {
        dx = (dx / len) * JOY_RADIUS;
        dy = (dy / len) * JOY_RADIUS;
      }
      this.knobEl.style.translate = `${dx}px ${dy}px`;
      this.joyX = dx / JOY_RADIUS;
      this.joyZ = -dy / JOY_RADIUS;
    } else {
      this.mouseActive = true;
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.joyPointer && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    if (this.isTouch) {
      if (e.pointerId !== this.joyPointer) return;
      this.joyActive = false;
      this.joyPointer = -1;
      if (this.baseEl) this.baseEl.style.opacity = "0";
    } else {
      this.mouseBoost = false;
    }
  };

  private readonly onPointerLeave = (): void => {
    this.mouseActive = false;
  };

  attach(stage: HTMLElement): void {
    this.stage = stage;
    this.isTouch = window.matchMedia("(pointer: coarse)").matches;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    stage.addEventListener("pointerdown", this.onPointerDown);
    stage.addEventListener("pointermove", this.onPointerMove);
    stage.addEventListener("pointerup", this.onPointerUp);
    stage.addEventListener("pointercancel", this.onPointerUp);
    stage.addEventListener("pointerleave", this.onPointerLeave);

    if (this.isTouch) {
      const base = document.createElement("div");
      base.className = "snk-joy";
      const knob = document.createElement("div");
      knob.className = "snk-joy__knob";
      base.appendChild(knob);
      stage.appendChild(base);
      this.baseEl = base;
      this.knobEl = knob;
    }
  }

  detach(): void {
    const stage = this.stage;
    if (stage) {
      stage.removeEventListener("pointerdown", this.onPointerDown);
      stage.removeEventListener("pointermove", this.onPointerMove);
      stage.removeEventListener("pointerup", this.onPointerUp);
      stage.removeEventListener("pointercancel", this.onPointerUp);
      stage.removeEventListener("pointerleave", this.onPointerLeave);
      if (this.baseEl && this.baseEl.parentNode === stage) {
        stage.removeChild(this.baseEl);
      }
    }
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.baseEl = null;
    this.knobEl = null;
    this.stage = null;
    this.joyActive = false;
    this.joyPointer = -1;
  }

  sample(): number | null {
    if (!this.active) return null;
    let kx = 0;
    let kz = 0;
    if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) kz += 1;
    if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) kz -= 1;
    if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) kx += 1;
    if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) kx -= 1;
    
    let angle: number | null = null;
    
    /* Priorité aux touches clavier (plus direct, pour le gameplay compétitif) */
    if (kx !== 0 || kz !== 0) {
      angle = Math.atan2(kx, kz);
      this.smoothAngle = null;
      this.lastAngle = angle; /* Reset smoothing immédiatement au clavier */
    } else if (this.isTouch) {
      if (this.joyActive) {
        const len = Math.hypot(this.joyX, this.joyZ);
        if (len > JOY_DEADZONE) angle = Math.atan2(this.joyX, this.joyZ);
      }
    } else if (this.mouseActive && this.stage) {
      /* Direction vers le curseur avec deadzone adaptatif (style slither.io) */
      const rect = this.stage.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = this.mouseX - centerX;
      const dy = this.mouseY - centerY;
      const distFromCenter = Math.hypot(dx, dy);
      
      /* Deadzone adaptatif : plus grand sur écrans plus larges (meilleure ergonomie) */
      const screenDiag = Math.hypot(rect.width, rect.height);
      const adaptiveDeadzone = Math.max(MOUSE_DEADZONE, screenDiag * 0.07);
      
      if (distFromCenter > adaptiveDeadzone) {
        angle = Math.atan2(dx, -dy);
      }
    }
    
    if (angle === null) {
      this.smoothAngle = null;
      this.lastAngle = null;
      return null;
    }
    
    /* Convention caméra : inversion du signe pour cohérence */
    angle = -angle;
    
    /* Lissage agressif de l'angle pour éviter les saccades (style slither.io) */
    if (this.lastAngle === null) {
      this.lastAngle = angle;
      this.smoothAngle = angle;
    } else {
      /* Gestion des discontinuités au -π/π */
      let delta = angle - this.lastAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      
      /* Lissage exponentiel : 18% changement par frame pour feel réactif */
      const smooth = 0.18;
      this.smoothAngle = this.lastAngle + delta * smooth;
      this.lastAngle = angle;
    }
    
    return this.smoothAngle;
  }

  isBoostActive(): boolean {
    if (!this.active) return false;
    return (
      this.mouseBoost ||
      this.touchBoost ||
      this.keys.has("Space") ||
      this.keys.has("ShiftLeft") ||
      this.keys.has("ShiftRight") ||
      this.keys.has("KeyE")
    );
  }
}
