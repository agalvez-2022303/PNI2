import { INPUTS } from '../core/referenceModel';
import { TileInputs, BeamInputs } from './types';

/**
 * Entradas por defecto de la simulación del stack (modo 33).
 *
 * `nSteps` NO se fija aquí a propósito: sin él, el solver integra hasta el
 * régimen estacionario, que es el comportamiento verificado por P1–P12. La
 * interfaz ofrece 1, 10 y 50 pisadas como opciones explícitas.
 */
export const DEFAULT_TILE_INPUTS: TileInputs = Object.freeze({
  Fmax: INPUTS.Fmax.def,
  cadence: INPUTS.cadence.def,
});

/** Entradas por defecto de la simulación de la viga (modo 31). */
export const DEFAULT_BEAM_INPUTS: BeamInputs = Object.freeze({
  a0: INPUTS.a0.def,
  fExc: INPUTS.fExc.def,
});

/**
 * Rangos de las ÚNICAS entradas editables por el usuario. Los valores vienen
 * del modelo de referencia; aquí sólo se reexportan para la interfaz, junto con
 * el paso del slider en unidades de presentación.
 */
export const RANGES = {
  tile: {
    Fmax: { ...INPUTS.Fmax, unit: 'N' },
    cadence: { ...INPUTS.cadence, unit: 'pasos/min' },
  },
  beam: {
    a0: { ...INPUTS.a0, unit: 'm/s²' },
    fExc: { ...INPUTS.fExc, unit: 'Hz' },
  },
} as const;

/** Valores admitidos del número de pisadas por corrida. */
export const N_STEPS_CHOICES = [1, 10, 50] as const;

/**
 * Valida y corrige las entradas al rango permitido.
 *
 * `nSteps` es opcional: si no viene, el solver integra hasta régimen
 * estacionario. Si viene, se acota a los valores que la interfaz ofrece, para
 * que un número absurdo no pueda alargar la corrida.
 */
export function clampTileInputs(p: Partial<TileInputs>): TileInputs {
  const out: TileInputs = {
    Fmax: clamp(p.Fmax ?? INPUTS.Fmax.def, INPUTS.Fmax.min, INPUTS.Fmax.max),
    cadence: clamp(p.cadence ?? INPUTS.cadence.def, INPUTS.cadence.min, INPUTS.cadence.max),
  };
  if (typeof p.nSteps === 'number' && isFinite(p.nSteps)) {
    // Se admite cualquier entero ≥ 1; la interfaz sólo ofrece 1, 10 y 50.
    out.nSteps = clamp(Math.round(p.nSteps), 1, 200);
  }
  return out;
}

/** Valida y corrige las entradas al rango permitido. */
export function clampBeamInputs(p: Partial<BeamInputs>): BeamInputs {
  return {
    a0: clamp(p.a0 ?? INPUTS.a0.def, INPUTS.a0.min, INPUTS.a0.max),
    fExc: clamp(p.fExc ?? INPUTS.fExc.def, INPUTS.fExc.min, INPUTS.fExc.max),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}
