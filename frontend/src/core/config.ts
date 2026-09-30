/**
 * Constantes físicas y de configuración globales (unidades SI).
 * Sin números mágicos: todo parámetro base vive aquí o en los archivos de defaults.
 * Fuente: IEEE Std 176-1987 (Standard on Piezoelectricity).
 */
export const PHYS = {
  /** Permitividad del vacío ε0 [F/m]. */
  EPS0: 8.854e-12,
  /** Aceleración de la gravedad estándar g [m/s²]. */
  G: 9.80665,
} as const;

/** Fracción de masa efectiva de una viga en voladizo (modo 1), teoría de Rayleigh. */
export const CANTILEVER_EFFECTIVE_MASS_FRACTION = 0.2427;

/** Parámetros numéricos del integrador y de los barridos. */
export const NUM = {
  /** Puntos por barrido de frecuencia en la FRF de la viga. */
  frfPoints: 600,
  /** Puntos del barrido potencia vs resistencia de carga. */
  rSweepPoints: 120,
  /** Puntos del barrido potencia vs masa de punta. */
  massSweepPoints: 80,
  /** Número de modos de vibración retenidos (Euler-Bernoulli truncado). */
  nModes: 3,
} as const;
