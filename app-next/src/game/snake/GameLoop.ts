/* ------------------------------------------------------------
   GameLoop — boucle requestAnimationFrame à pas fixe
   La physique est avancée par pas de durée constante (fixed Hz),
   indépendamment du taux de rafraîchissement réel. Le rendu est
   appelé avec l'alpha d'interpolation entre deux pas physiques,
   ce qui garantit une fluidité parfaite sur écrans 60/90/120 Hz.
   ------------------------------------------------------------ */

export class GameLoop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  private readonly step: number;

  constructor(
    hz: number,
    private readonly onFixed: (dt: number) => void,
    private readonly onRender: (dt: number, alpha: number) => void
  ) {
    this.step = 1 / hz;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const tick = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.05) dt = 0.05; // évite l'effet "spiral of death" après un lag
      this.acc += dt;
      let n = 0;
      while (this.acc >= this.step && n < 8) {
        this.onFixed(this.step);
        this.acc -= this.step;
        n++;
      }
      if (n === 8) this.acc = 0; // trop de retard : on laisse tomber l'accumulateur
      this.onRender(dt, this.acc / this.step);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
