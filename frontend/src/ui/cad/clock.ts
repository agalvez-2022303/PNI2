/**
 * Reloj de pisada compartido.
 *
 * El visor 3D, el brillo del LED y el esquema eléctrico leen TODOS de esta
 * misma fuente, así que no pueden desfasarse entre sí: en un mismo cuadro
 * ven exactamente la misma fase de la pisada.
 */
export class StepClock {
  /** Tiempo dentro de la pisada [s], 0 ≤ t < Tp. */
  t = 0;
  /** Fase normalizada 0..1 dentro de la pisada. */
  phase = 0;
  /** Número de pisada completa ya mostrada (contador monótono). */
  cycle = 0;
  /** Corre en tiempo real: la cadencia viene del usuario. */
  running = true;

  private acc = 0;

  constructor(public Tp: number) {}

  /** Avanza el reloj. Devuelve true si el cuadro cruzó el fin de pisada. */
  advance(dt: number): boolean {
    if (!this.running || this.Tp <= 0) return false;
    this.acc += dt;
    const period = this.Tp;
    if (this.acc >= period) {
      const n = Math.floor(this.acc / period);
      this.acc -= n * period;
      this.cycle += n;
    }
    this.t = this.acc;
    this.phase = this.acc / period;
    return true;
  }

  /** Reinicia la fase sin tocar el contador de ciclos. */
  rewind() {
    this.acc = 0;
    this.t = 0;
    this.phase = 0;
  }

  setPeriod(Tp: number) {
    this.Tp = Tp;
  }
}

/** Interpolación lineal de una serie en el instante t. */
export function sampleSeries(xs: number[], ys: number[], t: number): number {
  const n = xs.length;
  if (n === 0) return 0;
  if (n === 1) return ys[0];
  if (t <= xs[0]) return ys[0];
  if (t >= xs[n - 1]) return ys[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= t) lo = mid;
    else hi = mid;
  }
  const span = xs[hi] - xs[lo];
  const f = span > 0 ? (t - xs[lo]) / span : 0;
  return ys[lo] + (ys[hi] - ys[lo]) * f;
}
