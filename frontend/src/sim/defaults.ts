import { TileParams, BeamParams } from './types';

/** Configuración por defecto de la baldosa (caso demostrativo, no el de referencia). */
export const DEFAULT_TILE: TileParams = {
  piezoId: 'pzt5a',
  diameter: 20e-3,
  thickness: 1e-3,
  nLayers: 10,
  Fmax: 700,
  T: 0.3,
  Cs: 100e-6,
  Rload: 100e3,
  Vdiode: 0.7,
  nDiodes: 2,
  scaleFactor: 40,
  walkMode: false,
  walkFreq: 1.8,
  walkSteps: 6,
};

/** Configuración por defecto de la viga bimorfa. */
export const DEFAULT_BEAM: BeamParams = {
  piezoId: 'pzt5a',
  substrateId: 'laton',
  length: 60e-3,
  width: 20e-3,
  tSub: 0.5e-3,
  tPiezo: 0.25e-3,
  tipMass: 5e-3,
  a0: 2,
  zetaT: 0.03,
  lossFactor: 0.5,
  Rload: 100e3,
  freqMin: 10,
  freqMax: 300,
  scaleFactor: 1500,
};

/** Rangos de sliders para la UI (todo en unidades de presentación). */
export const RANGES = {
  tile: {
    nLayers: { min: 1, max: 50, step: 1 },
    diameterMm: { min: 5, max: 50, step: 0.5 },
    thicknessMm: { min: 0.2, max: 5, step: 0.1 },
    Fmax: { min: 300, max: 1000, step: 10 },
    walkFreq: { min: 1, max: 2.5, step: 0.1 },
    walkSteps: { min: 2, max: 20, step: 1 },
    scaleFactor: { min: 1, max: 200, step: 1 },
  },
  beam: {
    lengthMm: { min: 20, max: 120, step: 1 },
    widthMm: { min: 5, max: 40, step: 1 },
    tSubMm: { min: 0.1, max: 2, step: 0.05 },
    tPiezoMm: { min: 0.05, max: 1, step: 0.05 },
    tipMassG: { min: 0, max: 30, step: 0.5 },
    a0: { min: 0.5, max: 20, step: 0.5 },
    zetaT: { min: 0.005, max: 0.1, step: 0.005 },
    lossFactor: { min: 0.1, max: 1, step: 0.05 },
    scaleFactor: { min: 100, max: 5000, step: 50 },
  },
};
