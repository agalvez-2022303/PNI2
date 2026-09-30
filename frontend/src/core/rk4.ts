/**
 * Integrador Runge-Kutta de 4º orden con paso adaptativo (step-doubling).
 * El control de error compara un paso completo h contra dos medios pasos h/2;
 * el error local de RK4 es O(h^5), así que err ≈ (y_half - y_full)/15.
 * Fuente: Press et al., "Numerical Recipes", cap. 17 (Runge-Kutta adaptativo).
 */
export type Deriv = (t: number, y: number[]) => number[];

export interface Sample {
  t: number;
  y: number[];
}

export interface AdaptiveOptions {
  h0?: number;
  hMin?: number;
  hMax?: number;
  absTol?: number;
  relTol?: number;
  /** Intervalo de muestreo para almacenar la salida (s). */
  sampleEvery?: number;
  maxSteps?: number;
}

function add(a: number[], b: number[], s: number): number[] {
  const out = new Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i] * s;
  return out;
}

/** Un paso RK4 de tamaño h. */
export function rk4Step(f: Deriv, t: number, y: number[], h: number): number[] {
  const k1 = f(t, y);
  const k2 = f(t + h / 2, add(y, k1, h / 2));
  const k3 = f(t + h / 2, add(y, k2, h / 2));
  const k4 = f(t + h, add(y, k3, h));
  const out = new Array(y.length);
  for (let i = 0; i < y.length; i++) {
    out[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  return out;
}

/** Integra dy/dt = f(t,y) de t0 a t1 con paso adaptativo, devolviendo muestras. */
export function integrateAdaptive(
  f: Deriv,
  y0: number[],
  t0: number,
  t1: number,
  opts: AdaptiveOptions = {}
): Sample[] {
  const span = t1 - t0;
  let h = opts.h0 ?? span / 2000;
  const hMin = opts.hMin ?? span / 5e6;
  const hMax = opts.hMax ?? span / 200;
  const absTol = opts.absTol ?? 1e-9;
  const relTol = opts.relTol ?? 1e-4;
  const sampleEvery = opts.sampleEvery ?? span / 600;
  const maxSteps = opts.maxSteps ?? 500000;

  let t = t0;
  let y = y0.slice();
  const out: Sample[] = [{ t, y: y.slice() }];
  let nextSample = t0 + sampleEvery;
  let steps = 0;

  while (t < t1 && steps < maxSteps) {
    steps++;
    if (t + h > t1) h = t1 - t;
    const yFull = rk4Step(f, t, y, h);
    const yHalf1 = rk4Step(f, t, y, h / 2);
    const yHalf2 = rk4Step(f, t + h / 2, yHalf1, h / 2);

    let err = 0;
    for (let i = 0; i < y.length; i++) {
      const scale = absTol + relTol * Math.max(Math.abs(y[i]), Math.abs(yHalf2[i]));
      const e = Math.abs(yHalf2[i] - yFull[i]) / 15;
      err = Math.max(err, e / scale);
    }

    if (err <= 1 || h <= hMin) {
      t += h;
      // extrapolación de Richardson: yHalf2 es más preciso que yFull
      y = yHalf2;
      while (nextSample <= t + 1e-15 && nextSample <= t1) {
        out.push({ t: nextSample, y: y.slice() });
        nextSample += sampleEvery;
      }
      const factor = err === 0 ? 4 : 0.9 * Math.pow(err, -0.2);
      h = Math.min(hMax, Math.max(hMin, h * Math.min(4, Math.max(0.25, factor))));
    } else {
      const factor = 0.9 * Math.pow(err, -0.25);
      h = Math.max(hMin, h * Math.max(0.1, factor));
    }
  }
  if (out[out.length - 1].t < t1 - 1e-12) out.push({ t, y: y.slice() });
  return out;
}
