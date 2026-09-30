/**
 * Constantes de cálculo y de barrido (unidades SI).
 *
 * El modelo físico NO vive aquí: materiales, geometría, circuito y excitaciones
 * están congelados en core/referenceModel.ts. Aquí sólo quedan los parámetros
 * numéricos del integrador y de los barridos, que no son físicos.
 */

/** Fracción de masa efectiva de una viga en voladizo (modo 1), teoría de Rayleigh. */
export const CANTILEVER_EFFECTIVE_MASS_FRACTION = 0.2427;

/** Parámetros numéricos del integrador y de los barridos. */
export const NUM = {
  /** Puntos por barrido de frecuencia en la FRF de la viga. */
  frfPoints: 600,
  /** Puntos del barrido potencia vs resistencia de carga. */
  rSweepPoints: 120,
  /** Número de modos de vibración retenidos (Euler-Bernoulli truncado). */
  nModes: 3,
} as const;
