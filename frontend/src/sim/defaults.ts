import { INPUTS } from '../core/referenceModel';
import { TileInputs, BeamInputs } from './types';

/** Entradas por defecto de la simulación del stack (modo 33). */
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

/** Valida y corrige las entradas al rango permitido. */
export function clampTileInputs(p: Partial<TileInputs>): TileInputs {
  return {
    Fmax: clamp(p.Fmax ?? INPUTS.Fmax.def, INPUTS.Fmax.min, INPUTS.Fmax.max),
    cadence: clamp(p.cadence ?? INPUTS.cadence.def, INPUTS.cadence.min, INPUTS.cadence.max),
  };
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
